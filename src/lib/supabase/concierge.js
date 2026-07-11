// ════════════════════════════════════════════════════════════════════
// Personal Shopper Premium (Concierge) — client helpers
// ════════════════════════════════════════════════════════════════════
// Abonnement 25k FCFA/mois : pharmacien dedie, echantillons mensuels,
// support WhatsApp prioritaire, +10% de reduction supplementaire.
// RPCs proteges par RLS owner-only.
// ════════════════════════════════════════════════════════════════════
import { supabase } from './client';

export const CONCIERGE_MONTHLY_FEE_FCFA = 25000;

export const CONCIERGE_PERKS = [
  { key: 'priority_delivery', label: 'Livraison prioritaire (< 2h)' },
  { key: 'monthly_samples_kit', label: 'Kit d echantillons mensuel offert' },
  { key: 'whatsapp_dedicated', label: 'WhatsApp dedie avec ton pharmacien' },
  { key: '10pct_extra_discount', label: '10 % de reduction supplementaire' },
];

/**
 * Souscrit l abonnement concierge. Idempotent : ne cree qu une seule ligne
 * par user et prolonge paid_until si deja actif.
 */
export async function conciergeSubscribe() {
  try {
    const { data, error } = await supabase.rpc('concierge_subscribe');
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    console.warn('[conciergeSubscribe]', e?.message);
    return { data: null, error: e?.message || 'unknown_error' };
  }
}

/**
 * Envoi une requete au pharmacien assigne.
 * @param {string} requestType 'product_recommendation' | 'routine_custom' | 'samples' | 'other'
 * @param {string} message
 */
export async function conciergeSendRequest(requestType, message) {
  try {
    const { data, error } = await supabase.rpc('concierge_send_request', {
      p_request_type: requestType,
      p_message: message,
    });
    if (error) throw error;
    return { id: data, error: null };
  } catch (e) {
    console.warn('[conciergeSendRequest]', e?.message);
    return { id: null, error: e?.message || 'unknown_error' };
  }
}

/**
 * Retourne { subscription, pharmacist, recent_requests }.
 */
export async function conciergeGetMyStatus() {
  try {
    const { data, error } = await supabase.rpc('concierge_get_my_status');
    if (error) throw error;
    return data || { subscription: null, pharmacist: null, recent_requests: [] };
  } catch (e) {
    console.warn('[conciergeGetMyStatus]', e?.message);
    return { subscription: null, pharmacist: null, recent_requests: [] };
  }
}
