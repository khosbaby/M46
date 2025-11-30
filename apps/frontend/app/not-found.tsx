import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#05060c] px-4 text-white">
      <p className="text-xs uppercase tracking-[0.4em] text-white/40">404</p>
      <h1 className="text-3xl font-semibold">ページが見つかりません</h1>
      <p className="text-sm text-white/60">指定されたフィードまたは動画は存在しないか、削除されました。</p>
      <Link href="/" className="rounded-full border border-white/20 px-4 py-2 hover:border-sky-400">
        ホームへ戻る
      </Link>
    </div>
  );
}
