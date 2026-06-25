// ════════════════════════════════════════════════════════
// YARAM Admin — Envoi Web Push aux drivers via send-push-web
// ════════════════════════════════════════════════════════
// Réutilise l'edge function existante send-push-web (VAPID + RFC 8291).
// Le SW de la PWA driver (public/sw.js) reçoit le push event et affiche la notif.
// ════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://qxhhnrnworwrnwmqekmb.supabase.co';
const SUPABASE_ANON = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_ANON) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4aGhucm53b3J3cm53bXFla21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzNzg2MzcsImV4cCI6MjA1Mzk1NDYzN30.qNa-LCqv7vRdxhc3UeZi6_DZ8XlnRY9hRWVUkAo5kCY';

/**
 * Envoie une push notif à un driver assigné à une commande.
 *
 * @param {string} adminToken - token admin_sessions
 * @param {string} driverId   - uuid du delivery_drivers
 * @param {object} order      - { id, total_amount, address, ... }
 * @returns {Promise<{ok: boolean, sent: number, failed: number, errors?: any[]}>}
 */
export async function notifyDriverNewOrder(adminToken, driverId, order) {
  try {
    // 1) Récupère les subscriptions du driver
    const { data, error } = await supabase.rpc('admin_get_driver_push_subscriptions', {
      p_admin_token: adminToken,
      p_driver_id: driverId,
    });

    if (error || !data?.success) {
      console.warn('[notify-driver] fetch subs failed:', error?.message || data?.error);
      return { ok: false, sent: 0, failed: 0, error: error?.message || data?.error };
    }

    const subs = data.subscriptions || [];
    if (!subs.length) {
      console.log('[notify-driver] no subscriptions for driver', driverId, '(driver pas connecté à PWA ou notifs refusées)');
      return { ok: true, sent: 0, failed: 0, reason: 'no_subscriptions' };
    }

    // 2) Payload notif
    const amount = order?.total_amount
      ? `${Math.round(Number(order.total_amount)).toLocaleString('fr-FR')} FCFA`
      : '';
    const customerName = order?.address?.name || 'un client';

    const payload = {
      title: '🛵 Nouvelle livraison YARAM',
      body: amount
        ? `Commande #${order?.id} — ${customerName} • ${amount}`
        : `Commande #${order?.id} pour ${customerName}`,
      data: {
        url: `/driver/delivery/${order?.id}`,
        order_id: order?.id,
        type: 'new_delivery',
      },
    };

    // 3) Envoi en parallèle à chaque subscription (un driver peut avoir
    //    plusieurs devices : iPhone + Android par ex.)
    const results = await Promise.allSettled(subs.map((s) =>
      fetch(`${SUPABASE_URL}/functions/v1/send-push-web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'apikey': SUPABASE_ANON,
        },
        body: JSON.stringify({
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
          payload,
          ttl: 60,
        }),
      }).then(async (r) => {
        const txt = await r.text();
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
        return txt;
      })
    ));

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason?.message || String(r.reason));

    if (failed) console.warn('[notify-driver]', sent, 'sent /', failed, 'failed', errors);
    else console.log('[notify-driver] ✓', sent, 'push sent');

    return { ok: sent > 0, sent, failed, errors };
  } catch (e) {
    console.warn('[notify-driver] exception:', e?.message);
    return { ok: false, sent: 0, failed: 0, error: e?.message || String(e) };
  }
}
