'use client';

import { useEffect, useState } from 'react';
import { resolveApiBase } from '@/lib/clientApi';
import { createAssertionCredential } from '@/lib/webauthn';
import PasskeyRegisterForm from './PasskeyRegisterForm';
import { useSession } from '@/components/providers/SessionProvider';

type Props = {
  onAuthenticated?: () => void;
};

type StatusState = { type: 'idle' | 'loading' | 'success' | 'error'; message?: string };

export default function SignInPanel({ onAuthenticated }: Props) {
  const apiBase = resolveApiBase();
  const { setSessionToken } = useSession();
  const [mode, setMode] = useState<'passkey' | 'signup'>('passkey');
  const [handle, setHandle] = useState('');
  const [showHandleField, setShowHandleField] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<StatusState>({ type: 'idle' });
  const [email, setEmail] = useState('');
  const [emailChallenge, setEmailChallenge] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailStatus, setEmailStatus] = useState<StatusState>({ type: 'idle' });
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('m46_passkey_handle');
      if (stored) {
        setHandle(stored);
      } else {
        setShowHandleField(true);
      }
    } catch {
      setShowHandleField(true);
    }
  }, []);

  async function handlePasskeyLogin() {
    if (!handle.trim()) {
      setPasskeyStatus({ type: 'error', message: 'サインインに利用するハンドルを設定してください。' });
      return;
    }
    setPasskeyStatus({ type: 'loading', message: 'パスキーを確認しています…' });
    try {
      const startRes = await fetch(`${apiBase}/auth/webauthn/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      });
      if (!startRes.ok) throw new Error(`login_start_failed:${startRes.status}`);
      const startPayload = (await startRes.json()) as { challenge: string; handle: string };
      let assertion;
      try {
        assertion = await createAssertionCredential({ challenge: startPayload.challenge });
      } catch (err) {
        console.warn('webauthn_assertion_skipped', err);
        setPasskeyStatus({ type: 'error', message: 'パスキー操作がキャンセルされました。' });
        return;
      }
      const finishRes = await fetch(`${apiBase}/auth/webauthn/login/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: startPayload.challenge, passkey: assertion }),
      });
      if (!finishRes.ok) throw new Error(`login_finish_failed:${finishRes.status}`);
      const finishPayload = (await finishRes.json()) as { sessionToken?: string };
      if (finishPayload.sessionToken) {
        setSessionToken(finishPayload.sessionToken);
        try {
          window.localStorage.setItem('m46_passkey_handle', handle.trim());
        } catch {
          // ignore
        }
        setPasskeyStatus({ type: 'success', message: 'サインインしました。' });
        onAuthenticated?.();
      } else {
        throw new Error('session_not_returned');
      }
    } catch (error) {
      console.error('passkey_login_failed', error);
      setPasskeyStatus({ type: 'error', message: 'パスキーでのサインインに失敗しました。' });
    }
  }

  async function requestEmailCode() {
    setEmailStatus({ type: 'loading', message: 'コードを送信しています…' });
    try {
      const res = await fetch(`${apiBase}/auth/email/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(`email_start_failed:${res.status}`);
      const payload = (await res.json()) as { challenge: string; otpPreview?: string };
      setEmailChallenge(payload.challenge);
      setDevCode(payload.otpPreview ?? null);
      setEmailStatus({ type: 'success', message: 'メールを確認してコードを入力してください。' });
    } catch (error) {
      console.error('email_start_failed', error);
      setEmailStatus({ type: 'error', message: 'メールコードの送信に失敗しました。' });
    }
  }

  async function verifyEmailCode() {
    if (!emailChallenge) {
      setEmailStatus({ type: 'error', message: '先にコードを送信してください。' });
      return;
    }
    if (!emailCode.trim()) {
      setEmailStatus({ type: 'error', message: 'コードを入力してください。' });
      return;
    }
    setEmailStatus({ type: 'loading', message: 'コードを検証しています…' });
    try {
      const res = await fetch(`${apiBase}/auth/email/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: emailChallenge, code: emailCode.trim() }),
      });
      if (!res.ok) throw new Error(`email_finish_failed:${res.status}`);
      const payload = (await res.json()) as { sessionToken?: string };
      if (payload.sessionToken) {
        setSessionToken(payload.sessionToken);
        setEmailStatus({ type: 'success', message: 'サインインしました。' });
        onAuthenticated?.();
      } else {
        throw new Error('session_not_returned');
      }
    } catch (error) {
      console.error('email_finish_failed', error);
      setEmailStatus({ type: 'error', message: 'コードが正しくありません。' });
    }
  }

  return (
    <div className="auth-grid">
      {mode === 'passkey' ? (
        <div className="sign-gate-grid">
          <header className="sign-gate-header">
            <p className="phase">Sign in</p>
            <h2>サインイン</h2>
          </header>
          <section className="sign-card sign-card--passkey">
            <header className="sign-card__header">
              <div>
                <p className="phase">Sign in</p>
                <h3>
                  Passkey <span className="badge badge--primary">推奨</span>
                </h3>
              </div>
              <button type="button" className="text-link" onClick={() => setMode('signup')}>
                サインアップ
              </button>
            </header>
            {handle && !showHandleField ? (
              <div className="sign-handle-summary">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">使用するハンドル</p>
                  <p className="font-mono text-base text-white">{handle}</p>
                </div>
                <button type="button" className="text-link text-xs" onClick={() => setShowHandleField(true)}>
                  変更
                </button>
              </div>
            ) : (
              <label className="sign-handle-block">
                <span className="text-xs uppercase tracking-[0.3em] text-white/40">ハンドル（初回のみ）</span>
                <input
                  type="text"
                  value={handle}
                  onChange={event => setHandle(event.target.value)}
                  placeholder="@creator_handle"
                  className="sign-input text-center"
                />
                {handle && (
                  <button type="button" className="text-link text-xs" onClick={() => setShowHandleField(false)}>
                    このハンドルで続行
                  </button>
                )}
              </label>
            )}
            <button type="button" className="sign-primary" onClick={handlePasskeyLogin} disabled={passkeyStatus.type === 'loading'}>
              {passkeyStatus.type === 'loading' ? '確認中…' : 'パスキーでログイン'}
            </button>
            {passkeyStatus.type !== 'idle' && (
              <p className={`sign-status ${passkeyStatus.type === 'error' ? 'error' : 'success'}`}>{passkeyStatus.message}</p>
            )}
          </section>
          <section className="sign-card secondary">
            <header>
              <p className="phase">Sign in</p>
              <h3>Email</h3>
            </header>
            <label className="flex flex-col gap-2">
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="sign-input"
              />
            </label>
            <button
              type="button"
              className="sign-secondary"
              onClick={requestEmailCode}
              disabled={emailStatus.type === 'loading' && !emailChallenge}
            >
              {emailStatus.type === 'loading' && !emailChallenge ? '送信中…' : 'コードを送信'}
            </button>
            <div className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-white/40">6桁コード</span>
                <input
                  type="text"
                  value={emailCode}
                  onChange={event => setEmailCode(event.target.value)}
                  placeholder="メールで受け取ったコード"
                  className="sign-input"
                  disabled={!emailChallenge}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="sign-primary flex-1"
                  onClick={verifyEmailCode}
                  disabled={!emailChallenge || emailStatus.type === 'loading'}
                >
                  {emailStatus.type === 'loading' && emailChallenge ? 'ログイン中…' : 'メールでログイン'}
                </button>
              </div>
              {devCode && <p className="text-xs text-white/50">Dev Code: {devCode}</p>}
            </div>
            {emailStatus.type !== 'idle' && (
              <p className={`sign-status ${emailStatus.type === 'error' ? 'error' : 'success'}`}>{emailStatus.message}</p>
            )}
          </section>
        </div>
      ) : (
        <div className="signup-panel">
          <section className="sign-card">
            <header className="flex items-center justify-between">
              <div>
                <p className="phase">Sign up</p>
                <h3>パスキー新規登録</h3>
              </div>
              <button type="button" className="text-link" onClick={() => setMode('passkey')}>
                戻る
              </button>
            </header>
            <p className="text-sm text-white/70">
              ハンドルとメールを入力し、ブラウザのパスキーダイアログで「許可」を選択してください。成功すると自動的にフィードへ遷移します。
            </p>
            <PasskeyRegisterForm
              onSuccess={() => {
                onAuthenticated?.();
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
