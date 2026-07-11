// functions/blog/[slug].js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function : /blog/:slug
//
// COMPORTEMENT (calque functions/product/[id].js) :
// - Humain (navigateur standard) : sert le SPA normal (SPA route BlogArticle)
// - Bot scraper (FB, WhatsApp, Twitter, Google, etc.) : fetch l article Supabase
//   et sert un HTML avec les BONS og: tags + JSON-LD schema.org Article.
//
// POURQUOI :
// - Google indexe le contenu server-side pour ranker sur les requetes beaute
//   peau africaine (hyperpigmentation, ingredients, routines...).
// - WhatsApp / Facebook affichent la vraie preview d article (titre + cover).
// ─────────────────────────────────────────────────────────────────────────────

import { sbFetch, isBotUA, buildMetaTags, injectMetaTags } from '../_lib.js';

async function serveSpa(request, env) {
  const indexResponse = await env.ASSETS.fetch(new URL('/', request.url));
  const html = await indexResponse.text();
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function onRequest(context) {
  const { request, params, env } = context;
  const userAgent = request.headers.get('user-agent') || '';

  // Humain : sert le SPA. React lit /blog/:slug et affiche BlogArticle.
  if (!isBotUA(userAgent)) {
    return serveSpa(request, env);
  }

  // Bot : fetch article + sert HTML enrichi
  try {
    const slug = encodeURIComponent(params.slug || '');
    const articles = await sbFetch(
      env,
      `blog_articles?slug=eq.${slug}&published=eq.true&select=id,slug,title,subtitle,cover_url,seo_title,seo_description,seo_keywords,author_name,author_avatar_url,content_md,tags,published_at,updated_at,category_id&limit=1`
    );
    const a = articles?.[0];

    // Article introuvable -> SPA (affiche 404)
    if (!a) return serveSpa(request, env);

    // Categorie (best-effort)
    let category = null;
    if (a.category_id) {
      try {
        const cats = await sbFetch(
          env,
          `blog_categories?id=eq.${encodeURIComponent(a.category_id)}&select=slug,name&limit=1`
        );
        category = cats?.[0] || null;
      } catch { /* silent */ }
    }

    const title = a.seo_title || `${a.title} · YARAM Blog`;
    const description = a.seo_description
      || a.subtitle
      || (a.content_md ? a.content_md.replace(/[#*`>[\]()_-]/g, '').slice(0, 155).trim() : `${a.title} — YARAM, beaute peau africaine.`);
    const image = a.cover_url || 'https://yaram.app/icon-512.png';
    const url = `https://yaram.app/blog/${a.slug}`;

    const indexResponse = await env.ASSETS.fetch(new URL('/', request.url));
    let html = await indexResponse.text();

    const metaHtml = buildMetaTags({ title, description, image, url, type: 'article' });

    // JSON-LD Article schema pour Google
    const jsonLdArticle = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      description,
      image: image ? [image] : undefined,
      datePublished: a.published_at,
      dateModified: a.updated_at || a.published_at,
      author: a.author_name ? {
        '@type': 'Person',
        name: a.author_name,
      } : {
        '@type': 'Organization',
        name: 'YARAM',
      },
      publisher: {
        '@type': 'Organization',
        name: 'YARAM',
        logo: {
          '@type': 'ImageObject',
          url: 'https://yaram.app/icon-512.png',
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url,
      },
      articleSection: category?.name || undefined,
      keywords: Array.isArray(a.seo_keywords) && a.seo_keywords.length
        ? a.seo_keywords.join(', ')
        : (Array.isArray(a.tags) && a.tags.length ? a.tags.join(', ') : undefined),
      inLanguage: 'fr-SN',
    };

    // Breadcrumb schema (bonus SEO Google)
    const jsonLdBreadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://yaram.app/' },
        { '@type': 'ListItem', position: 2, name: 'Blog',    item: 'https://yaram.app/blog' },
        ...(category ? [{
          '@type': 'ListItem', position: 3, name: category.name,
          item: `https://yaram.app/blog/category/${category.slug}`,
        }] : []),
        { '@type': 'ListItem', position: category ? 4 : 3, name: a.title, item: url },
      ],
    };

    const ldHtml = `\n<script type="application/ld+json">${JSON.stringify(jsonLdArticle)}</script>` +
                   `\n<script type="application/ld+json">${JSON.stringify(jsonLdBreadcrumb)}</script>`;

    html = injectMetaTags(html, metaHtml + ldHtml);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (e) {
    console.error('[og-blog] error:', e.message);
    return serveSpa(request, env);
  }
}

