import './globals.css';
import './legacy.css';
import { ReactNode } from 'react';
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
        <UiPreferencesProvider>
          <SessionProvider>
            <div className="app-shell">
              <SiteHeader />
              <div className="app-shell__spacer" aria-hidden="true" />
              <main>{children}</main>
              <SiteFooter />
            </div>
          </SessionProvider>
        </UiPreferencesProvider>
      </body>
    </html>
  );
}
