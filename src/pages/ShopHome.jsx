// ════════════════════════════════════════════════════════════════════
// YARAM — ShopHome (route /shop)
// ────────────────────────────────────────────────────────────────────
// Homepage curatorielle world-class :
//   1. Hero storytelling (categorie du moment / promo vedette)
//   2. Nouveautes de la semaine (rail horizontal)
//   3. Marques mises en avant (grid 4-8)
//   4. Recommandations pour toi (basees sur skin_type / favoris)
//   5. Best-sellers Dakar (top ventes)
//   6. Fin de stock urgent (stock < 5)
//   7. Bons plans jusqu a X %
// ════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
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

// ─── SectionHead ───────────────────────────────────────────────────
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

  // Nouveautes semaine : produits < 21 jours, sinon fallback les 12 plus recents
  const newest = useMemo(() => {
    if (!productsRaw.length) return [];
    const withDate = productsRaw
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const recent = withDate.filter((p) => daysAgo(p.created_at) <= 21);
    return (recent.length >= 6 ? recent : withDate).slice(0, 12);
  }, [productsRaw]);

  // Marques : celles avec produit_count si dispo, sinon les 8 premieres
  const featuredBrands = useMemo(() => {
    if (!brandsRaw.length) return [];
    const sorted = brandsRaw.slice().sort(
      (a, b) => (Number(b.product_count || 0) - Number(a.product_count || 0))
    );
    return sorted.slice(0, 8);
  }, [brandsRaw]);

  // Recommandations pour toi : croise skin_type + favoris (categories deja aimees)
  const recommendations = useMemo(() => {
    if (!productsRaw.length) return [];
    const preferredCats = new Set();
    if (user?.skin_type && SKIN_TYPE_TO_CATS[user.skin_type]) {
      SKIN_TYPE_TO_CATS[user.skin_type].forEach((c) => preferredCats.add(c));
    }
    (favorites || []).forEach((f) => {
      if (f?.category) preferredCats.add(f.category);
    });
    if (preferredCats.size === 0) {
      // Fallback : produits les mieux notes
      return productsRaw
        .slice()
        .sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)))
        .slice(0, 8);
    }
    return productsRaw
      .filter((p) => p?.category && preferredCats.has(p.category))
      .sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)))
      .slice(0, 8);
  }, [productsRaw, favorites, user]);

  // Best-sellers : review_count desc + rating desc
  const bestSellers = useMemo(() => {
    if (!productsRaw.length) return [];
    return productsRaw
      .slice()
      .sort((a, b) => {
        const rc = Number(b.review_count || 0) - Number(a.review_count || 0);
        if (rc !== 0) return rc;
        return Number(b.rating || 0) - Number(a.rating || 0);
      })
      .slice(0, 8);
  }, [productsRaw]);

  // Fin de stock urgent : stock connu et < 5. Si pas de field stock : section masquee.
  const lowStock = useMemo(() => {
    return productsRaw
      .filter((p) => hasStockInfo(p) && p.stock > 0 && p.stock < 5)
      .slice(0, 10);
  }, [productsRaw]);

  // Bons plans : products avec discount reel
  const deals = useMemo(() => {
    return productsRaw
      .map((p) => ({ ...p, __pct: computeDiscountPct(p) }))
      .filter((p) => p.__pct >= 10)
      .sort((a, b) => b.__pct - a.__pct)
      .slice(0, 8);
  }, [productsRaw]);

  const maxDeal = deals[0]?.__pct || 0;

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

  const showDeals = deals.length > 0;
  const showLowStock = lowStock.length > 0;

  return (
    <SiteLayout>
      <div className="yhome">
        <Hero
          banner={banner}
          onCta={goBanner}
          onCatalog={() => goSearch()}
        />

        {/* Nouveautes de la semaine ───────────────────────── */}
        <section className="yhome-section">
          <SectionHead
            eyebrow="Cette semaine"
            title="Nouveautes de la semaine"
            subtitle="Les dernieres reference ajoutees au catalogue"
            onSeeAll={() => goSearch({ tri: 'newest' })}
          />
          <ProductRail
            products={newest}
            loading={loading}
            pharmacy={activePharmacy}
            count={8}
          />
        </section>

        {/* Marques mises en avant ─────────────────────────── */}
        <section className="yhome-section yhome-section--bg">
          <SectionHead
            eyebrow="Marques"
            title="Marques mises en avant"
            subtitle="Selection dermato reconnue par nos pharmaciens"
            onSeeAll={() => navigate('brands')}
            seeAllLabel="Voir toutes les marques"
          />
          <BrandGrid brands={featuredBrands} loading={loading} count={8} />
        </section>

        {/* Recommandations pour toi ────────────────────────── */}
        {(recommendations.length > 0 || loading) && (
          <section className="yhome-section">
            <SectionHead
              eyebrow={user?.skin_type ? `Selection ${user.skin_type}` : 'Pour toi'}
              title="Recommandations pour toi"
              subtitle={
                user?.skin_type
                  ? `Adaptees a ta peau ${user.skin_type} et a tes favoris`
                  : 'Nos produits les mieux notes du moment'
              }
              onSeeAll={() => goSearch({ tri: 'rating' })}
            />
            <ProductGrid
              products={recommendations}
              loading={loading}
              pharmacy={activePharmacy}
              count={8}
            />
          </section>
        )}

        {/* Best-sellers Dakar ──────────────────────────────── */}
        <section className="yhome-section yhome-section--bg">
          <SectionHead
            eyebrow="Top ventes"
            title="Best-sellers a Dakar"
            subtitle="Les preferes de nos clientes cette semaine"
            onSeeAll={() => goSearch({ tri: 'popularity' })}
          />
          <ProductGrid
            products={bestSellers}
            loading={loading}
            pharmacy={activePharmacy}
            count={8}
          />
        </section>

        {/* Fin de stock urgent ─────────────────────────────── */}
        {showLowStock && (
          <section className="yhome-section">
            <SectionHead
              eyebrow="Presque epuise"
              title="Fin de stock imminente"
              subtitle="Derniers exemplaires disponibles dans nos pharmacies"
            />
            <ProductRail
              products={lowStock}
              loading={false}
              pharmacy={activePharmacy}
              count={6}
            />
          </section>
        )}

        {/* Bons plans jusqu a X % ──────────────────────────── */}
        {showDeals && (
          <section className="yhome-section yhome-section--deals">
            <SectionHead
              eyebrow="Offres"
              title={`Bons plans jusqu a -${maxDeal} %`}
              subtitle="Promotions actives dans nos pharmacies partenaires"
              onSeeAll={() => goSearch({ promo: '1', tri: 'discount' })}
              seeAllLabel="Voir toutes les promos"
            />
            <ProductGrid
              products={deals}
              loading={false}
              pharmacy={activePharmacy}
              count={8}
            />
          </section>
        )}

        {/* Bloc B2B (conserve pour continuite marketing) ───── */}
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
