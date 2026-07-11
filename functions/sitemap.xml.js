// functions/sitemap.xml.js
// ─────────────────────────────────────────────────────────────────────────────
// Sitemap global YARAM : homepage + pages statiques + tous les produits, marques
// et articles de blog publies. Utilise par Google/Bing pour indexer le site.
//
// Cache 1h cote edge Cloudflare pour ne pas hammerer Supabase.
// ─────────────────────────────────────────────────────────────────────────────

import { sbFetch, escapeXml } from './_lib.js';

const BASE = 'https://yaram.app';
const TODAY = () => new Date().toISOString().slice(0, 10);

// Pages statiques principales (SPA routes indexables)
const STATIC_PAGES = [
  { path: '/',              priority: '1.0', changefreq: 'daily'   },
  { path: '/shop',          priority: '0.9', changefreq: 'daily'   },
  { path: '/brands',        priority: '0.8', changefreq: 'weekly'  },
  { path: '/categories',    priority: '0.8', changefreq: 'weekly'  },
  { path: '/pharmacies',    priority: '0.7', changefreq: 'weekly'  },
  { path: '/international', priority: '0.6', changefreq: 'monthly' },
  { path: '/blog',          priority: '0.8', changefreq: 'daily'   },
  { path: '/help',          priority: '0.4', changefreq: 'monthly' },
  { path: '/privacy',       priority: '0.3', changefreq: 'yearly'  },
  { path: '/terms',         priority: '0.3', changefreq: 'yearly'  },
  { path: '/mentions',      priority: '0.3', changefreq: 'yearly'  },
];

function urlXml({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function onRequest({ env }) {
  try {
    // ─── Fetch en parallele : produits + marques + articles + categories blog ───
    const [products, brands, articles, blogCats] = await Promise.all([
      sbFetch(env, 'products?select=id,created_at&status=eq.approved&active=eq.true&order=created_at.desc&limit=5000')
        .catch(() => []),
      sbFetch(env, 'brands?select=id,created_at&order=created_at.desc&limit=1000')
        .catch(() => []),
      sbFetch(env, 'blog_articles?select=slug,published_at,updated_at&published=eq.true&order=published_at.desc.nullslast&limit=1000')
        .catch(() => []),
      sbFetch(env, 'blog_categories?select=slug&order=display_order')
        .catch(() => []),
    ]);

    const today = TODAY();

    const staticXml = STATIC_PAGES.map(p =>
      urlXml({
        loc:        `${BASE}${p.path}`,
        lastmod:    today,
        changefreq: p.changefreq,
        priority:   p.priority,
      })
    ).join('\n');

    const productXml = (products || []).map(p => urlXml({
      loc:        `${BASE}/product/${p.id}`,
      lastmod:    (p.created_at || today).slice(0, 10),
      changefreq: 'weekly',
      priority:   '0.7',
    })).join('\n');

    const brandXml = (brands || []).map(b => urlXml({
      loc:        `${BASE}/brand/${b.id}`,
      lastmod:    (b.created_at || today).slice(0, 10),
      changefreq: 'weekly',
      priority:   '0.6',
    })).join('\n');

    const blogCatXml = (blogCats || []).map(c => urlXml({
      loc:        `${BASE}/blog/category/${c.slug}`,
      lastmod:    today,
      changefreq: 'weekly',
      priority:   '0.6',
    })).join('\n');

    const blogArticleXml = (articles || []).map(a => urlXml({
      loc:        `${BASE}/blog/${a.slug}`,
      lastmod:    (a.updated_at || a.published_at || today).slice(0, 10),
      changefreq: 'monthly',
      priority:   '0.7',
    })).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[staticXml, productXml, brandXml, blogCatXml, blogArticleXml].filter(Boolean).join('\n')}
</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (e) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap error: ${escapeXml(e.message)} -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
    );
  }
}
