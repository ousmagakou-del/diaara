// ════════════════════════════════════════════════════════════════════
// YARAM — ShopHome (route /shop)
// ────────────────────────────────────────────────────────────────────
// Homepage curatorielle world-class alignee EXACTEMENT sur la Home native
// (Yaram Expo RN app/(tabs)/index.jsx). Meme ordre de sections, memes
// libelles, memes CTAs. Version web adaptee au layout grille responsive
// 2/3/4 colonnes, sidebar-less.
//
// Ordre des sections (calque native) :
//   1. Hero storytelling
//   2. Marques
//   3. Categories (grid chips)
//   4. Coupon bienvenue
//   5. Pour toi (personnalise)
//   6. Tendances cette semaine
//   7. Nouveautes
//   8. Bons plans
//   9. Best-sellers Dakar
//  10. Recommande pour vous
//  11. Fin de stock
//  12. Tous les produits (CTA vers /search)
//  13. B2B — Devenir partenaire / livreur
// ════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { useNav, useUser } from '../App';
import {
  useProducts,
  useBrands,
  useCategories,
  useBanners,
  usePharmacies,
  useMyFavorites,
} from '../lib/queries';
import SiteLayout from '../components/SiteLayout';
import { ProductTile, BrandTile } from '../components/tiles';
import { SkeletonProductCard, SkeletonBrandCard } from '../components/Skeleton';
import './ShopHome.css';

// ─── Utils ─────────────────────────────────────────────────────────
function daysAgo(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function computeDiscountPct(p) {
  const price = Number(p?.price) || 0;
  const old = Number(p?.old_price || p?.list_price || 0);
  if (!price || !old || old <= price) return 0;
  return Math.round(((old - price) / old) * 100);
}

function hasStockInfo(p) {
  return typeof p?.stock === 'number';
}

// Map skin_type -> categories affines. Utilise pour les recos.
const SKIN_TYPE_TO_CATS = {
  mixte:    ['visage', 'serum', 'hydratant'],
  seche:    ['hydratant', 'huile', 'visage'],
  grasse:   ['nettoyant', 'masque', 'visage'],
  sensible: ['visage', 'hydratant'],
  mature:   ['serum', 'visage', 'hydratant'],
  normale:  ['visage', 'hydratant'],
};

// Palette catégories (calque du preset native — bg color, initiale typo)
const CAT_PRESET = {
  visage:    '#FCE7F3',
  solaire:   '#FEF3C7',
  cheveux:   '#EDE9FE',
  maquillage:'#FCE7F3',
  bebe:      '#DBEAFE',
  hygiene:   '#DCFCE7',
  complement:'#FEE7DC',
  corps:     '#FEE2E2',
  serum:     '#DBEAFE',
  hydratant: '#DBEAFE',
  masque:    '#EDE9FE',
  levres:    '#FCE7F3',
  huile:     '#DCFCE7',
  parfum:    '#FCE7F3',
  nettoyant: '#CFFAFE',
  bouche:    '#E0F2FE',
  intime:    '#FCE7F3',
  deodorants:'#DCFCE7',
  'pieds-mains': '#FFE7B5',
};
const presetFor = (slug) => CAT_PRESET[String(slug || '').toLowerCase()] || 'var(--y-brand-soft)';

// ─── SectionHead (calque native SectionHead) ───────────────────────
function SectionHead({ eyebrow, title, subtitle, onSeeAll, seeAllLabel = 'Voir tout' }) {
  return (
    <header className="yhome-shead">
      <div className="yhome-shead__text">
        {eyebrow && <span className="yhome-shead__eyebrow">{eyebrow}</span>}
        <h2 className="yhome-shead__title">{title}</h2>
        {subtitle && <p className="yhome-shead__sub">{subtitle}</p>}
      </div>
      {onSeeAll && (
        <button type="button" className="yhome-shead__link" onClick={onSeeAll}>
          {seeAllLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}
    </header>
  );
}

// ─── ProductRail (rail horizontal) ─────────────────────────────────
function ProductRail({ products, loading, count = 8, pharmacy = null }) {
  if (loading) {
    return (
      <div className="yhome-rail">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="yhome-rail__cell yhome-rail__cell--skel">
            <SkeletonProductCard />
          </div>
        ))}
      </div>
    );
  }
  if (!products?.length) return null;
  return (
    <div className="yhome-rail" role="list">
      {products.map((p) => (
        <div key={p.id} className="yhome-rail__cell" role="listitem">
          <ProductTile product={p} size="sm" pharmacy={pharmacy} />
        </div>
      ))}
    </div>
  );
}

// ─── ProductGrid ───────────────────────────────────────────────────
function ProductGrid({ products, loading, count = 8, pharmacy = null }) {
  if (loading) {
    return (
      <div className="yhome-grid">
        {Array.from({ length: count }).map((_, i) => <SkeletonProductCard key={i} />)}
      </div>
    );
  }
  if (!products?.length) return null;
  return (
    <div className="yhome-grid">
      {products.map((p) => (
        <ProductTile key={p.id} product={p} pharmacy={pharmacy} />
      ))}
    </div>
  );
}

// ─── BrandGrid ─────────────────────────────────────────────────────
function BrandGrid({ brands, loading, count = 8 }) {
  if (loading) {
    return (
      <div className="yhome-brand-grid">
        {Array.from({ length: count }).map((_, i) => <SkeletonBrandCard key={i} />)}
      </div>
    );
  }
  if (!brands?.length) return null;
  return (
    <div className="yhome-brand-grid">
      {brands.map((b) => (
        <BrandTile key={b.id || b.name} brand={b} />
      ))}
    </div>
  );
}

// ─── CategoryGrid (calque native Home Catégories — chips ronds) ───
function CategoryGrid({ categories, onPick }) {
  if (!categories?.length) return null;
  return (
    <div className="yhome-catg">
      {categories.slice(0, 12).map((cat) => {
        const slug = cat.slug || cat.id || cat.name;
        const bg = cat.bg_color || presetFor(slug);
        const initial = (cat.name || slug || '?').trim().charAt(0).toUpperCase();
        return (
          <button
            key={slug}
            type="button"
            className="yhome-catg__cell"
            onClick={() => onPick(slug)}
          >
            <span className="yhome-catg__circle" style={{ backgroundColor: bg }}>
              {cat.icon_url ? (
                <img src={cat.icon_url} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="yhome-catg__initial">{initial}</span>
              )}
            </span>
            <span className="yhome-catg__label">{cat.name || slug}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Hero storytelling ─────────────────────────────────────────────
function Hero({ banner, onCta, onCatalog }) {
  const title = banner?.title || 'Ta parapharmacie premium livree a Dakar';
  const subtitle = banner?.subtitle || 'Plus de 5 000 produits authentiques selectionnes, livres en 30 minutes.';
  const cta = banner?.cta_text || 'Explorer le catalogue';
  const eyebrow = banner?.sponsor_name ? `En vedette · ${banner.sponsor_name}` : 'Selection YARAM';
  const bgImage = banner?.image_url || null;

  return (
    <section
      className={`yhome-hero ${bgImage ? 'yhome-hero--has-img' : ''}`}
      style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
    >
      <div className="yhome-hero__scrim" />
      <div className="yhome-hero__inner">
        <span className="yhome-hero__eyebrow">{eyebrow}</span>
        <h1 className="yhome-hero__title">{title}</h1>
        <p className="yhome-hero__sub">{subtitle}</p>
        <div className="yhome-hero__cta-row">
          <button type="button" className="yhome-hero__cta" onClick={onCta}>
            {cta}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
          <button type="button" className="yhome-hero__ghost" onClick={onCatalog}>
            Voir tout le catalogue
          </button>
        </div>
        <div className="yhome-hero__trust">
          <div className="yhome-hero__trust-item">
            <strong>30 min</strong>
            <span>Livraison Dakar</span>
          </div>
          <div className="yhome-hero__trust-item">
            <strong>5 000+</strong>
            <span>Produits authentiques</span>
          </div>
          <div className="yhome-hero__trust-item">
            <strong>+40 marques</strong>
            <span>Selectionnees dermato</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Coupon bienvenue (calque native BIENVENUE10) ──────────────────
function CouponBanner({ onCopy, onDismiss }) {
  return (
    <div className="yhome-coupon">
      <div className="yhome-coupon__disc">
        <strong>-10%</strong>
        <span>1re</span>
      </div>
      <div className="yhome-coupon__text">
        <span className="yhome-coupon__title">Sur ta 1re commande</span>
        <span className="yhome-coupon__sub">des 25 000 FCFA</span>
        <span className="yhome-coupon__hint">avec le code</span>
      </div>
      <button type="button" className="yhome-coupon__code" onClick={onCopy}>
        BIENVENUE10
      </button>
      <button type="button" className="yhome-coupon__x" onClick={onDismiss} aria-label="Fermer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────
export default function ShopHome() {
  const { navigate } = useNav();
  const { user } = useUser() || { user: null };

  const { data: productsRaw = [], isLoading: prodLoading } = useProducts();
  const { data: brandsRaw = [], isLoading: brandsLoading } = useBrands();
  const { data: categoriesRaw = [], isLoading: catLoading } = useCategories();
  const { data: banners = [] } = useBanners();
  const { data: pharmacies = [] } = usePharmacies();
  const favsQ = useMyFavorites(user?.id || 'me');
  const favorites = favsQ?.data || [];

  const [couponDismissed, setCouponDismissed] = useState(false);

  const loading =
    (prodLoading && productsRaw.length === 0) ||
    (brandsLoading && brandsRaw.length === 0);

  // ─── Derivations memoisees ─────────────────────────────────────
  const banner = useMemo(() => {
    const list = (banners || []).filter((b) => b?.active !== false);
    return list[0] || null;
  }, [banners]);

  const activePharmacy = useMemo(
    () => (pharmacies || []).find((p) => p?.active !== false) || null,
    [pharmacies]
  );

  // Marques : celles avec produit_count si dispo, sinon les 8 premieres
  const featuredBrands = useMemo(() => {
    if (!brandsRaw.length) return [];
    const sorted = brandsRaw.slice().sort(
      (a, b) => (Number(b.product_count || 0) - Number(a.product_count || 0))
    );
    return sorted.slice(0, 8);
  }, [brandsRaw]);

  // Pour toi : croise skin_type + favoris (categories deja aimees)
  const pourToi = useMemo(() => {
    if (!productsRaw.length) return [];
    const preferredCats = new Set();
    if (user?.skin_type && SKIN_TYPE_TO_CATS[user.skin_type]) {
      SKIN_TYPE_TO_CATS[user.skin_type].forEach((c) => preferredCats.add(c));
    }
    (favorites || []).forEach((f) => {
      if (f?.category) preferredCats.add(f.category);
    });
    if (preferredCats.size === 0) {
      return productsRaw
        .slice()
        .sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)))
        .slice(0, 10);
    }
    return productsRaw
      .filter((p) => p?.category && preferredCats.has(p.category))
      .sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)))
      .slice(0, 10);
  }, [productsRaw, favorites, user]);

  // Tendances cette semaine (calque native trending = score + review_count)
  const trending = useMemo(() => {
    if (!productsRaw.length) return [];
    return productsRaw
      .slice()
      .sort((a, b) =>
        ((Number(b.review_count) || 0) + (Number(b.score) || 0) / 10)
        - ((Number(a.review_count) || 0) + (Number(a.score) || 0) / 10)
      )
      .slice(0, 12);
  }, [productsRaw]);

  // Nouveautes : produits < 21 jours, sinon les 12 plus recents
  const newest = useMemo(() => {
    if (!productsRaw.length) return [];
    const withDate = productsRaw
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const recent = withDate.filter((p) => daysAgo(p.created_at) <= 21);
    return (recent.length >= 6 ? recent : withDate).slice(0, 12);
  }, [productsRaw]);

  // Bons plans : discount decroissant
  const deals = useMemo(() => {
    return productsRaw
      .map((p) => ({ ...p, __pct: computeDiscountPct(p) }))
      .filter((p) => p.__pct >= 10)
      .sort((a, b) => b.__pct - a.__pct)
      .slice(0, 10);
  }, [productsRaw]);

  // Best-sellers Dakar : review_count desc + stock > 0 (calque native)
  const bestSellers = useMemo(() => {
    if (!productsRaw.length) return [];
    return productsRaw
      .filter((p) => (p.stock ?? 1) > 0)
      .slice()
      .sort((a, b) => {
        const rc = Number(b.review_count || 0) - Number(a.review_count || 0);
        if (rc !== 0) return rc;
        return Number(b.rating || 0) - Number(a.rating || 0);
      })
      .slice(0, 10);
  }, [productsRaw]);

  // Recommande pour vous : score desc (calque native recoPourVous)
  const recoPourVous = useMemo(() => {
    if (!productsRaw.length) return [];
    return productsRaw
      .slice()
      .sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)))
      .slice(0, 10);
  }, [productsRaw]);

  // Fin de stock : stock connu et 1..5
  const finDeStock = useMemo(() => {
    return productsRaw
      .filter((p) => hasStockInfo(p) && p.stock > 0 && p.stock <= 5)
      .slice(0, 10);
  }, [productsRaw]);

  // ─── Handlers navigation ───────────────────────────────────────
  const goSearch = (params = {}) => navigate({ name: 'search', params });
  const goBanner = () => {
    if (!banner) return goSearch();
    if (banner.link_type === 'url' && banner.link_target) {
      window.open(banner.link_target, '_blank');
      return;
    }
    if (banner.link_type === 'category' && banner.link_target) return goSearch({ category: banner.link_target });
    if (banner.link_type === 'brand' && banner.link_target) return navigate({ name: 'brand', id: banner.link_target });
    if (banner.link_type === 'product' && banner.link_target) return navigate({ name: 'product', id: banner.link_target });
    return goSearch();
  };

  const copyCoupon = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText('BIENVENUE10').catch(() => {});
      }
    } catch { /* noop */ }
    navigate('cart');
  };

  const userName = user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || null;

  return (
    <SiteLayout>
      <div className="yhome">
        {/* 1. HERO ─────────────────────────────────────────────────── */}
        <Hero
          banner={banner}
          onCta={goBanner}
          onCatalog={() => goSearch()}
        />

        {/* 2. MARQUES (calque native) ──────────────────────────────── */}
        <section className="yhome-section yhome-section--bg">
          <SectionHead
            title="Marques"
            subtitle="Selection dermato reconnue par nos pharmaciens"
            onSeeAll={() => navigate('brands')}
          />
          <BrandGrid brands={featuredBrands} loading={loading} count={8} />
        </section>

        {/* 3. CATEGORIES (calque native chips ronds) ───────────────── */}
        {(categoriesRaw.length > 0 || catLoading) && (
          <section className="yhome-section">
            <SectionHead
              title="Categories"
              subtitle="Parcourir par univers"
              onSeeAll={() => navigate('categories')}
            />
            <CategoryGrid
              categories={categoriesRaw}
              onPick={(slug) => goSearch({ category: slug })}
            />
          </section>
        )}

        {/* 4. COUPON BIENVENUE (calque native BIENVENUE10) ─────────── */}
        {!couponDismissed && (
          <section className="yhome-section yhome-section--coupon">
            <CouponBanner
              onCopy={copyCoupon}
              onDismiss={() => setCouponDismissed(true)}
            />
          </section>
        )}

        {/* 5. POUR TOI (calque native "Pour toi") ──────────────────── */}
        {(pourToi.length > 0 || loading) && (
          <section className="yhome-section">
            <SectionHead
              title={`Pour toi${userName ? `, ${userName}` : ''}`}
              subtitle="Selection personnalisee sur votre profil et vos favoris"
              onSeeAll={() => goSearch({ tri: 'rating' })}
            />
            <ProductGrid
              products={pourToi.slice(0, 8)}
              loading={loading}
              pharmacy={activePharmacy}
              count={8}
            />
          </section>
        )}

        {/* 6. TENDANCES (calque native "Tendances cette semaine") ─── */}
        {trending.length > 0 && (
          <section className="yhome-section yhome-section--bg">
            <SectionHead
              title="Tendances cette semaine"
              subtitle="Les plus vus et achetes ces 7 derniers jours"
              onSeeAll={() => goSearch({ tri: 'popularity' })}
            />
            <ProductRail
              products={trending}
              loading={loading}
              pharmacy={activePharmacy}
              count={8}
            />
          </section>
        )}

        {/* 7. NOUVEAUTES (calque native "Nouveautes") ──────────────── */}
        <section className="yhome-section">
          <SectionHead
            title="Nouveautes"
            subtitle="Les dernieres references ajoutees au catalogue"
            onSeeAll={() => goSearch({ tri: 'newest' })}
          />
          <ProductRail
            products={newest}
            loading={loading}
            pharmacy={activePharmacy}
            count={8}
          />
        </section>

        {/* 8. BONS PLANS (calque native) ──────────────────────────── */}
        {deals.length > 0 && (
          <section className="yhome-section yhome-section--deals">
            <SectionHead
              title="Bons plans"
              subtitle="Meilleures reductions du moment"
              onSeeAll={() => goSearch({ promo: '1', tri: 'discount' })}
            />
            <ProductGrid
              products={deals.slice(0, 8)}
              loading={false}
              pharmacy={activePharmacy}
              count={8}
            />
          </section>
        )}

        {/* 9. BEST-SELLERS DAKAR (calque native) ──────────────────── */}
        <section className="yhome-section yhome-section--bg">
          <SectionHead
            title="Best-sellers Dakar"
            subtitle="Ce que Dakar achete cette semaine"
            onSeeAll={() => goSearch({ tri: 'popularity' })}
          />
          <ProductGrid
            products={bestSellers.slice(0, 8)}
            loading={loading}
            pharmacy={activePharmacy}
            count={8}
          />
        </section>

        {/* 10. RECOMMANDE POUR VOUS (calque native) ──────────────── */}
        {(recoPourVous.length > 0 || loading) && (
          <section className="yhome-section">
            <SectionHead
              title="Recommande pour vous"
              subtitle="Selection basee sur votre profil"
              onSeeAll={() => goSearch({ tri: 'rating' })}
            />
            <ProductGrid
              products={recoPourVous.slice(0, 8)}
              loading={loading}
              pharmacy={activePharmacy}
              count={8}
            />
          </section>
        )}

        {/* 11. FIN DE STOCK (calque native) ──────────────────────── */}
        {finDeStock.length > 0 && (
          <section className="yhome-section">
            <SectionHead
              title="Fin de stock"
              subtitle="Derniers exemplaires disponibles"
              onSeeAll={() => goSearch({ tri: 'newest' })}
            />
            <ProductRail
              products={finDeStock}
              loading={false}
              pharmacy={activePharmacy}
              count={6}
            />
          </section>
        )}

        {/* 12. TOUS LES PRODUITS (calque native CTA final) ───────── */}
        {productsRaw.length > 0 && (
          <section className="yhome-section">
            <SectionHead
              title="Tous les produits"
              subtitle={`${productsRaw.length} produit${productsRaw.length > 1 ? 's' : ''} disponible${productsRaw.length > 1 ? 's' : ''}`}
              onSeeAll={() => goSearch()}
            />
            <ProductGrid
              products={productsRaw.slice(0, 8)}
              loading={false}
              pharmacy={activePharmacy}
              count={8}
            />
            <div className="yhome-all-cta">
              <button
                type="button"
                className="yhome-all-cta__btn"
                onClick={() => goSearch()}
              >
                Voir tous les {productsRaw.length} produits
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* 13. B2B — Devenir partenaire / livreur ────────────────── */}
        <section className="yhome-section yhome-section--b2b">
          <div className="yhome-b2b">
            <div className="yhome-b2b__card">
              <span className="yhome-b2b__eyebrow">Pharmaciens</span>
              <h3 className="yhome-b2b__title">Rejoignez le reseau YARAM</h3>
              <p className="yhome-b2b__sub">
                Touchez des milliers de clients a Dakar et digitalisez votre officine.
              </p>
              <button
                type="button"
                className="yhome-b2b__cta"
                onClick={() => navigate('partner-application')}
              >
                Devenir pharmacie partenaire
              </button>
            </div>
            <div className="yhome-b2b__card yhome-b2b__card--alt">
              <span className="yhome-b2b__eyebrow">Livreurs</span>
              <h3 className="yhome-b2b__title">Roulez avec YARAM</h3>
              <p className="yhome-b2b__sub">
                Horaires flexibles, paiements a la course, support dedie.
              </p>
              <button
                type="button"
                className="yhome-b2b__cta"
                onClick={() => navigate('driver-application')}
              >
                Devenir livreur
              </button>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
