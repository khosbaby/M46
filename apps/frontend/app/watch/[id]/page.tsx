import WatchExperience from '@/components/WatchExperience';
import { fetchFeed, fetchPostById } from '@/lib/api';
import { ApiPost } from '@/lib/types';
import { notFound } from 'next/navigation';

type Props = {
  params: { id: string };
};

function resolveTags(post: ApiPost) {
  const tags = post.aiTags.length ? post.aiTags.map(tag => tag.tag) : post.tags;
  return tags.map(tag => tag.trim().toLowerCase()).filter(Boolean);
}

function orderByAffinity(base: ApiPost, entries: ApiPost[]) {
  const baseTags = new Set(resolveTags(base));
  return entries
    .filter(item => item.id !== base.id)
    .map((item, index) => {
      const tags = resolveTags(item);
      const overlap = tags.reduce((count, tag) => (baseTags.has(tag) ? count + 1 : count), 0);
      const views = item.postStats?.views ?? item.popularity ?? 0;
      const randomSeed = Math.sin(parseInt(item.id.slice(0, 6), 16) || index);
      const score = overlap * 5000 + views * 2 + randomSeed;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.item);
}

export default async function WatchPage({ params }: Props) {
  const { id } = params;
  let focusedPost: ApiPost | null = null;
  try {
    focusedPost = await fetchPostById(id);
  } catch (error) {
    console.warn('watch_fetchPost_failed', error);
  }
  if (!focusedPost) {
    notFound();
  }

  let feed: ApiPost[] = [];
  try {
    feed = await fetchFeed();
  } catch (error) {
    console.warn('watch_fetchFeed_failed', error);
  }
  if (!feed.length) {
    feed = [focusedPost];
  }

  const playlistMap = new Map<string, ApiPost>();
  for (const entry of feed) {
    playlistMap.set(entry.id, entry);
  }
  playlistMap.set(focusedPost.id, focusedPost);
  const deduped = Array.from(playlistMap.values());
  const ordered = orderByAffinity(focusedPost, deduped);
  const playlist = [focusedPost, ...ordered.filter(item => item.id !== focusedPost.id)];

  return <WatchExperience initialPost={focusedPost} playlist={playlist} />;
}
