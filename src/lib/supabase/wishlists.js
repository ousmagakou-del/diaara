// ═══════════════════════════════════════════════════════════════════
// YARAM — Wishlists multi-listes + partage public
// ═══════════════════════════════════════════════════════════════════
// Toutes les opérations passent par des RPCs SECURITY DEFINER :
//   - wishlist_list_mine()
//   - wishlist_create(name, description)
//   - wishlist_rename(id, name, description)
//   - wishlist_delete(id)
//   - wishlist_get_items(wishlist_id)
//   - wishlist_add_item(wishlist_id, product_id)
//   - wishlist_remove_item(wishlist_id, product_id)
//   - wishlist_set_public(id, is_public)
//   - wishlist_get_by_slug(slug)   → publique, anon OK
//   - wishlist_ensure_default()    → auto-migre les legacy favorites
// ═══════════════════════════════════════════════════════════════════

import { supabase } from './client';

export async function listMyWishlists() {
  const { data, error } = await supabase.rpc('wishlist_list_mine');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createWishlist(name, description) {
  const { data, error } = await supabase.rpc('wishlist_create', {
    p_name: name,
    p_description: description || null,
  });
  if (error) throw error;
  return data; // { id, slug }
}

export async function renameWishlist(id, name, description) {
  const { error } = await supabase.rpc('wishlist_rename', {
    p_id: id,
    p_name: name,
    p_description: description || null,
  });
  if (error) throw error;
  return true;
}

export async function deleteWishlist(id) {
  const { error } = await supabase.rpc('wishlist_delete', { p_id: id });
  if (error) throw error;
  return true;
}

export async function getWishlistItems(wishlistId) {
  const { data, error } = await supabase.rpc('wishlist_get_items', {
    p_wishlist_id: wishlistId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addItemToWishlist(wishlistId, productId) {
  const { error } = await supabase.rpc('wishlist_add_item', {
    p_wishlist_id: wishlistId,
    p_product_id: productId,
  });
  if (error) throw error;
  return true;
}

export async function removeItemFromWishlist(wishlistId, productId) {
  const { error } = await supabase.rpc('wishlist_remove_item', {
    p_wishlist_id: wishlistId,
    p_product_id: productId,
  });
  if (error) throw error;
  return true;
}

export async function setWishlistPublic(id, isPublic) {
  const { error } = await supabase.rpc('wishlist_set_public', {
    p_id: id,
    p_is_public: !!isPublic,
  });
  if (error) throw error;
  return true;
}

// Public (anon) — utilise dans WishlistShared.jsx
export async function getWishlistBySlug(slug) {
  const { data, error } = await supabase.rpc('wishlist_get_by_slug', {
    p_slug: slug,
  });
  if (error) throw error;
  return data; // null si introuvable ou non publique
}

export async function ensureDefaultWishlist() {
  const { data, error } = await supabase.rpc('wishlist_ensure_default');
  if (error) throw error;
  return data; // uuid
}

// Helper share URL + WhatsApp message
export function buildWishlistShareUrl(slug) {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://yaram.app';
  return `${origin}/wishlist/${slug}`;
}

export function buildWhatsappShare(slug, name) {
  const url = buildWishlistShareUrl(slug);
  const msg = `Regarde ma liste "${name}" sur YARAM : ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
