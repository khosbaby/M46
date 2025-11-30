'use client';

import { useCallback, useMemo, useState } from 'react';
import { resolveApiBase } from '@/lib/clientApi';
import { createRegistrationCredential } from '@/lib/webauthn';
import { detectDeviceLabel } from '@/lib/device';
import { useSession } from '@/components/providers/SessionProvider';

export default function PasskeyManager() {
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const { setSessionToken } = useSession();
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' });

  const handleRegister = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!name || !email) {
        setStatus({ type: 'error', message: 'Name / Email を入力してください。' });
        return;
      }
      setStatus({ type: 'loading', message: 'パスキー登録を開始しています…' });
      try {
        const startRes = await fetch(`${apiBase}/auth/webauthn/register/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: name, email }),
        });
        if (!startRes.ok) throw new Error(`register_start_failed:${startRes.status}`);
        const startPayload = (await startRes.json()) as { challenge: string; handle: string; authUserId: string };
        const credential = await createRegistrationCredential({
          challenge: startPayload.challenge,
          userHandle: startPayload.authUserId,
          userName: email,
          userDisplayName: name,
        });
        const deviceLabel = detectDeviceLabel();
        const finishRes = await fetch(`${apiBase}/auth/webauthn/register/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challenge: startPayload.challenge, passkey: credential, deviceLabel }),
        });
        if (!finishRes.ok) throw new Error(`register_finish_failed:${finishRes.status}`);
        const finishPayload = (await finishRes.json()) as { sessionToken?: string };
        if (finishPayload.sessionToken) {
          setSessionToken(finishPayload.sessionToken);
        }
        setStatus({ type: 'success', message: 'パスキー登録が完了しました。' });
      } catch (error) {
        console.error('passkey_register_failed', error);
        setStatus({ type: 'error', message: 'パスキー登録に失敗しました。' });
      }
    },
    [apiBase, email, name, setSessionToken]
  );

  return (
    <form className="space-y-10" onSubmit={handleRegister}>
      <div className="space-y-6">
        <label className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Name</span>
          <input
            type="text"
            className="rounded-2xl bg-[#151829] px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            value={name}
            placeholder="Creator"
            onChange={event => setName(event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Email</span>
          <input
            type="email"
            className="rounded-2xl bg-[#151829] px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            value={email}
            placeholder="you@example.com"
            onChange={event => setEmail(event.target.value)}
            required
          />
        </label>
      </div>
      <div className="space-y-3 pt-2">
        <button
          type="submit"
          className="w-full rounded-full bg-[#14b8a6] px-6 py-3 font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
          disabled={status.type === 'loading'}
        >
          {status.type === 'loading' ? '登録中…' : 'パスキーを登録'}
        </button>
        {status.type !== 'idle' && (
          <p className={`text-sm ${status.type === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>{status.message}</p>
        )}
      </div>
    </form>
  );
}
