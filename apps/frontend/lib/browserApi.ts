import { normalizePost } from './postTransform';
import { ApiPost } from './types';

export async function fetchPostByIdClient(id: string): Promise<ApiPost | null> {
  if (!id) return null;
  try {
    const response = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { post?: unknown };
    const raw = payload.post ?? null;
    return raw ? normalizePost(raw as any) : null;
  } catch (error) {
    console.warn('fetchPostByIdClient_failed', error);
    return null;
  }
}
