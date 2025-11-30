import MypageExperience from '@/components/MypageExperience';
import { fetchFeed } from '@/lib/api';
import { SAMPLE_POSTS } from '@/lib/samplePosts';
import { ApiPost } from '@/lib/types';

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
  return <MypageExperience posts={posts} />;
}
