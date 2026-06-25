// ════════════════════════════════════════════════════════
// YARAM Driver — Web Push via VAPID + Service Worker
// ════════════════════════════════════════════════════════
// Réutilise le SW push handler déjà installé (public/sw.js).
// La subscription est sauvegardée dans `driver_push_subscriptions`
// (table séparée des clients pour clarté).
// ════════════════════════════════════════════════════════

import { supabase } from '../../lib/supabase';

const VAPID_PUBLIC = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_VAPID_PUBLIC) || '';

function urlBase64ToUint8Array(base64String) {
  const cleaned = String(base64String || '').replace(/\s+/g, '');
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Demande la permission web + subscribe au pushManager + upsert subscription
 * dans driver_push_subscriptions via RPC SECURITY DEFINER.
 *
 * @param {object} session — { token, driver_id }
 * @returns {Promise<{ok: boolean, error?: string, subscription?: object}>}
 */
export async function setupWebPushForDriver(session) {
  if (!session?.driver_id || !session?.token) {
    return { ok: false, error: 'no_session' };
  }
  if (typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)) {
    return { ok: false, error: 'web_push_unsupported' };
  }
  if (!VAPID_PUBLIC) {
    console.warn('[driver-push] VITE_VAPID_PUBLIC missing — web push disabled');
    return { ok: false, error: 'vapid_public_missing' };
  }

  try {
    // 1. Permission
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') {
      return { ok: false, error: 'permission_' + perm };
    }

    // 2. Service Worker prêt
    const reg = await navigator.serviceWorker.ready;
    if (!reg) return { ok: false, error: 'no_service_worker' };

    // 3. Subscribe (réutilise existant si déjà là)
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    const subJson = sub.toJSON ? sub.toJSON() : {
      endpoint: sub.endpoint,
      keys: {
        p256dh: arrayBufferToBase64Url(sub.getKey?.('p256dh')),
        auth: arrayBufferToBase64Url(sub.getKey?.('auth')),
      },
    };

    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: 'incomplete_subscription' };
    }

    // 4. Upsert via RPC (gère driver_id + token validation)
    const { data, error } = await supabase.rpc('driver_save_push_subscription', {
      p_token: session.token,
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: navigator.userAgent || null,
    });

    if (error || !data?.success) {
      console.warn('[driver-push] save subscription failed:', error?.message || data?.error);
      return { ok: false, error: error?.message || data?.error || 'save_failed' };
    }

    console.log('[driver-push] subscription saved ✓');
    return { ok: true, subscription: subJson };
  } catch (e) {
    console.warn('[driver-push] setupWebPushForDriver exception:', e?.message);
    return { ok: false, error: e?.message || String(e) };
  }
}
