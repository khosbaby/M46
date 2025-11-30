import { Suspense } from 'react';
import FeedExperience from '@/components/FeedExperience';
import { fetchFeed } from '@/lib/api';
import { ApiPost } from '@/lib/types';
import { SAMPLE_POSTS } from '@/lib/samplePosts';
import AuthGateway from '@/components/auth/AuthGateway';
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedFeed: { posts: ApiPost[]; fetchedAt: number } | null = null;

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function HomePage() {
  let posts: ApiPost[] = [];
  let fallbackMessage: string | null = null;
  try {
    posts = await fetchFeed();
    if (posts.length) {
      cachedFeed = { posts, fetchedAt: Date.now() };
    }
  } catch (err) {
    const cachedValid = cachedFeed && Date.now() - cachedFeed.fetchedAt <= FEED_CACHE_TTL_MS;
    if (cachedValid) {
      posts = cachedFeed!.posts;
      fallbackMessage = '最新のフィード取得に失敗したため、直近のキャッシュを表示しています。';
      console.warn('feed_fetch_failed_using_cache', err);
    } else {
      posts = SAMPLE_POSTS;
      fallbackMessage = `Supabase API (${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'}) に接続できなかったため、ダミーフィードを表示しています。`;
      console.error('Failed to fetch feed, using SAMPLE_POSTS', err);
    }
  }
  return (
    <Suspense fallback={null}>
      <AuthGateway feed={<FeedExperience initialPosts={posts} fallbackMessage={fallbackMessage} />} />
    </Suspense>
  );
}
