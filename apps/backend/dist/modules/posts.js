"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPostDetail = fetchPostDetail;
exports.listPosts = listPosts;
exports.createPost = createPost;
const supabase_1 = require("../supabase");
const zod_1 = require("zod");
const PostRow = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    duration_seconds: zod_1.z.number(),
    resolution: zod_1.z.string(),
    storage_key: zod_1.z.string(),
    ai_score: zod_1.z.number().nullable().optional(),
    sensitive: zod_1.z.boolean(),
    created_at: zod_1.z.string(),
    owner_id: zod_1.z.string(),
});
const TagRow = zod_1.z.object({
    tag: zod_1.z.string(),
    trust: zod_1.z.number().nullable().optional(),
});
const StatRow = zod_1.z.object({
    views: zod_1.z.number().nullable().optional(),
    watch_seconds: zod_1.z.number().nullable().optional(),
    bookmarks: zod_1.z.number().nullable().optional(),
    follows: zod_1.z.number().nullable().optional(),
    popularity: zod_1.z.number().nullable().optional(),
});
const UserRow = zod_1.z.object({
    id: zod_1.z.string(),
    handle: zod_1.z.string(),
});
const ProfileRow = zod_1.z.object({
    user_id: zod_1.z.string(),
    display_name: zod_1.z.string().nullable().optional(),
    avatar: zod_1.z.string().nullable().optional(),
    bio: zod_1.z.string().nullable().optional(),
    tagline: zod_1.z.string().nullable().optional(),
});
const CommentRow = zod_1.z.object({
    id: zod_1.z.string(),
    post_id: zod_1.z.string(),
    author_id: zod_1.z.string().nullable(),
    body: zod_1.z.string(),
    created_at: zod_1.z.string(),
});
const PostListRow = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    duration_seconds: zod_1.z.number(),
    resolution: zod_1.z.string(),
    storage_key: zod_1.z.string(),
    created_at: zod_1.z.string(),
    app_users: zod_1.z.object({
        handle: zod_1.z.string(),
    }),
});
const CreatePostInput = zod_1.z.object({
    ownerId: zod_1.z.string().uuid(),
    title: zod_1.z
        .string()
        .min(1)
        .max(120)
        .transform(value => value.trim()),
    description: zod_1.z
        .string()
        .min(1)
        .max(4000)
        .transform(value => value.trim()),
    storageKey: zod_1.z
        .string()
        .refine(value => /^https?:\/\//i.test(value.trim()), 'storage_key_must_be_http_url'),
    durationSeconds: zod_1.z
        .number()
        .int()
        .min(1)
        .max(30),
    resolution: zod_1.z
        .string()
        .regex(/^[0-9]+x[0-9]+$/i, 'invalid_resolution_format')
        .refine(value => {
        const [widthStr, heightStr] = value.toLowerCase().split('x');
        const width = Number(widthStr);
        const height = Number(heightStr);
        return Number.isFinite(width) && Number.isFinite(height) && height > width && width >= 360 && height <= 2400;
    }, 'resolution_must_be_vertical_and_within_bounds'),
    tags: zod_1.z
        .array(zod_1.z
        .string()
        .trim()
        .min(1)
        .max(48)
        .transform(value => value.toLowerCase()))
        .max(10)
        .optional()
        .default([]),
});
async function fetchPostRow(id) {
    const { data, error } = await supabase_1.supabase.from('posts').select('*').eq('id', id).single();
    if (error)
        throw error;
    return PostRow.parse(data);
}
async function fetchTags(postId) {
    const { data, error } = await supabase_1.supabase.from('ai_tags').select('tag, trust').eq('post_id', postId);
    if (error)
        throw error;
    return zod_1.z.array(TagRow).parse(data ?? []);
}
async function fetchStats(postId) {
    const { data, error } = await supabase_1.supabase.from('post_stats').select('views,watch_seconds,bookmarks,follows,popularity').eq('post_id', postId).single();
    if (error && error.code !== 'PGRST116')
        throw error;
    return data ? StatRow.parse(data) : null;
}
async function fetchUser(userId) {
    const { data, error } = await supabase_1.supabase.from('app_users').select('id, handle').eq('id', userId).single();
    if (error)
        throw error;
    return UserRow.parse(data);
}
async function fetchProfile(userId) {
    const { data, error } = await supabase_1.supabase.from('creator_profiles').select('user_id, display_name, avatar, bio, tagline').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116')
        throw error;
    return data ? ProfileRow.parse(data) : null;
}
async function fetchComments(postId) {
    const { data, error } = await supabase_1.supabase
        .from('comments')
        .select('id, post_id, author_id, body, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
    if (error)
        throw error;
    return zod_1.z.array(CommentRow).parse(data ?? []);
}
async function fetchUsersById(ids) {
    if (!ids.length)
        return new Map();
    const { data, error } = await supabase_1.supabase.from('app_users').select('id, handle').in('id', ids);
    if (error)
        throw error;
    const rows = zod_1.z.array(UserRow).parse(data ?? []);
    const map = new Map();
    rows.forEach(row => map.set(row.id, row));
    return map;
}
async function fetchProfilesByUser(ids) {
    if (!ids.length)
        return new Map();
    const { data, error } = await supabase_1.supabase.from('creator_profiles').select('user_id, display_name, avatar, bio, tagline').in('user_id', ids);
    if (error)
        throw error;
    const rows = zod_1.z.array(ProfileRow).parse(data ?? []);
    const map = new Map();
    rows.forEach(row => map.set(row.user_id, row));
    return map;
}
function buildAuthorPayload(user, profile) {
    return {
        handle: user.handle,
        displayName: profile?.display_name ?? user.handle,
        avatar: profile?.avatar ?? null,
        bio: profile?.bio ?? null,
        tagline: profile?.tagline ?? null,
    };
}
async function fetchPostDetail(id) {
    const post = await fetchPostRow(id);
    const [tags, stats, owner, ownerProfile, commentRows] = await Promise.all([
        fetchTags(post.id),
        fetchStats(post.id),
        fetchUser(post.owner_id),
        fetchProfile(post.owner_id),
        fetchComments(post.id),
    ]);
    const commentAuthorIds = Array.from(new Set(commentRows.map(row => row.author_id).filter((value) => Boolean(value))));
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
async function listPosts(limit = 50) {
    const { data, error } = await supabase_1.supabase
        .from('posts')
        .select('id,title,description,storage_key,duration_seconds,resolution,created_at,app_users:owner_id(handle)')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    return zod_1.z.array(PostListRow).parse(data).map(row => ({
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
async function createPost(input) {
    const payload = CreatePostInput.parse(input);
    const { data, error } = await supabase_1.supabase
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
    if (error)
        throw error;
    if (payload.tags.length) {
        await supabase_1.supabase.from('ai_tags').upsert(payload.tags.map(tag => ({
            post_id: data.id,
            tag,
            trust: 0.7,
        })));
    }
    return PostRow.parse(data);
}
