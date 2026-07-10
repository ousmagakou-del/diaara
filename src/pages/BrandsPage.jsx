// ════════════════════════════════════════════════════════════════════
// YARAM — BrandsPage (route /brands)
// ────────────────────────────────────────────────────────────────────
// Vitrine complete des marques du catalogue. Calque le natif :
//  - Search input pour filtrer par nom ou pays
//  - Grille responsive 2 / 3 / 4 / 5 colonnes
//  - Tri alphabetique
//  - Empty state si aucun resultat
// ════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { useNav } from '../App';
import { useBrands, useProducts } from '../lib/queries';
import SiteLayout from '../components/SiteLayout';
import { BrandTile } from '../components/tiles';
import { SkeletonBrandCard } from '../components/Skeleton';
import './BrandsPage.css';

export default function BrandsPage() {
  const { navigate } = useNav();
  const [query, setQuery] = useState('');

  const { data: brandsRaw = [], isLoading: brandsLoading } = useBrands();
  const { data: productsRaw = [] } = useProducts();

  // Comptage produits par marque : match par brand_id (prioritaire) ou par nom
  const countsByBrandId = useMemo(() => {
    const byId = {};
    const byName = {};
    (productsRaw || []).forEach((p) => {
      if (p?.brand_id) byId[String(p.brand_id)] = (byId[String(p.brand_id)] || 0) + 1;
      const bn = (p?.brand_name || p?.brand || '').toLowerCase().trim();
      if (bn) byName[bn] = (byName[bn] || 0) + 1;
    });
    return { byId, byName };
  }, [productsRaw]);

  // Tri alphabetique + injection product_count reel
  const brandsSorted = useMemo(() => {
    const list = [...(brandsRaw || [])].map((b) => {
      const cnt =
        countsByBrandId.byId[String(b.id)] ??
        countsByBrandId.byName[(b.name || '').toLowerCase().trim()] ??
        b.product_count ??
        0;
      return { ...b, product_count: cnt };
    });
    list.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' })
    );
    return list;
  }, [brandsRaw, countsByBrandId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brandsSorted;
    return brandsSorted.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const city = (b.city || b.origin || '').toLowerCase();
      const country = (b.origin_country || '').toLowerCase();
      return name.includes(q) || city.includes(q) || country.includes(q);
    });
  }, [brandsSorted, query]);

  const showLoading = brandsLoading && brandsRaw.length === 0;

  return (
    <SiteLayout>
      <div className="ybrp">
        {/* ─── HERO ─── */}
        <section className="ybrp__hero">
          <div className="ybrp__hero-inner">
            <span className="ybrp__eyebrow">Univers YARAM</span>
            <h1 className="ybrp__title">Marques</h1>
            <p className="ybrp__sub">
              Selectionne ta marque pour voir tous ses produits authentiques,
              references par nos pharmaciens partenaires.
            </p>
          </div>
        </section>

        {/* ─── SEARCH BAR ─── */}
        <div className="ybrp__searchbar">
          <label className="ybrp__search">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une marque..."
              aria-label="Rechercher une marque"
              autoComplete="off"
            />
            {query.length > 0 && (
              <button
                type="button"
                className="ybrp__search-clear"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </label>
        </div>

        {/* ─── GRID ─── */}
        <section className="ybrp__section">
          <header className="ybrp__shead">
            <h2 className="ybrp__shead-title">
              {query.trim() ? 'Resultats' : 'Toutes les marques'}
            </h2>
            <p className="ybrp__shead-sub">
              {showLoading
                ? 'Chargement...'
                : `${filtered.length} marque${filtered.length > 1 ? 's' : ''}`}
            </p>
          </header>

          {showLoading ? (
            <div className="ybrp__grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonBrandCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="ybrp__empty">
              <span className="ybrp__empty-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <h3 className="ybrp__empty-title">Aucune marque trouvee</h3>
              <p className="ybrp__empty-msg">
                {query.trim()
                  ? `Aucun resultat pour "${query}". Essaie un autre terme.`
                  : 'Le catalogue s enrichit chaque semaine. Repasse bientot.'}
              </p>
              {query.trim() && (
                <button
                  type="button"
                  className="ybrp__empty-cta"
                  onClick={() => setQuery('')}
                >
                  Reinitialiser la recherche
                </button>
              )}
            </div>
          ) : (
            <div className="ybrp__grid">
              {filtered.map((b) => (
                <BrandTile
                  key={b.id || b.name}
                  brand={b}
                  onOpen={() =>
                    b.id
                      ? navigate({ name: 'brand', params: { id: b.id } })
                      : navigate({ name: 'search', params: { brand: b.name } })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
