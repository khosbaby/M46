'use client';

import { useEffect, useState } from 'react';

type LegalDoc = {
  key: 'terms' | 'privacy';
  label: { ja: string; en: string; zh: string };
  file: string;
};

const LEGAL_DOCS: LegalDoc[] = [
  { key: 'terms', label: { ja: '利用規約', en: 'Terms of Service', zh: '使用條款' }, file: '/legal/terms.txt' },
  { key: 'privacy', label: { ja: 'プライバシー', en: 'Privacy Policy', zh: '隱私政策' }, file: '/legal/privacy.txt' },
];

function LegalModal({
  open,
  content,
  label,
  onClose,
}: {
  open: boolean;
  content: string;
  label: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="legal-modal-overlay">
      <div className="legal-modal">
        <header>
          <h3>{label}</h3>
          <button type="button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="legal-modal-body">
          <pre>{content}</pre>
        </div>
      </div>
    </div>
  );
}

export default function SiteFooter() {
  const [language, setLanguage] = useState<'ja' | 'en' | 'zh'>('ja');
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [activeDoc, setActiveDoc] = useState<LegalDoc | null>(null);

  useEffect(() => {
    const langAttr = document.body.getAttribute('data-lang');
    if (langAttr === 'en' || langAttr === 'zh') {
      setLanguage(langAttr);
    } else {
      setLanguage('ja');
    }
  }, []);

  useEffect(() => {
    LEGAL_DOCS.forEach(doc => {
      fetch(doc.file)
        .then(res => (res.ok ? res.text() : Promise.reject()))
        .then(text => setDocs(prev => ({ ...prev, [doc.key]: text })))
        .catch(() => setDocs(prev => ({ ...prev, [doc.key]: '読み込みに失敗しました。' })));
    });
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer>
      <p>© {year} M46 Neural Short-Form Console</p>
      <div className="legal-docs">
        {LEGAL_DOCS.map(doc => (
          <button key={doc.key} type="button" onClick={() => setActiveDoc(doc)}>
            {doc.label[language]}
          </button>
        ))}
        <a href="/WebApp%20Frontend.md" target="_blank" rel="noreferrer">
          Frontend Specification
        </a>
      </div>
      <LegalModal
        open={Boolean(activeDoc)}
        content={activeDoc ? docs[activeDoc.key] ?? '' : ''}
        label={activeDoc ? activeDoc.label[language] : ''}
        onClose={() => setActiveDoc(null)}
      />
    </footer>
  );
}
