import './globals.css';
import './legacy.css';
import { ReactNode, Suspense } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { UiPreferencesProvider } from '@/components/providers/UiPreferencesProvider';
import { SessionProvider } from '@/components/providers/SessionProvider';

export const metadata = {
  title: 'M46 短尺動画SNS',
  description: 'AIタグ + パスキー認証対応のショート動画SNSプロトタイプ',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Suspense fallback={null}>
          <UiPreferencesProvider>
            <SessionProvider>
              <div className="app-shell">
                <Suspense fallback={null}>
                  <SiteHeader />
                </Suspense>
                <div className="app-shell__spacer" aria-hidden="true" />
                <main>
                  <Suspense fallback={null}>{children}</Suspense>
                </main>
                <SiteFooter />
              </div>
            </SessionProvider>
          </UiPreferencesProvider>
        </Suspense>
      </body>
    </html>
  );
}
