// ════════════════════════════════════════════════════════════════════
// YARAM — BlogHome (route /blog)
// ────────────────────────────────────────────────────────────────────
// Landing SEO du blog beaute peau africaine. Structure magazine :
//   - Hero header
//   - 3 featured articles
//   - Chips categories
//   - Une section par categorie (4-5 derniers articles)
//   - Newsletter CTA
// ════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../App';
import SiteLayout from '../components/SiteLayout';
import {
  listBlogCategories,
  getFeaturedBlogArticles,
  listBlogArticles,
} from '../lib/supabase/blog';
import './BlogHome.css';

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return ''; }
}

function ArticleCard({ article, onOpen, variant = 'default' }) {
  const cover = article.cover_url;
  return (
    <button
      type="button"
      className={variant === 'main' ? 'blog-featured-card blog-featured-card--main' : 'blog-featured-card'}
      onClick={() => onOpen(article.slug)}
    >
      <div
        className="blog-featured-cover"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        role="img"
        aria-label={article.title}
      />
      <div className="blog-featured-body">
        {article.category_name && (
          <span className="blog-featured-cat">{article.category_name}</span>
        )}
        <h3 className="blog-featured-title">{article.title}</h3>
        {article.subtitle && (
          <p className="blog-featured-sub">{article.subtitle}</p>
        )}
        <div className="blog-featured-meta">
          <span>{fmtDate(article.published_at)}</span>
          {article.read_time_min ? <span>· {article.read_time_min} min de lecture</span> : null}
        </div>
      </div>
    </button>
  );
}

function GridCard({ article, onOpen }) {
  return (
    <button
      type="button"
      className="blog-article-card"
      onClick={() => onOpen(article.slug)}
    >
      <div
        className="blog-article-cover"
        style={article.cover_url ? { backgroundImage: `url(${article.cover_url})` } : undefined}
        role="img"
        aria-label={article.title}
      />
      <div className="blog-article-body">
        {article.category_name && (
          <span className="blog-featured-cat">{article.category_name}</span>
        )}
        <h4 className="blog-article-title">{article.title}</h4>
        <div className="blog-article-meta">
          {fmtDate(article.published_at)}
          {article.read_time_min ? ` · ${article.read_time_min} min` : ''}
        </div>
      </div>
    </button>
  );
}

export default function BlogHome() {
  const { navigate } = useNav();
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [articlesByCat, setArticlesByCat] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [feat, cats] = await Promise.all([
          getFeaturedBlogArticles(3),
          listBlogCategories(),
        ]);
        if (cancelled) return;
        setFeatured(feat);
        setCategories(cats);

        // Fetch derniers articles par categorie en parallele
        const byCat = {};
        const results = await Promise.all(
          cats.map(c =>
            listBlogArticles({ categorySlug: c.slug, limit: 5, offset: 0 })
              .then(r => ({ slug: c.slug, articles: r.articles }))
              .catch(() => ({ slug: c.slug, articles: [] }))
          )
        );
        if (cancelled) return;
        results.forEach(r => { byCat[r.slug] = r.articles; });
        setArticlesByCat(byCat);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openArticle = (slug) => {
    if (!slug) return;
    navigate({ name: 'blog_article', params: { slug } });
  };
  const openCategory = (slug) => {
    if (!slug) return;
    navigate({ name: 'blog_category', params: { slug } });
  };

  const featuredMain = featured[0] || null;
  const featuredSide = featured.slice(1, 3);

  // SEO tags client-side (bots recuperent via CF function pour /blog/:slug ;
  // pour /blog on set aussi le title/desc dynamique via useEffect)
  useEffect(() => {
    document.title = 'Blog YARAM — Beauté peau africaine, routines et ingrédients';
    const md = document.querySelector('meta[name="description"]');
    const desc = 'Guides beauté, routines, ingrédients et science de la peau africaine. Le magazine YARAM pour prendre soin de ta peau au quotidien.';
    if (md) md.setAttribute('content', desc);
  }, []);

  return (
    <SiteLayout>
      <div className="blog-page">
        <div className="blog-container">
          <header className="blog-hero-header">
            <div className="blog-crumb">
              <a onClick={(e) => { e.preventDefault(); navigate('shop'); }} href="/shop">Accueil</a>
              {' · '}
              <span>Blog</span>
            </div>
            <h1>Le magazine beauté YARAM</h1>
            <p>
              Ingrédients, routines et science de la peau africaine. Des conseils clairs,
              par nos experts, pour que ta peau parle avant toi.
            </p>
          </header>

          {/* ─── Featured articles ─── */}
          {featured.length > 0 && (
            <section className="blog-featured-row" aria-label="Articles à la une">
              {featuredMain && (
                <ArticleCard article={featuredMain} variant="main" onOpen={openArticle} />
              )}
              {featuredSide.map(a => (
                <ArticleCard key={a.id || a.slug} article={a} onOpen={openArticle} />
              ))}
            </section>
          )}

          {/* ─── Categories chips ─── */}
          {categories.length > 0 && (
            <nav className="blog-cats-row" aria-label="Catégories">
              {categories.map(c => (
                <a
                  key={c.slug}
                  href={`/blog/category/${c.slug}`}
                  className="blog-cat-chip"
                  onClick={(e) => { e.preventDefault(); openCategory(c.slug); }}
                >
                  {c.name}
                </a>
              ))}
            </nav>
          )}

          {/* ─── Section par categorie ─── */}
          {categories.map(cat => {
            const arts = articlesByCat[cat.slug] || [];
            if (loading && arts.length === 0) return null;
            return (
              <section key={cat.slug} className="blog-cat-section">
                <div className="blog-cat-header">
                  <h2>{cat.name}</h2>
                  <a
                    href={`/blog/category/${cat.slug}`}
                    onClick={(e) => { e.preventDefault(); openCategory(cat.slug); }}
                  >
                    Tout voir →
                  </a>
                </div>
                {arts.length === 0 ? (
                  <div className="blog-empty">
                    Nouveaux articles bientôt. Reviens vite.
                  </div>
                ) : (
                  <div className="blog-articles-grid">
                    {arts.map(a => (
                      <GridCard key={a.id || a.slug} article={a} onOpen={openArticle} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* ─── Newsletter CTA ─── */}
          <div className="blog-newsletter-card">
            <div>
              <h3>Reçois notre lettre beauté</h3>
              <p>
                Un e-mail par semaine avec les nouveaux articles, les tests produits
                et les astuces routines. Aucune pub, tu peux te désinscrire à tout moment.
              </p>
            </div>
            <button className="blog-newsletter-btn" onClick={() => navigate('newsletter')}>
              M'inscrire
            </button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
