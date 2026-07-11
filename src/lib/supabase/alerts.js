// ════════════════════════════════════════════════════════════════════
// YARAM — Push intelligentes : souscriptions client
// ════════════════════════════════════════════════════════════════════
// RPCs Supabase SECURITY DEFINER pour gerer les alertes user :
//   - subscribe_price_drop / unsubscribe_price_drop  (baisse de prix)
//   - subscribe_restock    / unsubscribe_restock     (retour en stock)
//
// Toutes filtres RLS sont geres cote RPC (auth.uid()).
// ════════════════════════════════════════════════════════════════════

import { supabase } from './client';

export async function subscribePriceDrop(productId, thresholdPct = 10) {
  if (!productId) return { ok: false, error: 'missing_product_id' };
  const { error } = await supabase.rpc('subscribe_price_drop', {
    p_product_id: productId,
    p_threshold_pct: Math.max(1, Math.min(90, Number(thresholdPct) || 10)),
  });
  if (error) {
    console.warn('[subscribePriceDrop]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function unsubscribePriceDrop(productId) {
  if (!productId) return { ok: false, error: 'missing_product_id' };
  const { error } = await supabase.rpc('unsubscribe_price_drop', {
    p_product_id: productId,
  });
  if (error) {
    console.warn('[unsubscribePriceDrop]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function subscribeRestock(productId) {
  if (!productId) return { ok: false, error: 'missing_product_id' };
  const { error } = await supabase.rpc('subscribe_restock', {
    p_product_id: productId,
  });
  if (error) {
    console.warn('[subscribeRestock]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function unsubscribeRestock(productId) {
  if (!productId) return { ok: false, error: 'missing_product_id' };
  const { error } = await supabase.rpc('unsubscribe_restock', {
    p_product_id: productId,
  });
  if (error) {
    console.warn('[unsubscribeRestock]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Etat de souscription pour un produit + user courant.
 * Retourne : { priceDropSubscribed, priceDropThreshold, restockSubscribed }
 */
export async function getAlertSubscriptions(productId) {
  const empty = { priceDropSubscribed: false, priceDropThreshold: 10, restockSubscribed: false };
  if (!productId) return empty;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return empty;

  try {
    const [pd, rs] = await Promise.all([
      supabase
        .from('price_drop_alerts')
        .select('threshold_pct')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle(),
      supabase
        .from('user_restock_alerts')
        .select('user_id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle(),
    ]);
    return {
      priceDropSubscribed: !!pd?.data,
      priceDropThreshold: Number(pd?.data?.threshold_pct) || 10,
      restockSubscribed: !!rs?.data,
    };
  } catch (e) {
    console.warn('[getAlertSubscriptions]', e?.message);
    return empty;
  }
}
