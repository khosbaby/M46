'use client';

import clsx from 'clsx';
import { useUiPreferences } from '@/components/providers/UiPreferencesProvider';

const LANG_OPTIONS = [
  { label: '日本語', value: 'ja' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
];

const REGION_OPTIONS = [
  { label: 'Japan', value: 'JP' },
  { label: 'US', value: 'US' },
  { label: 'EU', value: 'EU' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ConsoleSettingsPanel({ open, onClose }: Props) {
  const { theme, setTheme, language, setLanguage, region, setRegion } = useUiPreferences();

  return (
    <div className={clsx('control-sidebar', open && 'visible')}>
      <button type="button" className="control-overlay" aria-label="Close settings" onClick={onClose} />
      <aside className="control-panel" aria-hidden={!open}>
        <div className="control-panel__header">
          <button type="button" className="panel-close-btn" aria-label="設定を閉じる" onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <section className="control-block">
          <p className="label">Display Theme</p>
          <div className="lang-tabs" role="group" aria-label="テーマ切替">
            <button type="button" className={clsx('lang-btn', theme === 'night' && 'active')} onClick={() => setTheme('night')}>
              Night
            </button>
            <button type="button" className={clsx('lang-btn', theme === 'day' && 'active')} onClick={() => setTheme('day')}>
              Day
            </button>
          </div>
        </section>
        <section className="control-block">
          <label htmlFor="console-language" className="label">
            言語 / Language / 语言
          </label>
          <select id="console-language" value={language} onChange={event => setLanguage(event.target.value)}>
            {LANG_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>
        <section className="control-block">
          <label htmlFor="console-region" className="label">
            地域 / Region / 区域
          </label>
          <select id="console-region" value={region} onChange={event => setRegion(event.target.value)}>
            {REGION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>
      </aside>
    </div>
  );
}
