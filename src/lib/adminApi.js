// src/lib/adminApi.js
// Wrappers RPC pour les operations admin (Phase 2 RLS).
//
// Tous les wrappers :
//   1. Recuperent le token admin courant via getAdminToken()
//   2. Verifient qu'il est present (sinon renvoient une session expiree)
//   3. Appellent la RPC correspondante (SECURITY DEFINER cote DB)
//   4. Renvoient { data, error, count } pour rester compatible avec
//      l'API supabase-js attendue dans les sections admin

import { supabase } from './supabase';
import { getAdminToken } from './adminAuth';

function requireToken() {
  const token = getAdminToken();
  if (!token) {
    const err = new Error('admin_session_expired');
    err.code = 'PGRST301';
    return { token: null, err };
  }
  return { token, err: null };
}

function splitCount(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { rows: rows || [], count: 0 };
  const count = Number(rows[0].full_count || 0);
  return { rows, count };
}

// ─────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────

export async function adminListOrders({ limit = 20, offset = 0, status = null } = {}) {
  const { token, err } = requireToken();
  if (err) return { data: null, count: 0, error: err };

  const { data, error } = await supabase.rpc('admin_list_orders', {
    p_token:  token,
    p_limit:  limit,
    p_offset: offset,
    p_status: status,
  });

  if (error) return { data: null, count: 0, error };
  const { rows, count } = splitCount(data);
  return { data: rows, count, error: null };
}

export async function adminUpdateOrder(orderId, patch) {
  const { token, err } = requireToken();
  if (err) return { error: err };
  const { error } = await supabase.rpc('admin_update_order', {
    p_token: token,
    p_id:    orderId,
    p_patch: patch,
  });
  return { error };
}

// ─────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────

export async function adminListUsers({ limit = 20, offset = 0, search = null } = {}) {
  const { token, err } = requireToken();
  if (err) return { data: null, count: 0, error: err };

  const { data, error } = await supabase.rpc('admin_list_users', {
    p_token:  token,
    p_limit:  limit,
    p_offset: offset,
    p_search: search,
  });

  if (error) return { data: null, count: 0, error };
  const { rows, count } = splitCount(data);
  return { data: rows, count, error: null };
}

// ─────────────────────────────────────────────────────────────────────
// COMMISSIONS
// ─────────────────────────────────────────────────────────────────────

export async function adminListCommissions({ limit = 50, offset = 0, status = null } = {}) {
  const { token, err } = requireToken();
  if (err) return { data: null, count: 0, error: err };

  const { data, error } = await supabase.rpc('admin_list_commissions', {
    p_token:  token,
    p_limit:  limit,
    p_offset: offset,
    p_status: status,
  });

  if (error) return { data: null, count: 0, error };
  const { rows, count } = splitCount(data);
  return { data: rows, count, error: null };
}

// ─────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────

export async function adminListAuditLog({ limit = 100, offset = 0 } = {}) {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };

  const { data, error } = await supabase.rpc('admin_list_audit_log', {
    p_token:  token,
    p_limit:  limit,
    p_offset: offset,
  });

  return { data: data || [], error };
}

// ─────────────────────────────────────────────────────────────────────
// PUSH SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────

export async function adminListPushSubscriptions() {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };

  const { data, error } = await supabase.rpc('admin_list_push_subscriptions', {
    p_token: token,
  });

  return { data: data || [], error };
}

// ─────────────────────────────────────────────────────────────────────
// STATS / DASHBOARD
// ─────────────────────────────────────────────────────────────────────

export async function adminUsersStats({ since = null } = {}) {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };
  const { data, error } = await supabase.rpc('admin_users_stats', {
    p_token: token,
    p_since: since,
  });
  return { data, error };
}

export async function adminDashboardCounts() {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };
  const { data, error } = await supabase.rpc('admin_dashboard_counts', { p_token: token });
  return { data, error };
}

// ─────────────────────────────────────────────────────────────────────
// USERS (variantes)
// ─────────────────────────────────────────────────────────────────────

export async function adminListUserOrders(userId) {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };
  const { data, error } = await supabase.rpc('admin_list_user_orders', {
    p_token:   token,
    p_user_id: userId,
  });
  return { data: data || [], error };
}

export async function adminListLoyaltyUsers({ limit = 200 } = {}) {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };
  const { data, error } = await supabase.rpc('admin_list_loyalty_users', {
    p_token: token,
    p_limit: limit,
  });
  return { data: data || [], error };
}

export async function adminListUsersFull() {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };
  const { data, error } = await supabase.rpc('admin_list_users_full', { p_token: token });
  return { data: data || [], error };
}

// ─────────────────────────────────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────────────────────────────────

export async function adminListStaff() {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };
  const { data, error } = await supabase.rpc('admin_list_staff', { p_token: token });
  return { data: data || [], error };
}

export async function adminUpsertStaff(id, payload) {
  const { token, err } = requireToken();
  if (err) return { error: err };
  const { error } = await supabase.rpc('admin_upsert_staff', {
    p_token:   token,
    p_id:      id || null,
    p_payload: payload,
  });
  return { error };
}

export async function adminDeleteStaff(id) {
  const { token, err } = requireToken();
  if (err) return { error: err };
  const { error } = await supabase.rpc('admin_delete_staff', {
    p_token: token,
    p_id:    id,
  });
  return { error };
}

// ─────────────────────────────────────────────────────────────────────
// ORDERS — variante full pour aggregations admin (Commissions, Performance, ...)
// ─────────────────────────────────────────────────────────────────────

export async function adminListOrdersFull({ since = null, statuses = null } = {}) {
  const { token, err } = requireToken();
  if (err) return { data: null, error: err };
  const { data, error } = await supabase.rpc('admin_list_orders_full', {
    p_token:    token,
    p_since:    since,
    p_statuses: statuses,
  });
  return { data: data || [], error };
}
