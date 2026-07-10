// ═══════════════════════════════════════════════════════════════
// Cloudflare Pages Function - Assets Vite hashes
// ═══════════════════════════════════════════════════════════════
// Objectif : garantir qu un asset absent retourne un vrai 404 avec le bon
// content-type au lieu d etre rewrite en /index.html (bug MIME type qui
// casse tout le site quand un vieux SW client demande un chunk mort).
//
// Cette Function intercepte /assets/*. Elle delegue a l asset store natif
// via env.ASSETS.fetch (proxy vers dist/assets/*). Si l asset existe,
// on renvoie sa reponse propre (200 + bon content-type + cache long).
// Si absent, on renvoie 404 sans passer par les rules _redirects.
// ═══════════════════════════════════════════════════════════════

export const onRequest: PagesFunction = async ({ request, env, next }) => {
  const url = new URL(request.url);

  // Delegue au fetch static natif de Cloudflare Pages
  const response = await env.ASSETS.fetch(request);

  // Si l asset est trouve : renvoie tel quel avec cache long
  if (response.status === 200 || response.status === 304) {
    const headers = new Headers(response.headers);
    // Vite hash-imprint = immutable long cache
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Sinon : vrai 404 clair pour signaler au client qu il faut refetch le shell
  return new Response('Asset not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
