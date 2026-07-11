// ════════════════════════════════════════════════════════════════════
// YARAM — Blog SEO (yaram.app/blog/*)
// ════════════════════════════════════════════════════════════════════
// RPCs Supabase SECURITY DEFINER cote client :
//   - blog_list_categories  (public read)
//   - blog_list_articles    (public read)
//   - blog_get_article      (public read - + linked products)
//   - blog_get_featured     (public read)
//   - blog_increment_view   (public write - counter only)
// ════════════════════════════════════════════════════════════════════

import { supabase } from './client';

export async function listBlogCategories() {
  const { data, error } = await supabase.rpc('blog_list_categories');
  if (error) {
    console.warn('[listBlogCategories]', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function listBlogArticles({ categorySlug = null, limit = 20, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('blog_list_articles', {
    p_category_slug: categorySlug,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.warn('[listBlogArticles]', error.message);
    return { total: 0, articles: [] };
  }
  return {
    total: Number(data?.total || 0),
    articles: Array.isArray(data?.articles) ? data.articles : [],
  };
}

export async function getBlogArticle(slug) {
  if (!slug) return null;
  const { data, error } = await supabase.rpc('blog_get_article', { p_slug: slug });
  if (error) {
    console.warn('[getBlogArticle]', error.message);
    return null;
  }
  if (!data?.found) return null;
  return {
    article: data.article,
    category: data.category,
    products: Array.isArray(data.products) ? data.products : [],
  };
}

export async function getFeaturedBlogArticles(limit = 5) {
  const { data, error } = await supabase.rpc('blog_get_featured', { p_limit: limit });
  if (error) {
    console.warn('[getFeaturedBlogArticles]', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function incrementBlogView(slug) {
  if (!slug) return;
  try {
    await supabase.rpc('blog_increment_view', { p_slug: slug });
  } catch { /* silent */ }
}

// ─── Admin (JWT admin session token via header custom) ─────────────
// L'admin utilise le client Supabase avec service_role via edge / direct REST
// depuis le contexte admin. Ici on expose helpers direct sur les tables
// pour les CRUD (RLS bloque anon/auth, seul service_role passe).
export async function adminListAllArticles() {
  const { data, error } = await supabase
    .from('blog_articles')
    .select('*, blog_categories(id,slug,name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertArticle(row) {
  const payload = { ...row, updated_at: new Date().toISOString() };
  if (payload.id) {
    const { data, error } = await supabase
      .from('blog_articles')
      .update(payload)
      .eq('id', payload.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  delete payload.id;
  const { data, error } = await supabase
    .from('blog_articles')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function adminDeleteArticle(id) {
  const { error } = await supabase.from('blog_articles').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export function slugifyTitle(title = '') {
  return String(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}
