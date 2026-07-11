// ════════════════════════════════════════════════════════════════════
// Trade-In / Rachat cosmetiques semi-neufs — client helpers
// ════════════════════════════════════════════════════════════════════
// L utilisateur soumet une liste d items usages (photo + brand + condition)
// et recoit un credit YARAM apres validation admin.
// RLS owner-only. Estimation calculee cote serveur pour eviter la fraude.
// ════════════════════════════════════════════════════════════════════
import { supabase } from './client';

export const TRADE_IN_CONDITIONS = [
  { value: 'new', label: 'Neuf (jamais utilise)' },
  { value: 'like_new', label: 'Comme neuf' },
  { value: 'good', label: 'Bon etat' },
  { value: 'fair', label: 'Etat correct' },
  { value: 'used', label: 'Utilise' },
];

/**
 * Soumet une demande de trade-in.
 * items: [{ name, brand, condition, photo_url?, estimated_value? }]
 * pickupAddress: { address, city?, phone? } (optionnel)
 */
export async function tradeInSubmit(items, pickupAddress = null) {
  try {
    const { data, error } = await supabase.rpc('trade_in_submit', {
      p_items: items,
      p_pickup_address: pickupAddress,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    console.warn('[tradeInSubmit]', e?.message);
    return { data: null, error: e?.message || 'unknown_error' };
  }
}

/**
 * Liste les demandes de trade-in de l utilisateur courant (via RLS).
 */
export async function tradeInListMine() {
  try {
    const { data, error } = await supabase
      .from('trade_in_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[tradeInListMine]', e?.message);
    return [];
  }
}
