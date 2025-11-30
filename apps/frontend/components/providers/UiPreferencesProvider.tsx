'use client';

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type ThemeMode = 'night' | 'day';

type UiPreferences = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  saveMode: boolean;
  setSaveMode: (value: boolean) => void;
  searchTag: string;
  setSearchTag: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  region: string;
  setRegion: (value: string) => void;
};

const UiPreferencesContext = createContext<UiPreferences | null>(null);

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('night');
  const [saveMode, setSaveMode] = useState(false);
  const [searchTag, setSearchTag] = useState('');
  const [language, setLanguage] = useState('ja');
  const [region, setRegion] = useState('JP');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const body = document?.body;
    if (!body) return;
    body.setAttribute('data-theme', theme === 'day' ? 'day' : 'night');
    body.setAttribute('data-lang', language);
    if (language === 'zh') {
      body.classList.add('lang-zh');
    } else {
      body.classList.remove('lang-zh');
    }
  }, [theme, language]);

  useEffect(() => {
    if (!searchParams) return;
    const tagParam = searchParams.get('tag');
    if (pathname === '/') {
      if (tagParam) {
        setSearchTag(`#${tagParam}`);
      } else {
        setSearchTag('');
      }
    }
  }, [pathname, searchParams]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(current => (current === 'night' ? 'day' : 'night')),
      saveMode,
      setSaveMode,
      searchTag,
      setSearchTag,
      language,
      setLanguage,
      region,
      setRegion,
    }),
    [theme, saveMode, searchTag, language, region]
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) throw new Error('useUiPreferences must be used inside UiPreferencesProvider');
  return ctx;
}
