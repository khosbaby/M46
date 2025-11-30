"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFeed = fetchFeed;
const supabase_1 = require("../supabase");
const zod_1 = require("zod");
const BaseFeedRow = zod_1.z.object({
    id: zod_1.z.string(),
});
const PostRow = zod_1.z.object({
    id: zod_1.z.string(),
    owner_id: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    duration_seconds: zod_1.z.number().nullable(),
    resolution: zod_1.z.string().nullable(),
    storage_key: zod_1.z.string().nullable(),
    created_at: zod_1.z.string(),
    sensitive: zod_1.z.boolean().nullable().optional(),
    ai_score: zod_1.z.number().nullable().optional(),
});
const TagRow = zod_1.z.object({
    post_id: zod_1.z.string(),
    tag: zod_1.z.string(),
    trust: zod_1.z.number().nullable().optional(),
});
const StatRow = zod_1.z.object({
    post_id: zod_1.z.string(),
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
function groupByPost(rows) {
    const map = new Map();
    for (const row of rows) {
        const list = map.get(row.post_id) ?? [];
        list.push(row);
        map.set(row.post_id, list);
    }
    return map;
}
const FEED_LIMIT = 60;
async function fetchRpcBaseRows(tag) {
    const rpc = tag ? supabase_1.supabase.rpc('feed_by_tag', { p_tag: tag }) : supabase_1.supabase.rpc('feed_default');
    const { data, error } = await rpc;
    if (error)
        throw error;
    const rows = zod_1.z.array(BaseFeedRow).parse(data ?? []);
    return rows.map(row => row.id);
}
async function fetchRecentPostIds(limit = 40) {
    const { data, error } = await supabase_1.supabase
        .from('posts')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    return (data ?? []).map(row => row.id);
}
async function fetchBaseRows(tag) {
    const orderedIds = await fetchRpcBaseRows(tag);
    if (!tag) {
        const recentIds = await fetchRecentPostIds(40);
        const seen = new Set(orderedIds);
        for (const id of recentIds) {
            if (!seen.has(id)) {
                orderedIds.push(id);
                seen.add(id);
            }
            if (orderedIds.length >= FEED_LIMIT)
                break;
        }
    }
    return orderedIds.slice(0, FEED_LIMIT);
}
async function fetchPostsByIds(ids) {
    if (!ids.length)
        return [];
    const { data, error } = await supabase_1.supabase
        .from('posts')
        .select('id, owner_id, title, description, duration_seconds, resolution, storage_key, created_at, sensitive, ai_score')
        .in('id', ids);
    if (error)
        throw error;
    return zod_1.z.array(PostRow).parse(data ?? []);
}
async function fetchTagsByPost(ids) {
    if (!ids.length)
        return new Map();
    const { data, error } = await supabase_1.supabase
        .from('ai_tags')
        .select('post_id, tag, trust')
        .in('post_id', ids);
    if (error)
        throw error;
    const rows = zod_1.z.array(TagRow).parse(data ?? []);
    return groupByPost(rows);
}
async function fetchStatsByPost(ids) {
    if (!ids.length)
        return new Map();
    const { data, error } = await supabase_1.supabase
        .from('post_stats')
        .select('post_id, views, watch_seconds, bookmarks, follows, popularity')
        .in('post_id', ids);
    if (error)
        throw error;
    const rows = zod_1.z.array(StatRow).parse(data ?? []);
    const map = new Map();
    rows.forEach(row => map.set(row.post_id, row));
    return map;
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
    const { data, error } = await supabase_1.supabase
        .from('creator_profiles')
        .select('user_id, display_name, avatar, bio, tagline')
        .in('user_id', ids);
    if (error)
        throw error;
    const rows = zod_1.z.array(ProfileRow).parse(data ?? []);
    const map = new Map();
    rows.forEach(row => map.set(row.user_id, row));
    return map;
}
function buildFeedItem(post, tags, stats, author, profile) {
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
async function fetchFeed(tag) {
    const orderedIds = await fetchBaseRows(tag);
    if (!orderedIds.length)
        return [];
    const posts = await fetchPostsByIds(orderedIds);
    if (!posts.length)
        return [];
    const postMap = new Map(posts.map(post => [post.id, post]));
    const ownerIds = Array.from(new Set(posts.map(post => post.owner_id).filter((value) => Boolean(value))));
    const [tagsByPost, statsByPost, usersById, profilesByUser] = await Promise.all([
        fetchTagsByPost(orderedIds),
        fetchStatsByPost(orderedIds),
        fetchUsersById(ownerIds),
        fetchProfilesByUser(ownerIds),
    ]);
    const items = orderedIds
        .map(id => {
        const post = postMap.get(id);
        if (!post)
            return null;
        const tags = tagsByPost.get(id) ?? [];
        const stats = statsByPost.get(id);
        const author = usersById.get(post.owner_id);
        const profile = profilesByUser.get(post.owner_id);
        return buildFeedItem(post, tags, stats, author, profile);
    })
        .filter((item) => Boolean(item));
    return items.sort((a, b) => {
        const viewsA = a.post_stats?.views ?? 0;
        const viewsB = b.post_stats?.views ?? 0;
        if (viewsB !== viewsA)
            return viewsB - viewsA;
        const popA = a.popularity ?? 0;
        const popB = b.popularity ?? 0;
        if (popB !== popA)
            return popB - popA;
        return b.created_at.localeCompare(a.created_at);
    });
}
