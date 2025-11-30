import 'server-only';

import { normalizePost } from './postTransform';
import { ApiPost, FeedResponse } from './types';
import { fetchFeedFromSupabase, fetchPostDetailFromSupabase } from './supabaseFeed';

export async function fetchFeed({ tag }: { tag?: string } = {}): Promise<ApiPost[]> {
  try {
    const posts = await fetchFeedFromSupabase(tag);
    if (posts.length) {
      return posts;
    }
  } catch (error) {
    if ((error as Error)?.message === 'supabase_rest_not_configured') {
      console.warn('supabase_rest_not_configured_falling_back', error);
    } else {
      console.error('supabase_rest_feed_failed', error);
    }
  }

  const base = resolveApiBaseUrl();
  if (!base) {
    throw new Error('API_BASE_URL is not configured. Set NEXT_PUBLIC_API_BASE_URL or API_BASE_URL.');
  }
  const url = new URL(tag ? '/feed/by-tag' : '/feed', base);
  if (tag) url.searchParams.set('tag', tag);
  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`feed_request_failed:${response.status}:${detail}`);
  }
  const payload = (await response.json()) as FeedResponse | { posts?: unknown };
  if (!payload || !Array.isArray(payload.posts)) {
    throw new Error('invalid_feed_response');
  }
  return payload.posts.map(normalizePost);
}

export { normalizePost } from './postTransform';

function resolveApiBaseUrl() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? '';
  return base ? base.replace(/\/$/, '') : '';
}

export async function fetchPostById(id: string): Promise<ApiPost | null> {
  if (!id) return null;
  try {
    const supabasePost = await fetchPostDetailFromSupabase(id);
    if (supabasePost) {
      return supabasePost;
    }
  } catch (error) {
    if ((error as Error)?.message === 'supabase_rest_not_configured') {
      console.warn('supabase_rest_post_detail_not_configured', error);
    } else {
      console.error('supabase_rest_post_detail_failed', error);
    }
  }

  const base = resolveApiBaseUrl();
  if (!base) {
    return null;
  }
  try {
    const response = await fetch(`${base}/posts/${id}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { post?: unknown };
    const raw = payload.post ?? null;
    return raw ? normalizePost(raw as any) : null;
  } catch (error) {
    console.error('fallback_fetch_post_failed', error);
    return null;
  }
}
