'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/components/providers/SessionProvider';
import SignInPanel from '@/components/SignInPanel';

type Props = {
  feed: ReactNode;
};

export default function AuthGateway({ feed }: Props) {
  const { status, profile } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authIntent = searchParams?.get('auth') ?? searchParams?.get('modal');
  const [dismissed, setDismissed] = useState(() => authIntent !== 'signin');
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (status === 'authenticated') {
      setDismissed(true);
    }
  }, [status]);

  useEffect(() => {
    if (authIntent === 'signin' && status === 'unauthenticated') {
      setDismissed(false);
    }
  }, [authIntent, status]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (authIntent === 'signin') {
      router.replace('/', { scroll: false });
    }
  }, [authIntent, router]);

  const handleOverlayPointerDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === overlayRef.current) {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  if (status === 'loading') {
    return (
      <div className="auth-gate auth-gate--loading">
        <p className="phase">Passkey</p>
        <h2>セッション確認中…</h2>
        <p className="text-white/60">ブラウザに保存されたパスキーをチェックしています。</p>
      </div>
    );
  }

  if (status === 'authenticated') {
    return (
      <div className="auth-shell">
        <header className="auth-shell__banner">
          <div>
            <p className="phase">Session</p>
            <h2>{profile?.displayName ?? profile?.handle ?? '@creator'}</h2>
            <p className="text-white/60">@{profile?.handle ?? 'creator_passkey'} としてサインイン中です。</p>
          </div>
          <div className="auth-shell__actions">
            <Link className="cta" href="/post">
              投稿コンソールを開く
            </Link>
            <Link className="cta secondary" href="/mypage">
              プロフィール編集へ
            </Link>
          </div>
        </header>
        <section>{feed}</section>
      </div>
    );
  }

  const showOverlay = status === 'unauthenticated' && !dismissed;

  return (
    <div className="auth-shell auth-shell--guest">
      {showOverlay && (
        <div
          ref={overlayRef}
          className="auth-overlay auth-overlay--page"
          onMouseDown={handleOverlayPointerDown}
          role="presentation"
        >
          <div
            className="auth-panel auth-panel--wide"
            role="dialog"
            aria-modal="true"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="auth-panel__header">
              <div>
                <p className="phase">Sign in</p>
                <h2>サインイン</h2>
              </div>
              <button type="button" className="panel-close-btn" onClick={handleDismiss}>
                フィードに戻る
              </button>
            </div>
            <SignInPanel
              onAuthenticated={() => {
                handleDismiss();
              }}
            />
          </div>
        </div>
      )}
      <section>{feed}</section>
    </div>
  );
}
