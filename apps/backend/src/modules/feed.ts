import { supabase } from '../supabase';
import { z } from 'zod';

const BaseFeedRow = z.object({
  id: z.string(),
});

const PostRow = z.object({
  id: z.string(),
  owner_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  resolution: z.string().nullable(),
  storage_key: z.string().nullable(),
  created_at: z.string(),
  sensitive: z.boolean().nullable().optional(),
  ai_score: z.number().nullable().optional(),
});

const TagRow = z.object({
  post_id: z.string(),
  tag: z.string(),
  trust: z.number().nullable().optional(),
});

const StatRow = z.object({
  post_id: z.string(),
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

type PostRowData = z.infer<typeof PostRow>;
type TagRowData = z.infer<typeof TagRow>;
type StatRowData = z.infer<typeof StatRow>;
type UserRowData = z.infer<typeof UserRow>;
type ProfileRowData = z.infer<typeof ProfileRow>;

export type FeedItem = {
  id: string;
  title: string;
  description: string;
  duration_seconds: number;
  resolution: string;
  storage_key: string;
  created_at: string;
  sensitive: boolean;
  ai_score: number | null | undefined;
  ai_tags: { tag: string; trust?: number | null }[];
  tags: string[];
  post_stats?: {
    views: number;
    watch_seconds: number;
    bookmarks: number;
    follows: number;
    popularity: number;
  };
  popularity: number;
  author_handle: string | null;
  author_display: string | null;
  author_avatar: string | null;
  author?: {
    handle: string;
    displayName: string;
    avatar: string | null;
    bio: string | null;
    tagline: string | null;
  };
};

function groupByPost<T extends { post_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.post_id) ?? [];
    list.push(row);
    map.set(row.post_id, list);
  }
  return map;
}

const FEED_LIMIT = 60;

async function fetchRpcBaseRows(tag?: string) {
  const rpc = tag ? supabase.rpc('feed_by_tag', { p_tag: tag }) : supabase.rpc('feed_default');
  const { data, error } = await rpc;
  if (error) throw error;
  const rows = z.array(BaseFeedRow).parse(data ?? []);
  return rows.map(row => row.id);
}

async function fetchRecentPostIds(limit = 40) {
  const { data, error } = await supabase
    .from('posts')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(row => row.id);
}

async function fetchBaseRows(tag?: string) {
  const orderedIds = await fetchRpcBaseRows(tag);
  if (!tag) {
    const recentIds = await fetchRecentPostIds(40);
    const seen = new Set(orderedIds);
    for (const id of recentIds) {
      if (!seen.has(id)) {
        orderedIds.push(id);
        seen.add(id);
      }
      if (orderedIds.length >= FEED_LIMIT) break;
    }
  }
  return orderedIds.slice(0, FEED_LIMIT);
}

async function fetchPostsByIds(ids: string[]): Promise<PostRowData[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('id, owner_id, title, description, duration_seconds, resolution, storage_key, created_at, sensitive, ai_score')
    .in('id', ids);
  if (error) throw error;
  return z.array(PostRow).parse(data ?? []);
}

async function fetchTagsByPost(ids: string[]) {
  if (!ids.length) return new Map<string, TagRowData[]>();
  const { data, error } = await supabase
    .from('ai_tags')
    .select('post_id, tag, trust')
    .in('post_id', ids);
  if (error) throw error;
  const rows = z.array(TagRow).parse(data ?? []);
  return groupByPost(rows);
}

async function fetchStatsByPost(ids: string[]) {
  if (!ids.length) return new Map<string, StatRowData>();
  const { data, error } = await supabase
    .from('post_stats')
    .select('post_id, views, watch_seconds, bookmarks, follows, popularity')
    .in('post_id', ids);
  if (error) throw error;
  const rows = z.array(StatRow).parse(data ?? []);
  const map = new Map<string, StatRowData>();
  rows.forEach(row => map.set(row.post_id, row));
  return map;
}

async function fetchUsersById(ids: string[]) {
  if (!ids.length) return new Map<string, UserRowData>();
  const { data, error } = await supabase.from('app_users').select('id, handle').in('id', ids);
  if (error) throw error;
  const rows = z.array(UserRow).parse(data ?? []);
  const map = new Map<string, UserRowData>();
  rows.forEach(row => map.set(row.id, row));
  return map;
}

async function fetchProfilesByUser(ids: string[]) {
  if (!ids.length) return new Map<string, ProfileRowData>();
  const { data, error } = await supabase
    .from('creator_profiles')
    .select('user_id, display_name, avatar, bio, tagline')
    .in('user_id', ids);
  if (error) throw error;
  const rows = z.array(ProfileRow).parse(data ?? []);
  const map = new Map<string, ProfileRowData>();
  rows.forEach(row => map.set(row.user_id, row));
  return map;
}

function buildFeedItem(
  post: PostRowData,
  tags: TagRowData[],
  stats: StatRowData | undefined,
  author: UserRowData | undefined,
  profile: ProfileRowData | undefined
): FeedItem {
  const aiTags = tags.map(tag => ({
    tag: tag.tag,
    trust: tag.trust ?? undefined,
  }));
  const statsPayload = stats
    ? {
        views: stats.views ?? 0,
        watch_seconds: stats.watch_seconds ?? 0,
        bookmarks: stats.bookmarks ?? 0,
        follows: stats.follows ?? 0,
        popularity: stats.popularity ?? 0,
      }
    : undefined;
  const popularity = stats?.popularity ?? post.ai_score ?? 0;
  const authorHandle = author?.handle ?? null;
  const authorDisplay = profile?.display_name ?? authorHandle;
  const authorAvatar = profile?.avatar ?? null;

  return {
    id: post.id,
    title: post.title,
    description: post.description ?? '',
    duration_seconds: post.duration_seconds ?? 0,
    resolution: post.resolution ?? 'unknown',
    storage_key: post.storage_key ?? '',
    created_at: post.created_at,
    sensitive: Boolean(post.sensitive),
    ai_score: post.ai_score,
    ai_tags: aiTags,
    tags: aiTags.map(tag => tag.tag),
    post_stats: statsPayload,
    popularity,
    author_handle: authorHandle,
    author_display: authorDisplay ?? authorHandle,
    author_avatar: authorAvatar,
    author: authorHandle
      ? {
          handle: authorHandle,
          displayName: authorDisplay ?? authorHandle,
          avatar: authorAvatar,
          bio: profile?.bio ?? null,
          tagline: profile?.tagline ?? null,
        }
      : undefined,
  };
}

export async function fetchFeed(tag?: string): Promise<FeedItem[]> {
  const orderedIds = await fetchBaseRows(tag);
  if (!orderedIds.length) return [];
  const posts = await fetchPostsByIds(orderedIds);
  if (!posts.length) return [];

  const postMap = new Map(posts.map(post => [post.id, post]));
  const ownerIds = Array.from(
    new Set(posts.map(post => post.owner_id).filter((value): value is string => Boolean(value)))
  );

  const [tagsByPost, statsByPost, usersById, profilesByUser] = await Promise.all([
    fetchTagsByPost(orderedIds),
    fetchStatsByPost(orderedIds),
    fetchUsersById(ownerIds),
    fetchProfilesByUser(ownerIds),
  ]);

  const items = orderedIds
    .map(id => {
      const post = postMap.get(id);
      if (!post) return null;
      const tags = tagsByPost.get(id) ?? [];
      const stats = statsByPost.get(id);
      const author = usersById.get(post.owner_id);
      const profile = profilesByUser.get(post.owner_id);
      return buildFeedItem(post, tags, stats, author, profile);
    })
    .filter((item): item is FeedItem => Boolean(item));

  return items.sort((a, b) => {
    const viewsA = a.post_stats?.views ?? 0;
    const viewsB = b.post_stats?.views ?? 0;
    if (viewsB !== viewsA) return viewsB - viewsA;
    const popA = a.popularity ?? 0;
    const popB = b.popularity ?? 0;
    if (popB !== popA) return popB - popA;
    return b.created_at.localeCompare(a.created_at);
  });
}
