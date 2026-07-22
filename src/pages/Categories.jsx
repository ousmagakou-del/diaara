// ════════════════════════════════════════════════════════════════════
// YARAM — Categories (route /categories)
// ────────────────────────────────────────────────────────────────────
// Vitrine de toutes les categories du catalogue + top marques.
// Layout responsive : hero univers + grid categories + rail marques.
// Base tokens design uniquement.
// ════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useNav } from '../App';
import { useCategories, useBrands, useProductCategorySlugs } from '../lib/queries';
import SiteLayout from '../components/SiteLayout';
import CategoryIcon, { hasCategoryIcon } from '../components/CategoryIcon';
import { BrandTile } from '../components/tiles';
import Skeleton, { SkeletonBrandCard } from '../components/Skeleton';
import './Categories.css';

// ─── FEATURED (categories "vitrines" avec icone) ───────────────────
// Slugs alignes sur la colonne `categories.slug` en DB (nov 2026).
// Les anciens slugs curatoriels ('pharmacie', 'beaute', 'bien-etre',
// 'international') n existaient pas cote DB : les tuiles affichaient
// systematiquement 0 produit.
const FEATURED = [
  {
    key: 'visage',
    label: 'Visage',
    slug: 'visage',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    key: 'solaire',
    label: 'Solaire',
    slug: 'solaire',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
      </svg>
    ),
  },
  {
    key: 'cheveux',
    label: 'Cheveux',
    slug: 'cheveux',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <path d="M4 20c0-6 4-14 8-14s8 8 8 14" />
        <path d="M7 20c0-4 2-9 5-9s5 5 5 9" />
        <path d="M10 20c0-2 1-4 2-4s2 2 2 4" />
      </svg>
    ),
  },
  {
    key: 'corps',
    label: 'Corps',
    slug: 'corps',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <circle cx="12" cy="4.5" r="2.5" />
        <path d="M8 22v-7H6v-4a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4h-2v7" />
      </svg>
    ),
  },
];

export default function Categories() {
  const { navigate } = useNav();

  const { data: categoriesRaw = [], isLoading: catLoading } = useCategories();
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: slugRows = [], isLoading: slugsLoading } = useProductCategorySlugs();

  const counts = useMemo(() => {
    const c = {};
    (slugRows || []).forEach((row) => {
      if (row?.category) c[row.category] = (c[row.category] || 0) + 1;
    });
    return c;
  }, [slugRows]);

  const categories = useMemo(() => {
    if (categoriesRaw?.length) return categoriesRaw;
    const map = {};
    (slugRows || []).forEach((row) => {
      const cat = row?.category;
      if (!cat) return;
      if (!map[cat]) map[cat] = { id: cat, slug: cat, name: cat.charAt(0).toUpperCase() + cat.slice(1) };
    });
    return Object.values(map).sort(
      (a, b) => (counts[b.slug] || 0) - (counts[a.slug] || 0),
    );
  }, [categoriesRaw, slugRows, counts]);

  const loading =
    (catLoading && categoriesRaw.length === 0) ||
    (slugsLoading && slugRows.length === 0);

  const featuredTiles = useMemo(
    () => FEATURED.map((f) => ({ ...f, count: counts[f.slug] || 0 })),
    [counts],
  );

  const goSearch = (params) => navigate({ name: 'search', params });

  return (
    <SiteLayout>
      <div className="ycatp">
        {/* ─── HERO ─── */}
        <section className="ycatp__hero">
          <div className="ycatp__hero-inner">
            <span className="ycatp__eyebrow">Univers YARAM</span>
            <h1 className="ycatp__title">
              Categories
            </h1>
            <p className="ycatp__sub">
              {categories.length > 0
                ? `${categories.length} categorie${categories.length > 1 ? 's' : ''} disponible${categories.length > 1 ? 's' : ''} — selection premium par nos pharmaciens.`
                : 'Selection premium par nos pharmaciens, filtrable par marque, prix et type de peau.'}
            </p>
          </div>
        </section>

        {/* ─── FEATURED ─── */}
        <section className="ycatp__section">
          <header className="ycatp__shead">
            <h2 className="ycatp__shead-title">A la une</h2>
            <p className="ycatp__shead-sub">Nos univers les plus consultes</p>
          </header>
          {loading ? (
            <div className="ycatp__featured">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="card" height={160} />
              ))}
            </div>
          ) : (
            <div className="ycatp__featured">
              {featuredTiles.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="ycatp__feat"
                  onClick={() => goSearch({ category: f.slug })}
                >
                  <div className="ycatp__feat-icon">{f.icon}</div>
                  <div className="ycatp__feat-body">
                    <span className="ycatp__feat-label">{f.label}</span>
                    <span className="ycatp__feat-count">
                      {f.count > 0 ? `${f.count} produit${f.count > 1 ? 's' : ''}` : 'A decouvrir'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ─── TOUTES LES CATEGORIES ─── */}
        <section className="ycatp__section">
          <header className="ycatp__shead">
            <h2 className="ycatp__shead-title">Toutes les categories</h2>
            <p className="ycatp__shead-sub">{categories.length > 0 && `${categories.length} categorie${categories.length > 1 ? 's' : ''}`}</p>
          </header>
          {loading ? (
            <div className="ycatp__grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height={72} radius={14} />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="ycatp__empty">
              <p>Aucune categorie pour l instant.</p>
            </div>
          ) : (
            <div className="ycatp__grid">
              {categories.map((cat) => {
                const slug = cat.slug || cat.id;
                const cnt = counts[slug] || cat.product_count || 0;
                return (
                  <button
                    key={slug}
                    type="button"
                    className="ycatp__row"
                    onClick={() => goSearch({ category: slug })}
                  >
                    <span className="ycatp__row-icon" aria-hidden>
                      {hasCategoryIcon(slug) ? (
                        <CategoryIcon slug={slug} size="70%" />
                      ) : cat.icon_url ? (
                        <img
                          src={cat.icon_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span>{(cat.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </span>
                    <span className="ycatp__row-text">
                      <span className="ycatp__row-name">{cat.name}</span>
                      {cnt > 0 && (
                        <span className="ycatp__row-sub">
                          {cnt} produit{cnt > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                    <svg className="ycatp__row-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── MARQUES POPULAIRES ─── */}
        <section className="ycatp__section ycatp__section--bg">
          <header className="ycatp__shead">
            <h2 className="ycatp__shead-title">Marques populaires</h2>
            <p className="ycatp__shead-sub">
              {brands.length > 0 ? `${brands.length} marques` : 'Selection dermato'}
            </p>
          </header>
          {brandsLoading && brands.length === 0 ? (
            <div className="ycatp__brand-grid">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonBrandCard key={i} />)}
            </div>
          ) : (
            <div className="ycatp__brand-grid">
              {brands.slice(0, 12).map((b) => (
                <BrandTile key={b.id || b.name} brand={b} />
              ))}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
