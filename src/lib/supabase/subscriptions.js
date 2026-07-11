// ════════════════════════════════════════════════════════════════════
// Subscribe & Save — client helpers
// ════════════════════════════════════════════════════════════════════
// Routines recurrentes -15%. RPCs proteges par RLS owner-only.
// ════════════════════════════════════════════════════════════════════
import { supabase } from './client';

/**
 * Cree un nouvel abonnement. Retourne l id (uuid) cree.
 * items : [{ id, name, price, qty, img?, brand? }]
 * address : { label?, address, city?, phone? }
 */
export async function createSubscription({
  name,
  items,
  frequencyDays,
  address,
  paymentMethod = 'wave',
}) {
  try {
    const { data, error } = await supabase.rpc('subscription_create', {
      p_name: name,
      p_items: items,
      p_frequency_days: frequencyDays,
      p_address: address,
      p_payment_method: paymentMethod,
    });
    if (error) throw error;
    return { id: data, error: null };
  } catch (e) {
    console.warn('[createSubscription]', e?.message);
    return { id: null, error: e?.message || 'unknown_error' };
  }
}

export async function pauseSubscription(id, untilDate = null) {
  const { data, error } = await supabase.rpc('subscription_pause', {
    p_id: id,
    p_until_date: untilDate,
  });
  if (error) throw error;
  return data;
}

export async function resumeSubscription(id) {
  const { data, error } = await supabase.rpc('subscription_resume', { p_id: id });
  if (error) throw error;
  return data;
}

export async function cancelSubscription(id) {
  const { data, error } = await supabase.rpc('subscription_cancel', { p_id: id });
  if (error) throw error;
  return data;
}

/**
 * Skip / accelerate. delta > 0 = repousse ; delta < 0 = avance.
 */
export async function updateSubscriptionNextDelivery(id, deltaDays) {
  const { data, error } = await supabase.rpc('subscription_update_next_delivery', {
    p_id: id,
    p_delta_days: deltaDays,
  });
  if (error) throw error;
  return data;
}

export async function changeSubscriptionItems(id, items) {
  const { data, error } = await supabase.rpc('subscription_change_items', {
    p_id: id,
    p_items: items,
  });
  if (error) throw error;
  return data;
}

export async function listMySubscriptions() {
  try {
    const { data, error } = await supabase.rpc('subscription_list_mine');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[listMySubscriptions]', e?.message);
    return [];
  }
}

// ── Helpers de formatage ─────────────────────────────────────────────
export function computeSubscriptionTotal(items = [], discountPct = 15) {
  const raw = items.reduce(
    (s, it) => s + Number(it?.qty || 1) * Number(it?.price || 0),
    0,
  );
  const discount = Math.round((raw * discountPct) / 100);
  return { raw, discount, total: Math.max(0, raw - discount) };
}

export const FREQUENCY_OPTIONS = [
  { value: 30, label: 'Tous les 30 jours', short: '30j' },
  { value: 60, label: 'Tous les 60 jours', short: '60j' },
  { value: 90, label: 'Tous les 90 jours', short: '90j' },
];

export const SUB_DISCOUNT_PCT = 15;
