import { DEFAULT_AVATAR_SRC } from './defaultAvatar';
import { ApiAuthorProfile, ApiComment, ApiPost, ApiPostStats, ApiTag } from './types';

export function normalizeTags(rawTags: unknown): ApiTag[] {
  if (!Array.isArray(rawTags)) return [];
  return rawTags.reduce<ApiTag[]>((acc, tag) => {
    if (typeof tag === 'string' && tag) {
      acc.push({ tag });
      return acc;
    }
    if (tag && typeof tag === 'object' && 'tag' in tag) {
      const item = tag as { tag: unknown; trust?: unknown };
      const normalizedTag = typeof item.tag === 'string' ? item.tag : String(item.tag ?? '');
      if (!normalizedTag) return acc;
      const trustValue =
        typeof item.trust === 'number'
          ? item.trust
          : typeof item.trust === 'string'
            ? Number(item.trust)
            : undefined;
      acc.push({
        tag: normalizedTag,
        trust: Number.isFinite(trustValue) ? trustValue : undefined,
      });
    }
    return acc;
  }, []);
}

function coerceNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizeStats(raw: unknown): ApiPostStats | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Record<string, unknown>;
  return {
    views: coerceNumber(data.views),
    watchSeconds: coerceNumber(data.watch_seconds ?? data.watchSeconds),
    bookmarks: coerceNumber(data.bookmarks),
    follows: coerceNumber(data.follows),
    popularity: coerceNumber(data.popularity),
  };
}

export function normalizeAuthor(raw: unknown): ApiAuthorProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const handle =
    typeof data.handle === 'string'
      ? data.handle
      : typeof data.author_handle === 'string'
        ? data.author_handle
        : null;
  const displayName =
    typeof data.displayName === 'string'
      ? data.displayName
      : typeof data.display_name === 'string'
        ? data.display_name
        : typeof data.author_display === 'string'
          ? data.author_display
          : handle;
  const avatarValue =
    typeof data.avatar === 'string' && data.avatar.trim()
      ? data.avatar
      : typeof data.author_avatar === 'string' && data.author_avatar.trim()
        ? data.author_avatar
        : null;
  return {
    handle: handle ?? '',
    displayName: displayName ?? handle ?? '',
    avatar: avatarValue ?? DEFAULT_AVATAR_SRC,
    bio: typeof data.bio === 'string' ? data.bio : null,
    tagline: typeof data.tagline === 'string' ? data.tagline : null,
  };
}

const randomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `temp-${Math.random().toString(36).slice(2)}`;
};

function normalizeComments(raw: unknown): ApiComment[] {
  if (!Array.isArray(raw)) return [];
  return raw.reduce<ApiComment[]>((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    const data = item as Record<string, unknown>;
    const body = typeof data.body === 'string' ? data.body : '';
    if (!body) return acc;
    const author = normalizeAuthor(data.author);
    const createdAt =
      typeof data.created_at === 'string'
        ? data.created_at
        : typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString();
    acc.push({
      id: typeof data.id === 'string' ? data.id : randomId(),
      body,
      createdAt,
      author,
    });
    return acc;
  }, []);
}

export function normalizePost(raw: any): ApiPost {
  const rawAiTags = normalizeTags(raw.ai_tags ?? raw.aiTags ?? raw.tags);
  let previewSeconds: number | undefined;
  const aiTags = rawAiTags
    .map(tag => {
      if (tag.tag.startsWith('preview:')) {
        const value = Number(tag.tag.replace(/^preview:/i, ''));
        if (!Number.isNaN(value)) {
          previewSeconds = Math.max(0, value);
        }
        return null;
      }
      return tag;
    })
    .filter((value): value is ApiTag => Boolean(value));
  const tags =
    Array.isArray(raw.tags) && raw.tags.every(tag => typeof tag === 'string')
      ? (raw.tags as string[]).filter(tag => !/^preview:/i.test(tag))
      : aiTags.map(tag => tag.tag);
  const stats = normalizeStats(raw.post_stats ?? raw.stats);
  const author = normalizeAuthor(raw.author ?? raw);
  const storageKey = typeof raw.storage_key === 'string' ? raw.storage_key : typeof raw.storageKey === 'string' ? raw.storageKey : '';
  const comments = normalizeComments(raw.comments);

  return {
    id: typeof raw.id === 'string' ? raw.id : randomId(),
    title: typeof raw.title === 'string' ? raw.title : 'Untitled',
    description: typeof raw.description === 'string' ? raw.description : '',
    durationSeconds: coerceNumber(raw.duration_seconds ?? raw.durationSeconds),
    resolution: typeof raw.resolution === 'string' ? raw.resolution : '1080x1920',
    storageKey,
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
    sensitive: Boolean(raw.sensitive),
    aiScore: typeof raw.ai_score === 'number' ? raw.ai_score : typeof raw.aiScore === 'number' ? raw.aiScore : undefined,
    aiTags,
    tags,
    postStats: stats,
    popularity: typeof raw.popularity === 'number' ? raw.popularity : stats?.popularity,
    previewSeconds,
    author,
    authorHandle: author?.handle,
    authorDisplay: author?.displayName,
    authorAvatar: author?.avatar ?? DEFAULT_AVATAR_SRC,
    comments: comments.length ? comments : undefined,
  };
}
