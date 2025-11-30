'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiPost } from '@/lib/types';
import { DEFAULT_AVATAR_SRC } from '@/lib/defaultAvatar';
import { useSession } from '@/components/providers/SessionProvider';
import PasskeyManager from './PasskeyManager';
import { useRouter } from 'next/navigation';

type Props = {
  posts: ApiPost[];
};

const tabs = [
  { id: 'posts', label: '投稿一覧' },
  { id: 'generations', label: '生成動画' },
  { id: 'settings', label: '設定' },
];

export default function MypageExperience({ posts }: Props) {
  const [activeTab, setActiveTab] = useState<'posts' | 'generations' | 'settings'>('posts');
  const { sessionToken, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<{ handle: string; displayName: string; tagline: string; bio: string; avatar: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarMessageType, setAvatarMessageType] = useState<'success' | 'error' | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => {
    const watchSeconds = posts.reduce((sum, item) => sum + (item.postStats?.watchSeconds ?? 0), 0);
    return {
      totalPosts: posts.length,
      avgDuration: posts.length ? posts.reduce((sum, item) => sum + item.durationSeconds, 0) / posts.length : 0,
      watchSeconds,
    };
  }, [posts]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/?auth=signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (!sessionToken) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    let cancelled = false;
    async function loadProfile() {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const response = await fetch('/api/mcp/profile', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const payload = (await response.json().catch(() => ({}))) as { profile?: any; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? 'profile_fetch_failed');
        }
        if (!cancelled && payload.profile) {
          setProfile({
            handle: payload.profile.handle,
            displayName: payload.profile.displayName,
            tagline: payload.profile.tagline,
            bio: payload.profile.bio,
            avatar: payload.profile.avatar ?? DEFAULT_AVATAR_SRC,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(error instanceof Error ? error.message : 'profile_fetch_failed');
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const displayName = profile?.displayName ?? 'クリエイターハブ';
  const handle = profile?.handle ?? '@creator_passkey';
  const tagline = profile?.tagline ?? 'AIタグ嗜好・パスキー・プロフィールをここで管理します。';
  const avatarSrc = profile?.avatar ?? DEFAULT_AVATAR_SRC;

  const handleAvatarUpload = async (file: File | null, reset = false) => {
    if (!sessionToken) {
      setAvatarMessage('セッションが無効です。再度サインインしてください。');
      setAvatarMessageType('error');
      return;
    }
    if (!reset && !file) {
      setAvatarMessage('画像ファイルを選択してください。');
      return;
    }
    const formData = new FormData();
    formData.append('sessionToken', sessionToken);
    if (reset) {
      formData.append('action', 'reset');
    } else if (file) {
      formData.append('file', file);
    }
    setAvatarUploading(true);
    setAvatarMessage(null);
    setAvatarMessageType(null);
    try {
      const response = await fetch('/api/mcp/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as { avatar?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'avatar_upload_failed');
      }
      const nextAvatar = payload.avatar ?? DEFAULT_AVATAR_SRC;
      setAvatarMessage('アイコンを更新しました。');
      setAvatarMessageType('success');
      setProfile(prev => (prev ? { ...prev, avatar: nextAvatar } : prev));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : 'avatar_upload_failed');
      setAvatarMessageType('error');
    } finally {
      setAvatarUploading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="px-4 py-16 text-center text-white/70">
        <p className="text-sm uppercase tracking-[0.4em] text-white/40">Session</p>
        <p className="mt-2 text-2xl font-semibold text-white">認証状態を確認しています…</p>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <div className="px-4 py-16 text-center text-white/70">
        <p className="text-sm uppercase tracking-[0.4em] text-white/40">Auth required</p>
        <p className="mt-2 text-2xl font-semibold text-white">サインインしてマイページを表示してください。</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-[#05060c] via-[#050918] to-[#04060f] px-4 py-10 text-white lg:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="glass-panel px-6 py-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">{handle}</p>
              <h1 className="text-3xl font-semibold">{displayName}</h1>
              <p className="text-sm text-white/60">{tagline}</p>
              {profileLoading && <p className="text-xs text-white/40">プロフィールを同期中...</p>}
              {profileError && <p className="text-xs text-rose-300">{profileError}</p>}
            </div>
          </div>
          <div className="mt-6 grid gap-4 text-sm text-white/70 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-xs text-white/50">投稿数</p>
              <p className="text-2xl font-semibold text-white">{summary.totalPosts}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-xs text-white/50">平均尺</p>
              <p className="text-2xl font-semibold text-white">{summary.avgDuration.toFixed(1)} 秒</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-xs text-white/50">累計Watch</p>
              <p className="text-2xl font-semibold text-white">{Intl.NumberFormat('ja-JP').format(summary.watchSeconds)} 秒</p>
            </div>
          </div>
        </section>

        <section className="glass-panel px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={clsx(
                  'rounded-full px-4 py-2 text-sm',
                  activeTab === tab.id ? 'bg-sky-500/20 text-white' : 'bg-white/5 text-white/60 hover:text-white'
                )}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-6">
            {activeTab === 'posts' && (
              <div className="grid gap-4 md:grid-cols-2">
                {posts.slice(0, 4).map(post => (
                  <div key={post.id} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs text-white/50">{new Date(post.createdAt).toLocaleDateString()}</p>
                    <h3 className="text-lg font-semibold">{post.title}</h3>
                    <p className="text-sm text-white/60 line-clamp-2">{post.description}</p>
                    <p className="text-xs text-white/50">
                      AIタグ: {post.aiTags.slice(0, 3).map(tag => tag.tag).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'generations' && (
              <div className="space-y-4 text-sm text-white/70">
                <p>生成中の動画はまだありません。Postタブからキューに追加してください。</p>
                <div className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-center text-white/40">
                  Coming soon: マルチモデル生成ステータス
                </div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="grid gap-6 text-sm text-white/80 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">アイコン</p>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 overflow-hidden rounded-full bg-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex flex-col gap-2 text-xs text-white/60">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          disabled={!sessionToken || avatarUploading}
                          onChange={event => handleAvatarUpload(event.target.files?.[0] ?? null)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-white/15 px-3 py-1 text-white hover:bg-white/20 disabled:opacity-50"
                            onClick={() => handleAvatarUpload(null, true)}
                            disabled={!sessionToken || avatarUploading}
                          >
                            デフォルトに戻す
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-white/15 px-3 py-1 text-white hover:bg-white/20 disabled:opacity-50"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!sessionToken || avatarUploading}
                          >
                            ファイルを選択
                          </button>
                          {avatarUploading && <span className="text-white/50">アップロード中...</span>}
                        </div>
                        {!sessionToken && <p className="text-rose-300">サインイン済みのときに変更できます。</p>}
                        {avatarMessage && (
                          <p className={clsx('text-xs', avatarMessageType === 'success' ? 'text-emerald-300' : 'text-rose-300')}>
                            {avatarMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-white/50">PNG または JPEG をアップロードしてください。</p>
                </div>
                <form className="space-y-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">プロフィール</p>
                  <label className="block text-xs text-white/60">
                    表示名
                    <input className="mt-1 w-full rounded-2xl bg-[#151829] px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" defaultValue="Creator Passkey" />
                  </label>
                  <label className="block text-xs text-white/60">
                    タグライン
                    <input className="mt-1 w-full rounded-2xl bg-[#151829] px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" defaultValue="Neon-coded reels" />
                  </label>
                  <label className="block text-xs text-white/60">
                    Bio
                    <textarea className="mt-1 w-full rounded-2xl bg-[#151829] px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" rows={3} defaultValue="Supabase x Next.js でAI動画を配信中。" />
                  </label>
                  <button type="button" className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-4 py-2 text-white">
                    保存
                  </button>
                </form>
                <div className="space-y-4">
                  <PasskeyManager />
                  <div className="space-y-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">AI 嗜好</p>
                    <label className="mt-2 flex items-center gap-2 text-xs text-white/70">
                      <input type="checkbox" defaultChecked className="rounded bg-[#151829] text-cyan-400 focus:ring-cyan-400" /> Saveモード優先
                    </label>
                    <label className="mt-2 flex items-center gap-2 text-xs text-white/70">
                      <input type="checkbox" className="rounded bg-[#151829] text-cyan-400 focus:ring-cyan-400" /> 18歳未満向けフィルター
                    </label>
                    <label className="mt-2 flex flex-col text-xs text-white/70">
                      フォロータグ
                      <input className="mt-1 rounded-2xl bg-[#151829] px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" defaultValue="neon, calm, travel" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
