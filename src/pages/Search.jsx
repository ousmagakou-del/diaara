// ════════════════════════════════════════════════════════════════════
// YARAM — Search / Category page (route /search)
// ────────────────────────────────────────────────────────────────────
// Page unifiee de recherche + navigation par filtres avances.
// Layout 2 colonnes desktop : filtres sticky a gauche (260px), resultats
// a droite (grille 2/3/4 col selon breakpoint). Sur mobile, les filtres
// sont accessibles via un bottom sheet.
//
// URL SEO : /search?q=xxx&marque=biotherm,vichy&prix_min=5000&prix_max=25000&peau=grasse&tri=prix_asc
//
// Filtres avances :
//   - Marque (multi-select checkbox liste avec search)
//   - Prix (slider min/max FCFA)
//   - Type de peau (mixte, seche, grasse, sensible, mature, normale)
//   - Ingredients recherches (multi-select)
//   - Rating min (3 stars, 4 stars, 4.5+)
//   - En stock uniquement (toggle)
//   - Livrable demain (toggle : exclut les imports)
//
// Tri : Pertinence · Prix asc · Prix desc · Note · Popularite · Nouveautes
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNav } from '../App';
import { useProducts, useBrands, useCategories } from '../lib/queries';
import SiteLayout from '../components/SiteLayout';
import { ProductTile } from '../components/tiles';
import { SkeletonProductCard } from '../components/Skeleton';
import { usePageSEO, useJsonLd } from '../lib/seo';
import './Search.css';

// ─── Constantes ────────────────────────────────────────────────────
const DEBOUNCE_MS = 200;

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Pertinence' },
  { id: 'price_asc', label: 'Prix croissant' },
  { id: 'price_desc', label: 'Prix decroissant' },
  { id: 'rating', label: 'Note client' },
  { id: 'popularity', label: 'Popularite' },
  { id: 'newest', label: 'Nouveautes' },
];

const SKIN_TYPES = [
  { id: 'mixte', label: 'Mixte' },
  { id: 'seche', label: 'Seche' },
  { id: 'grasse', label: 'Grasse' },
  { id: 'sensible', label: 'Sensible' },
  { id: 'mature', label: 'Mature' },
  { id: 'normale', label: 'Normale' },
];

const RATING_MIN_OPTIONS = [
  { id: 0,   label: 'Toutes les notes' },
  { id: 3,   label: '3 etoiles et plus' },
  { id: 4,   label: '4 etoiles et plus' },
  { id: 4.5, label: '4.5 etoiles et plus' },
];

const PRICE_LIMIT = 200000;

// Ingredients frequents pour le multi-select — la vraie liste est
// hydratee dynamiquement a partir des produits.
const DEFAULT_INGREDIENTS = [
  'Acide hyaluronique', 'Retinol', 'Vitamine C', 'Niacinamide',
  'AHA', 'BHA', 'Ceramides', 'Karite', 'Aloe vera', 'SPF',
];

// ─── Helpers URL params <-> etat ───────────────────────────────────
function readParams() {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  const parseMulti = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
  return {
    q: sp.get('q') || '',
    category: sp.get('category') || sp.get('categorie') || '',
    brands: parseMulti(sp.get('marque') || sp.get('brand') || ''),
    priceMin: Number(sp.get('prix_min') || sp.get('price_min') || 0) || 0,
    priceMax: Number(sp.get('prix_max') || sp.get('price_max') || 0) || 0,
    skinTypes: parseMulti(sp.get('peau') || sp.get('skin') || ''),
    ingredients: parseMulti(sp.get('ingredients') || ''),
    ratingMin: Number(sp.get('note_min') || sp.get('rating_min') || 0) || 0,
    inStockOnly: sp.get('stock') === '1' || sp.get('in_stock') === '1',
    fastShip: sp.get('livraison') === '1' || sp.get('fast') === '1',
    promoOnly: sp.get('promo') === '1',
    sort: sp.get('tri') || sp.get('sort') || 'relevance',
  };
}

function writeParams(state, opts = {}) {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams();
  if (state.q) sp.set('q', state.q);
  if (state.category) sp.set('category', state.category);
  if (state.brands?.length) sp.set('marque', state.brands.join(','));
  if (state.priceMin) sp.set('prix_min', String(state.priceMin));
  if (state.priceMax) sp.set('prix_max', String(state.priceMax));
  if (state.skinTypes?.length) sp.set('peau', state.skinTypes.join(','));
  if (state.ingredients?.length) sp.set('ingredients', state.ingredients.join(','));
  if (state.ratingMin) sp.set('note_min', String(state.ratingMin));
  if (state.inStockOnly) sp.set('stock', '1');
  if (state.fastShip) sp.set('livraison', '1');
  if (state.promoOnly) sp.set('promo', '1');
  if (state.sort && state.sort !== 'relevance') sp.set('tri', state.sort);
  const q = sp.toString();
  const url = q ? `/search?${q}` : '/search';
  if (opts.replace) window.history.replaceState({}, '', url);
  else window.history.pushState({}, '', url);
}

// ─── Helpers matching produit ──────────────────────────────────────
function productMatchesSearch(p, term) {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    p.name?.toLowerCase().includes(t) ||
    p.brand?.toLowerCase().includes(t) ||
    p.category?.toLowerCase().includes(t) ||
    (Array.isArray(p.badges) && p.badges.join(' ').toLowerCase().includes(t))
  );
}

function productMatchesSkinType(p, skinTypes) {
  if (!skinTypes?.length) return true;
  // Verifie sur badges (array) ou champ skin_type direct
  const badges = Array.isArray(p.badges) ? p.badges.map((b) => String(b).toLowerCase()) : [];
  const direct = String(p.skin_type || '').toLowerCase();
  return skinTypes.some((s) => badges.includes(s) || badges.some((b) => b.includes(s)) || direct.includes(s));
}

function productMatchesIngredients(p, ingredients) {
  if (!ingredients?.length) return true;
  const src = [
    p.inci, p.long_desc, p.reason, p.name,
    Array.isArray(p.badges) ? p.badges.join(' ') : '',
  ].filter(Boolean).join(' ').toLowerCase();
  return ingredients.every((i) => src.includes(i.toLowerCase()));
}

function computeDiscountPct(p) {
  const price = Number(p?.price) || 0;
  const old = Number(p?.old_price || p?.list_price || 0);
  if (!price || !old || old <= price) return 0;
  return Math.round(((old - price) / old) * 100);
}

function productIsPromo(p) {
  return computeDiscountPct(p) > 0 || !!p?.promo || !!p?.discount;
}

// ─── Composant principal ───────────────────────────────────────────
export default function Search({ initialCategory, initialBrand }) {
  const { navigate } = useNav();
  const initial = useMemo(() => {
    const p = readParams();
    if (initialCategory && !p.category) p.category = initialCategory;
    if (initialBrand && !p.brands.length) p.brands = [initialBrand];
    return p;
  }, [initialCategory, initialBrand]);

  // ─── State ────────────────────────────────────────────────────
  const [q, setQ] = useState(initial.q);
  const [qDebounced, setQDebounced] = useState(initial.q);
  const [category, setCategory] = useState(initial.category);
  const [brands, setBrands] = useState(initial.brands);
  const [priceMin, setPriceMin] = useState(initial.priceMin);
  const [priceMax, setPriceMax] = useState(initial.priceMax);
  const [skinTypes, setSkinTypes] = useState(initial.skinTypes);
  const [ingredients, setIngredients] = useState(initial.ingredients);
  const [ratingMin, setRatingMin] = useState(initial.ratingMin);
  const [inStockOnly, setInStockOnly] = useState(initial.inStockOnly);
  const [fastShip, setFastShip] = useState(initial.fastShip);
  const [promoOnly, setPromoOnly] = useState(initial.promoOnly);
  const [sort, setSort] = useState(initial.sort);

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [brandFilterQ, setBrandFilterQ] = useState('');

  // Data
  const { data: products = [], isLoading: prodLoading } = useProducts();
  const { data: allBrands = [], isLoading: brandsLoading } = useBrands();
  const { data: categories = [] } = useCategories();

  const loading = prodLoading && products.length === 0;

  // ─── Debounce recherche ──────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  // ─── Sync URL <-> state ──────────────────────────────────────
  const stateRef = useRef();
  stateRef.current = {
    q: qDebounced, category, brands, priceMin, priceMax, skinTypes, ingredients,
    ratingMin, inStockOnly, fastShip, promoOnly, sort,
  };

  useEffect(() => {
    // Debounce URL write pour eviter le spam d'entrees historiques
    const t = setTimeout(() => writeParams(stateRef.current, { replace: true }), 250);
    return () => clearTimeout(t);
  }, [qDebounced, category, brands, priceMin, priceMax, skinTypes, ingredients, ratingMin, inStockOnly, fastShip, promoOnly, sort]);

  // Reagir aux changements de props initiales
  useEffect(() => { if (initialCategory) setCategory(initialCategory); }, [initialCategory]);
  useEffect(() => { if (initialBrand) setBrands([initialBrand]); }, [initialBrand]);

  // Reagir au back/forward navigator
  useEffect(() => {
    const onPop = () => {
      const p = readParams();
      setQ(p.q); setQDebounced(p.q);
      setCategory(p.category);
      setBrands(p.brands);
      setPriceMin(p.priceMin);
      setPriceMax(p.priceMax);
      setSkinTypes(p.skinTypes);
      setIngredients(p.ingredients);
      setRatingMin(p.ratingMin);
      setInStockOnly(p.inStockOnly);
      setFastShip(p.fastShip);
      setPromoOnly(p.promoOnly);
      setSort(p.sort);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ─── Liste ingredients extraite du catalogue (top 20) ────────
  const availableIngredients = useMemo(() => {
    // On extrait des inci les mots frequents. Fallback : liste par defaut.
    const bag = new Map();
    (products || []).forEach((p) => {
      const inci = (p.inci || '').split(/[,;.]/).map((x) => x.trim()).filter(Boolean);
      inci.forEach((tag) => {
        if (tag.length < 3 || tag.length > 40) return;
        const key = tag.toLowerCase();
        bag.set(key, (bag.get(key) || 0) + 1);
      });
    });
    const top = Array.from(bag.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
    return top.length >= 6 ? top : DEFAULT_INGREDIENTS;
  }, [products]);

  // ─── Filtrage ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = products || [];

    if (qDebounced.trim()) list = list.filter((p) => productMatchesSearch(p, qDebounced.trim()));
    if (category) list = list.filter((p) => (p.category || '').toLowerCase() === category.toLowerCase());
    if (brands.length) {
      const set = new Set(brands.map((b) => b.toLowerCase()));
      list = list.filter((p) => set.has((p.brand || '').toLowerCase()));
    }
    if (priceMin > 0) list = list.filter((p) => Number(p.price || 0) >= priceMin);
    if (priceMax > 0) list = list.filter((p) => Number(p.price || 0) <= priceMax);
    if (skinTypes.length) list = list.filter((p) => productMatchesSkinType(p, skinTypes));
    if (ingredients.length) list = list.filter((p) => productMatchesIngredients(p, ingredients));
    if (ratingMin > 0) list = list.filter((p) => Number(p.rating || 0) >= ratingMin);
    if (inStockOnly) list = list.filter((p) => p.active !== false && (p.stock === undefined || Number(p.stock) > 0));
    if (fastShip) list = list.filter((p) => !p.is_imported);
    if (promoOnly) list = list.filter((p) => productIsPromo(p));

    return list;
  }, [products, qDebounced, category, brands, priceMin, priceMax, skinTypes, ingredients, ratingMin, inStockOnly, fastShip, promoOnly]);

  // ─── Tri ──────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const list = filtered.slice();
    switch (sort) {
      case 'price_asc':
        list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        break;
      case 'price_desc':
        list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        break;
      case 'rating':
        list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
        break;
      case 'popularity':
        list.sort((a, b) => Number(b.review_count || 0) - Number(a.review_count || 0));
        break;
      case 'newest':
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
      default:
        break; // relevance = ordre naturel
    }
    return list;
  }, [filtered, sort]);

  // ─── SEO ──────────────────────────────────────────────────────
  const seoTitle = category
    ? `${category.charAt(0).toUpperCase()}${category.slice(1)} — Recherche · YARAM`
    : brands.length === 1
      ? `${brands[0]} — Produits · YARAM`
      : qDebounced
        ? `${qDebounced} — Recherche · YARAM`
        : 'Recherche · YARAM';

  usePageSEO({
    title: seoTitle,
    description: 'Recherche produits, marques et categories · Filtres avances, tri, promotions · YARAM',
    canonical: `https://yaram.app${typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/search'}`,
  });

  useJsonLd(
    sorted.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: seoTitle,
          numberOfItems: sorted.length,
          itemListElement: sorted.slice(0, 20).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://yaram.app/product/${p.id}`,
            name: p.name,
          })),
        }
      : null,
    `search-jsonld-${category || brands[0] || qDebounced || 'none'}`
  );

  // ─── Handlers filtres ─────────────────────────────────────────
  const toggleBrand = useCallback((name) => {
    setBrands((prev) => prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]);
  }, []);
  const toggleSkinType = useCallback((id) => {
    setSkinTypes((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
  }, []);
  const toggleIngredient = useCallback((id) => {
    setIngredients((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
  }, []);

  const resetFilters = () => {
    setBrands([]);
    setPriceMin(0);
    setPriceMax(0);
    setSkinTypes([]);
    setIngredients([]);
    setRatingMin(0);
    setInStockOnly(false);
    setFastShip(false);
    setPromoOnly(false);
    setCategory('');
  };

  const activeFilterCount =
    brands.length + skinTypes.length + ingredients.length +
    (category ? 1 : 0) +
    (priceMin > 0 ? 1 : 0) +
    (priceMax > 0 ? 1 : 0) +
    (ratingMin > 0 ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (fastShip ? 1 : 0) +
    (promoOnly ? 1 : 0);

  const visibleBrandsInFilter = useMemo(() => {
    const term = brandFilterQ.trim().toLowerCase();
    const list = (allBrands || []).filter((b) => b?.name);
    if (!term) return list.slice(0, 50);
    return list.filter((b) => b.name.toLowerCase().includes(term)).slice(0, 50);
  }, [allBrands, brandFilterQ]);

  const priceRangeLabel = () => {
    if (priceMin > 0 && priceMax > 0) return `${priceMin.toLocaleString('fr-FR')} - ${priceMax.toLocaleString('fr-FR')} F`;
    if (priceMin > 0) return `A partir de ${priceMin.toLocaleString('fr-FR')} F`;
    if (priceMax > 0) return `Jusqu a ${priceMax.toLocaleString('fr-FR')} F`;
    return 'Sans limite';
  };

  const pageTitle = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : brands.length === 1
      ? brands[0]
      : qDebounced
        ? `Resultats pour "${qDebounced}"`
        : 'Rechercher un produit';

  // ─── Render ───────────────────────────────────────────────────
  const FiltersPanel = (
    <FiltersContent
      allBrands={visibleBrandsInFilter}
      brandsLoading={brandsLoading}
      brandFilterQ={brandFilterQ}
      setBrandFilterQ={setBrandFilterQ}
      brands={brands} toggleBrand={toggleBrand}
      priceMin={priceMin} setPriceMin={setPriceMin}
      priceMax={priceMax} setPriceMax={setPriceMax}
      skinTypes={skinTypes} toggleSkinType={toggleSkinType}
      ingredients={ingredients} toggleIngredient={toggleIngredient}
      availableIngredients={availableIngredients}
      ratingMin={ratingMin} setRatingMin={setRatingMin}
      inStockOnly={inStockOnly} setInStockOnly={setInStockOnly}
      fastShip={fastShip} setFastShip={setFastShip}
      promoOnly={promoOnly} setPromoOnly={setPromoOnly}
      categories={categories}
      category={category} setCategory={setCategory}
      onReset={resetFilters}
      activeCount={activeFilterCount}
    />
  );

  return (
    <SiteLayout>
      <div className="ysearch">
        {/* ─── Barre haute (recherche + tri) ─── */}
        <div className="ysearch__top">
          <div className="ysearch__top-inner">
            <div className="ysearch__title-wrap">
              <h1 className="ysearch__title">{pageTitle}</h1>
              {!loading && (
                <span className="ysearch__count">
                  {sorted.length.toLocaleString('fr-FR')} produit{sorted.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="ysearch__query-row">
              <label className="ysearch__query">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Affiner : mot cle, marque, ingredient..."
                  aria-label="Affiner la recherche"
                />
                {q && (
                  <button type="button" className="ysearch__query-clear" onClick={() => setQ('')} aria-label="Effacer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </label>

              <div className="ysearch__sort-wrap">
                <label className="ysearch__sort-label" htmlFor="ysearch-sort">Trier par</label>
                <select
                  id="ysearch-sort"
                  className="ysearch__sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chips filtres actifs */}
            {activeFilterCount > 0 && (
              <div className="ysearch__chips">
                {category && (
                  <button type="button" className="ysearch__chip" onClick={() => setCategory('')}>
                    Categorie · {category}
                    <ChipCross />
                  </button>
                )}
                {brands.map((b) => (
                  <button key={b} type="button" className="ysearch__chip" onClick={() => toggleBrand(b)}>
                    Marque · {b}
                    <ChipCross />
                  </button>
                ))}
                {skinTypes.map((s) => (
                  <button key={s} type="button" className="ysearch__chip" onClick={() => toggleSkinType(s)}>
                    Peau · {SKIN_TYPES.find((x) => x.id === s)?.label || s}
                    <ChipCross />
                  </button>
                ))}
                {ingredients.map((i) => (
                  <button key={i} type="button" className="ysearch__chip" onClick={() => toggleIngredient(i)}>
                    Ingredient · {i}
                    <ChipCross />
                  </button>
                ))}
                {ratingMin > 0 && (
                  <button type="button" className="ysearch__chip" onClick={() => setRatingMin(0)}>
                    Note ≥ {ratingMin}
                    <ChipCross />
                  </button>
                )}
                {(priceMin > 0 || priceMax > 0) && (
                  <button type="button" className="ysearch__chip" onClick={() => { setPriceMin(0); setPriceMax(0); }}>
                    Prix · {priceRangeLabel()}
                    <ChipCross />
                  </button>
                )}
                {inStockOnly && (
                  <button type="button" className="ysearch__chip" onClick={() => setInStockOnly(false)}>
                    En stock
                    <ChipCross />
                  </button>
                )}
                {fastShip && (
                  <button type="button" className="ysearch__chip" onClick={() => setFastShip(false)}>
                    Livrable demain
                    <ChipCross />
                  </button>
                )}
                {promoOnly && (
                  <button type="button" className="ysearch__chip" onClick={() => setPromoOnly(false)}>
                    Promo
                    <ChipCross />
                  </button>
                )}
                <button type="button" className="ysearch__chip-reset" onClick={resetFilters}>
                  Reinitialiser
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Layout 2 colonnes ─── */}
        <div className="ysearch__body">
          <aside className="ysearch__filters" aria-label="Filtres">
            {FiltersPanel}
          </aside>

          <main className="ysearch__results">
            {loading ? (
              <div className="ysearch__grid">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonProductCard key={i} />)}
              </div>
            ) : sorted.length === 0 ? (
              <NoResults
                term={qDebounced || category || brands.join(', ')}
                onReset={resetFilters}
                categories={categories}
                onPickCategory={(c) => setCategory(c)}
              />
            ) : (
              <div className="ysearch__grid">
                {sorted.map((p) => <ProductTile key={p.id} product={p} />)}
              </div>
            )}
          </main>
        </div>

        {/* ─── Bouton floating mobile ─── */}
        <button
          type="button"
          className="ysearch__fab"
          onClick={() => setMobileSheetOpen(true)}
          aria-label="Ouvrir les filtres"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden>
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          Filtres
          {activeFilterCount > 0 && <span className="ysearch__fab-badge">{activeFilterCount}</span>}
        </button>

        {/* ─── Bottom sheet mobile ─── */}
        {mobileSheetOpen && (
          <div className="ysearch__sheet-root" onClick={() => setMobileSheetOpen(false)}>
            <div className="ysearch__sheet" onClick={(e) => e.stopPropagation()}>
              <div className="ysearch__sheet-head">
                <span>Filtres</span>
                <button
                  type="button"
                  className="ysearch__sheet-close"
                  onClick={() => setMobileSheetOpen(false)}
                  aria-label="Fermer les filtres"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="ysearch__sheet-body">
                {FiltersPanel}
              </div>
              <div className="ysearch__sheet-foot">
                <button type="button" className="ysearch__sheet-reset" onClick={resetFilters}>
                  Reinitialiser
                </button>
                <button
                  type="button"
                  className="ysearch__sheet-apply"
                  onClick={() => setMobileSheetOpen(false)}
                >
                  Voir {sorted.length} produit{sorted.length > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sous composants
// ═══════════════════════════════════════════════════════════════════

function ChipCross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FilterBlock({ title, children }) {
  return (
    <div className="ysearch__block">
      <div className="ysearch__block-title">{title}</div>
      <div className="ysearch__block-body">{children}</div>
    </div>
  );
}

function CheckboxRow({ id, label, checked, onChange, hint }) {
  return (
    <label className="ysearch__check">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-labelledby={id ? `${id}-label` : undefined}
      />
      <span className="ysearch__check-box" aria-hidden />
      <span id={id ? `${id}-label` : undefined} className="ysearch__check-label">{label}</span>
      {hint !== undefined && <span className="ysearch__check-hint">{hint}</span>}
    </label>
  );
}

function ToggleRow({ label, checked, onChange, hint }) {
  return (
    <label className="ysearch__toggle-row">
      <div className="ysearch__toggle-txt">
        <span className="ysearch__toggle-label">{label}</span>
        {hint && <span className="ysearch__toggle-hint">{hint}</span>}
      </div>
      <span className={`ysearch__toggle ${checked ? 'is-on' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          aria-label={label}
        />
        <span className="ysearch__toggle-track" />
        <span className="ysearch__toggle-thumb" />
      </span>
    </label>
  );
}

function FiltersContent({
  allBrands, brandsLoading, brandFilterQ, setBrandFilterQ,
  brands, toggleBrand,
  priceMin, setPriceMin, priceMax, setPriceMax,
  skinTypes, toggleSkinType,
  ingredients, toggleIngredient, availableIngredients,
  ratingMin, setRatingMin,
  inStockOnly, setInStockOnly,
  fastShip, setFastShip,
  promoOnly, setPromoOnly,
  categories, category, setCategory,
  onReset, activeCount,
}) {
  return (
    <div className="ysearch__filters-inner">
      <div className="ysearch__filters-head">
        <span>Affiner</span>
        <button
          type="button"
          className="ysearch__filters-reset"
          onClick={onReset}
          disabled={activeCount === 0}
        >
          Reinitialiser
        </button>
      </div>

      {categories?.length > 0 && (
        <FilterBlock title="Categorie">
          <div className="ysearch__cat-list">
            <button
              type="button"
              className={`ysearch__cat ${!category ? 'is-active' : ''}`}
              onClick={() => setCategory('')}
            >
              Toutes les categories
            </button>
            {categories.slice(0, 12).map((c) => {
              const slug = c.slug || c.id;
              return (
                <button
                  key={slug}
                  type="button"
                  className={`ysearch__cat ${category === slug ? 'is-active' : ''}`}
                  onClick={() => setCategory(slug)}
                >
                  {c.name || slug}
                </button>
              );
            })}
          </div>
        </FilterBlock>
      )}

      <FilterBlock title="Marque">
        <label className="ysearch__brand-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Chercher une marque"
            value={brandFilterQ}
            onChange={(e) => setBrandFilterQ(e.target.value)}
          />
        </label>
        <div className="ysearch__brand-list">
          {brandsLoading && allBrands.length === 0 ? (
            <div className="ysearch__block-empty">Chargement...</div>
          ) : allBrands.length === 0 ? (
            <div className="ysearch__block-empty">Aucune marque correspondante</div>
          ) : (
            allBrands.map((b) => (
              <CheckboxRow
                key={b.id || b.name}
                id={`brand-${b.id || b.name}`}
                label={b.name}
                checked={brands.includes(b.name)}
                onChange={() => toggleBrand(b.name)}
                hint={b.product_count ? String(b.product_count) : undefined}
              />
            ))
          )}
        </div>
      </FilterBlock>

      <FilterBlock title="Prix (FCFA)">
        <div className="ysearch__price-row">
          <input
            type="number"
            className="ysearch__price-in"
            placeholder="Min"
            min={0}
            max={PRICE_LIMIT}
            step={1000}
            value={priceMin || ''}
            onChange={(e) => setPriceMin(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Prix minimum"
          />
          <span aria-hidden>—</span>
          <input
            type="number"
            className="ysearch__price-in"
            placeholder="Max"
            min={0}
            max={PRICE_LIMIT}
            step={1000}
            value={priceMax || ''}
            onChange={(e) => setPriceMax(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Prix maximum"
          />
        </div>
        <input
          type="range"
          className="ysearch__price-slider"
          min={0}
          max={PRICE_LIMIT}
          step={1000}
          value={priceMax || PRICE_LIMIT}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          aria-label="Curseur prix maximum"
        />
        <div className="ysearch__price-hint">
          Jusqu a {(priceMax || PRICE_LIMIT).toLocaleString('fr-FR')} F
        </div>
      </FilterBlock>

      <FilterBlock title="Type de peau">
        <div className="ysearch__grid-check">
          {SKIN_TYPES.map((s) => (
            <CheckboxRow
              key={s.id}
              id={`skin-${s.id}`}
              label={s.label}
              checked={skinTypes.includes(s.id)}
              onChange={() => toggleSkinType(s.id)}
            />
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Ingredients">
        <div className="ysearch__grid-check">
          {availableIngredients.slice(0, 12).map((i) => (
            <CheckboxRow
              key={i}
              id={`ing-${i}`}
              label={i}
              checked={ingredients.includes(i)}
              onChange={() => toggleIngredient(i)}
            />
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Note minimum">
        <div className="ysearch__grid-check">
          {RATING_MIN_OPTIONS.map((o) => (
            <label key={o.id} className="ysearch__check ysearch__check--radio">
              <input
                type="radio"
                name="rating-min"
                checked={ratingMin === o.id}
                onChange={() => setRatingMin(o.id)}
              />
              <span className="ysearch__check-box ysearch__check-box--radio" aria-hidden />
              <span className="ysearch__check-label">{o.label}</span>
            </label>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Disponibilite & livraison">
        <ToggleRow
          label="En stock uniquement"
          hint="Masque les produits en rupture"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
        />
        <ToggleRow
          label="Livrable demain"
          hint="Exclut les imports internationaux"
          checked={fastShip}
          onChange={(e) => setFastShip(e.target.checked)}
        />
        <ToggleRow
          label="En promotion"
          hint="Uniquement les produits en solde"
          checked={promoOnly}
          onChange={(e) => setPromoOnly(e.target.checked)}
        />
      </FilterBlock>
    </div>
  );
}

function NoResults({ term, categories, onPickCategory, onReset }) {
  const suggested = (categories || []).slice(0, 6);
  return (
    <div className="ysearch__no-results">
      <div className="ysearch__no-icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="48" height="48">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h3 className="ysearch__no-title">Aucun resultat</h3>
      <p className="ysearch__no-sub">
        Aucun produit ne correspond a{term ? ` "${term}" et` : ''} tes filtres actuels.
      </p>
      {suggested.length > 0 && (
        <div className="ysearch__no-cats">
          {suggested.map((c) => (
            <button
              key={c.slug || c.id}
              type="button"
              className="ysearch__no-cat"
              onClick={() => onPickCategory(c.slug || c.id)}
            >
              {c.name || c.slug}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="ysearch__no-reset" onClick={onReset}>
        Reinitialiser les filtres
      </button>
    </div>
  );
}
