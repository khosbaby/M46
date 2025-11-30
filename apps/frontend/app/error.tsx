"use client";

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#05060c] px-6 text-white">
    <div className="rounded-3xl bg-gradient-to-br from-[#0d1022] to-[#090b16] p-8 text-center shadow-[0_20px_80px_rgba(3,5,15,0.8)]">
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">Global Error</p>
        <h1 className="mt-2 text-2xl font-semibold">予期しないエラーが発生しました</h1>
        <p className="mt-2 text-sm text-white/70">
          {error.message || '不明なエラー'}（digest: {error.digest ?? 'N/A'}）
        </p>
        <button className="mt-6 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold hover:border-sky-500" onClick={() => reset()}>
          再読み込み
        </button>
      </div>
    </div>
  );
}
