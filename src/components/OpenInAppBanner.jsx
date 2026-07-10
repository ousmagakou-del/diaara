// ════════════════════════════════════════════════════════════════════
// OpenInAppBanner — CTA discret "Ouvrir dans l'app YARAM" (mobile web)
// ════════════════════════════════════════════════════════════════════
//
// Affichage :
//   - Uniquement sur mobile (matchMedia max-width:900px OU UA iPhone/Android)
//   - PAS en PWA installee (display-mode: standalone)
//   - PAS dans un WebView (Capacitor natif, in-app browsers)
//   - PAS si dismisse dans les 7 derniers jours (localStorage timestamp)
//
// Clic "Ouvrir" :
//   - iOS : deep link `yaram://` puis fallback App Store apres 1.5s
//     (si l'app est installee, iOS switch avant que le setTimeout ne fire)
//   - Android : intent:// URI natif, browser_fallback_url = Play Store
//     Si l'app est absente, Chrome/Samsung Internet ouvre directement le Play.
//
// Design : bande fixe bas d'ecran, safe-area padding, tokens --y-*.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import './OpenInAppBanner.css';

const DISMISS_KEY = 'yaram-open-in-app-dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const APP_STORE_URL = 'https://apps.apple.com/app/yaram/id6771017009';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.yaram';
const DEEP_LINK = 'yaram://';
const ANDROID_INTENT =
  'intent://open/#Intent;scheme=yaram;package=app.yaram;' +
  'S.browser_fallback_url=' +
  encodeURIComponent(PLAY_STORE_URL) +
  ';end';

function isMobile() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) return true;
  } catch { /* noop */ }
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod|Android/i.test(ua);
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isStandaloneOrWebView() {
  if (typeof window === 'undefined') return true;
  try {
    // PWA installee : matchMedia standalone (Android + iOS 16.4+)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    // iOS Safari legacy : navigator.standalone
    if (window.navigator?.standalone === true) return true;
  } catch { /* noop */ }
  // WebView Capacitor : la globale Capacitor est injectee par le natif.
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return true;
  // Heuristique WebView Facebook/Instagram/TikTok : ua contient FBAN/FBAV/Instagram
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(ua)) return true;
  return false;
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!ts || Number.isNaN(ts)) return false;
    return (Date.now() - ts) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

// ─── Icon assets ──────────────────────────────────────────────────
const IcoClose = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ════════════════════════════════════════════════════════════════════
export default function OpenInAppBanner() {
  const [visible, setVisible] = useState(false);

  // Calcul cote client uniquement (SSR-safe).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMobile()) return;
    if (isStandaloneOrWebView()) return;
    if (wasDismissedRecently()) return;
    // Petit delai : ne pas flasher pendant le splash / premier paint.
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setVisible(false);
  }, []);

  const openApp = useCallback(() => {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIos = isIOS();

    if (isAndroid) {
      // intent:// gere lui-meme le fallback vers browser_fallback_url si l'app est absente.
      try { window.location.href = ANDROID_INTENT; } catch { window.location.href = PLAY_STORE_URL; }
      return;
    }

    if (isIos) {
      // Deep link universel yaram:// (declare dans Info.plist CFBundleURLSchemes).
      // Si l'app est installee, iOS switch AVANT que le setTimeout ne fire.
      // Sinon Safari reste sur la page → on redirige vers l'App Store.
      let switched = false;
      const onHide = () => { if (document.hidden) switched = true; };
      document.addEventListener('visibilitychange', onHide);
      try { window.location.href = DEEP_LINK; } catch { /* noop */ }
      setTimeout(() => {
        document.removeEventListener('visibilitychange', onHide);
        if (!switched && !document.hidden) {
          window.location.href = APP_STORE_URL;
        }
      }, 1500);
      return;
    }

    // Fallback desktop : ouvre l'App Store dans un nouvel onglet.
    window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer');
  }, []);

  if (!visible) return null;

  return (
    <div className="yr-app-banner" role="complementary" aria-label="Ouvrir dans l'application YARAM">
      <button
        type="button"
        className="yr-app-banner__close"
        onClick={dismiss}
        aria-label="Fermer"
      >
        <IcoClose />
      </button>
      <div className="yr-app-banner__logo" aria-hidden="true">
        <img src="/yaram-logo.svg" alt="" width="24" height="24" />
      </div>
      <div className="yr-app-banner__text">
        <strong className="yr-app-banner__title">YARAM app</strong>
        <span className="yr-app-banner__sub">Plus rapide, notifications commandes</span>
      </div>
      <button
        type="button"
        className="yr-app-banner__cta"
        onClick={openApp}
      >
        Ouvrir
      </button>
    </div>
  );
}
