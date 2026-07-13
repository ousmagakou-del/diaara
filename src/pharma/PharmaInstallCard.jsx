// ════════════════════════════════════════════════════════════════════
// PharmaInstallCard.jsx
// ────────────────────────────────────────────────────────────────────
// Carte "Installer sur mon téléphone + activer les notifications" pour
// les pharmacies partenaires.
//
// Comportement :
// - Détecte iOS Safari / Android Chrome / desktop
// - Sur iOS : instructions "Partager → Ajouter à l'écran d'accueil"
// - Sur Android : bouton natif via beforeinstallprompt
// - Sur desktop : instructions Chrome/Edge
// - Bouton "Activer les notifications" wire notification permission
//   + subscribe push + persistance en DB via RPC pharma_save_push_subscription
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase, getPharmaToken } from '../lib/supabase';

// Clé VAPID publique — identique côté client / driver / pharma
// (correspond à la clé privée stockée dans la vault Supabase pour send-push-web)
const VAPID_PUBLIC_KEY = 'BNxe7DjGiK8jp_LdEKgZbI3oFG9p_X0wmKHHfsXOlVHwBE3FB_pIRgFb_VxkN1xnzPxRzz0w8hYqYnFw7yWEpQk';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PharmaInstallCard({ pharmacyId }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState('unknown'); // 'ios' | 'android' | 'desktop'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [notifState, setNotifState] = useState('default');
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // ── Détection plateforme + standalone ─────────────────────────
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

    // Écoute l'event Android beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // État actuel des notifs
    if ('Notification' in window) setNotifState(Notification.permission);

    // Est-on déjà subscribed ?
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }).catch(() => {});
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Handler install Android natif ─────────────────────────────
  const handleInstallAndroid = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
  }, [deferredPrompt]);

  // ── Handler activer notifs + subscribe push ───────────────────
  const handleEnableNotifs = useCallback(async () => {
    if (notifBusy) return;
    setNotifBusy(true);
    setNotifMsg('');

    try {
      if (!('Notification' in window)) {
        setNotifMsg('❌ Ton navigateur ne supporte pas les notifications.');
        return;
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setNotifMsg('❌ Push notifications non supportées ici. Utilise Chrome ou Safari récent.');
        return;
      }

      // 1. Demande la permission
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      setNotifState(perm);

      if (perm !== 'granted') {
        setNotifMsg('⚠️ Permission refusée. Va dans Réglages Safari/Chrome → Notifications YARAM pour l\'autoriser.');
        return;
      }

      // 2. Subscribe au push service
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      setSubscribed(true);

      // 3. Save subscription en DB liée à pharmacy_id
      const token = getPharmaToken();
      if (!token) {
        setNotifMsg('⚠️ Session expirée — reconnecte-toi.');
        return;
      }
      const { error } = await supabase.rpc('pharma_save_push_subscription', {
        p_token: token,
        p_subscription: sub.toJSON(),
      });
      if (error) {
        console.error('[pharma push] save subscription error', error);
        setNotifMsg('⚠️ Subscription reçue mais pas sauvegardée. Réessaye plus tard.');
        return;
      }

      setNotifMsg('✅ Notifications activées ! Tu recevras une alerte à chaque nouvelle commande.');
    } catch (e) {
      console.error('[pharma push] error', e);
      setNotifMsg('❌ Erreur : ' + (e?.message || 'inconnue'));
    } finally {
      setNotifBusy(false);
    }
  }, [notifBusy]);

  // ── Test envoi d'une notif locale (verif que ça marche) ───────
  const handleTestNotif = useCallback(() => {
    if (Notification.permission !== 'granted') {
      setNotifMsg('⚠️ Active d\'abord les notifs avant de tester.');
      return;
    }
    new Notification('YARAM Pharma', {
      body: 'Test réussi ! Tu recevras les vraies alertes de la même façon.',
      icon: '/yaram-logo-192.png',
      badge: '/yaram-logo-192.png',
      tag: 'pharma-test',
    });
  }, []);

  // ── Si déjà installée en PWA, on montre juste les notifs ──────
  const showInstall = !isStandalone;

  return (
    <div className="phar-card">
      <div className="phar-card-title">📱 Application mobile</div>

      {showInstall && (
        <>
          <p style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 12 }}>
            Installe le dashboard sur ton téléphone pour un accès instantané
            depuis l'écran d'accueil — comme une vraie app.
          </p>

          {platform === 'ios' && (
            <div style={{
              background: '#E8F5EC',
              border: '1px solid #1F8B4C',
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
            }}>
              <strong style={{ fontSize: 13, color: '#166635', display: 'block', marginBottom: 8 }}>
                Sur iPhone (Safari) :
              </strong>
              <ol style={{ fontSize: 13, color: '#166635', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                <li>Appuie sur l'icône <strong>Partager</strong> <span style={{ fontSize: 16 }}>⎋</span> en bas de Safari</li>
                <li>Fais défiler et choisis <strong>« Sur l'écran d'accueil »</strong></li>
                <li>Appuie sur <strong>Ajouter</strong> en haut à droite</li>
              </ol>
              <p style={{ fontSize: 11, color: '#166635', marginTop: 8, fontStyle: 'italic' }}>
                Une fois installée, ouvre l'icône YARAM Pharma depuis ton écran d'accueil.
              </p>
            </div>
          )}

          {platform === 'android' && deferredPrompt && (
            <button
              onClick={handleInstallAndroid}
              className="phar-btn-primary"
              style={{ marginBottom: 12 }}
            >
              📲 Installer sur mon téléphone
            </button>
          )}

          {platform === 'android' && !deferredPrompt && (
            <div style={{
              background: '#E8F5EC',
              border: '1px solid #1F8B4C',
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
            }}>
              <strong style={{ fontSize: 13, color: '#166635', display: 'block', marginBottom: 8 }}>
                Sur Android (Chrome) :
              </strong>
              <ol style={{ fontSize: 13, color: '#166635', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                <li>Menu Chrome <strong>⋮</strong> en haut à droite</li>
                <li><strong>« Ajouter à l'écran d'accueil »</strong></li>
                <li>Confirme avec <strong>Installer</strong></li>
              </ol>
            </div>
          )}

          {platform === 'desktop' && (
            <div style={{
              background: '#F4F4F2',
              border: '1px solid #EEE',
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              fontSize: 12,
              color: '#6B6B6B',
            }}>
              Cette carte est plus utile sur mobile. Ouvre yaram.app/pharma
              sur ton iPhone ou Android pour installer.
            </div>
          )}
        </>
      )}

      {isStandalone && (
        <div style={{
          background: '#E8F5EC',
          border: '1px solid #1F8B4C',
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          fontSize: 13,
          color: '#166635',
        }}>
          ✅ Le dashboard est installé sur ton téléphone.
        </div>
      )}

      {/* ─── NOTIFICATIONS ─── */}
      <div style={{ borderTop: '1px solid #EEE', paddingTop: 14, marginTop: 4 }}>
        <div className="phar-card-title" style={{ fontSize: 14, marginBottom: 8 }}>
          🔔 Notifications de commandes
        </div>
        <p style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 12 }}>
          Reçois une notification instantanée dès qu'une nouvelle commande arrive,
          même si le dashboard n'est pas ouvert.
        </p>

        {notifState === 'granted' && subscribed ? (
          <>
            <div style={{
              background: '#E8F5EC',
              border: '1px solid #1F8B4C',
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              fontSize: 13,
              color: '#166635',
              fontWeight: 600,
            }}>
              ✅ Notifications actives
            </div>
            <button
              onClick={handleTestNotif}
              className="phar-btn-outline"
              style={{ marginBottom: 0 }}
            >
              🧪 Tester une notification
            </button>
          </>
        ) : (
          <button
            onClick={handleEnableNotifs}
            disabled={notifBusy}
            className="phar-btn-primary"
          >
            {notifBusy ? 'Activation…' : '🔔 Activer les notifications'}
          </button>
        )}

        {notifMsg && (
          <div style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            fontSize: 12,
            background: notifMsg.startsWith('✅') ? '#E8F5EC' : '#FEF6E5',
            color: notifMsg.startsWith('✅') ? '#166635' : '#A07700',
          }}>
            {notifMsg}
          </div>
        )}

        {notifState === 'denied' && (
          <p style={{ fontSize: 11, color: '#D9342B', marginTop: 8, fontStyle: 'italic' }}>
            ⚠️ Les notifications sont bloquées. Va dans les Réglages du navigateur
            pour autoriser à nouveau les notifications YARAM.
          </p>
        )}
      </div>
    </div>
  );
}
