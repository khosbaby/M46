import { fetchFeed } from '@/lib/api';
import { ApiPost } from '@/lib/types';
import { SAMPLE_POSTS } from '@/lib/samplePosts';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';

function normalizeHandle(value: string) {
  return value.replace(/^@/, '').toLowerCase();
}

export default async function CreatorPage({ params }: { params: { handle: string } }) {
  const paramHandle = decodeURIComponent(params.handle);
  const normalizedHandle = normalizeHandle(paramHandle);
  let posts: ApiPost[] = [];
  try {
    posts = await fetchFeed();
  } catch (error) {
    console.warn('creator_feed_fallback', error);
    posts = SAMPLE_POSTS;
  }
  const filtered = posts.filter(post => normalizeHandle(post.author?.handle ?? post.authorHandle ?? '') === normalizedHandle);
  if (!filtered.length) {
    notFound();
  }
  const hero = filtered[0];

  return (
    <div className="bg-gradient-to-b from-[#05060c] via-[#050918] to-[#04060f] px-4 py-10 text-white lg:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-3xl bg-gradient-to-br from-[#090b16]/90 to-[#050812]/80 p-6 shadow-[0_40px_160px_rgba(2,4,12,0.55)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-white/10">
              {hero.author?.avatar ? (
                <Image
                  src={hero.author.avatar}
                  alt={hero.author.displayName ?? hero.authorHandle ?? 'creator avatar'}
                  width={80}
                  height={80}
                  className="h-full w-full rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl">{hero.author?.displayName?.slice(0, 1) ?? '?'}</div>
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">@{normalizedHandle}</p>
              <h1 className="text-3xl font-semibold">{hero.author?.displayName ?? hero.authorDisplay ?? paramHandle}</h1>
              {hero.author?.tagline && <p className="text-sm text-white/60">{hero.author.tagline}</p>}
            </div>
            <div className="flex gap-4 text-sm text-white/70">
              <div>
                <p className="text-xs text-white/50">投稿数</p>
                <p className="text-2xl font-semibold">{filtered.length}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">ビュー</p>
                <p className="text-2xl font-semibold">
                  {Intl.NumberFormat('ja-JP', { notation: 'compact' }).format(
                    filtered.reduce((sum, item) => sum + (item.postStats?.views ?? 0), 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-3xl bg-gradient-to-br from-[#090b16]/80 to-[#050812]/70 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">投稿一覧</h2>
            <Link href="/" className="text-sm text-sky-300">
              フィードへ戻る →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {filtered.map(post => (
              <Link
                key={post.id}
                href={`/watch/${post.id}`}
                className="rounded-3xl bg-[#0c101f]/80 p-4 shadow-[0_20px_60px_rgba(4,6,15,0.55)] transition hover:scale-[1.01]"
              >
                <p className="text-xs text-white/50">{new Date(post.createdAt).toLocaleDateString('ja-JP')}</p>
                <h3 className="mt-2 text-xl font-semibold">{post.title}</h3>
                <p className="mt-2 text-sm text-white/60 line-clamp-2">{post.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {(post.tags.length ? post.tags : post.aiTags.map(tag => tag.tag)).slice(0, 3).map(tag => (
                    <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                      #{tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
