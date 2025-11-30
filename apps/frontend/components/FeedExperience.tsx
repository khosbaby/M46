'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiPost } from '@/lib/types';
import { useUiPreferences } from '@/components/providers/UiPreferencesProvider';
import { useRouter } from 'next/navigation';
import { resolveMediaSource } from '@/lib/media';

type Props = {
  initialPosts: ApiPost[];
  fallbackMessage: string | null;
};

const RECENT_TAGS_KEY = 'm46_recent_tags';

function formatDuration(seconds: number | undefined) {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds | 0}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}m ${rem | 0}s`;
}

function normalizeTags(post: ApiPost) {
  const tags = post.aiTags.length ? post.aiTags.map(tag => tag.tag) : post.tags;
  return tags.map(tag => tag.trim().toLowerCase()).filter(Boolean);
}

function FeedPreviewVideo({ src, autoplay, previewSeconds }: { src: string; autoplay: boolean; previewSeconds?: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [posterUrl, setPosterUrl] = useState('');

  useEffect(() => {
    if (!autoplay) {
      if (!src) {
        setPosterUrl('');
        return;
      }
      let cancelled = false;
      const tempVideo = document.createElement('video');
      tempVideo.crossOrigin = 'anonymous';
      tempVideo.preload = 'metadata';
      tempVideo.src = src;

      const captureFrame = () => {
        if (cancelled) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = tempVideo.videoWidth || 480;
          canvas.height = tempVideo.videoHeight || 852;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            setPosterUrl(canvas.toDataURL('image/jpeg', 0.82));
          }
        } catch {
          setPosterUrl('');
        }
      };

      const handleSeeked = () => {
        captureFrame();
      };

      const handleLoaded = () => {
        if (cancelled) return;
        const preview = Number.isFinite(previewSeconds) ? Number(previewSeconds) : 0;
        if (preview > 0 && preview < (tempVideo.duration || Infinity)) {
          tempVideo.currentTime = preview;
          tempVideo.addEventListener('seeked', handleSeeked, { once: true });
        } else {
          captureFrame();
        }
      };

      tempVideo.addEventListener('loadeddata', handleLoaded, { once: true });
      tempVideo.load();

      return () => {
        cancelled = true;
        tempVideo.pause();
        tempVideo.removeAttribute('src');
        tempVideo.load();
      };
    }

    const video = videoRef.current;
    if (!video || !src) return;
    const handleLoaded = () => {
      const preview = Number.isFinite(previewSeconds) ? Number(previewSeconds) : 0;
      if (preview > 0 && preview < (video.duration || Infinity)) {
        try {
          video.currentTime = preview;
        } catch {
          // no-op
        }
      }
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
    };
  }, [src, previewSeconds, autoplay]);

  if (autoplay) {
    if (!src) return <span>プレビュー中…</span>;
    return (
      <video
        ref={videoRef}
        className="card-video"
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        poster="/logo/logo_grad_2.svg"
      />
    );
  }

  if (posterUrl) {
    return (
      <Image
        src={posterUrl}
        alt="video preview"
        width={480}
        height={852}
        className="h-full w-full rounded-[20px] object-cover"
        unoptimized
      />
    );
  }
  return <span>プレビュー中…</span>;
}

export default function FeedExperience({ initialPosts, fallbackMessage }: Props) {
  const router = useRouter();
  const { saveMode, searchTag } = useUiPreferences();
  const normalizedTag = searchTag.replace(/^[#\s]+/, '').toLowerCase();
  const [recentTags, setRecentTags] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RECENT_TAGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const tags = Array.isArray(parsed?.tags) ? parsed.tags.filter((value: unknown) => typeof value === 'string') : [];
      if (tags.length) {
        setRecentTags(tags.map(tag => tag.toLowerCase()));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const filteredPosts = useMemo(() => {
    return initialPosts.filter(post => {
      if (saveMode && post.sensitive) return false;
      if (!normalizedTag) return true;
      const tags = (post.tags.length ? post.tags : post.aiTags.map(tag => tag.tag)).map(tag => tag.toLowerCase());
      return tags.includes(normalizedTag);
    });
  }, [initialPosts, saveMode, normalizedTag]);

  const candidatePosts = filteredPosts.length ? filteredPosts : initialPosts;

  const posts = useMemo(() => {
    if (!recentTags.length) return candidatePosts;
    const recentSet = new Set(recentTags);
    const tagWeight = 1000000;
    return [...candidatePosts].sort((a, b) => {
      const tagsA = normalizeTags(a);
      const tagsB = normalizeTags(b);
      const matchesA = tagsA.reduce((count, tag) => (recentSet.has(tag) ? count + 1 : count), 0);
      const matchesB = tagsB.reduce((count, tag) => (recentSet.has(tag) ? count + 1 : count), 0);
      const viewsA = a.postStats?.views ?? 0;
      const viewsB = b.postStats?.views ?? 0;
      const scoreA = matchesA * tagWeight + viewsA;
      const scoreB = matchesB * tagWeight + viewsB;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return 0;
    });
  }, [candidatePosts, recentTags]);

  function openPost(id: string) {
    router.push(`/watch/${id}`);
  }

  function shouldIgnore(target: EventTarget | null) {
    return Boolean((target as HTMLElement | null)?.closest('button'));
  }

  function handleNavigate(event: MouseEvent<HTMLElement>, id: string) {
    if (shouldIgnore(event.target)) return;
    openPost(id);
  }

  function handleKeyNavigate(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (shouldIgnore(event.target)) return;
    event.preventDefault();
    openPost(id);
  }

  return (
    <div className="view-stack">
      <section className="feed-wrapper">
        {fallbackMessage && <p className="player-description">{fallbackMessage}</p>}
        <div className="feed-grid">
          {posts.map((post, index) => {
            const tags = post.aiTags.length ? post.aiTags.map(tag => tag.tag) : post.tags;
            const previewSrc = resolveMediaSource(post.storageKey);
            const isMasked = saveMode && post.sensitive;
            return (
              <article
                key={post.id}
                className={clsx('card', isMasked && 'hidden')}
                data-autoplay={index % 5 === 0}
                onClick={event => handleNavigate(event, post.id)}
                role="button"
                tabIndex={0}
                onKeyDown={event => handleKeyNavigate(event, post.id)}
              >
                <div className="video-placeholder">
                  <FeedPreviewVideo src={previewSrc} autoplay={index % 5 === 0} previewSeconds={post.previewSeconds} />
                </div>
                <div className="sr-only">
                  <p>{post.title}</p>
                  <p>{(post.author?.displayName ?? post.author?.handle ?? 'creator') + ' / ' + formatDuration(post.durationSeconds)}</p>
                  <p>{tags.slice(0, 3).map(tag => `#${tag}`).join(' ')}</p>
                </div>
              </article>
            );
          })}
        </div>
        {!posts.length && <p className="player-description">表示できる投稿がありません。条件を緩めてください。</p>}
      </section>
      <div className="post-fab" aria-hidden="false">
        <a href="/post" className="ghost-btn primary" aria-label="新規投稿">
          POST
        </a>
      </div>
    </div>
  );
}
