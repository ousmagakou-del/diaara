// ════════════════════════════════════════════════════════════════════
// YARAM — BlogArticle (route /blog/:slug)
// ────────────────────────────────────────────────────────────────────
// Rendu long-form d un article + linked products + articles similaires
// + share + newsletter CTA.
// Le Cloudflare Function functions/blog/[slug].js injecte les og:tags
// et le JSON-LD schema.org pour les bots ; ici, on rend l experience
// utilisateur cote SPA.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../App';
import SiteLayout from '../components/SiteLayout';
import { ProductTile } from '../components/tiles';
import {
  getBlogArticle,
  listBlogArticles,
  incrementBlogView,
} from '../lib/supabase/blog';
import './BlogArticle.css';

// ─── Minimal markdown parser (parity avec ArticlesSection.jsx) ───
// Supporte :
//   # h1  ## h2  ### h3
//   **bold**  *italic*  `code`  [link](url)
//   > blockquote
//   - list item
//   ![alt](img_url)   image
// Chaque bloc separe par ligne vide. Genere un id pour h2/h3 (TOC anchors).
function slugForHeading(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function renderInline(text, keyBase = '') {
  if (!text) return null;
  const parts = [];
  // Order matters : image first, then link, then bold, italic, code
  const regex = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('![')) {
      const labelEnd = tok.indexOf(']');
      const alt = tok.slice(2, labelEnd);
      const url = tok.slice(labelEnd + 2, -1);
      parts.push(<img key={`${keyBase}img${key++}`} src={url} alt={alt} loading="lazy" />);
    } else if (tok.startsWith('[')) {
      const labelEnd = tok.indexOf(']');
      const label = tok.slice(1, labelEnd);
      const url = tok.slice(labelEnd + 2, -1);
      parts.push(
        <a key={`${keyBase}a${key++}`} href={url} target={url.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          {label}
        </a>
      );
    } else if (tok.startsWith('**')) {
      parts.push(<strong key={`${keyBase}b${key++}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      parts.push(<code key={`${keyBase}c${key++}`}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('*')) {
      parts.push(<em key={`${keyBase}i${key++}`}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function parseMarkdown(md) {
  const nodes = [];
  const headings = [];
  if (!md) return { nodes, headings };

  const blocks = md.split(/\n{2,}/);
  blocks.forEach((rawBlock, i) => {
    const block = rawBlock.trim();
    if (!block) return;

    if (block.startsWith('### ')) {
      const text = block.slice(4);
      const id = slugForHeading(text);
      headings.push({ level: 3, id, text });
      nodes.push(<h3 key={`h3-${i}`} id={id}>{renderInline(text, `h3${i}`)}</h3>);
      return;
    }
    if (block.startsWith('## ')) {
      const text = block.slice(3);
      const id = slugForHeading(text);
      headings.push({ level: 2, id, text });
      nodes.push(<h2 key={`h2-${i}`} id={id}>{renderInline(text, `h2${i}`)}</h2>);
      return;
    }
    if (block.startsWith('# ')) {
      const text = block.slice(2);
      nodes.push(<h2 key={`h1-${i}`}>{renderInline(text, `h1${i}`)}</h2>);
      return;
    }
    if (block.startsWith('> ')) {
      const lines = block.split('\n').map(l => l.replace(/^>\s?/, '')).join(' ');
      nodes.push(<blockquote key={`bq-${i}`}>{renderInline(lines, `bq${i}`)}</blockquote>);
      return;
    }
    if (/^[-*]\s/.test(block)) {
      const items = block.split('\n').filter(l => /^[-*]\s/.test(l)).map(l => l.replace(/^[-*]\s/, ''));
      nodes.push(
        <ul key={`ul-${i}`}>
          {items.map((it, j) => <li key={j}>{renderInline(it, `li${i}${j}`)}</li>)}
        </ul>
      );
      return;
    }
    if (/^\d+\.\s/.test(block)) {
      const items = block.split('\n').filter(l => /^\d+\.\s/.test(l)).map(l => l.replace(/^\d+\.\s/, ''));
      nodes.push(
        <ol key={`ol-${i}`}>
          {items.map((it, j) => <li key={j}>{renderInline(it, `oli${i}${j}`)}</li>)}
        </ol>
      );
      return;
    }
    // Paragraphe
    const lines = block.split('\n');
    nodes.push(
      <p key={`p-${i}`}>
        {lines.map((line, k) => (
          <span key={k}>
            {renderInline(line, `p${i}${k}`)}
            {k < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });

  return { nodes, headings };
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return ''; }
}

export default function BlogArticle() {
  const { navigate, route } = useNav();
  const slug = route?.params?.slug;

  const [state, setState] = useState({ loading: true, data: null });
  const [related, setRelated] = useState([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setState({ loading: true, data: null });
    (async () => {
      try {
        const data = await getBlogArticle(slug);
        if (cancelled) return;
        setState({ loading: false, data });

        // View count (fire and forget)
        incrementBlogView(slug);

        // Meta tags client (les bots utilisent la CF function ; ici, pour SPA UX)
        if (data?.article) {
          document.title = data.article.seo_title || `${data.article.title} · YARAM`;
          const md = document.querySelector('meta[name="description"]');
          if (md) {
            const desc = data.article.seo_description
              || data.article.subtitle
              || `${data.article.title} — YARAM, beauté peau africaine.`;
            md.setAttribute('content', desc);
          }
        }

        // Related dans meme categorie
        if (data?.category?.slug) {
          const r = await listBlogArticles({ categorySlug: data.category.slug, limit: 4, offset: 0 });
          if (!cancelled) {
            setRelated((r.articles || []).filter(a => a.slug !== slug).slice(0, 3));
          }
        }
      } catch (e) {
        if (!cancelled) setState({ loading: false, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const article = state.data?.article;
  const category = state.data?.category;
  const products = state.data?.products || [];

  const { nodes, headings } = useMemo(
    () => parseMarkdown(article?.content_md || ''),
    [article?.content_md]
  );

  const handleAnchor = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const share = (network) => {
    if (typeof window === 'undefined') return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(article?.title || 'YARAM Blog');
    let target = '';
    if (network === 'whatsapp') target = `https://api.whatsapp.com/send?text=${text}%20${url}`;
    else if (network === 'facebook') target = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    else if (network === 'twitter')  target = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    else if (network === 'copy') {
      try {
        navigator.clipboard?.writeText(window.location.href);
      } catch {}
      return;
    }
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
  };

  if (state.loading) {
    return (
      <SiteLayout>
        <div className="blog-article">
          <div className="blog-article-loading">Chargement de l'article…</div>
        </div>
      </SiteLayout>
    );
  }

  if (!article) {
    return (
      <SiteLayout>
        <div className="blog-article">
          <div className="blog-article-notfound">
            <h1>Article introuvable</h1>
            <p>Cet article n'existe pas ou n'est plus disponible.</p>
            <button onClick={() => navigate('blog')}>Retour au blog</button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <article className="blog-article">
        {article.cover_url && (
          <div
            className="blog-article-cover-hero"
            style={{ backgroundImage: `url(${article.cover_url})` }}
            role="img"
            aria-label={article.title}
          />
        )}

        <div className="blog-article-container">
          <div className="blog-article-crumb">
            <a onClick={(e) => { e.preventDefault(); navigate('shop'); }} href="/shop">Accueil</a>
            {' · '}
            <a onClick={(e) => { e.preventDefault(); navigate('blog'); }} href="/blog">Blog</a>
            {category && (
              <>
                {' · '}
                <a
                  onClick={(e) => { e.preventDefault(); navigate({ name: 'blog_category', params: { slug: category.slug } }); }}
                  href={`/blog/category/${category.slug}`}
                >
                  {category.name}
                </a>
              </>
            )}
          </div>

          {category && <span className="blog-article-cat">{category.name}</span>}
          <h1 className="blog-article-title">{article.title}</h1>
          {article.subtitle && (
            <p className="blog-article-subtitle">{article.subtitle}</p>
          )}

          <div className="blog-article-meta">
            <div
              className="blog-article-avatar"
              style={article.author_avatar_url ? { backgroundImage: `url(${article.author_avatar_url})` } : undefined}
              aria-hidden="true"
            />
            <span className="blog-article-author-name">
              {article.author_name || 'Rédaction YARAM'}
            </span>
            <span className="blog-article-meta-sep">·</span>
            <span>{fmtDate(article.published_at)}</span>
            {article.read_time_min ? (
              <>
                <span className="blog-article-meta-sep">·</span>
                <span>{article.read_time_min} min de lecture</span>
              </>
            ) : null}
          </div>

          {/* Table of contents (h2/h3) */}
          {headings.length >= 2 && (
            <nav className="blog-article-toc" aria-label="Table des matières">
              <h4>Sommaire</h4>
              <ul>
                {headings.map((h, i) => (
                  <li key={i} className={h.level === 3 ? 'blog-article-toc-h3' : ''}>
                    <a href={`#${h.id}`} onClick={(e) => handleAnchor(e, h.id)}>
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Body markdown */}
          <div className="blog-article-body">{nodes}</div>

          {/* Tags */}
          {Array.isArray(article.tags) && article.tags.length > 0 && (
            <div className="blog-article-tags">
              {article.tags.map(t => (
                <span key={t} className="blog-article-tag">#{t}</span>
              ))}
            </div>
          )}

          {/* Share */}
          <div className="blog-article-share">
            <span className="blog-article-share-label">Partager</span>
            <button className="blog-article-share-btn" onClick={() => share('whatsapp')} aria-label="Partager sur WhatsApp">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488"/></svg>
            </button>
            <button className="blog-article-share-btn" onClick={() => share('facebook')} aria-label="Partager sur Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>
            </button>
            <button className="blog-article-share-btn" onClick={() => share('twitter')} aria-label="Partager sur X">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </button>
            <button className="blog-article-share-btn" onClick={() => share('copy')} aria-label="Copier le lien">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </button>
          </div>

          {/* Produits recommandes */}
          {products.length > 0 && (
            <section className="blog-article-products" aria-label="Produits recommandés">
              <h3>Produits recommandés dans cet article</h3>
              <p className="blog-article-products-sub">
                Notre sélection alignée avec les conseils ci-dessus.
              </p>
              <div className="blog-article-products-grid">
                {products.map(p => (
                  <ProductTile key={p.id} product={p} size="sm" />
                ))}
              </div>
            </section>
          )}

          {/* Related articles */}
          {related.length > 0 && (
            <section className="blog-article-related" aria-label="Articles similaires">
              <h3>À lire aussi</h3>
              <div className="blog-article-related-grid">
                {related.map(a => (
                  <button
                    key={a.id || a.slug}
                    type="button"
                    className="blog-article-card"
                    onClick={() => navigate({ name: 'blog_article', params: { slug: a.slug } })}
                  >
                    <div
                      className="blog-article-cover"
                      style={a.cover_url ? { backgroundImage: `url(${a.cover_url})` } : undefined}
                      role="img"
                      aria-label={a.title}
                    />
                    <div className="blog-article-body" style={{ padding: '14px 16px 18px' }}>
                      <h4 className="blog-article-title" style={{ fontSize: 16, margin: 0 }}>{a.title}</h4>
                      <div className="blog-article-meta" style={{ border: 'none', padding: 0, margin: '6px 0 0', fontSize: 12 }}>
                        {fmtDate(a.published_at)}
                        {a.read_time_min ? ` · ${a.read_time_min} min` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Newsletter CTA bottom */}
          <div className="blog-article-newsletter">
            <h3>Envie de la suite ?</h3>
            <p>Rejoins la lettre beauté YARAM et reçois nos nouveaux articles chaque semaine.</p>
            <button className="blog-article-newsletter-btn" onClick={() => navigate('newsletter')}>
              M'inscrire à la newsletter
            </button>
          </div>
        </div>
      </article>
    </SiteLayout>
  );
}
