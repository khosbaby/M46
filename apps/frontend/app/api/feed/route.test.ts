import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFeedResponse } from './route';
import { SAMPLE_POSTS } from '@/lib/samplePosts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildFeedResponse', () => {
  it('returns remote payload when upstream responds with ok status', async () => {
    const mockPayload = { posts: [{ id: 'remote-post' }], tag: 'cyber' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload,
      text: async () => JSON.stringify(mockPayload),
    });

    const payload = await buildFeedResponse({
      tag: 'cyber',
      apiBase: 'https://api.example.com',
      fetchImpl: mockFetch as typeof fetch,
    });

    expect(payload).toEqual(mockPayload);
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/feed/by-tag?tag=cyber', {
      cache: 'no-store',
    });
  });

  it('falls back to SAMPLE_POSTS when remote fetch throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const payload = await buildFeedResponse({
      tag: 'cyber',
      apiBase: 'https://api.example.com',
      fetchImpl: mockFetch as typeof fetch,
      samplePosts: SAMPLE_POSTS,
    });

    expect(payload.posts).toHaveLength(1);
    expect(payload.posts[0].id).toBe('sample-neon-city');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('filters fallback posts by tag even without remote API base', async () => {
    const payload = await buildFeedResponse({
      tag: 'nature',
      apiBase: '',
      samplePosts: SAMPLE_POSTS,
    });

    expect(payload.posts.map(post => post.id)).toEqual(['sample-skyline-drift']);
  });
});
