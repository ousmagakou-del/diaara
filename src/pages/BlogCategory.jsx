// ════════════════════════════════════════════════════════════════════
// YARAM — BlogCategory (route /blog/category/:slug)
// ────────────────────────────────────────────────────────────────────
// Liste paginee des articles d une categorie.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useNav } from '../App';
import SiteLayout from '../components/SiteLayout';
import {
  listBlogCategories,
  listBlogArticles,
} from '../lib/supabase/blog';
import './BlogHome.css';

const PAGE_SIZE = 12;

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return ''; }
}

export default function BlogCategory() {
  const { navigate, route } = useNav();
  const slug = route?.params?.slug;

  const [category, setCategory] = useState(null);
  const [otherCats, setOtherCats] = useState([]);
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cats = await listBlogCategories();
      if (cancelled) return;
      const cur = cats.find(c => c.slug === slug) || null;
      setCategory(cur);
      setOtherCats(cats.filter(c => c.slug !== slug));

      if (cur) {
        document.title = `${cur.name} — Blog YARAM`;
        const md = document.querySelector('meta[name="description"]');
        if (md) md.setAttribute('content', cur.description || `Articles ${cur.name} — YARAM, blog beauté peau africaine.`);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const r = await listBlogArticles({
        categorySlug: slug,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (cancelled) return;
      setArticles(r.articles);
      setTotal(r.total);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug, page]);

  const openArticle = (s) => navigate({ name: 'blog_article', params: { slug: s } });
  const openCat = (s) => navigate({ name: 'blog_category', params: { slug: s } });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <SiteLayout>
      <div className="blog-page">
        <div className="blog-container">
          <header className="blog-hero-header">
            <div className="blog-crumb">
              <a onClick={(e) => { e.preventDefault(); navigate('shop'); }} href="/shop">Accueil</a>
              {' · '}
              <a onClick={(e) => { e.preventDefault(); navigate('blog'); }} href="/blog">Blog</a>
              {' · '}
              <span>{category?.name || 'Catégorie'}</span>
            </div>
            <h1>{category?.name || 'Catégorie'}</h1>
            {category?.description && <p>{category.description}</p>}
          </header>

          {otherCats.length > 0 && (
            <nav className="blog-cats-row" aria-label="Autres catégories">
              <a
                href="/blog"
                className="blog-cat-chip"
                onClick={(e) => { e.preventDefault(); navigate('blog'); }}
              >
                Tout le blog
              </a>
              {otherCats.map(c => (
                <a
                  key={c.slug}
                  href={`/blog/category/${c.slug}`}
                  className="blog-cat-chip"
                  onClick={(e) => { e.preventDefault(); openCat(c.slug); }}
                >
                  {c.name}
                </a>
              ))}
            </nav>
          )}

          {loading && articles.length === 0 ? (
            <div className="blog-empty">Chargement…</div>
          ) : articles.length === 0 ? (
            <div className="blog-empty">
              Aucun article publié pour l'instant dans cette catégorie.
            </div>
          ) : (
            <div className="blog-articles-grid">
              {articles.map(a => (
                <button
                  key={a.id || a.slug}
                  type="button"
                  className="blog-article-card"
                  onClick={() => openArticle(a.slug)}
                >
                  <div
                    className="blog-article-cover"
                    style={a.cover_url ? { backgroundImage: `url(${a.cover_url})` } : undefined}
                    role="img"
                    aria-label={a.title}
                  />
                  <div className="blog-article-body">
                    <h4 className="blog-article-title">{a.title}</h4>
                    <div className="blog-article-meta">
                      {fmtDate(a.published_at)}
                      {a.read_time_min ? ` · ${a.read_time_min} min` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32,
              alignItems: 'center', flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                style={{
                  padding: '10px 18px', borderRadius: 999,
                  border: '1px solid #E5E9E6', background: '#F7F9F6',
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  opacity: page === 0 ? 0.5 : 1, fontSize: 14, fontWeight: 600,
                }}
              >
                ← Précédent
              </button>
              <span style={{ fontSize: 14, color: '#6B7570', padding: '0 12px' }}>
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                style={{
                  padding: '10px 18px', borderRadius: 999,
                  border: '1px solid #E5E9E6', background: '#F7F9F6',
                  cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages - 1 ? 0.5 : 1, fontSize: 14, fontWeight: 600,
                }}
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
