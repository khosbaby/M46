'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiPost } from '@/lib/types';
import { useSession } from '@/components/providers/SessionProvider';
import { resolveApiBase } from '@/lib/clientApi';

const SUPABASE_STORAGE_BASE = (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BASE_URL ?? '').replace(/\/$/, '');

type FormState = {
  title: string;
  description: string;
  durationSeconds: number;
  resolution: string;
  storageKey: string;
  sensitive: boolean;
  previewSeconds: number;
};

type StatusState =
  | { type: 'idle'; message?: string }
  | { type: 'loading'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const MCP_TARGET_INFO = 'Supabase MCP (codex)';

function isVerticalResolution(resolution: string) {
  const match = resolution.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return false;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isFinite(width) && Number.isFinite(height) && height > width;
}

function normalizeStorageKeyForSubmit(value: string) {
  let nextValue = value.trim();
  if (!nextValue) return '';
  if (/^https?:\/\//i.test(nextValue)) {
    return nextValue;
  }
  if (nextValue.startsWith('supabase://')) {
    nextValue = nextValue.replace(/^supabase:\/\//, '');
  }
  nextValue = nextValue.replace(/^\/+/, '');
  if (!SUPABASE_STORAGE_BASE) {
    return '';
  }
  return `${SUPABASE_STORAGE_BASE}/${nextValue}`;
}

import { useRouter } from 'next/navigation';

export default function PostComposerClient() {
  const router = useRouter();
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    durationSeconds: 24,
    resolution: '1080x1920',
    storageKey: '',
    sensitive: false,
    previewSeconds: 0,
  });
  const { sessionToken, status: sessionStatus, profile } = useSession();
  const [actionStatus, setActionStatus] = useState<StatusState>({ type: 'idle' });
  const [recentPost, setRecentPost] = useState<ApiPost | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/?auth=signin');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const isVerticalOnly = useMemo(() => isVerticalResolution(form.resolution), [form.resolution]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isVerticalOnly) {
      setActionStatus({ type: 'error', message: '縦長（9:16）以外の動画は投稿できません。' });
      return;
    }
    const normalizedStorageKey = normalizeStorageKeyForSubmit(form.storageKey || uploadedUrl);
    if (!normalizedStorageKey) {
      setActionStatus({ type: 'error', message: 'storage_key を正しい URL で入力してください。' });
      return;
    }
    setActionStatus({ type: 'loading', message: 'Supabase MCP に送信中...' });
    try {
      const response = await fetch(`${apiBase}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          storageKey: normalizedStorageKey,
          durationSeconds: form.durationSeconds,
          resolution: form.resolution,
          tags: [],
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        const message = typeof detail?.error === 'string' ? detail.error : `create_failed:${response.status}`;
        throw new Error(message);
      }
      const payload = (await response.json().catch(() => ({}))) as { post?: ApiPost };
      if (payload.post) {
        setRecentPost(payload.post);
      }
      setActionStatus({ type: 'success', message: 'Supabase へ送信しました。' });
    } catch (error) {
      setActionStatus({ type: 'error', message: (error as Error)?.message ?? '送信に失敗しました。' });
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="px-4 py-16 text-center text-white/70">
        <p className="text-sm uppercase tracking-[0.4em] text-white/40">Session</p>
        <p className="mt-2 text-2xl font-semibold text-white">パスキーセッションを確認しています…</p>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <div className="px-4 py-16 text-center text-white/70">
        <p className="text-sm uppercase tracking-[0.4em] text-white/40">Auth required</p>
        <p className="mt-2 text-2xl font-semibold text-white">サインイン後に投稿フォームを利用できます。</p>
      </div>
    );
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1.8fr)]">
      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-[30px] bg-gradient-to-br from-white/12 via-white/5 to-transparent p-10 text-white shadow-[0_50px_140px_-80px_rgba(15,23,42,0.95)] ring-1 ring-white/10 backdrop-blur-2xl"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 text-sm text-white/80 shadow-inner shadow-black/30">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">API Channel</p>
            <p className="font-mono text-sm text-white">{MCP_TARGET_INFO}</p>
          </div>
          <div className="flex flex-col rounded-3xl bg-white/5 px-5 py-4 text-sm text-white/80 shadow-inner shadow-black/20 backdrop-blur-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">Session</span>
            <p className="mt-2 font-mono text-sm text-white">{profile?.handle ?? '@passkey_creator'}</p>
            <p className="text-xs text-white/50">パスキー認証済み</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col rounded-3xl bg-white/5 px-5 py-4 text-sm shadow-inner shadow-black/20 backdrop-blur-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">タイトル</span>
            <input
              type="text"
              required
              maxLength={80}
              className="mt-2 bg-transparent text-white focus:outline-none"
              value={form.title}
              onChange={event => updateForm('title', event.target.value)}
            />
          </label>
          <label className="flex flex-col rounded-3xl bg-white/5 px-5 py-4 text-sm shadow-inner shadow-black/20 backdrop-blur-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">解像度</span>
            <select
              className="mt-2 bg-transparent text-white focus:outline-none"
              value={form.resolution}
              onChange={event => updateForm('resolution', event.target.value)}
            >
              <option value="1080x1920">1080x1920</option>
              <option value="720x1280">720x1280</option>
              <option value="360x640">360x640</option>
            </select>
            <p className={`mt-2 text-xs ${isVerticalOnly ? 'text-emerald-300' : 'text-rose-300'}`}>
              {isVerticalOnly ? '縦長（9:16推奨）のみサポートしています。' : '横長解像度は投稿できません。'}
            </p>
          </label>
        </div>
        <label className="flex flex-col rounded-3xl bg-white/5 px-5 py-4 text-sm shadow-inner shadow-black/20 backdrop-blur-sm">
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">説明</span>
          <textarea
            required
            rows={3}
            className="mt-2 w-full bg-transparent text-white focus:outline-none"
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
          />
        </label>
        <label className="flex flex-col rounded-3xl bg-gradient-to-br from-white/20 via-white/10 to-transparent px-5 py-4 text-sm text-white shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">動画ファイル / URL</span>
          <input
            type="file"
            accept="video/*"
            className="mt-2 text-white"
            onChange={event => {
              const nextFile = event.target.files?.[0] ?? null;
              setSelectedFile(nextFile);
              setUploadedUrl('');
              updateForm('storageKey', '');
              setUploadError(null);
              setVideoDuration(0);
              updateForm('previewSeconds', 0);
            }}
          />
          {selectedFile && <span className="mt-2 text-xs text-white/70">選択中: {selectedFile.name}</span>}
          {uploading && <span className="mt-2 text-xs text-white/70">アップロード中...</span>}
          {uploadError && <span className="mt-2 text-xs text-rose-300">{uploadError}</span>}
        </label>
        <label className="flex flex-col rounded-3xl bg-white/5 px-5 py-4 text-sm shadow-inner shadow-black/20 backdrop-blur-sm">
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">ストレージURL</span>
          <input
            type="text"
            className="mt-2 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
            value={form.storageKey}
            onChange={event => updateForm('storageKey', event.target.value)}
            placeholder="https://storage.supabase.co/video/yourfile.mp4"
          />
        </label>
        {selectedFile && (
          <div className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <video
              ref={previewVideoRef}
              src={localPreviewUrl}
              className="h-72 w-full rounded-2xl bg-black object-contain"
              controls
              onLoadedMetadata={event => {
                const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : form.durationSeconds;
                setVideoDuration(duration || form.durationSeconds);
              }}
            />
          </div>
        )}
        <div className="space-y-3">
          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500 px-6 py-3 text-base font-semibold text-white shadow-[0_20px_40px_rgba(14,165,233,0.35)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionStatus.type === 'loading' || uploading}
          >
            {actionStatus.type === 'loading' ? '送信中...' : 'Supabase MCP へ送信'}
          </button>
          {actionStatus.type !== 'idle' && (
            <p
              className={`text-sm ${
                actionStatus.type === 'error'
                  ? 'text-rose-300'
                  : actionStatus.type === 'success'
                    ? 'text-emerald-300'
                    : 'text-white/70'
              }`}
            >
              {actionStatus.message}
            </p>
          )}
        </div>
      </form>
      <aside className="space-y-6 rounded-[30px] bg-gradient-to-br from-[#050712]/95 via-[#090f23]/85 to-[#0f1b34]/80 p-8 text-white shadow-[0_40px_120px_-80px_rgba(0,0,0,0.85)] ring-1 ring-white/10 backdrop-blur-xl">
        <div className="space-y-4 rounded-2xl bg-white/5 p-5 text-sm text-white/80 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">投稿ガイド</p>
          <ol className="list-decimal space-y-2 pl-5 text-xs text-white/70">
            <li>動画は縦長 30秒以内に収めてください</li>
            <li>storage_key には http(s) URL を入力</li>
            <li>Saveモード対象の動画には sensitive を ON</li>
          </ol>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-sm text-white/90">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">MCP Status</p>
          <p className="mt-2 font-mono text-xs">{sessionToken ? 'READY' : 'SIGN-IN REQUIRED'}</p>
        </div>
      </aside>
    </section>
  );
}
