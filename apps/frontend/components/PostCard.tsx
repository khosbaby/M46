import { ApiPost } from '@/lib/types';
import { resolveMediaSource } from '@/lib/media';
import { AdaptiveVideo } from '@/components/AdaptiveVideo';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  post: ApiPost;
  saveMode?: boolean;
  onSelectTag?: (tag: string) => void;
  onFocus?: (post: ApiPost | null) => void;
  variant?: 'grid' | 'list';
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds | 0}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}m ${rem | 0}s`;
}

function formatNumber(value: number | undefined) {
  if (typeof value !== 'number') return '-';
  return Intl.NumberFormat('ja-JP', { notation: 'compact' }).format(value);
}

export default function PostCard({ post, saveMode, onSelectTag, onFocus, variant = 'grid' }: Props) {
  const [isHovered, setHovered] = useState(false);
  const tags = post.aiTags.length ? post.aiTags : post.tags.map(tag => ({ tag }));
  const mediaSource = useMemo(() => resolveMediaSource(post.storageKey), [post.storageKey]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;
    const shouldPlay = isHovered || variant === 'list';
    if (shouldPlay) {
      player.play().catch(() => {});
    } else {
      player.pause();
    }
  }, [isHovered, variant]);

  return (
    <article
      className={clsx(
        'group relative overflow-hidden rounded-3xl bg-[#0b0d1b]/80 shadow-[0_20px_80px_rgba(3,5,15,0.65)] transition hover:scale-[1.01]',
        variant === 'list' ? 'flex gap-4 p-4 md:flex-row' : 'flex flex-col p-4'
      )}
      onMouseEnter={() => {
        setHovered(true);
        onFocus?.(post);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onFocus?.(null);
      }}
    >
      <div className={clsx('relative overflow-hidden rounded-2xl bg-black/40', variant === 'list' ? 'w-48 flex-shrink-0' : 'mb-4')}>
        {mediaSource ? (
          <AdaptiveVideo
            ref={videoRef}
            src={mediaSource}
            playsInline
            muted
            loop
            controls={false}
            poster="/logo/logo_grad_2.svg"
            className={clsx(
              'aspect-[9/16] w-full object-cover transition duration-500',
              isHovered ? 'scale-[1.02]' : 'scale-100'
            )}
          />
        ) : (
          <div className="aspect-[9/16] w-full bg-gradient-to-b from-slate-900 to-black" />
        )}
        {saveMode && post.sensitive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm font-semibold text-white/80 backdrop-blur">
            Saveモードのためマスク中
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70">
          {post.resolution}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-black">{formatDuration(post.durationSeconds)}</div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <header>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">#{post.id.slice(0, 6)}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{post.title}</h3>
          <p
            className="mt-1 text-sm text-white/70"
            style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {post.description}
          </p>
        </header>
        <div className="flex flex-wrap gap-2 text-xs">
          {tags.slice(0, 5).map(tag => (
            <button
              key={tag.tag}
              type="button"
              className="rounded-full bg-white/10 px-3 py-1 text-white/80 transition hover:bg-white/20"
              onClick={() => onSelectTag?.(tag.tag)}
            >
              #{tag.tag}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
          <span>👀 {formatNumber(post.postStats?.views)}</span>
          <span>🔥 {formatNumber(post.popularity)}</span>
        </div>
        {post.author && (
          <div className="flex items-center gap-3 text-sm text-white/70">
            <div className="h-9 w-9 rounded-full bg-white/10" />
            <div>
              <p className="font-medium text-white">{post.author.displayName || post.author.handle}</p>
              {post.author.tagline && <p className="text-xs text-white/60">{post.author.tagline}</p>}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
