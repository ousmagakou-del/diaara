// ════════════════════════════════════════════════════════════════
// BrandInstallCard — Installation PWA + Notifications (marques)
// ────────────────────────────────────────────────────────────────
// Copie fidele du pattern PharmaInstallCard adapte pour :
//   - Palette violette
//   - Strings marque ("YARAM Marque" vs "YARAM Pharma")
//   - RPC brand_save_push_subscription (fallback silencieux si absente)
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getBrandToken } from '../pages/Brand';

// Meme cle VAPID que le driver/pharma (partagee)
const VAPID_PUBLIC_KEY = 'BNxe7DjGiK8jp_LdEKgZbI3oFG9p_X0wmKHHfsXOlVHwBE3FB_pIRgFb_VxkN1xnzPxRzz0w8hYqYnFw7yWEpQk';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

const Icon = ({ name, ...p }) => {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p };
  switch (name) {
    case 'phone': return (<svg {...props}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>);
    case 'bell': return (<svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>);
    case 'check': return (<svg {...props}><polyline points="20 6 9 17 4 12"/></svg>);
    case 'download': return (<svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
    default: return null;
  }
};

const infoBoxViolet = {
  background: 'var(--brand-violet-softer)',
  border: '1px solid var(--brand-violet-soft)',
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};
const infoBoxSuccess = {
  background: '#EAF7F0',
  border: '1px solid #1F8B4C',
  borderRadius: 12,
  padding: 12,
  marginBottom: 8,
  fontSize: 13,
  color: '#166635',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export default function BrandInstallCard({ brandId }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState('unknown'); // 'ios' | 'android' | 'desktop'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [notifState, setNotifState] = useState('default');
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true;
    setIsStandalone(!!standalone);

    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if ('Notification' in window) setNotifState(Notification.permission);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }).catch(() => {});
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallAndroid = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
  }, [deferredPrompt]);

  const handleEnableNotifs = useCallback(async () => {
    if (notifBusy) return;
    setNotifBusy(true);
    setNotifMsg('');
    try {
      if (!('Notification' in window)) {
        setNotifMsg('Notifications non supportées par ce navigateur.');
        return;
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setNotifMsg('Push non supporté. Utilise Chrome ou Safari récent.');
        return;
      }
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      setNotifState(perm);
      if (perm !== 'granted') {
        setNotifMsg('Permission refusée. Va dans les Réglages du navigateur pour l\'autoriser.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      setSubscribed(true);

      const token = getBrandToken();
      if (!token) {
        setNotifMsg('Session expirée — reconnecte-toi.');
        return;
      }
      try {
        const { error } = await supabase.rpc('brand_save_push_subscription', {
          p_token: token,
          p_subscription: sub.toJSON(),
        });
        if (error) console.warn('[brand push] save subscription warning:', error.message);
      } catch (e) {
        console.warn('[brand push] RPC absente pour l\'instant :', e?.message);
      }
      setNotifMsg('Notifications activées — tu seras alerté(e) des validations.');
    } catch (e) {
      console.error('[brand push] error', e);
      setNotifMsg('Erreur : ' + (e?.message || 'inconnue'));
    } finally {
      setNotifBusy(false);
    }
  }, [notifBusy]);

  const handleTestNotif = useCallback(() => {
    if (Notification.permission !== 'granted') {
      setNotifMsg('Active d\'abord les notifs avant de tester.');
      return;
    }
    new Notification('YARAM Marque', {
      body: 'Test réussi ! Tu recevras les vraies alertes de la même façon.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'brand-test',
    });
  }, []);

  const showInstall = !isStandalone;

  return (
    <div className="brnd-card">
      <div className="brnd-card-title">
        <Icon name="phone" width={18} height={18} />
        Application mobile
      </div>

      {showInstall && (
        <>
          <p style={{ fontSize: 13, color: 'var(--y-n-600)', marginBottom: 12, marginTop: 0 }}>
            Installe le dashboard sur ton téléphone pour un accès instant — comme une vraie app.
          </p>

          {platform === 'ios' && (
            <div style={infoBoxViolet}>
              <strong style={{ fontSize: 13, color: 'var(--brand-violet-dark)', display: 'block', marginBottom: 8 }}>
                Sur iPhone (Safari) :
              </strong>
              <ol style={{ fontSize: 13, color: 'var(--brand-violet-dark)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                <li>Appuie sur l'icône <strong>Partager</strong> en bas de Safari</li>
                <li>Fais défiler → <strong>« Sur l'écran d'accueil »</strong></li>
                <li>Appuie sur <strong>Ajouter</strong> en haut à droite</li>
              </ol>
              <p style={{ fontSize: 11, color: 'var(--brand-violet-dark)', marginTop: 8, fontStyle: 'italic' }}>
                Une fois installée, ouvre l'icône YARAM Marque depuis ton écran d'accueil.
              </p>
            </div>
          )}

          {platform === 'android' && deferredPrompt && (
            <button
              onClick={handleInstallAndroid}
              className="brnd-btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
            >
              <Icon name="download" width={16} height={16} />
              Installer sur mon téléphone
            </button>
          )}

          {platform === 'android' && !deferredPrompt && (
            <div style={infoBoxViolet}>
              <strong style={{ fontSize: 13, color: 'var(--brand-violet-dark)', display: 'block', marginBottom: 8 }}>
                Sur Android (Chrome) :
              </strong>
              <ol style={{ fontSize: 13, color: 'var(--brand-violet-dark)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                <li>Menu Chrome ⋮ en haut à droite</li>
                <li><strong>« Ajouter à l'écran d'accueil »</strong></li>
                <li>Confirme avec <strong>Installer</strong></li>
              </ol>
            </div>
          )}

          {platform === 'desktop' && (
            <div style={{
              background: 'var(--y-n-100)',
              border: '1px solid var(--y-n-200)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              fontSize: 12,
              color: 'var(--y-n-700)',
            }}>
              Cette carte est plus utile sur mobile. Ouvre yaram.app/brand sur ton iPhone ou Android pour installer.
            </div>
          )}
        </>
      )}

      {isStandalone && (
        <div style={infoBoxSuccess}>
          <Icon name="check" width={16} height={16} />
          Le dashboard est installé sur ton téléphone.
        </div>
      )}

      {/* NOTIFICATIONS */}
      <div style={{ borderTop: '1px solid var(--y-n-200)', paddingTop: 14, marginTop: 8 }}>
        <div className="brnd-card-title" style={{ fontSize: 14, marginBottom: 8 }}>
          <Icon name="bell" width={16} height={16} />
          Notifications
        </div>
        <p style={{ fontSize: 13, color: 'var(--y-n-600)', marginBottom: 12, marginTop: 0 }}>
          Reçois une notification quand YARAM valide ou rejette un de tes produits.
        </p>

        {notifState === 'granted' && subscribed ? (
          <>
            <div style={infoBoxSuccess}>
              <Icon name="check" width={16} height={16} />
              Notifications actives
            </div>
            <button
              onClick={handleTestNotif}
              className="brnd-btn-outline"
              style={{ width: '100%' }}
            >
              Tester une notification
            </button>
          </>
        ) : (
          <button
            onClick={handleEnableNotifs}
            disabled={notifBusy}
            className="brnd-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Icon name="bell" width={16} height={16} />
            {notifBusy ? 'Activation…' : 'Activer les notifications'}
          </button>
        )}

        {notifMsg && (
          <div style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            fontSize: 12,
            background: notifState === 'granted' ? 'var(--brand-violet-softer)' : 'var(--y-warning-soft)',
            color: notifState === 'granted' ? 'var(--brand-violet-dark)' : 'var(--y-warning-text)',
          }}>
            {notifMsg}
          </div>
        )}

        {notifState === 'denied' && (
          <p style={{ fontSize: 11, color: 'var(--y-danger)', marginTop: 8, fontStyle: 'italic' }}>
            Les notifications sont bloquées. Va dans les Réglages du navigateur pour les autoriser à nouveau.
          </p>
        )}
      </div>
    </div>
  );
}
