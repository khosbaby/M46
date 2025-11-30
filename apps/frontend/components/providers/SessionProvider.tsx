'use client';

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolveApiBase } from '@/lib/clientApi';
import { useSessionToken } from '@/lib/useSessionToken';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SessionProfile = {
  handle: string;
  displayName: string;
  avatar?: string | null;
  bio?: string | null;
  tagline?: string | null;
};

type SessionContextValue = {
  status: SessionStatus;
  sessionToken: string;
  profile: SessionProfile | null;
  setSessionToken: (token: string) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

async function fetchSessionPayload(apiBase: string, token: string) {
  const response = await fetch(`${apiBase}/auth/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('session_fetch_failed');
  }
  return (await response.json()) as { authenticated: boolean; profile?: SessionProfile | null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [sessionToken, setSessionToken] = useSessionToken();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<SessionProfile | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionToken) {
      setProfile(null);
      setStatus('unauthenticated');
      return;
    }
    try {
      const payload = await fetchSessionPayload(apiBase, sessionToken);
      if (!payload.authenticated) {
        setSessionToken('');
        setProfile(null);
        setStatus('unauthenticated');
        return;
      }
      setProfile(payload.profile ?? null);
      setStatus('authenticated');
    } catch {
      setSessionToken('');
      setProfile(null);
      setStatus('unauthenticated');
    }
  }, [apiBase, sessionToken, setSessionToken]);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      if (!sessionToken) {
        if (!cancelled) {
          setProfile(null);
          setStatus('unauthenticated');
        }
        return;
      }
      setStatus('loading');
      try {
        const payload = await fetchSessionPayload(apiBase, sessionToken);
        if (cancelled) return;
        if (!payload.authenticated) {
          setSessionToken('');
          setProfile(null);
          setStatus('unauthenticated');
          return;
        }
        setProfile(payload.profile ?? null);
        setStatus('authenticated');
      } catch {
        if (!cancelled) {
          setSessionToken('');
          setProfile(null);
          setStatus('unauthenticated');
        }
      }
    }
    sync();
    return () => {
      cancelled = true;
    };
  }, [apiBase, sessionToken, setSessionToken]);

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {
        // ignore network errors on logout
      }
    }
    setSessionToken('');
    setProfile(null);
    setStatus('unauthenticated');
  }, [apiBase, sessionToken, setSessionToken]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      sessionToken,
      profile,
      setSessionToken,
      refresh,
      logout,
    }),
    [status, sessionToken, profile, setSessionToken, refresh, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
