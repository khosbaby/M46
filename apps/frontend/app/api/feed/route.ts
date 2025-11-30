import { NextRequest, NextResponse } from 'next/server';
import { SAMPLE_POSTS } from '@/lib/samplePosts';
import { FeedResponse } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? '';

type FeedFetchOptions = {
  tag?: string | null;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  samplePosts?: typeof SAMPLE_POSTS;
};

const isTagMatch = (candidate: unknown, tag: string) => {
  if (typeof candidate === 'string') return candidate === tag;
  if (candidate && typeof candidate === 'object' && 'tag' in candidate) {
    return (candidate as { tag: string }).tag === tag;
  }
  return false;
};

export async function buildFeedResponse(options: FeedFetchOptions = {}): Promise<FeedResponse> {
  const { tag, apiBase = API_BASE, fetchImpl = fetch, samplePosts = SAMPLE_POSTS } = options;
  if (apiBase) {
    try {
      const url = new URL(tag ? `/feed/by-tag` : `/feed`, apiBase);
      if (tag) url.searchParams.set('tag', tag);
      const res = await fetchImpl(url.toString(), { cache: 'no-store' });
      if (res.ok) {
        return (await res.json()) as FeedResponse;
      }
      console.warn('Remote feed request failed', res.status, await res.text());
    } catch (err) {
      console.error('Remote feed fetch error', err);
    }
  }

  const posts = tag
    ? samplePosts.filter(post => post.tags.some(tagEntry => isTagMatch(tagEntry, tag)))
    : samplePosts;
  return { posts };
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');
  const payload = await buildFeedResponse({ tag });
  return NextResponse.json(payload);
}
