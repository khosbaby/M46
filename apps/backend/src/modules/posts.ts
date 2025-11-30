import { supabase } from '../supabase';
import { z } from 'zod';

const PostRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  duration_seconds: z.number(),
  resolution: z.string(),
  storage_key: z.string(),
  ai_score: z.number().nullable().optional(),
  sensitive: z.boolean(),
  created_at: z.string(),
  owner_id: z.string(),
});

const TagRow = z.object({
  tag: z.string(),
  trust: z.number().nullable().optional(),
});

const StatRow = z.object({
  views: z.number().nullable().optional(),
  watch_seconds: z.number().nullable().optional(),
  bookmarks: z.number().nullable().optional(),
  follows: z.number().nullable().optional(),
  popularity: z.number().nullable().optional(),
});

const UserRow = z.object({
  id: z.string(),
  handle: z.string(),
});

const ProfileRow = z.object({
  user_id: z.string(),
  display_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
});

const CommentRow = z.object({
  id: z.string(),
  post_id: z.string(),
  author_id: z.string().nullable(),
  body: z.string(),
  created_at: z.string(),
});

const PostListRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  duration_seconds: z.number(),
  resolution: z.string(),
  storage_key: z.string(),
  created_at: z.string(),
  app_users: z.object({
    handle: z.string(),
  }),
});

const CreatePostInput = z.object({
  ownerId: z.string().uuid(),
  title: z
    .string()
    .min(1)
    .max(120)
    .transform(value => value.trim()),
  description: z
    .string()
    .min(1)
    .max(4000)
    .transform(value => value.trim()),
  storageKey: z
    .string()
    .refine(value => /^https?:\/\//i.test(value.trim()), 'storage_key_must_be_http_url'),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(30),
  resolution: z
    .string()
    .regex(/^[0-9]+x[0-9]+$/i, 'invalid_resolution_format')
    .refine(value => {
      const [widthStr, heightStr] = value.toLowerCase().split('x');
      const width = Number(widthStr);
      const height = Number(heightStr);
      return Number.isFinite(width) && Number.isFinite(height) && height > width && width >= 360 && height <= 2400;
    }, 'resolution_must_be_vertical_and_within_bounds'),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(48)
        .transform(value => value.toLowerCase())
    )
    .max(10)
    .optional()
    .default([]),
});

export type PostDetail = z.infer<typeof PostRow>;

async function fetchPostRow(id: string) {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error) throw error;
  return PostRow.parse(data);
}

async function fetchTags(postId: string) {
  const { data, error } = await supabase.from('ai_tags').select('tag, trust').eq('post_id', postId);
  if (error) throw error;
  return z.array(TagRow).parse(data ?? []);
}

async function fetchStats(postId: string) {
  const { data, error } = await supabase.from('post_stats').select('views,watch_seconds,bookmarks,follows,popularity').eq('post_id', postId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? StatRow.parse(data) : null;
}

async function fetchUser(userId: string) {
  const { data, error } = await supabase.from('app_users').select('id, handle').eq('id', userId).single();
  if (error) throw error;
  return UserRow.parse(data);
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('creator_profiles').select('user_id, display_name, avatar, bio, tagline').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? ProfileRow.parse(data) : null;
}

async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, author_id, body, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return z.array(CommentRow).parse(data ?? []);
}

async function fetchUsersById(ids: string[]) {
  if (!ids.length) return new Map<string, z.infer<typeof UserRow>>();
  const { data, error } = await supabase.from('app_users').select('id, handle').in('id', ids);
  if (error) throw error;
  const rows = z.array(UserRow).parse(data ?? []);
  const map = new Map<string, z.infer<typeof UserRow>>();
  rows.forEach(row => map.set(row.id, row));
  return map;
}

async function fetchProfilesByUser(ids: string[]) {
  if (!ids.length) return new Map<string, z.infer<typeof ProfileRow> | null>();
  const { data, error } = await supabase.from('creator_profiles').select('user_id, display_name, avatar, bio, tagline').in('user_id', ids);
  if (error) throw error;
  const rows = z.array(ProfileRow).parse(data ?? []);
  const map = new Map<string, z.infer<typeof ProfileRow>>();
  rows.forEach(row => map.set(row.user_id, row));
  return map;
}

function buildAuthorPayload(user: z.infer<typeof UserRow>, profile: z.infer<typeof ProfileRow> | null) {
  return {
    handle: user.handle,
    displayName: profile?.display_name ?? user.handle,
    avatar: profile?.avatar ?? null,
    bio: profile?.bio ?? null,
    tagline: profile?.tagline ?? null,
  };
}

export async function fetchPostDetail(id: string) {
  const post = await fetchPostRow(id);
  const [tags, stats, owner, ownerProfile, commentRows] = await Promise.all([
    fetchTags(post.id),
    fetchStats(post.id),
    fetchUser(post.owner_id),
    fetchProfile(post.owner_id),
    fetchComments(post.id),
  ]);
  const commentAuthorIds = Array.from(
    new Set(commentRows.map(row => row.author_id).filter((value): value is string => Boolean(value)))
  );
  const [commentUsers, commentProfiles] = await Promise.all([fetchUsersById(commentAuthorIds), fetchProfilesByUser(commentAuthorIds)]);

  return {
    ...post,
    ai_tags: tags,
    tags: tags.map(tag => tag.tag),
    post_stats: stats
      ? {
          views: stats.views ?? 0,
          watch_seconds: stats.watch_seconds ?? 0,
          bookmarks: stats.bookmarks ?? 0,
          follows: stats.follows ?? 0,
          popularity: stats.popularity ?? 0,
        }
      : undefined,
    popularity: stats?.popularity ?? post.ai_score ?? 0,
    author: buildAuthorPayload(owner, ownerProfile),
    author_handle: owner.handle,
    author_display: ownerProfile?.display_name ?? owner.handle,
    author_avatar: ownerProfile?.avatar ?? null,
    comments: commentRows.map(row => {
      const user = row.author_id ? commentUsers.get(row.author_id) : null;
      const profile = row.author_id ? commentProfiles.get(row.author_id) : null;
      return {
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        author: user ? buildAuthorPayload(user, profile ?? null) : null,
      };
    }),
  };
}

export async function listPosts(limit = 50) {
  const { data, error } = await supabase
    .from('posts')
    .select('id,title,description,storage_key,duration_seconds,resolution,created_at,app_users:owner_id(handle)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return z.array(PostListRow).parse(data).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    storageKey: row.storage_key,
    durationSeconds: row.duration_seconds,
    resolution: row.resolution,
    createdAt: row.created_at,
    authorHandle: row.app_users.handle,
  }));
}

export async function createPost(input: {
  ownerId: string;
  title: string;
  description: string;
  storageKey: string;
  durationSeconds: number;
  resolution: string;
  tags: string[];
}) {
  const payload = CreatePostInput.parse(input);
  const { data, error } = await supabase
    .from('posts')
    .insert({
      owner_id: payload.ownerId,
      title: payload.title,
      description: payload.description,
      storage_key: payload.storageKey.trim(),
      duration_seconds: payload.durationSeconds,
      resolution: payload.resolution,
    })
    .select('*')
    .single();
  if (error) throw error;
  if (payload.tags.length) {
    await supabase.from('ai_tags').upsert(
      payload.tags.map(tag => ({
        post_id: data.id,
        tag,
        trust: 0.7,
      }))
    );
  }
  return PostRow.parse(data);
}
