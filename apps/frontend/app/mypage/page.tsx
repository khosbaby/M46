import { Suspense } from 'react';
import MypageExperience from '@/components/MypageExperience';
import { fetchFeed } from '@/lib/api';
import { SAMPLE_POSTS } from '@/lib/samplePosts';
import { ApiPost } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function MypagePage() {
  let posts: ApiPost[] = [];
  try {
    posts = await fetchFeed();
  } catch (error) {
    console.warn('mypage_feed_failed', error);
  }
  if (!posts.length) {
    posts = SAMPLE_POSTS;
  }
  return (
    <Suspense fallback={null}>
      <MypageExperience posts={posts} />
    </Suspense>
  );
}
