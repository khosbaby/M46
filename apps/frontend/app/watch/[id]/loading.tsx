export default function WatchLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#05060c] text-white">
      <div className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Loading</p>
        <p className="text-lg text-white/70">動画情報を読み込んでいます…</p>
      </div>
    </div>
  );
}
