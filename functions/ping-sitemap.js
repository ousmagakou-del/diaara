// functions/ping-sitemap.js
// ─────────────────────────────────────────────────────────────────────────────
// Endpoint POST /ping-sitemap
//
// Appelle ce qu'il faut pour signaler aux moteurs de recherche que le sitemap
// a change (un produit a ete approuve, une pharmacie creee, etc.).
//
// USAGE COTE ADMIN :
//   fetch('/ping-sitemap', { method: 'POST' })
//   ← a appeler apres approveProduct(), createPharmacy(), etc.
//
// NOTE 2024+ : Google a deprecated le `ping?sitemap=` HTTP endpoint en juin 2023
// (cf https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping).
// Maintenant Google revisite le sitemap automatiquement quand il voit
// <lastmod> change. Notre sitemap dynamique met deja <lastmod> a jour donc
// Google le decouvrira tout seul (en 1-7 jours typiquement).
//
// Bing accepte encore le ping (IndexNow). On l'utilise donc pour acceler.
// ─────────────────────────────────────────────────────────────────────────────

const SITEMAP_URL = 'https://yaram.app/sitemap.xml';

export async function onRequest({ request }) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const results = {};

  // ─── Bing / IndexNow ───
  // IndexNow est supporte par Bing, Yandex, Naver, Seznam.
  // Pas besoin de cle (le sitemap suffit).
  try {
    const bing = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`, {
      method: 'GET',
      headers: { 'User-Agent': 'YARAM-Bot/1.0' },
    });
    results.bing = bing.status;
  } catch (e) {
    results.bing = 'error: ' + e.message;
  }

  // ─── Google : ping deprecated, on note juste ───
  results.google = 'auto-discovered via <lastmod> (no ping needed since 2023)';

  return new Response(JSON.stringify({
    pinged: true,
    sitemap: SITEMAP_URL,
    results,
    at: new Date().toISOString(),
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
