// ════════════════════════════════════════════════════════════════════
// Bundles / Cross-sell client helpers
// ════════════════════════════════════════════════════════════════════
import { supabase } from './client';

// Public
export async function getBundleBySlug(slug) {
  if (!slug) return null;
  try {
    const { data, error } = await supabase.rpc('get_bundle_by_slug', { p_slug: slug });
    if (error) throw error;
    if (!data || data.error) return null;
    return data;
  } catch (e) {
    console.warn('[getBundleBySlug]', e?.message);
    return null;
  }
}

export async function getBundlesForSkinType(skinType) {
  try {
    const { data, error } = await supabase.rpc('get_bundles_for_skin_type', {
      p_skin_type: skinType || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[getBundlesForSkinType]', e?.message);
    return [];
  }
}

export async function getBundlesContainingProduct(productId) {
  if (!productId) return [];
  try {
    const { data, error } = await supabase.rpc('get_bundles_containing_product', {
      p_product_id: productId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[getBundlesContainingProduct]', e?.message);
    return [];
  }
}

export async function getFrequentlyBoughtWith(productId, limit = 4) {
  if (!productId) return [];
  try {
    const { data, error } = await supabase.rpc('get_frequently_bought_with', {
      p_product_id: productId,
      p_limit: limit,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[getFrequentlyBoughtWith]', e?.message);
    return [];
  }
}

// Home featured bundles
export async function getFeaturedBundles() {
  try {
    const { data, error } = await supabase
      .from('product_bundles')
      .select('*')
      .eq('active', true)
      .eq('featured', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[getFeaturedBundles]', e?.message);
    return [];
  }
}

// Admin
export async function adminListBundles() {
  try {
    const { data, error } = await supabase.rpc('admin_list_bundles');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[adminListBundles]', e?.message);
    return [];
  }
}

export async function adminCreateBundle({
  title,
  description,
  productIds,
  discountPct = 10,
  coverUrl = null,
  targetSkinTypes = [],
  targetConcerns = [],
  featured = false,
}) {
  const { data, error } = await supabase.rpc('admin_create_bundle', {
    p_title: title,
    p_description: description || null,
    p_product_ids: productIds || [],
    p_discount_pct: discountPct,
    p_cover_url: coverUrl,
    p_target_skin_types: targetSkinTypes,
    p_target_concerns: targetConcerns,
    p_featured: featured,
  });
  if (error) throw error;
  return data;
}

export async function adminUpdateBundle(bundleId, patch) {
  const { data, error } = await supabase.rpc('admin_update_bundle', {
    p_bundle_id: bundleId,
    p_title: patch.title ?? null,
    p_description: patch.description ?? null,
    p_discount_pct: patch.discountPct ?? null,
    p_cover_url: patch.coverUrl ?? null,
    p_target_skin_types: patch.targetSkinTypes ?? null,
    p_target_concerns: patch.targetConcerns ?? null,
    p_featured: patch.featured ?? null,
    p_active: patch.active ?? null,
    p_product_ids: patch.productIds ?? null,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteBundle(bundleId) {
  const { data, error } = await supabase.rpc('admin_delete_bundle', {
    p_bundle_id: bundleId,
  });
  if (error) throw error;
  return data;
}

export async function adminRefreshFrequentlyBoughtWith() {
  const { data, error } = await supabase.rpc('admin_refresh_frequently_bought_with');
  if (error) throw error;
  return data;
}
