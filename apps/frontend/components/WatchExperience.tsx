'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiPost } from '@/lib/types';
import { resolveMediaSource } from '@/lib/media';
import { fetchPostByIdClient } from '@/lib/browserApi';
import { AdaptiveVideo } from '@/components/AdaptiveVideo';

type Props = {
  playlist: ApiPost[];
  initialPost: ApiPost;
};

type OrientationInfo = {
  width: number;
  height: number;
  isVertical: boolean;
};

function parseResolution(value: string): OrientationInfo {
  const match = value.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) {
    return { width: 0, height: 0, isVertical: true };
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return { width, height, isVertical: height >= width };
}

function IconSpeaker({ muted }: { muted: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10v4h4l5 4V6l-5 4H4z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {muted ? (
        <path d="M17 9l4 6m0-6l-4 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M17 8c1.5 1 2 2.5 2 4s-.5 3-2 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 6c2 1.5 3 3.5 3 6s-1 4.5-3 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function IconBookmark({ active }: { active: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4h12v16l-6-4-6 4V4z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}

function IconComment() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h16v10H9l-5 4V5z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

function CommentToggle({ comments }: { comments: ApiPost['comments'] | undefined }) {
  const [open, setOpen] = useState(false);
  const list = comments ?? [];
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-label="コメントを表示"
      >
        <IconComment />
      </button>
      {open && (
        <div className="max-h-48 w-72 overflow-y-auto rounded-3xl bg-black/80 px-4 py-3 text-left text-xs text-white/80 shadow-lg backdrop-blur">
          {list.length ? (
            list.map(comment => (
              <article key={comment.id} className="mb-3 last:mb-0">
                <p className="font-semibold">{comment.author?.displayName ?? comment.author?.handle ?? 'anonymous'}</p>
                <p className="text-[10px] text-white/40">{new Date(comment.createdAt).toLocaleString('ja-JP')}</p>
                <p className="mt-1 leading-relaxed">{comment.body}</p>
              </article>
            ))
          ) : (
            <p className="text-white/50">コメントはまだありません。</p>
          )}
        </div>
      )}
    </div>
  );
}

const RECENT_TAGS_KEY = 'm46_recent_tags';

function extractNormalizedTags(post: ApiPost | null | undefined) {
  if (!post) return [];
  const tags = post.aiTags.length ? post.aiTags.map(tag => tag.tag) : post.tags;
  return tags.map(tag => tag.trim().toLowerCase()).filter(Boolean);
}

function resolveAuthorName(post: ApiPost) {
  return post.author?.displayName ?? post.author?.handle ?? post.authorDisplay ?? post.authorHandle ?? 'unknown creator';
}

function resolveAuthorAvatar(post: ApiPost) {
  return post.author?.avatar ?? post.authorAvatar ?? null;
}

function deriveInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'M46';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? '');
  const initials = chars.join('');
  if (initials) return initials;
  return trimmed.slice(0, 2).toUpperCase();
}

export default function WatchExperience({ playlist, initialPost }: Props) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(() => {
    const index = playlist.findIndex(item => item.id === initialPost.id);
    return index >= 0 ? index : 0;
  });
  const [postMap, setPostMap] = useState<Map<string, ApiPost>>(() => {
    const map = new Map<string, ApiPost>();
    map.set(initialPost.id, initialPost);
    return map;
  });
  const [muted, setMuted] = useState(true);
  const [isFetchingDetails, setFetchingDetails] = useState(false);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollRaf = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const scrollReleaseTimeout = useRef<NodeJS.Timeout | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const handleTagNavigate = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) return;
      router.push(`/?tag=${encodeURIComponent(normalized)}`);
    },
    [router]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('m46_bookmarks');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setBookmarkedIds(new Set(parsed));
      }
    } catch {
      // ignore
    }
  }, []);

  const persistBookmarks = useCallback((ids: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('m46_bookmarks', JSON.stringify(Array.from(ids)));
    } catch {
      // ignore
    }
  }, []);

  const toggleBookmark = useCallback(
    (postId: string) => {
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        if (next.has(postId)) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        persistBookmarks(next);
        return next;
      });
    },
    [persistBookmarks]
  );

  const activePost = useMemo(() => {
    const entry = playlist[activeIndex];
    if (!entry) return null;
    return postMap.get(entry.id) ?? entry;
  }, [playlist, activeIndex, postMap]);

  const activeTags = useMemo(() => extractNormalizedTags(activePost), [activePost]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeTags.length) return;
    try {
      const payload = {
        tags: Array.from(new Set(activeTags)).slice(0, 20),
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(payload));
    } catch {
      // ignore localStorage failures
    }
  }, [activeTags]);

  useEffect(() => {
    setPostMap(prev => {
      if (prev.has(initialPost.id)) return prev;
      const next = new Map(prev);
      next.set(initialPost.id, initialPost);
      return next;
    });
  }, [initialPost]);

  useEffect(() => {
    const target = playlist[activeIndex];
    if (!target || postMap.has(target.id)) return;
    let cancelled = false;
    setFetchingDetails(true);
    fetchPostByIdClient(target.id)
      .then(post => {
        if (!post || cancelled) return;
        setPostMap(prev => {
          const next = new Map(prev);
          next.set(post.id, post);
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setFetchingDetails(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeIndex, playlist, postMap]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const current = playlist[activeIndex];
    if (!current) return;
    const nextUrl = `/watch/${current.id}`;
    if (window.location.pathname !== nextUrl) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, [activeIndex, playlist]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) {
        video.currentTime = 0;
        const promise = video.play();
        if (promise) promise.catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeIndex]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex(index => Math.max(0, index - 1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex(index => Math.min(playlist.length - 1, index + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playlist.length]);

  const scrollToIndex = useCallback(
    (target: number) => {
      if (target < 0 || target >= playlist.length) return;
      const track = trackRef.current;
      const card = cardRefs.current[target];
      if (!track || !card) return;
      if (scrollReleaseTimeout.current) {
        clearTimeout(scrollReleaseTimeout.current);
        scrollReleaseTimeout.current = null;
      }
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const nextScrollLeft = cardCenter - track.clientWidth / 2;
      isProgrammaticScroll.current = true;
      track.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
      setActiveIndex(target);
      scrollReleaseTimeout.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 400);
    },
    [playlist.length]
  );

  const goPrev = useCallback(() => {
    scrollToIndex(Math.max(0, activeIndex - 1));
  }, [activeIndex, scrollToIndex]);

  const goNext = useCallback(() => {
    scrollToIndex(Math.min(playlist.length - 1, activeIndex + 1));
  }, [activeIndex, playlist.length, scrollToIndex]);

  const mediaSources = useMemo(() => playlist.map(post => resolveMediaSource(post.storageKey)), [playlist]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rawTarget = event.target;
    if (!(rawTarget instanceof Element)) return;
    const isInsideStage = rawTarget.closest('.watch-stage');
    if (!isInsideStage) {
      return;
    }
    event.preventDefault();
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    trackRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;
    if (scrollRaf.current) {
      cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = null;
    }
    scrollRaf.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const centerX = trackRect.left + trackRect.width / 2;
      let closestIndex = activeIndex;
      let minDistance = Number.POSITIVE_INFINITY;
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(cardCenter - centerX);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      setActiveIndex(prev => (prev === closestIndex ? prev : closestIndex));
    });
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (scrollRaf.current) {
        cancelAnimationFrame(scrollRaf.current);
      }
      if (scrollReleaseTimeout.current) {
        clearTimeout(scrollReleaseTimeout.current);
      }
    };
  }, []);

  return (
    <div className="watch-root relative min-h-screen w-full overflow-x-hidden bg-black text-white">
      <div
        ref={trackRef}
        className="watch-track relative mx-auto flex min-h-[calc(100vh-4rem)] w-full snap-x snap-mandatory gap-6 overflow-x-auto overflow-y-hidden px-8 py-6 scroll-smooth"
        onWheel={handleWheel}
        onScroll={handleScroll}
      >
        {playlist.map((post, index) => {
          const mediaSrc = mediaSources[index];
          const isActive = index === activeIndex;
          const postTags = post.aiTags.length ? post.aiTags.map(tag => tag.tag) : post.tags;
          const { isVertical } = parseResolution(post.resolution);
          const authorName = resolveAuthorName(post);
          const avatarSrc = resolveAuthorAvatar(post);
          const authorInitials = deriveInitials(authorName);
          const canGoPrevLocal = index > 0;
          const canGoNextLocal = index < playlist.length - 1;
          return (
            <article
              key={post.id}
              ref={element => {
                cardRefs.current[index] = element;
              }}
              className={clsx(
                'relative snap-center flex h-full w-[80vw] max-w-5xl flex-none flex-col items-center justify-center transition-opacity duration-500',
                isActive ? 'opacity-100' : 'opacity-35'
              )}
            >
              <div className="watch-stage relative flex h-[88vh] w-full items-center justify-center overflow-hidden rounded-[32px] bg-gradient-to-b from-slate-950 via-black to-slate-950 shadow-[0_20px_120px_rgba(0,0,0,0.45)]">
                {mediaSrc ? (
                  <AdaptiveVideo
                    ref={element => {
                      videoRefs.current[index] = element;
                    }}
                    src={mediaSrc}
                    playsInline
                    loop
                    muted={muted}
                    preload="auto"
                    onEnded={() => scrollToIndex(Math.min(playlist.length - 1, index + 1))}
                    className="watch-stage__video"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-[24px] bg-white/5 text-white/40">動画を読み込めません</div>
                )}
                {isActive && (
                    <>
                    {isFetchingDetails && (
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1 text-xs text-white/70 shadow-lg">
                        syncing metadata...
                      </div>
                    )}
                    <button
                      type="button"
                      className="watch-stage__arrow watch-stage__arrow--left"
                      onClick={goPrev}
                      disabled={!canGoPrevLocal}
                      aria-label="前の動画"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="watch-stage__arrow watch-stage__arrow--right"
                      onClick={goNext}
                      disabled={!canGoNextLocal}
                      aria-label="次の動画"
                    >
                      ›
                    </button>
                    <div className="watch-meta-panel">
                      <div className="flex items-center gap-6">
                    <div className="watch-author-initial overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.25)]">
                          {avatarSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarSrc} alt={authorName} className="h-full w-full object-cover" />
                          ) : (
                            <span>{authorInitials}</span>
                          )}
                        </div>
                    <div className="flex flex-col gap-2">
                          <p className="text-xs uppercase tracking-[0.35em] text-white/60">{authorName}</p>
                          <h2 className="mt-1 text-2xl font-semibold text-white">{post.title}</h2>
                        </div>
                      </div>
                      <p className="watch-meta-desc">{post.description}</p>
                      {postTags.length > 0 && (
                        <div className="watch-tags">
                          {postTags.slice(0, 6).map(tag => (
                            <button key={`${post.id}-overlay-tag-${tag}`} type="button" onClick={() => handleTagNavigate(tag)} className="watch-tag-chip">
                              <span>#</span>
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="watch-actions">
                      <button
                        type="button"
                        className="watch-action-btn"
                        onClick={() => setMuted(value => !value)}
                        aria-label={muted ? 'ミュート解除' : 'ミュート'}
                      >
                        <IconSpeaker muted={muted} />
                      </button>
                      <button
                        type="button"
                        className={clsx('watch-action-btn', bookmarkedIds.has(post.id) && 'watch-action-btn--active')}
                        onClick={() => toggleBookmark(post.id)}
                        aria-pressed={bookmarkedIds.has(post.id)}
                        aria-label={bookmarkedIds.has(post.id) ? 'ブックマークを解除' : 'ブックマーク'}
                      >
                        <IconBookmark active={bookmarkedIds.has(post.id)} />
                      </button>
                      <div className="watch-action-btn watch-action-btn__comments">
                        <CommentToggle comments={post.comments ?? []} />
                      </div>
                    </div>
                    <div className="watch-nav-controls" aria-label="動画ナビゲーション">
                      <p className="watch-nav-controls__title" title={post.title}>
                        {post.title}
                      </p>
                      <div className="watch-nav-controls__status" aria-live="polite">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <span className="watch-nav-controls__divider" aria-hidden="true">
                          /
                        </span>
                        <span>{String(playlist.length).padStart(2, '0')}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
