// functions/search.js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function : /search?brand=X ou /search?category=Y
//
// COMPORTEMENT :
// - Humain (navigateur standard) : sert le SPA normal (next() = laisse passer au static)
// - Bot scraper (FB, WhatsApp, Twitter, etc.) : fetch la brand ou catégorie depuis
//   Supabase et sert un HTML enrichi avec og:image (logo brand / icon catégorie).
//
// POURQUOI :
// - Permet de partager `https://yaram.app/search?brand=Bioderma` sur WhatsApp
//   et avoir une jolie carte cliquable avec le logo Bioderma au lieu du logo YARAM.
// - Idem pour `/search?category=visage` → carte avec icon catégorie.
//
// FALLBACK :
// - Pas de query string, brand introuvable, erreur Supabase → next() (SPA standard).
// ─────────────────────────────────────────────────────────────────────────────

import { sbFetch, isBotUA, buildMetaTags, injectMetaTags } from './_lib.js';

const PLACEHOLDER_IMAGE = 'https://yaram.app/icon-512.png';

// Labels lisibles pour les slugs catégorie (alignés avec src/pages/Search.jsx)
const CATEGORY_LABELS = {
  visage: 'Visage',
  serum: 'Sérums',
  solaire: 'Solaires',
  nettoyant: 'Nettoyants',
  hydratant: 'Hydratants',
  masque: 'Masques',
  corps: 'Corps',
  levres: 'Lèvres',
  maquillage: 'Maquillage',
  cheveux: 'Cheveux',
  huile: 'Huiles',
  hygiene: 'Hygiène',
  bebe: 'Bébé',
  bouche: 'Bouche',
  complement: 'Compléments',
  parfum: 'Parfums',
  pieds_mains: 'Pieds & Mains',
  intime: 'Intime',
  deodorants: 'Déodorants',
};

function catLabel(slug) {
  if (!slug) return '';
  return CATEGORY_LABELS[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1));
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const userAgent = request.headers.get('user-agent') || '';

  // Humain : laisse passer le SPA standard
  if (!isBotUA(userAgent)) {
    return next();
  }

  // Bot : lit ?brand= ou ?category= dans l'URL
  const url = new URL(request.url);
  const brandName = url.searchParams.get('brand');
  const categorySlug = url.searchParams.get('category');

  // Si ni brand ni category → fallback (SPA standard avec og: par défaut)
  if (!brandName && !categorySlug) {
    return next();
  }

  try {
    let title, description, image, ogUrl;

    if (brandName) {
      // ─── Fetch brand ───
      const brands = await sbFetch(
        env,
        `brands?name=eq.${encodeURIComponent(brandName)}&select=id,name,img&limit=1`,
      );
      const brand = brands?.[0];

      if (!brand) return next(); // brand introuvable → fallback

      // Compte les produits actifs de la brand (pour la description)
      let productCount = 0;
      try {
        const countRes = await fetch(
          `${env.SUPABASE_URL || 'https://qxhhnrnworwrnwmqekmb.supabase.co'}/rest/v1/products?brand=eq.${encodeURIComponent(brandName)}&active=eq.true&select=id`,
          {
            headers: {
              apikey: env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4aGhucm53b3J3cm53bXFla21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTExMzYsImV4cCI6MjA5NDA4NzEzNn0.l_7-Eg06UFnXvSw1BQiuNw0yU94jillHNycx-jvP1Aw',
              Prefer: 'count=exact',
            },
          },
        );
        const range = countRes.headers.get('content-range');
        if (range) {
          const total = parseInt(range.split('/')[1] || '0', 10);
          if (!Number.isNaN(total)) productCount = total;
        }
      } catch { /* ignore */ }

      title = `${brand.name} — Produits beauté validés · YARAM`;
      description = productCount > 0
        ? `${productCount} produit${productCount > 1 ? 's' : ''} ${brand.name} adapté${productCount > 1 ? 's' : ''} à ta peau africaine · Livraison Dakar · Paiement Wave/Orange Money`
        : `Découvre les produits ${brand.name} sur YARAM · Beauté pensée pour les peaux africaines · Livraison Dakar`;
      image = brand.img || PLACEHOLDER_IMAGE;
      ogUrl = `https://yaram.app/search?brand=${encodeURIComponent(brand.name)}`;
    } else {
      // ─── Fetch category ───
      const categories = await sbFetch(
        env,
        `categories?slug=eq.${encodeURIComponent(categorySlug)}&select=id,slug,name,icon_url&limit=1`,
      );
      const category = categories?.[0];

      const catName = category?.name || catLabel(categorySlug);

      // Compte les produits actifs de la catégorie
      let productCount = 0;
      try {
        const countRes = await fetch(
          `${env.SUPABASE_URL || 'https://qxhhnrnworwrnwmqekmb.supabase.co'}/rest/v1/products?category=eq.${encodeURIComponent(categorySlug)}&active=eq.true&select=id`,
          {
            headers: {
              apikey: env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4aGhucm53b3J3cm53bXFla21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTExMzYsImV4cCI6MjA5NDA4NzEzNn0.l_7-Eg06UFnXvSw1BQiuNw0yU94jillHNycx-jvP1Aw',
              Prefer: 'count=exact',
            },
          },
        );
        const range = countRes.headers.get('content-range');
        if (range) {
          const total = parseInt(range.split('/')[1] || '0', 10);
          if (!Number.isNaN(total)) productCount = total;
        }
      } catch { /* ignore */ }

      title = `${catName} — Produits beauté · YARAM`;
      description = productCount > 0
        ? `${productCount} produit${productCount > 1 ? 's' : ''} ${catName.toLowerCase()} pour ta peau africaine · Validé${productCount > 1 ? 's' : ''} par YARAM · Livraison Dakar`
        : `Découvre tous les produits ${catName.toLowerCase()} sur YARAM · Beauté adaptée aux peaux africaines · Livraison Dakar`;
      image = category?.icon_url || PLACEHOLDER_IMAGE;
      ogUrl = `https://yaram.app/search?category=${encodeURIComponent(categorySlug)}`;
    }

    // Récupère le index.html standard
    const indexResponse = await env.ASSETS.fetch(new URL('/', request.url));
    let html = await indexResponse.text();

    const metaHtml = buildMetaTags({ title, description, image, url: ogUrl, type: 'website' });
    html = injectMetaTags(html, metaHtml);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (e) {
    console.error('[og-search] error:', e.message);
    return next();
  }
}
