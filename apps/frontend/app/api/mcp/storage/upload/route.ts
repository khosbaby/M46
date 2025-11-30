import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';

import { resolveSession, SessionError } from '@/lib/mcpSession';
import { withSupabaseMcp } from '@/lib/supabaseMcpClient';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'videos';
const PUBLIC_BASE =
  (process.env.SUPABASE_PUBLIC_STORAGE_BASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BASE_URL)?.replace(/\/$/, '') ?? '';

function ensureEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('supabase_storage_not_configured');
  }
}

function buildObjectPath(filename: string) {
  const safeName = filename.replace(/[^\w.-]+/g, '_').replace(/^_+/, '');
  const timestamp = Date.now();
  return `${timestamp}-${safeName || 'upload.mp4'}`;
}

function buildPublicUrl(objectPath: string) {
  if (PUBLIC_BASE) {
    return `${PUBLIC_BASE}/${objectPath}`;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    ensureEnv();
    const formData = await request.formData();
    const sessionToken = formData.get('sessionToken');
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file_required' }, { status: 400 });
    }
    const filenameInput = formData.get('filename');
    const filename = typeof filenameInput === 'string' && filenameInput.trim() ? filenameInput.trim() : file.name;
    const objectPath = buildObjectPath(filename);
    await withSupabaseMcp(async client => {
      await resolveSession(client, typeof sessionToken === 'string' ? sessionToken : '').catch(error => {
        if (error instanceof SessionError) {
          throw error;
        }
        throw new SessionError('session_validation_failed', 401);
      });
      return null;
    });
    const arrayBuffer = await file.arrayBuffer();
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: Buffer.from(arrayBuffer),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return NextResponse.json({ error: 'storage_upload_failed', detail }, { status: response.status });
    }
    const publicUrl = buildPublicUrl(objectPath);
    return NextResponse.json({ url: publicUrl, path: objectPath });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === 'supabase_storage_not_configured') {
      return NextResponse.json({ error: 'storage_not_configured' }, { status: 500 });
    }
    console.error('storage_upload_failed', error);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}
