import { NextRequest, NextResponse } from 'next/server';

import { DEFAULT_AVATAR_SRC } from '@/lib/defaultAvatar';
import { resolveSession, SessionError } from '@/lib/mcpSession';
import { withSupabaseMcp } from '@/lib/supabaseMcpClient';

function extractToken(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);
    const data = await withSupabaseMcp(async client => {
      const session = await resolveSession(client, token);
      const profileResult = await client.select({
        table: 'creator_profiles',
        columns: ['display_name', 'avatar', 'bio', 'tagline'],
        filters: { user_id: session.userId },
        limit: 1,
      });
      const profile = profileResult.rows?.[0] ?? {};
      return { session, profile };
    });
    const avatar =
      typeof data.profile.avatar === 'string' && data.profile.avatar.trim() ? data.profile.avatar : DEFAULT_AVATAR_SRC;
    return NextResponse.json({
      profile: {
        handle: data.session.handle,
        displayName: typeof data.profile.display_name === 'string' ? data.profile.display_name : data.session.handle,
        tagline: typeof data.profile.tagline === 'string' ? data.profile.tagline : '',
        bio: typeof data.profile.bio === 'string' ? data.profile.bio : '',
        avatar,
      },
    });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('profile_fetch_failed', error);
    return NextResponse.json({ error: 'profile_fetch_failed' }, { status: 500 });
  }
}
