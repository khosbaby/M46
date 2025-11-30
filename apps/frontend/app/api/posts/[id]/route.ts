import { NextResponse } from 'next/server';

import { fetchPostById } from '@/lib/api';

type RouteContext = {
  params: { id: string };
};

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: RouteContext) {
  const id = context.params?.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }
  try {
    const post = await fetchPostById(id);
    if (!post) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error) {
    console.error('api_posts_id_error', error);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
