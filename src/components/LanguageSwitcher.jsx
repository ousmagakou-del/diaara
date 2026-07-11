// ════════════════════════════════════════════════════════════════════
// LanguageSwitcher — dropdown FR / EN
// ════════════════════════════════════════════════════════════════════
// Rendu dans le header desktop de SiteLayout, a cote du logo.
// Compact, discret, aucune dependance externe.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useLanguage, SUPPORTED_LANGS } from '../lib/i18n';
import { LANG_LABELS } from '../lib/translations';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { lang, change } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = LANG_LABELS[lang] || LANG_LABELS.fr;

  return (
    <div className="lang-switcher" ref={rootRef}>
      <button
        type="button"
        className="lang-switcher__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className="lang-switcher__code">{current.code}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <ul className="lang-switcher__menu" role="listbox">
          {SUPPORTED_LANGS.map((code) => {
            const label = LANG_LABELS[code];
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={code === lang}
                  className={`lang-switcher__option ${code === lang ? 'is-active' : ''}`}
                  onClick={() => { change(code); setOpen(false); }}
                >
                  <span className="lang-switcher__opt-code">{label.code}</span>
                  <span className="lang-switcher__opt-name">{label.name}</span>
                  {code === lang && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
