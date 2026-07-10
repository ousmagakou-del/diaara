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
import { BrandTile } from '../components/tiles';
import Skeleton, { SkeletonBrandCard } from '../components/Skeleton';
import './Categories.css';

// ─── FEATURED (categories "vitrines" avec icone) ───────────────────
const FEATURED = [
  {
    key: 'pharmacie',
    label: 'Pharmacie',
    slug: 'pharmacie',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <path d="M10.5 20.5a7 7 0 0 1-9.9-9.9l9.9-9.9a7 7 0 0 1 9.9 9.9l-9.9 9.9z" />
        <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
      </svg>
    ),
  },
  {
    key: 'beaute',
    label: 'Beaute',
    slug: 'beaute',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <path d="M9 4l4-2 4 6-3 2z" />
        <rect x="7" y="10" width="9" height="11" rx="1.5" />
        <line x1="7" y1="14" x2="16" y2="14" />
      </svg>
    ),
  },
  {
    key: 'bebe',
    label: 'Bebe',
    slug: 'bebe',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <path d="M9 2h6v3H9z" />
        <path d="M8 5h8l-1 4H9z" />
        <rect x="9" y="9" width="6" height="13" rx="2" />
        <line x1="10.5" y1="13" x2="13.5" y2="13" />
        <line x1="10.5" y1="16" x2="13.5" y2="16" />
      </svg>
    ),
  },
  {
    key: 'bien-etre',
    label: 'Bien-etre',
    slug: 'bien-etre',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <path d="M20 4c-8 0-14 6-14 14 0 .5 0 1 .1 1.5C12 19 18 14 20 4z" />
        <path d="M6 18s4-2 8-6" />
      </svg>
    ),
  },
  {
    key: 'hygiene',
    label: 'Hygiene',
    slug: 'hygiene',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <path d="M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
        <path d="M9 14a3 3 0 0 0 3 3" />
      </svg>
    ),
  },
  {
    key: 'international',
    label: 'Import',
    slug: 'international',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
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
              {Array.from({ length: 6 }).map((_, i) => (
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
                      {cat.icon_url ? (
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
