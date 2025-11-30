import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';

import { DEFAULT_AVATAR_SRC } from '@/lib/defaultAvatar';
import { resolveSession, SessionError } from '@/lib/mcpSession';
import { withSupabaseMcp } from '@/lib/supabaseMcpClient';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET ?? 'avatars';
const AVATAR_PUBLIC_BASE =
  (process.env.SUPABASE_PUBLIC_AVATAR_BASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BASE_URL)?.replace(/\/$/, '') ??
  (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}` : '');

function ensureEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('supabase_storage_not_configured');
  }
}

function safeFilename(filename: string) {
  return filename.replace(/[^\w.-]+/g, '_').replace(/^_+/, '') || 'avatar.png';
}

function buildObjectPath(userId: string, filename: string) {
  const safeName = safeFilename(filename);
  return `${userId}/${Date.now()}-${safeName}`;
}

function buildPublicUrl(objectPath: string) {
  if (AVATAR_PUBLIC_BASE) {
    return `${AVATAR_PUBLIC_BASE}/${objectPath}`;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${objectPath}`;
}

async function uploadAvatar(objectPath: string, file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${objectPath}`;
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
    throw new Error(detail || 'avatar_upload_failed');
  }
  return buildPublicUrl(objectPath);
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    ensureEnv();
    const formData = await request.formData();
    const sessionToken = formData.get('sessionToken');
    const file = formData.get('file');
    const action = formData.get('action');
    const avatarUrl: string = await withSupabaseMcp(async client => {
      const session = await resolveSession(client, typeof sessionToken === 'string' ? sessionToken : '');
      let nextAvatar = DEFAULT_AVATAR_SRC;
      if (file instanceof File && file.size > 0) {
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
          throw new SessionError('invalid_avatar_type', 400);
        }
        const objectPath = buildObjectPath(session.userId, file.name);
        nextAvatar = await uploadAvatar(objectPath, file);
      } else if (action !== 'reset') {
        throw new SessionError('avatar_file_required', 400);
      }
      const result = await client.select({
        table: 'creator_profiles',
        columns: ['user_id'],
        filters: { user_id: session.userId },
        limit: 1,
      });
      if (result.rowCount > 0) {
        await client.update({
          table: 'creator_profiles',
          filters: { user_id: session.userId },
          changes: { avatar: nextAvatar },
        });
      } else {
        await client.insert({
          table: 'creator_profiles',
          record: {
            user_id: session.userId,
            avatar: nextAvatar,
          },
        });
      }
      return nextAvatar;
    });
    return NextResponse.json({ avatar: avatarUrl });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === 'supabase_storage_not_configured') {
      return NextResponse.json({ error: 'storage_not_configured' }, { status: 500 });
    }
    console.error('avatar_upload_failed', error);
    return NextResponse.json({ error: 'avatar_upload_failed' }, { status: 500 });
  }
}
