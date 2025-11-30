'use client';

import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUiPreferences } from '@/components/providers/UiPreferencesProvider';
import ConsoleSettingsPanel from '@/components/ConsoleSettingsPanel';
import SignInPanel from './SignInPanel';
import { useSession } from '@/components/providers/SessionProvider';

const QUICK_TAGS = ['travel', 'retro', 'city', 'dummy', 'ai', 'night'];
const HEADER_TEXT = {
 ja: {
    tagline: 'Neural Short-Form Console',
    home: 'ホームへ戻る',
    searchLabel: 'タグ検索',
    searchPlaceholder: '#travel',
    quickTagTitle: 'クイックタグ',
    trend: 'トレンド',
    saveLabel: 'Save',
    on: 'ON',
    off: 'OFF',
    signIn: 'サインイン',
    sessionManage: 'セッション管理',
    openSettings: '設定を開く',
    passkeyPhase: 'Sign in',
    passkeyTitle: 'セッション認証',
    close: '閉じる',
  },
 en: {
    tagline: 'Neural Short-Form Console',
    home: 'Back to home',
    searchLabel: 'Search tags',
    searchPlaceholder: '#travel',
    quickTagTitle: 'Quick tags',
    trend: 'Trending',
    saveLabel: 'Save',
    on: 'ON',
    off: 'OFF',
    signIn: 'Sign In',
    sessionManage: 'Manage Session',
    openSettings: 'Open settings',
    passkeyPhase: 'Sign in',
    passkeyTitle: 'Session Authentication',
    close: 'Close',
  },
 zh: {
    tagline: '神经短视频控制台',
    home: '返回首页',
    searchLabel: '标签搜索',
    searchPlaceholder: '#旅行',
    quickTagTitle: '快捷标签',
    trend: '趋势',
    saveLabel: '保存',
    on: '开启',
    off: '关闭',
    signIn: '登录',
    sessionManage: '会话管理',
    openSettings: '打开设置',
    passkeyPhase: 'Sign in',
    passkeyTitle: '会话认证',
    close: '关闭',
  },
};

export default function SiteHeader() {
  const router = useRouter();
  const { saveMode, setSaveMode, searchTag, setSearchTag, language } = useUiPreferences();
  const [showQuickList, setShowQuickList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const { sessionToken, logout } = useSession();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const text = HEADER_TEXT[language as keyof typeof HEADER_TEXT] ?? HEADER_TEXT.ja;
  const searchParams = useSearchParams();
  const authIntent = searchParams?.get('auth') ?? searchParams?.get('modal');

  const normalizedValue = searchTag.startsWith('#') || searchTag === '' ? searchTag : `#${searchTag}`;

  const handleQuickSelect = (tag: string) => {
    setSearchTag(`#${tag}`);
    setShowQuickList(false);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('menu-overlay', showSettings || showAuthPanel);
    return () => {
      document.body.classList.remove('menu-overlay');
    };
  }, [showSettings, showAuthPanel]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (authIntent === 'signin') {
      setShowAuthPanel(true);
      router.replace('/', { scroll: false });
    }
  }, [authIntent, router]);

  const handleCloseAuthPanel = useCallback(() => {
    setShowAuthPanel(false);
    router.replace('/', { scroll: false });
  }, [router]);

  const handleOverlayMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === overlayRef.current) {
        handleCloseAuthPanel();
      }
    },
    [handleCloseAuthPanel]
  );

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error('logout_failed', error);
    } finally {
      router.push('/?auth=signin');
      router.refresh();
      setShowAuthPanel(true);
    }
  }

  return (
    <header>
      <div className="brand" aria-label="M46 Console Header">
        <Link href="/" className="logo" aria-label={text.home}>
          <Image src="/logo/logo_grad_1.svg" alt="M46" width={64} height={64} priority />
        </Link>
        <div>
          <h1>M46</h1>
          <p className="tagline">{text.tagline}</p>
        </div>
      </div>
      <div className="session">
        <div className="header-search">
          <label htmlFor="global-tag-search" className="sr-only">
            {text.searchLabel}
          </label>
          <input
            id="global-tag-search"
            type="search"
            placeholder={text.searchPlaceholder}
            value={normalizedValue}
            onChange={event => setSearchTag(event.target.value)}
            onFocus={() => setShowQuickList(true)}
            onBlur={() => setTimeout(() => setShowQuickList(false), 120)}
          />
          <div className={clsx('tag-quick-list', showQuickList && 'visible')}>
            <p className="tag-quick-title">{text.quickTagTitle}</p>
            {QUICK_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onMouseDown={event => {
                  event.preventDefault();
                  handleQuickSelect(tag);
                }}
              >
                <strong>#{tag}</strong>
                <span>{text.trend}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="save-toggle">
          <span className="save-label" data-active={saveMode}>
            {text.saveLabel} {saveMode ? text.on : text.off}
          </span>
          <label className="switch">
            <input type="checkbox" checked={saveMode} onChange={event => setSaveMode(event.target.checked)} />
            <span className="slider" />
          </label>
        </div>
        {sessionToken ? (
          <button type="button" className="ghost-btn danger" onClick={handleLogout}>
            ログアウト
          </button>
        ) : (
          <button type="button" className="ghost-btn primary" onClick={() => setShowAuthPanel(true)}>
            {text.signIn}
          </button>
        )}
        <button type="button" className="menu-btn" onClick={() => setShowSettings(true)} aria-label={text.openSettings}>
          <span className="menu-icon" />
        </button>
      </div>
      <ConsoleSettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      {portalReady && showAuthPanel
        ? createPortal(
            <div className="auth-overlay" ref={overlayRef} onMouseDown={handleOverlayMouseDown} role="presentation">
              <div className="auth-panel auth-panel--wide" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
                <div className="auth-panel__header">
                  <div>
                    <p className="phase">{text.passkeyPhase}</p>
                    <h2>{text.passkeyTitle}</h2>
                  </div>
                  <button type="button" className="panel-close-btn" onClick={handleCloseAuthPanel} aria-label={text.close}>
                    ×
                  </button>
                </div>
                <SignInPanel
                  onAuthenticated={() => {
                    handleCloseAuthPanel();
                    router.push('/');
                    router.refresh();
                  }}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
