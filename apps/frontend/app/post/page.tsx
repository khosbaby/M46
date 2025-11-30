import PostComposerClient from './post-composer-client';

export const metadata = {
  title: '投稿フォーム | M46 短尺動画SNS',
};

export default function PostPage() {
  return (
    <main className="post-console relative min-h-screen overflow-hidden">
      <div className="post-console__halo post-console__halo--left" />
      <div className="post-console__halo post-console__halo--right" />
      <div className="post-console__content relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 pt-12 lg:px-10">
        <header className="mb-10 space-y-4">
          <h1 className="text-left text-4xl font-semibold leading-tight text-white md:text-5xl">Post Console</h1>
        </header>
        <PostComposerClient />
      </div>
    </main>
  );
}
