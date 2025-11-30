import 'server-only';

import { supabaseRest } from './supabaseRest';
import { ApiPost } from './types';

const FEED_LIMIT = Number(process.env.SUPABASE_FEED_LIMIT ?? '40');

type PostRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  resolution: string | null;
  storage_key: string | null;
  created_at: string;
  sensitive: boolean | null;
  ai_score: number | null;
};

type TagRow = { post_id: string; tag: string | null; trust: number | null };
type StatRow = { post_id: string; views: number | null; watch_seconds: number | null; bookmarks: number | null; follows: number | null; popularity: number | null };
type UserRow = { id: string; handle: string };
type ProfileRow = { user_id: string; display_name: string | null; avatar: string | null; bio: string | null; tagline: string | null };

function groupBy<T extends { post_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.post_id) ?? [];
    list.push(row);
    map.set(row.post_id, list);
  }
  return map;
}

function coerceNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export async function fetchFeedFromSupabase(tag?: string): Promise<ApiPost[]> {
  const baseParams: Record<string, string> = {
    select: 'id,owner_id,title,description,duration_seconds,resolution,storage_key,created_at,sensitive,ai_score',
    order: 'created_at.desc',
    limit: String(FEED_LIMIT),
  };
  let posts = await supabaseRest<PostRow[]>('/posts', { searchParams: baseParams });
  if (tag) {
    const tagged = await supabaseRest<{ post_id: string }[]>('/ai_tags', {
      searchParams: {
        select: 'post_id',
        tag: `eq.${tag}`,
      },
    });
    const allowed = new Set(tagged.map(row => row.post_id));
    posts = posts.filter(row => allowed.has(row.id));
  }
  if (!posts.length) return [];

  const postIds = posts.map(row => row.id);
  const ownerIds = Array.from(new Set(posts.map(row => row.owner_id)));
  const filterValue = postIds.length ? `in.(${postIds.join(',')})` : '';
  const ownerFilterValue = ownerIds.length ? `in.(${ownerIds.join(',')})` : '';

  const [tagsRows, statsRows, userRows, profileRows] = await Promise.all([
    filterValue
      ? supabaseRest<TagRow[]>('/ai_tags', {
          searchParams: {
            select: 'post_id,tag,trust',
            post_id: filterValue,
          },
        })
      : Promise.resolve([]),
    filterValue
      ? supabaseRest<StatRow[]>('/post_stats', {
          searchParams: {
            select: 'post_id,views,watch_seconds,bookmarks,follows,popularity',
            post_id: filterValue,
          },
        })
      : Promise.resolve([]),
    ownerFilterValue
      ? supabaseRest<UserRow[]>('/app_users', {
          searchParams: {
            select: 'id,handle',
            id: ownerFilterValue,
          },
        })
      : Promise.resolve([]),
    ownerFilterValue
      ? supabaseRest<ProfileRow[]>('/creator_profiles', {
          searchParams: {
            select: 'user_id,display_name,avatar,bio,tagline',
            user_id: ownerFilterValue,
          },
        })
      : Promise.resolve([]),
  ]);

  const tagsByPost = groupBy(tagsRows);
  const statsByPost = new Map(statsRows.map(row => [row.post_id, row]));
  const usersById = new Map(userRows.map(row => [row.id, row]));
  const profilesByUser = new Map(profileRows.map(row => [row.user_id, row]));

  const items = posts.map(row => {
    const tags = tagsByPost.get(row.id) ?? [];
    const stats = statsByPost.get(row.id);
    const author = usersById.get(row.owner_id);
    const profile = profilesByUser.get(row.owner_id);
    const aiTags = tags
      .map(tag => {
        if (!tag.tag) return null;
        return { tag: tag.tag, trust: typeof tag.trust === 'number' ? tag.trust : undefined };
      })
      .filter((value): value is { tag: string; trust?: number } => Boolean(value));
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      durationSeconds: coerceNumber(row.duration_seconds),
      resolution: row.resolution ?? '1080x1920',
      storageKey: row.storage_key ?? '',
      createdAt: row.created_at,
      sensitive: Boolean(row.sensitive),
      aiScore: row.ai_score,
      aiTags,
      tags: aiTags.map(tag => tag.tag),
      postStats: stats
        ? {
            views: coerceNumber(stats.views),
            watchSeconds: coerceNumber(stats.watch_seconds),
            bookmarks: coerceNumber(stats.bookmarks),
            follows: coerceNumber(stats.follows),
            popularity: coerceNumber(stats.popularity),
          }
        : undefined,
      popularity: stats?.popularity ?? row.ai_score ?? 0,
      author: author
        ? {
            handle: author.handle,
            displayName: profile?.display_name ?? author.handle,
            avatar: profile?.avatar ?? null,
            bio: profile?.bio ?? null,
            tagline: profile?.tagline ?? null,
          }
        : null,
      authorHandle: author?.handle ?? null,
      authorDisplay: profile?.display_name ?? author?.handle ?? null,
      authorAvatar: profile?.avatar ?? null,
    };
  });

  return items.sort((a, b) => {
    const viewsA = a.postStats?.views ?? 0;
    const viewsB = b.postStats?.views ?? 0;
    if (viewsB !== viewsA) return viewsB - viewsA;
    const popA = a.popularity ?? 0;
    const popB = b.popularity ?? 0;
    if (popB !== popA) return popB - popA;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function fetchPostDetailFromSupabase(id: string): Promise<ApiPost | null> {
  if (!id) return null;
  const posts = await supabaseRest<PostRow[]>('/posts', {
    searchParams: {
      select: 'id,owner_id,title,description,duration_seconds,resolution,storage_key,created_at,sensitive,ai_score',
      id: `eq.${id}`,
    },
  });
  if (!posts.length) return null;
  const post = posts[0];
  const [tagsRows, statsRow, userRow, profileRow, commentsRows] = await Promise.all([
    supabaseRest<TagRow[]>('/ai_tags', { searchParams: { select: 'post_id,tag,trust', post_id: `eq.${id}` } }),
    supabaseRest<StatRow[]>('/post_stats', { searchParams: { select: 'post_id,views,watch_seconds,bookmarks,follows,popularity', post_id: `eq.${id}` } }),
    supabaseRest<UserRow[]>('/app_users', { searchParams: { select: 'id,handle', id: `eq.${post.owner_id}` } }),
    supabaseRest<ProfileRow[]>('/creator_profiles', {
      searchParams: { select: 'user_id,display_name,avatar,bio,tagline', user_id: `eq.${post.owner_id}` },
    }),
    supabaseRest<
      Array<{
        id: string;
        body: string;
        created_at: string;
        author_id: string | null;
      }>
    >('/comments', {
      searchParams: {
        select: 'id,body,created_at,author_id',
        post_id: `eq.${id}`,
        order: 'created_at.asc',
      },
    }),
  ]);

  const tags = tagsRows
    .map(tag => (tag.tag ? { tag: tag.tag, trust: typeof tag.trust === 'number' ? tag.trust : undefined } : null))
    .filter((value): value is { tag: string; trust?: number } => Boolean(value));
  const stats = statsRow[0];
  const author = userRow[0];
  const profile = profileRow[0];
  const commentAuthorIds = Array.from(new Set(commentsRows.map(comment => comment.author_id).filter((value): value is string => Boolean(value))));
  const [commentUsers, commentProfiles] = await Promise.all([
    commentAuthorIds.length
      ? supabaseRest<UserRow[]>('/app_users', { searchParams: { select: 'id,handle', id: `in.(${commentAuthorIds.join(',')})` } })
      : Promise.resolve([]),
    commentAuthorIds.length
      ? supabaseRest<ProfileRow[]>('/creator_profiles', {
          searchParams: { select: 'user_id,display_name,avatar,bio,tagline', user_id: `in.(${commentAuthorIds.join(',')})` },
        })
      : Promise.resolve([]),
  ]);
  const commentUsersMap = new Map(commentUsers.map(row => [row.id, row]));
  const commentProfilesMap = new Map(commentProfiles.map(row => [row.user_id, row]));

  return {
    id: post.id,
    title: post.title,
    description: post.description ?? '',
    durationSeconds: coerceNumber(post.duration_seconds),
    resolution: post.resolution ?? '1080x1920',
    storageKey: post.storage_key ?? '',
    createdAt: post.created_at,
    sensitive: Boolean(post.sensitive),
    aiScore: post.ai_score,
    aiTags: tags,
    tags: tags.map(tag => tag.tag),
    postStats: stats
      ? {
          views: coerceNumber(stats.views),
          watchSeconds: coerceNumber(stats.watch_seconds),
          bookmarks: coerceNumber(stats.bookmarks),
          follows: coerceNumber(stats.follows),
          popularity: coerceNumber(stats.popularity),
        }
      : undefined,
    popularity: stats?.popularity ?? post.ai_score ?? 0,
    author: author
      ? {
          handle: author.handle,
          displayName: profile?.display_name ?? author.handle,
          avatar: profile?.avatar ?? null,
          bio: profile?.bio ?? null,
          tagline: profile?.tagline ?? null,
        }
      : null,
    authorHandle: author?.handle ?? null,
    authorDisplay: profile?.display_name ?? author?.handle ?? null,
    authorAvatar: profile?.avatar ?? null,
    comments: commentsRows.map(comment => {
      const commentAuthor = comment.author_id ? commentUsersMap.get(comment.author_id) : null;
      const commentProfile = comment.author_id ? commentProfilesMap.get(comment.author_id) : null;
      return {
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at,
        author: commentAuthor
          ? {
              handle: commentAuthor.handle,
              displayName: commentProfile?.display_name ?? commentAuthor.handle,
              avatar: commentProfile?.avatar ?? null,
              bio: commentProfile?.bio ?? null,
              tagline: commentProfile?.tagline ?? null,
            }
          : null,
      };
    }),
  };
}
