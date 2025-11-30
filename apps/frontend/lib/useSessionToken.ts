'use client';

import { useEffect, useState } from 'react';

const PRIMARY_STORAGE_KEY = 'M46_session_token';
const LEGACY_KEYS = ['m46_session_token', 'm13_session_token'];

function readStoredToken(): string {
  if (typeof window === 'undefined') return '';
  const primary = window.localStorage.getItem(PRIMARY_STORAGE_KEY);
  if (primary) return primary;
  for (const legacyKey of LEGACY_KEYS) {
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue) {
      window.localStorage.removeItem(legacyKey);
      window.localStorage.setItem(PRIMARY_STORAGE_KEY, legacyValue);
      return legacyValue;
    }
  }
  return '';
}

export function useSessionToken() {
  const [sessionToken, setSessionToken] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredToken();
    if (stored) setSessionToken(stored);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionToken) {
      window.localStorage.setItem(PRIMARY_STORAGE_KEY, sessionToken);
    } else {
      window.localStorage.removeItem(PRIMARY_STORAGE_KEY);
    }
  }, [sessionToken]);

  return [sessionToken, setSessionToken] as const;
}
