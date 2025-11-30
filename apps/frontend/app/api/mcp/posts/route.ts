import { NextResponse } from 'next/server';

import { normalizePost } from '@/lib/postTransform';
import { SupabaseClientAdapter, SupabaseMcpError, withSupabaseMcp } from '@/lib/supabaseMcpClient';
import { resolveSession, SessionError } from '@/lib/mcpSession';
import { fetchPostDetailFromSupabase } from '@/lib/supabaseFeed';

type CreatePostRequest = {
  sessionToken?: string;
  title?: string;
  description?: string;
  storageKey?: string;
  durationSeconds?: number;
  resolution?: string;
  tags?: string[] | string;
  previewSeconds?: number;
};

const STORAGE_BASE =
  (process.env.SUPABASE_PUBLIC_STORAGE_BASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BASE_URL ?? '').replace(/\/*$/, '');
class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function ensureVerticalResolution(resolution: string) {
  const match = resolution.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) {
    throw new RequestError('invalid_resolution_format');
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= width) {
    throw new RequestError('resolution_must_be_vertical');
  }
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeTags(raw: CreatePostRequest['tags']) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(value => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
      .filter(Boolean)
      .slice(0, 10);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);
  }
  return [];
}

function normalizeStorageKey(raw?: string) {
  const value = raw?.trim();
  if (!value) {
    throw new RequestError('storage_key_required');
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  let normalized = value;
  if (normalized.startsWith('supabase://')) {
    normalized = normalized.replace(/^supabase:\/\//, '');
  }
  normalized = normalized.replace(/^\/+/, '');
  if (!normalized) {
    throw new RequestError('storage_key_required');
  }
  const base = STORAGE_BASE;
  if (!base) {
    throw new RequestError('storage_base_not_configured', 500);
  }
  return `${base}/${normalized}`;
}

async function createPostViaMcp(payload: CreatePostRequest) {
  const sessionToken = payload.sessionToken?.trim();
  const title = (payload.title ?? '').trim();
  if (!title) {
    throw new RequestError('title_required');
  }
  const description = (payload.description ?? '').trim();
  const storageKey = normalizeStorageKey(payload.storageKey);
  const resolution = (payload.resolution ?? '1080x1920').trim();
  ensureVerticalResolution(resolution);
  const durationSeconds = normalizeNumber(payload.durationSeconds, 24, 1, 120);
  const tags = normalizeTags(payload.tags);
  const previewSeconds = normalizePreviewSeconds(payload.previewSeconds, durationSeconds);

  const postId = await withSupabaseMcp(async client => {
    const session = await resolveSession(client, sessionToken ?? '').catch(error => {
      if (error instanceof SessionError) {
        throw new RequestError(error.message, error.status);
      }
      throw error;
    });
    const inserted = await client.insert({
      table: 'posts',
      record: {
        owner_id: session.userId,
        title,
        description,
        storage_key: storageKey,
        duration_seconds: durationSeconds,
        resolution,
        sensitive: false,
      },
    });
    const id = inserted.id;
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
      throw new RequestError('post_insert_failed', 500);
    }
    if (tags.length || Number.isFinite(previewSeconds)) {
      for (const tag of tags) {
        await client.insert({
          table: 'ai_tags',
          record: {
            post_id: String(id),
            tag,
            trust: 0.7,
          },
        });
      }
      if (previewSeconds > 0) {
        await client.insert({
          table: 'ai_tags',
          record: { post_id: String(id), tag: `preview:${previewSeconds}`, trust: 1 },
        });
      }
    }
    return String(id);
  });

  const post = await fetchPostDetailFromSupabase(postId);
  if (!post) {
    throw new RequestError('post_fetch_failed', 500);
  }
  return normalizePost(post);
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as CreatePostRequest;
    const post = await createPostViaMcp(payload);
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof RequestError || error instanceof SupabaseMcpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('mcp_post_create_failed', error);
    return NextResponse.json({ error: 'create_post_failed' }, { status: 500 });
  }
}
function normalizePreviewSeconds(value: unknown, max: number) {
  const candidate = normalizeNumber(value, 0, 0, max);
  return Number.isFinite(candidate) ? Number(candidate.toFixed(2)) : 0;
}
