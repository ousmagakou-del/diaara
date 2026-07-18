// ════════════════════════════════════════════════════════════════════
// YARAM Dermato — helpers RPC pour patient + dermato + utilitaires
// ════════════════════════════════════════════════════════════════════

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

// ─── Formatage prix "3 000 F CFA" ───
export function formatFcfa(amount) {
  if (amount == null || isNaN(amount)) return '—';
  const n = Math.round(Number(amount));
  const formatted = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} F CFA`;
}

// ─── Formatage court "3 000 F" ───
export function formatFcfaShort(amount) {
  if (amount == null || isNaN(amount)) return '—';
  const n = Math.round(Number(amount));
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;
}

// ─── Formatage date/heure FR ───
export function formatDateFr(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}
export function formatDateTimeFr(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}
export function formatTimeFr(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ═══════════════════════════════════════════════════
// PATIENT-SIDE RPCs
// ═══════════════════════════════════════════════════
export async function listActiveDermatologists() {
  const { data, error } = await supabase.rpc('list_active_dermatologists');
  if (error) throw error;
  // La RPC peut retourner soit un array direct soit { dermatologists: [...] }
  if (Array.isArray(data)) return data;
  return data?.dermatologists || [];
}

export async function getDermatologistDetail(slug) {
  const { data, error } = await supabase.rpc('get_dermatologist_detail', { p_slug: slug });
  if (error) throw error;
  return data;
}

export async function bookDermatoAsync({ dermatologistId, userId, symptoms, photos, patientInfo }) {
  const { data, error } = await supabase.rpc('book_dermato_async', {
    p_user_id: userId,
    p_dermatologist_id: dermatologistId,
    p_symptoms: symptoms || '',
    p_photos: photos || [],
    p_patient_info: patientInfo || {},
  });
  if (error) throw error;
  return data;
}

export async function bookDermatoVideo({ dermatologistId, userId, slotId, symptoms, patientInfo }) {
  const { data, error } = await supabase.rpc('book_dermato_video', {
    p_user_id: userId,
    p_dermatologist_id: dermatologistId,
    p_slot_id: slotId,
    p_symptoms: symptoms || '',
    p_patient_info: patientInfo || {},
  });
  if (error) throw error;
  return data;
}

export async function confirmDermatoPayment(consultId, method = 'mock', ref = null) {
  const { data, error } = await supabase.rpc('confirm_dermato_payment', {
    p_consultation_id: consultId,
    p_payment_method: method,
    p_payment_ref: ref || `WAVE_${Date.now()}`,
  });
  if (error) throw error;
  return data;
}

export async function getMyDermatoConsultations(userId) {
  const { data, error } = await supabase.rpc('get_my_dermato_consultations', { p_user_id: userId });
  if (error) throw error;
  if (Array.isArray(data)) return data;
  return data?.consultations || [];
}

export async function getDermatoConsultationDetail(userId, consultId) {
  const { data, error } = await supabase.rpc('get_dermato_consultation_detail', {
    p_user_id: userId,
    p_consultation_id: consultId,
  });
  if (error) throw error;
  return data;
}

export async function patientSendDermatoMessage(userId, consultId, body, photoUrl = null) {
  const { data, error } = await supabase.rpc('patient_send_dermato_message', {
    p_user_id: userId,
    p_consultation_id: consultId,
    p_body: body || '',
    p_photo_url: photoUrl,
  });
  if (error) throw error;
  return data;
}

export async function patientGetDermatoRoom(userId, consultId) {
  const { data, error } = await supabase.rpc('patient_get_dermato_room', {
    p_user_id: userId,
    p_consultation_id: consultId,
  });
  if (error) throw error;
  return data;
}

export async function rateDermatoConsultation(userId, consultId, rating, review = '') {
  const { data, error } = await supabase.rpc('rate_dermato_consultation', {
    p_user_id: userId,
    p_consultation_id: consultId,
    p_rating: rating,
    p_review: review,
  });
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════
// DERMA-SIDE (dashboard) — utilise localStorage 'derma_token'
// ═══════════════════════════════════════════════════
const DERMA_TOKEN_KEY = 'derma_token';
const DERMA_SESSION_KEY = 'derma_session';

export function getDermaToken() {
  try { return localStorage.getItem(DERMA_TOKEN_KEY); } catch { return null; }
}
export function getDermaSession() {
  try {
    const raw = localStorage.getItem(DERMA_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
export function saveDermaSession(token, dermato) {
  try {
    localStorage.setItem(DERMA_TOKEN_KEY, token);
    localStorage.setItem(DERMA_SESSION_KEY, JSON.stringify({ token, dermato, saved_at: Date.now() }));
  } catch { /* ignore */ }
}
export function clearDermaSession() {
  try {
    localStorage.removeItem(DERMA_TOKEN_KEY);
    localStorage.removeItem(DERMA_SESSION_KEY);
  } catch { /* ignore */ }
}

export async function dermaLogin(email, pin) {
  const { data, error } = await supabase.rpc('derma_login', { p_email: email, p_pin: pin });
  if (error) return { success: false, error: error.message };
  if (!data || data.success === false) return { success: false, error: data?.error || 'Erreur' };
  return { success: true, token: data.token, dermato: data.dermato };
}

export async function dermaGetConsultations() {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_get_consultations', { p_token: token });
  if (error) throw error;
  return data;
}

export async function dermaGetConsultationDetail(consultId) {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_get_consultation_detail', {
    p_token: token,
    p_consultation_id: consultId,
  });
  if (error) throw error;
  return data;
}

export async function dermaSendMessage(consultId, body, photoUrl = null) {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_send_message', {
    p_token: token,
    p_consultation_id: consultId,
    p_body: body || '',
    p_photo_url: photoUrl,
  });
  if (error) throw error;
  return data;
}

export async function dermaSendPrescription(consultId, payload) {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_send_prescription', {
    p_token: token,
    p_consultation_id: consultId,
    p_items: payload.items || [],
    p_diagnosis: payload.diagnosis || '',
    p_advice: payload.advice || '',
    p_precautions: payload.precautions || '',
    p_signature_data: payload.signature_data || '',
    p_signed_html: payload.signed_html || '',
    p_notes: payload.notes || '',
    p_follow_up_needed: !!payload.follow_up_needed,
    p_follow_up_date: payload.follow_up_date || null,
  });
  if (error) throw error;
  return data;
}

export async function dermaSetSlots(slots) {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_set_slots', {
    p_token: token,
    p_slots: slots,
  });
  if (error) throw error;
  return data;
}

export async function dermaDeleteSlot(slotId) {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_delete_slot', {
    p_token: token,
    p_slot_id: slotId,
  });
  if (error) throw error;
  return data;
}

export async function dermaGetSlots() {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_get_slots', { p_token: token });
  if (error) throw error;
  return data;
}

export async function dermaGetRoom(consultId) {
  const token = getDermaToken();
  const { data, error } = await supabase.rpc('derma_get_room', {
    p_token: token,
    p_consultation_id: consultId,
  });
  if (error) throw error;
  return data;
}

// ─── Edge fn create-daily-room ───
export async function createDailyRoom(consultationId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-daily-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ consultation_id: consultationId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.error || `HTTP ${res.status}` };
    return { success: true, ...data };
  } catch (e) {
    return { success: false, error: e?.message || 'network' };
  }
}

// ═══════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════
export async function adminListDermatologists(adminToken) {
  const { data, error } = await supabase.rpc('admin_list_dermatologists', { p_admin_token: adminToken });
  if (error) throw error;
  return data;
}

export async function adminCreateDermatologist(adminToken, payload, pin) {
  const { data, error } = await supabase.rpc('admin_create_dermatologist', {
    p_admin_token: adminToken,
    p_data: payload,
    p_pin: pin,
  });
  if (error) throw error;
  return data;
}

export async function adminUpdateDermatologist(adminToken, id, patch, newPin = null) {
  const { data, error } = await supabase.rpc('admin_update_dermatologist', {
    p_admin_token: adminToken,
    p_id: id,
    p_patch: patch,
    p_new_pin: newPin,
  });
  if (error) throw error;
  return data;
}

export async function adminListDermatoConsultations(adminToken) {
  const { data, error } = await supabase.rpc('admin_list_dermato_consultations', { p_admin_token: adminToken });
  if (error) throw error;
  return data;
}

// ─── Statut badge helpers ───
export const CONSULT_STATUS_LABEL = {
  pending_payment: 'Paiement en attente',
  paid: 'Payé',
  in_review: 'En cours d\'analyse',
  scheduled: 'Programmé',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
};
