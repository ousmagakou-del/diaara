// ════════════════════════════════════════════════════════════════════
// YARAM — Mini i18n (custom, no lib)
// ────────────────────────────────────────────────────────────────────
// Langue par defaut : FR. EN cible SEO + expat/anglophones.
// Persist dans localStorage sous "yaram-lang".
// Fallback silencieux vers FR puis vers la valeur par defaut passee en 2e arg.
// Wolof pas encore branche (traduction humaine plus tard).
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { translations, SUPPORTED_LANGS, DEFAULT_LANG } from './translations';

const LS_KEY = 'yaram-lang';
const EVT = 'yaram-lang-change';

function safeGet() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_LANG;
    const v = localStorage.getItem(LS_KEY);
    if (v && SUPPORTED_LANGS.includes(v)) return v;
  } catch { /* noop */ }
  return DEFAULT_LANG;
}

export function getLang() {
  return safeGet();
}

export function setLang(lang) {
  const next = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  try {
    localStorage.setItem(LS_KEY, next);
  } catch { /* noop */ }
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', next);
    }
  } catch { /* noop */ }
  try {
    window.dispatchEvent(new Event(EVT));
  } catch { /* noop */ }
  return next;
}

// ─── Getter statique — utilisable hors composants React ──────────────
export function t(key, defaultValue) {
  const lang = safeGet();
  const dictLang = translations[lang] || {};
  const dictFr = translations.fr || {};
  return (
    dictLang[key] ??
    dictFr[key] ??
    (defaultValue !== undefined ? defaultValue : key)
  );
}

// ─── Hook React — re-render quand la langue change ────────────────────
export function useLanguage() {
  const [lang, setLangState] = useState(safeGet);

  useEffect(() => {
    const handler = () => setLangState(safeGet());
    window.addEventListener(EVT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const change = useCallback((next) => {
    setLang(next);
    setLangState(next);
  }, []);

  // t() reactif — utilise la lang du closure du hook
  const tt = useCallback((key, defaultValue) => {
    const dictLang = translations[lang] || {};
    const dictFr = translations.fr || {};
    return (
      dictLang[key] ??
      dictFr[key] ??
      (defaultValue !== undefined ? defaultValue : key)
    );
  }, [lang]);

  return { lang, change, t: tt };
}

// ─── Init : set html lang au boot ─────────────────────────────────────
export function initI18n() {
  try {
    const lang = safeGet();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
    }
    return lang;
  } catch {
    return DEFAULT_LANG;
  }
}

export { SUPPORTED_LANGS, DEFAULT_LANG };
