// ════════════════════════════════════════════════════════════════════
// YARAM — BrandPage (route /brand/:id)
// ────────────────────────────────────────────────────────────────────
// Page marque premium e-commerce style Uber Eats / Lyft brand page.
// Sections : breadcrumb · hero · filter bar sticky · grille produits ·
//             à propos · marques similaires
// Wrappée dans SiteLayout (header + footer cohérents).
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNav } from '../App';
import { getAllBrands, getAllProducts, getAllPharmacies } from '../lib/supabase';
import { addToCart } from '../lib/cart';
import SiteLayout from '../components/SiteLayout';
import './BrandPage.css';

const PAGE_SIZE = 24;
const BRAND_GREEN = '#1F8B4C';

// ─── Helpers ──────────────────────────────────────────────────────
function formatPrice(p) {
  const n = Number(p) || 0;
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

function brandInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function safePastel(seed = '') {
  // Petite teinte pastel cohérente à partir du nom (fallback hero sans cover)
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue}, 55%, 38%) 0%, hsl(${(hue + 30) % 360}, 60%, 28%) 100%)`;
}

// ─── Icônes inline SVG ─────────────────────────────────────────────
const Ico = {
  search: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  chevron: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  star: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  globe: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  users: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  box: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  arrow: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  pin: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  empty: () => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="58" fill="#EAF5EE" />
      <path d="M40 50h40v32a4 4 0 0 1-4 4H44a4 4 0 0 1-4-4V50z" stroke="#1F8B4C" strokeWidth="3" fill="none" />
      <path d="M48 50V42a12 12 0 0 1 24 0v8" stroke="#1F8B4C" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

// ════════════════════════════════════════════════════════════════════
// Composant principal
// ════════════════════════════════════════════════════════════════════
export default function BrandPage() {
  const { navigate, route } = useNav();
  const brandId = route?.params?.id;

  const [allBrands, setAllBrands] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtres UI
  const [sort, setSort] = useState('popular');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filterStuck, setFilterStuck] = useState(false);

  const filterBarRef = useRef(null);
  const filterSentinelRef = useRef(null);

  // ─── Fetch initial ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      getAllBrands(),
      getAllProducts(),
      getAllPharmacies(),
    ]).then(([brR, prR, phR]) => {
      if (!alive) return;
      if (brR.status === 'fulfilled') setAllBrands(brR.value || []);
      if (prR.status === 'fulfilled') setAllProducts(prR.value || []);
      if (phR.status === 'fulfilled') setPharmacies(phR.value || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [brandId]);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [sort, category, search, brandId]);

  // ─── Sticky filter bar shadow effect ──────────────────────────────
  useEffect(() => {
    const sentinel = filterSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => setFilterStuck(!entry.isIntersecting),
      { rootMargin: '-1px 0px 0px 0px', threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loading]);

  // ─── Brand resolution ─────────────────────────────────────────────
  const brand = useMemo(() => {
    if (!brandId || !allBrands.length) return null;
    return allBrands.find((b) => String(b.id) === String(brandId)) || null;
  }, [allBrands, brandId]);

  // ─── Products de cette marque ─────────────────────────────────────
  const brandProducts = useMemo(() => {
    if (!brand) return [];
    const target = (brand.name || '').toLowerCase().trim();
    return allProducts.filter((p) => {
      if (p.brand_id && String(p.brand_id) === String(brand.id)) return true;
      const pb = (p.brand_name || p.brand || '').toLowerCase().trim();
      return pb && pb === target;
    });
  }, [allProducts, brand]);

  // ─── Catégories disponibles (depuis les produits de la marque) ────
  const categories = useMemo(() => {
    const set = new Set();
    brandProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [brandProducts]);

  // ─── Pipeline filtres → tri → recherche ───────────────────────────
  const filteredProducts = useMemo(() => {
    let arr = brandProducts;
    if (category !== 'all') {
      arr = arr.filter((p) => (p.category || '').toLowerCase() === category.toLowerCase());
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((p) => (p.name || '').toLowerCase().includes(q));
    }
    const sorted = [...arr];
    switch (sort) {
      case 'price_asc':
        sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case 'price_desc':
        sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case 'new':
        sorted.sort((a, b) => {
          const da = new Date(a.created_at || 0).getTime();
          const db = new Date(b.created_at || 0).getTime();
          return db - da;
        });
        break;
      case 'popular':
      default:
        sorted.sort((a, b) => {
          const ra = (Number(a.rating) || 0) * (Number(a.review_count) || 1);
          const rb = (Number(b.rating) || 0) * (Number(b.review_count) || 1);
          return rb - ra;
        });
        break;
    }
    return sorted;
  }, [brandProducts, category, search, sort]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  // ─── Marques similaires ───────────────────────────────────────────
  const otherBrands = useMemo(() => {
    if (!brand) return [];
    return allBrands.filter((b) => String(b.id) !== String(brand.id)).slice(0, 6);
  }, [allBrands, brand]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const goProduct = (p) => navigate({ name: 'product', id: p.id });
  const goBrand = (b) => navigate({ name: 'brand', id: b.id });

  const onAddToCart = (p, e) => {
    e.stopPropagation();
    const ph = pharmacies[0];
    if (!ph) {
      navigate({ name: 'product', id: p.id });
      return;
    }
    addToCart({
      product: {
        id: p.id,
        name: p.name,
        brand: p.brand_name || p.brand || (brand?.name || ''),
        img: p.image_url || p.img || '',
        price: p.price,
        is_imported: p.is_imported,
        lead_time_days: p.lead_time_days,
        origin_country: p.origin_country,
      },
      pharmacy: ph,
      qty: 1,
    });
  };

  // ─── État : loading initial ───────────────────────────────────────
  if (loading) {
    return (
      <SiteLayout>
        <div className="brand-page">
          <div className="bp-hero bp-hero--skeleton">
            <div className="bp-hero-inner">
              <div className="bp-logo-card bp-skel" />
              <div className="bp-skel-line bp-skel-line--title" />
              <div className="bp-skel-line bp-skel-line--sub" />
            </div>
          </div>
          <div className="bp-container">
            <div className="bp-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bp-card bp-skel-card">
                  <div className="bp-skel bp-skel-img" />
                  <div className="bp-skel-line bp-skel-line--short" />
                  <div className="bp-skel-line" />
                  <div className="bp-skel-line bp-skel-line--price" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── État : marque introuvable ────────────────────────────────────
  if (!brand) {
    return (
      <SiteLayout>
        <div className="brand-page">
          <div className="bp-container">
            <div className="bp-empty">
              <Ico.empty />
              <h2>Marque introuvable</h2>
              <p>Cette marque n'existe pas ou a été retirée du catalogue.</p>
              <button className="bp-btn-primary" onClick={() => navigate('brands')}>
                Voir toutes les marques
              </button>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── Variables d'affichage hero ───────────────────────────────────
  const heroStyle = brand.cover_url
    ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 100%), url(${brand.cover_url})` }
    : { background: safePastel(brand.name || brand.id || 'YARAM') };

  const totalProducts = brandProducts.length;
  const totalReviews = brandProducts.reduce(
    (s, p) => s + (Number(p.review_count) || 0),
    0
  );
  const avgRating =
    brandProducts.length > 0
      ? (
          brandProducts.reduce((s, p) => s + (Number(p.rating) || 0), 0) /
          brandProducts.length
        ).toFixed(1)
      : null;

  return (
    <SiteLayout>
      <div className="brand-page">

        {/* ━━━━━━━━━ BREADCRUMB ━━━━━━━━━ */}
        <nav className="bp-breadcrumb" aria-label="Fil d'ariane">
          <div className="bp-container">
            <button onClick={() => navigate('landing')}>Accueil</button>
            <Ico.chevron />
            <button onClick={() => navigate('shop')}>Catalogue</button>
            <Ico.chevron />
            <button onClick={() => navigate('brands')}>Marques</button>
            <Ico.chevron />
            <span className="bp-breadcrumb-current">{brand.name}</span>
          </div>
        </nav>

        {/* ━━━━━━━━━ HERO ━━━━━━━━━ */}
        <section className="bp-hero" style={heroStyle}>
          <div className="bp-hero-inner">
            <div className="bp-logo-card">
              {brand.img ? (
                <img
                  src={brand.img}
                  alt={brand.name}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = `<div class="bp-logo-fallback">${brandInitials(brand.name)}</div>`;
                  }}
                />
              ) : (
                <div className="bp-logo-fallback">{brandInitials(brand.name)}</div>
              )}
            </div>

            <h1 className="bp-hero-title">{brand.name}</h1>

            {(brand.tagline || brand.description) && (
              <p className="bp-hero-desc">{brand.tagline || brand.description}</p>
            )}

            <div className="bp-hero-badges">
              {brand.origin_country && (
                <span className="bp-badge">
                  <Ico.globe /> Origine : <strong>{brand.origin_country}</strong>
                </span>
              )}
              {brand.is_premium && (
                <span className="bp-badge bp-badge--premium"> Premium</span>
              )}
            </div>

            <div className="bp-hero-stats">
              <div className="bp-stat">
                <Ico.box />
                <span><strong>{totalProducts}</strong> produit{totalProducts > 1 ? 's' : ''}</span>
              </div>
              {totalReviews > 0 && (
                <>
                  <span className="bp-stat-sep">·</span>
                  <div className="bp-stat">
                    <Ico.users />
                    <span><strong>{totalReviews.toLocaleString('fr-FR')}</strong> avis</span>
                  </div>
                </>
              )}
              {avgRating && Number(avgRating) > 0 && (
                <>
                  <span className="bp-stat-sep">·</span>
                  <div className="bp-stat">
                    <Ico.star />
                    <span><strong>{avgRating}</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ━━━━━━━━━ FILTER BAR (sticky) ━━━━━━━━━ */}
        <div ref={filterSentinelRef} className="bp-filter-sentinel" />
        <div
          ref={filterBarRef}
          className={`bp-filter-bar ${filterStuck ? 'bp-filter-bar--stuck' : ''}`}
        >
          <div className="bp-container bp-filter-inner">
            <div className="bp-filter-left">
              <div className="bp-chips">
                <button
                  className={category === 'all' ? 'bp-chip bp-chip--active' : 'bp-chip'}
                  onClick={() => setCategory('all')}
                >
                  Tout
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    className={category === c ? 'bp-chip bp-chip--active' : 'bp-chip'}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="bp-filter-right">
              <div className="bp-search">
                <Ico.search />
                <input
                  type="text"
                  placeholder={`Filtrer dans ${brand.name}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="bp-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Trier"
              >
                <option value="popular">Plus populaires</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="new">Nouveautés</option>
              </select>
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━ COUNT + GRID ━━━━━━━━━ */}
        <section className="bp-container bp-section">
          <div className="bp-count">
            <strong>{filteredProducts.length}</strong> produit{filteredProducts.length > 1 ? 's' : ''}
            {(category !== 'all' || search.trim()) && (
              <button
                className="bp-link-reset"
                onClick={() => { setCategory('all'); setSearch(''); }}
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bp-empty bp-empty--inline">
              <Ico.empty />
              {brandProducts.length === 0 ? (
                <>
                  <h2>Cette marque n'a pas encore de produits référencés</h2>
                  <p>Repassez bientôt — le catalogue {brand.name} s'enrichit chaque semaine.</p>
                  <button className="bp-btn-primary" onClick={() => navigate('brands')}>
                    Voir toutes les marques
                  </button>
                </>
              ) : (
                <>
                  <h2>Aucun produit ne correspond</h2>
                  <p>Essayez de retirer un filtre ou de modifier votre recherche.</p>
                  <button
                    className="bp-btn-primary"
                    onClick={() => { setCategory('all'); setSearch(''); }}
                  >
                    Réinitialiser les filtres
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="bp-grid">
                {visibleProducts.map((p) => (
                  <div key={p.id} className="bp-card" onClick={() => goProduct(p)}>
                    <div className="bp-card-img-wrap">
                      {(p.image_url || p.img) ? (
                        <img
                          src={p.image_url || p.img}
                          alt={p.name}
                          loading="lazy"
                          className="bp-card-img"
                        />
                      ) : (
                        <div className="bp-card-img-fallback"></div>
                      )}
                      {p.is_imported && (
                        <span className="bp-card-tag">
                          <Ico.globe /> Import
                        </span>
                      )}
                    </div>
                    <div className="bp-card-info">
                      <span className="bp-card-brand">{p.brand_name || p.brand || brand.name}</span>
                      <span className="bp-card-name">{p.name}</span>
                      <div className="bp-card-bottom">
                        <span className="bp-card-price">{formatPrice(p.price)}</span>
                        <button
                          className="bp-card-add"
                          onClick={(e) => onAddToCart(p, e)}
                          aria-label="Ajouter au panier"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {visibleCount < filteredProducts.length && (
                <div className="bp-load-more">
                  <button
                    className="bp-btn-outline"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
                    Voir plus
                    <span className="bp-load-more-count">
                      ({filteredProducts.length - visibleCount} restants)
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ━━━━━━━━━ À PROPOS ━━━━━━━━━ */}
        <section className="bp-about">
          <div className="bp-container bp-about-inner">
            <div className="bp-about-text">
              <span className="bp-about-eyebrow">À propos</span>
              <h2 className="bp-about-title">L'univers {brand.name}</h2>
              <p>
                {brand.long_description ||
                  brand.description ||
                  `${brand.name} est une marque référencée par YARAM pour la qualité, l'authenticité et l'efficacité de ses produits. Chaque article est sourcé en circuit officiel et livré à Dakar par notre réseau de pharmacies partenaires.`}
              </p>
              <p className="bp-about-secondary">
                Tous les produits {brand.name} disponibles sur YARAM sont
                authentiques, traçables, et livrés en 30 minutes à Dakar.
                {brand.origin_country && ` Origine : ${brand.origin_country}.`}
              </p>
              <div className="bp-about-pillars">
                <div className="bp-pillar">
                  <div className="bp-pillar-icon">✓</div>
                  <div>
                    <strong>Authentique</strong>
                    <span>Sourcé en circuit officiel</span>
                  </div>
                </div>
                <div className="bp-pillar">
                  <div className="bp-pillar-icon"></div>
                  <div>
                    <strong>Livraison 30 min</strong>
                    <span>Express à Dakar</span>
                  </div>
                </div>
                <div className="bp-pillar">
                  <div className="bp-pillar-icon"></div>
                  <div>
                    <strong>Sélection YARAM</strong>
                    <span>Validée par nos pharmaciens</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bp-about-visual">
              {brand.cover_url || brand.img ? (
                <img
                  src={brand.cover_url || brand.img}
                  alt={brand.name}
                  loading="lazy"
                />
              ) : (
                <div
                  className="bp-about-visual-fallback"
                  style={{ background: safePastel(brand.name) }}
                >
                  <span>{brandInitials(brand.name)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ━━━━━━━━━ MARQUES SIMILAIRES ━━━━━━━━━ */}
        {otherBrands.length > 0 && (
          <section className="bp-container bp-section bp-similar">
            <div className="bp-section-head">
              <h2 className="bp-h2">Marques similaires</h2>
              <button className="bp-link" onClick={() => navigate('brands')}>
                Toutes les marques <Ico.arrow />
              </button>
            </div>
            <div className="bp-similar-grid">
              {otherBrands.map((b) => (
                <button
                  key={b.id}
                  className="bp-similar-card"
                  onClick={() => goBrand(b)}
                >
                  <div className="bp-similar-logo">
                    {b.img ? (
                      <img src={b.img} alt={b.name} loading="lazy" decoding="async"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="bp-similar-fallback">{brandInitials(b.name)}</div>
                    )}
                  </div>
                  <span className="bp-similar-name">{b.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

      </div>
    </SiteLayout>
  );
}
