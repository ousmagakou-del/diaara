// ════════════════════════════════════════════════════════════════════
// ProductPage — World-class product page (Amazon / Sephora level)
// Phase C
// ════════════════════════════════════════════════════════════════════
// - ImageZoom desktop hover + touch pinch
// - Vertical thumbnails desktop / horizontal scroll mobile
// - Video preview if product.video_url
// - Sticky buy box: prix, prix barre, economie, stepper, add-to-cart,
//   buy-now (direct checkout), livraison estimee, retour 14j, vendeur
// - Accordions: description, composition, mode d'emploi, precautions, specs
// - Reviews: rating global + repartition + filtres + cards + pagination
// - Souvent achete ensemble (bundle 2-3 produits)
// - Produits similaires carousel
// - Quality badges (Vegan, Bio, Certifie, Fabrication SN)
// - Stock notifs: "Plus que N", "Rupture prevue"
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNav } from '../App';
import SiteLayout from '../components/SiteLayout';
import ImageZoom from '../components/ImageZoom';
import Accordion from '../components/Accordion';
import Stepper from '../components/Stepper';
import ReviewCard from '../components/ReviewCard';
import {
  getAllProducts,
  getAllPharmacies,
  getProductReviews,
} from '../lib/supabase';
import { addToCart } from '../lib/cart';
import { getWhatsAppNumber } from '../lib/utils';
import './ProductPage.css';

// ─── Data helpers ─────────────────────────────────────────────────
async function getProductById(id) {
  if (!id) return null;
  try {
    const all = await getAllProducts();
    return (all || []).find((p) => String(p.id) === String(id)) || null;
  } catch { return null; }
}
async function getProductPharmacies(_productId) {
  try {
    const all = await getAllPharmacies();
    return (all || []).slice(0, 6);
  } catch { return []; }
}

// ─── Format helpers ───────────────────────────────────────────────
const formatPrice = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';

const flagFor = (code) => {
  if (!code) return '';
  const map = {
    FR: 'FR', SN: 'SN', MA: 'MA', US: 'US', DE: 'DE',
    IT: 'IT', ES: 'ES', UK: 'UK', GB: 'GB', CH: 'CH',
    JP: 'JP', KR: 'KR', BE: 'BE', NL: 'NL', CA: 'CA',
  };
  return map[String(code).toUpperCase()] || String(code).toUpperCase();
};

// ─── Delivery estimate helpers ────────────────────────────────────
function estimateDeliveryText(product) {
  if (product?.is_imported) {
    const min = Number(product.lead_time_days) || 7;
    return `Livraison sous ${min}-${min + 7} jours`;
  }
  const now = new Date();
  const cutoff = new Date(now); cutoff.setHours(16, 0, 0, 0);
  const target = new Date(now);
  if (now < cutoff) {
    // livre demain
    target.setDate(target.getDate() + 1);
  } else {
    target.setDate(target.getDate() + 2);
  }
  const day = target.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
  return `Livraison ${day}`;
}

// ─── Icons ────────────────────────────────────────────────────────
const Icon = {
  Star: ({ filled = true, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Check: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  ChevR: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  ChevL: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Truck: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  Shield: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Refresh: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
    </svg>
  ),
  Pin: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Play: ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4"/>
    </svg>
  ),
  Leaf: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6"/>
    </svg>
  ),
  Award: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 22 12 19 17 22 15.79 13.88"/>
    </svg>
  ),
  Info: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
};

// ─── Stars display ────────────────────────────────────────────────
function Stars({ value = 0, size = 16 }) {
  const v = Number(value) || 0;
  return (
    <div className="pp-stars" style={{ '--star-size': `${size}px` }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(v) ? 'pp-star pp-star--on' : 'pp-star'}>
          <Icon.Star size={size} filled={i <= Math.round(v)} />
        </span>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────
const Sk = ({ w = '100%', h = 16, r = 8, style }) => (
  <div className="pp-sk" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

function HeroSkeleton() {
  return (
    <div className="pp-hero">
      <div className="pp-gallery">
        <Sk w="100%" h={520} r={24} />
        <div className="pp-thumbs">
          {[1,2,3,4,5].map((i) => <Sk key={i} w={84} h={84} r={14} />)}
        </div>
      </div>
      <div className="pp-buybox">
        <Sk w={120} h={14} />
        <div style={{ height: 14 }} />
        <Sk w="80%" h={36} />
        <div style={{ height: 10 }} />
        <Sk w={180} h={18} />
        <div style={{ height: 22 }} />
        <Sk w={220} h={48} />
        <div style={{ height: 30 }} />
        <Sk w="100%" h={56} r={16} />
        <div style={{ height: 12 }} />
        <Sk w="100%" h={56} r={16} />
      </div>
    </div>
  );
}

// ─── Quality badges component ─────────────────────────────────────
function QualityBadges({ product }) {
  const badges = [];
  const b = product || {};
  const raw = Array.isArray(b.badges) ? b.badges.map((x) => String(x).toLowerCase()) : [];
  const has = (k) => b[k] || raw.includes(k);
  if (has('vegan')) badges.push({ id: 'vegan', label: 'Vegan', icon: <Icon.Leaf size={14} /> });
  if (has('bio') || has('organic')) badges.push({ id: 'bio', label: 'Bio', icon: <Icon.Leaf size={14} /> });
  if (has('certified') || has('certifie')) badges.push({ id: 'cert', label: 'Certifie', icon: <Icon.Award size={14} /> });
  if (b.origin_country === 'SN' || has('made_in_senegal')) badges.push({ id: 'sn', label: 'Fabrication SN', icon: <Icon.Award size={14} /> });
  if (!badges.length) return null;
  return (
    <div className="pp-quality-badges">
      {badges.map((x) => (
        <span key={x.id} className={`pp-qbadge pp-qbadge--${x.id}`}>
          {x.icon}
          <span>{x.label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Composition with hover explain ───────────────────────────────
function CompositionList({ text }) {
  if (!text) return <p>Composition detaillee disponible sur l'emballage.</p>;
  const items = String(text).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const explain = (item) => {
    const key = item.toLowerCase();
    if (key.includes('aqua') || key.includes('eau')) return 'Solvant principal, base neutre.';
    if (key.includes('glycerin')) return 'Hydratant naturel puissant.';
    if (key.includes('parfum')) return 'Fragrance : peut sensibiliser les peaux reactives.';
    if (key.includes('alcohol')) return 'Alcool denature : effet asechant possible.';
    if (key.includes('acid')) return 'Actif exfoliant / correcteur.';
    if (key.includes('extract')) return 'Extrait vegetal apaisant.';
    return 'Ingredient de formulation.';
  };
  return (
    <ul className="pp-comp-list">
      {items.map((it, i) => (
        <li key={i} className="pp-comp-li" title={explain(it)}>
          <span className="pp-comp-name">{it}</span>
          <span className="pp-comp-help"><Icon.Info /></span>
          <span className="pp-comp-tip">{explain(it)}</span>
        </li>
      ))}
    </ul>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function ProductPage() {
  const { navigate, route } = useNav();
  const id = route?.params?.id || route?.id;

  // Data
  const [product, setProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmaciesLoading, setPharmaciesLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [related, setRelated] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  // UI
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [videoOpen, setVideoOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Reviews UI
  const [reviewFilter, setReviewFilter] = useState({ rating: 0, withPhoto: false });
  const [reviewLimit, setReviewLimit] = useState(4);

  // Bundle "souvent achete ensemble"
  const [bundleSel, setBundleSel] = useState(new Set());

  // ─── Load data ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setProductError(true); setProductLoading(false); return; }
    setProductLoading(true);
    setPharmaciesLoading(true);
    setReviewsLoading(true);
    setRelatedLoading(true);
    setProductError(false);
    setGalleryIdx(0);
    setQty(1);
    setReviewLimit(4);
    setBundleSel(new Set());
    window.scrollTo(0, 0);

    Promise.allSettled([
      getProductById(id),
      getProductPharmacies(id).catch(() => []),
      getProductReviews(id).catch(() => []),
      getAllProducts().catch(() => []),
    ]).then(([pRes, phRes, rvRes, allRes]) => {
      if (pRes.status === 'fulfilled' && pRes.value) {
        setProduct(pRes.value); setProductError(false);
      } else { setProductError(true); }
      setProductLoading(false);

      setPharmacies(phRes.status === 'fulfilled' ? (phRes.value || []) : []);
      setPharmaciesLoading(false);

      setReviews(rvRes.status === 'fulfilled' ? (rvRes.value || []) : []);
      setReviewsLoading(false);

      if (allRes.status === 'fulfilled' && pRes.status === 'fulfilled' && pRes.value) {
        const all = allRes.value || [];
        const self = pRes.value;
        const same = all.filter(
          (x) => x.id !== self.id &&
            (x.brand_name === self.brand_name || x.category_name === self.category_name)
        );
        setRelated(same.slice(0, 8));
      } else {
        setRelated([]);
      }
      setRelatedLoading(false);
    });
  }, [id]);

  // ─── Gallery images ───────────────────────────────────────────
  const images = useMemo(() => {
    if (!product) return [];
    const main = product.image_url || product.img || '';
    const extras = product.images || product.gallery || [];
    const list = [main, ...(Array.isArray(extras) ? extras : [])].filter(Boolean);
    const unique = Array.from(new Set(list));
    return unique.length ? unique : [main].filter(Boolean);
  }, [product]);

  const videoUrl = product?.video_url || product?.video || null;

  // ─── Reviews stats ────────────────────────────────────────────
  const reviewStats = useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return { avg: 0, count: 0, dist: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, withPhotoCount: 0 };
    }
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0; let withPhotoCount = 0;
    reviews.forEach((r) => {
      const rt = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
      dist[rt] = (dist[rt] || 0) + 1;
      sum += rt;
      if (Array.isArray(r.photos) && r.photos.length > 0) withPhotoCount += 1;
    });
    return { avg: sum / reviews.length, count: reviews.length, dist, withPhotoCount };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (reviewFilter.rating > 0 && Math.round(Number(r.rating) || 0) !== reviewFilter.rating) return false;
      if (reviewFilter.withPhoto && !(Array.isArray(r.photos) && r.photos.length > 0)) return false;
      return true;
    });
  }, [reviews, reviewFilter]);

  // ─── Pricing ──────────────────────────────────────────────────
  const priceCurrent = Number(product?.price) || 0;
  const priceOld = Number(product?.old_price || product?.compare_at_price || 0) || 0;
  const savings = priceOld > priceCurrent ? priceOld - priceCurrent : 0;
  const savingsPct = priceOld > 0 && savings > 0 ? Math.round((savings / priceOld) * 100) : 0;

  // ─── Stock notif ──────────────────────────────────────────────
  const stockQty = Number(product?.stock_qty);
  const stockState = product
    ? product.in_stock === false || stockQty === 0
      ? { label: 'Rupture prevue', cls: 'out', msg: 'Bientot en reappro' }
      : Number.isFinite(stockQty) && stockQty > 0 && stockQty < 5
      ? { label: `Plus que ${stockQty} en stock`, cls: 'low', msg: 'Depeche-toi' }
      : { label: 'En stock', cls: 'ok', msg: 'Livre rapidement' }
    : null;

  // ─── Bundle "souvent achete ensemble" (max 3 = self + 2 related) ──
  const bundle = useMemo(() => {
    if (!product || related.length === 0) return [];
    return [product, ...related.slice(0, 2)];
  }, [product, related]);

  const bundleTotal = useMemo(() => {
    return bundle.reduce((s, p) => bundleSel.has(p.id) ? s + (Number(p.price) || 0) : s, 0);
  }, [bundle, bundleSel]);

  // Auto-select main product in bundle by default
  useEffect(() => {
    if (product) {
      setBundleSel((prev) => {
        const next = new Set(prev);
        next.add(product.id);
        return next;
      });
    }
  }, [product]);

  // ─── Handlers ─────────────────────────────────────────────────
  const buildCartPayload = useCallback((p, ph, q) => ({
    product: {
      id: p.id, name: p.name, brand: p.brand_name || '',
      img: (Array.isArray(p.images) ? p.images[0] : null) || p.image_url || p.img || '',
      price: p.price, is_imported: !!p.is_imported,
      lead_time_days: p.lead_time_days || 1, origin_country: p.origin_country || 'SN',
    },
    pharmacy: ph, qty: q,
  }), []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const handleAddToCart = () => {
    if (!product) return;
    const pharmacy = pharmacies?.[0] || { id: 'default', name: 'YARAM' };
    addToCart(buildCartPayload(product, pharmacy, qty));
    showToast('Ajoute au panier');
  };

  const handleBuyNow = () => {
    if (!product) return;
    const pharmacy = pharmacies?.[0] || { id: 'default', name: 'YARAM' };
    addToCart(buildCartPayload(product, pharmacy, qty));
    navigate('checkout');
  };

  const handleBuyAtPharmacy = (ph) => {
    if (!product) return;
    addToCart(buildCartPayload(product, ph, qty));
    navigate('cart');
  };

  const handleAddBundle = () => {
    if (!product) return;
    const pharmacy = pharmacies?.[0] || { id: 'default', name: 'YARAM' };
    bundle.forEach((p) => {
      if (bundleSel.has(p.id)) addToCart(buildCartPayload(p, pharmacy, 1));
    });
    showToast('Bundle ajoute au panier');
  };

  const toggleBundleItem = (pid) => {
    setBundleSel((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  // ─── Accordion items ──────────────────────────────────────────
  const accordionItems = useMemo(() => {
    if (!product) return [];
    return [
      {
        id: 'description',
        title: 'Description',
        content: (
          <p>{product.description || product.long_desc ||
            'Decouvrez ce produit selectionne par notre equipe. Authenticite garantie, livraison rapide partout au Senegal.'}</p>
        ),
      },
      {
        id: 'composition',
        title: 'Composition / Ingredients',
        subtitle: 'Survolez chaque ingredient',
        content: <CompositionList text={product.composition || product.ingredients || product.inci} />,
      },
      {
        id: 'usage',
        title: "Mode d'emploi",
        content: (
          <p>{product.usage || product.instructions ||
            'Suivre les indications du fabricant ou les conseils de votre pharmacien.'}</p>
        ),
      },
      {
        id: 'precautions',
        title: 'Precautions',
        content: (
          <p>{product.precautions || product.warnings ||
            'Tenir hors de portee des enfants. En cas de doute, demandez conseil a votre pharmacien.'}</p>
        ),
      },
      {
        id: 'specs',
        title: 'Specifications techniques',
        content: (
          <ul className="pp-spec-list">
            {product.volume && <li><strong>Contenance :</strong> {product.volume}</li>}
            {product.weight && <li><strong>Poids :</strong> {product.weight}</li>}
            {product.ean && <li><strong>EAN :</strong> {product.ean}</li>}
            {product.reference && <li><strong>Reference :</strong> {product.reference}</li>}
            {product.origin_country && <li><strong>Origine :</strong> {flagFor(product.origin_country)}</li>}
            {product.brand_name && <li><strong>Marque :</strong> {product.brand_name}</li>}
            {product.category_name && <li><strong>Categorie :</strong> {product.category_name}</li>}
          </ul>
        ),
      },
    ];
  }, [product]);

  // ─── Error state ──────────────────────────────────────────────
  if (productError && !productLoading) {
    return (
      <SiteLayout>
        <div className="pp-root">
          <div className="pp-empty pp-empty--center">
            <h2>Produit introuvable</h2>
            <p>Ce produit n'existe pas ou a ete retire du catalogue.</p>
            <button className="pp-btn-primary" onClick={() => navigate('shop')}>
              Retour au catalogue
            </button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const vendorName = pharmacies?.[0]?.name || 'YARAM Pharmacie Officielle';

  return (
    <SiteLayout>
      <div className="pp-root">
        {/* Breadcrumb — aligne native : Accueil > Categorie > Nom */}
        <nav className="pp-breadcrumb" aria-label="Fil d'Ariane">
          <button onClick={() => navigate('landing')}>Accueil</button>
          {product?.category_name ? (
            <>
              <Icon.ChevR />
              <button onClick={() => navigate({ name: 'search', params: { category: product.category_id || product.category_name } })}>
                <span style={{ textTransform: 'capitalize' }}>{product.category_name}</span>
              </button>
            </>
          ) : (
            <>
              <Icon.ChevR />
              <button onClick={() => navigate('shop')}>Catalogue</button>
            </>
          )}
          {product?.name && (
            <>
              <Icon.ChevR />
              <span className="pp-breadcrumb-current">{product.name}</span>
            </>
          )}
        </nav>

        {/* ─── HERO ─── */}
        {productLoading ? <HeroSkeleton /> : (
          <section className="pp-hero pp-hero--v2">
            {/* LEFT — Thumbs vertical (desktop) */}
            <div className="pp-thumbs pp-thumbs--vert pp-show-desktop">
              {images.slice(0, 8).map((src, i) => (
                <button
                  key={i}
                  className={i === galleryIdx ? 'pp-thumb pp-thumb--active' : 'pp-thumb'}
                  onClick={() => { setGalleryIdx(i); setVideoOpen(false); }}
                  aria-label={`Image ${i + 1}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
              {videoUrl && (
                <button
                  className={videoOpen ? 'pp-thumb pp-thumb--active pp-thumb-video' : 'pp-thumb pp-thumb-video'}
                  onClick={() => setVideoOpen(true)}
                  aria-label="Voir la video"
                >
                  <div className="pp-thumb-video-inner">
                    <Icon.Play size={18} />
                    <span>Video</span>
                  </div>
                </button>
              )}
            </div>

            {/* MAIN gallery */}
            <div className="pp-gallery pp-gallery--v2">
              <div className="pp-gallery-main pp-gallery-main--v2">
                {videoOpen && videoUrl ? (
                  <div className="pp-video-wrap">
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      playsInline
                      className="pp-video"
                    />
                    <button
                      className="pp-video-close"
                      onClick={() => setVideoOpen(false)}
                      aria-label="Fermer la video"
                    >
                      Retour photo
                    </button>
                  </div>
                ) : images[galleryIdx] ? (
                  <ImageZoom
                    src={images[galleryIdx]}
                    alt={product?.name || ''}
                    zoomLevel={2.4}
                    onError={(e) => { e.currentTarget.style.opacity = 0.3; }}
                  />
                ) : (
                  <div className="pp-gallery-placeholder">Image indisponible</div>
                )}

                {savingsPct > 0 && (
                  <div className="pp-badge-save">-{savingsPct}%</div>
                )}
              </div>

              {/* Horizontal thumbs (mobile) */}
              <div className="pp-thumbs pp-thumbs--horiz pp-show-mobile">
                {images.slice(0, 8).map((src, i) => (
                  <button
                    key={i}
                    className={i === galleryIdx ? 'pp-thumb pp-thumb--active' : 'pp-thumb'}
                    onClick={() => { setGalleryIdx(i); setVideoOpen(false); }}
                    aria-label={`Image ${i + 1}`}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
                {videoUrl && (
                  <button
                    className="pp-thumb pp-thumb-video"
                    onClick={() => setVideoOpen(true)}
                    aria-label="Video"
                  >
                    <div className="pp-thumb-video-inner">
                      <Icon.Play size={16} />
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* BUY BOX (sticky) */}
            <aside className="pp-buybox pp-buybox--v2">
              {product?.brand_name && (
                <button
                  className="pp-brand-link"
                  onClick={() => product.brand_id && navigate({ name: 'brand', params: { id: product.brand_id } })}
                >
                  {product.brand_name}
                </button>
              )}
              <h1 className="pp-title">{product?.name}</h1>

              <div className="pp-rating-row">
                <Stars value={reviewStats.avg || 0} size={16} />
                <button
                  type="button"
                  className="pp-rating-text pp-rating-link"
                  onClick={() => {
                    const el = document.getElementById('pp-reviews');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {reviewStats.count > 0
                    ? `${reviewStats.avg.toFixed(1)} (${reviewStats.count} avis)`
                    : 'Aucun avis'}
                </button>
              </div>

              <QualityBadges product={product} />

              <div className="pp-price-block">
                <div className="pp-price">{formatPrice(priceCurrent)}</div>
                {priceOld > priceCurrent && (
                  <>
                    <div className="pp-price-old">{formatPrice(priceOld)}</div>
                    <div className="pp-price-save">Economie {formatPrice(savings)}</div>
                  </>
                )}
              </div>

              {product?.is_imported && (
                <div className="pp-import-badge">
                  <span className="pp-import-flag">{flagFor(product.origin_country)}</span>
                  <span>Import {product.origin_country || ''}</span>
                </div>
              )}

              <div className="pp-delivery">
                <Icon.Truck size={18} />
                <span>{estimateDeliveryText(product)}</span>
              </div>

              {stockState && (
                <div className={`pp-stock pp-stock--${stockState.cls}`}>
                  <strong>{stockState.label}</strong>
                  {stockState.msg && <span> · {stockState.msg}</span>}
                </div>
              )}

              {/* Quantity */}
              <div className="pp-qty-row">
                <label className="pp-qty-label">Quantite</label>
                <Stepper
                  value={qty}
                  onChange={setQty}
                  min={1}
                  max={99}
                  size="md"
                  disabled={stockState?.cls === 'out'}
                />
              </div>

              <button
                className="pp-btn-primary pp-btn-add"
                onClick={handleAddToCart}
                disabled={stockState?.cls === 'out'}
              >
                {stockState?.cls === 'out'
                  ? 'Indisponible'
                  : product?.is_imported
                    ? `Précommander · ${formatPrice(priceCurrent * qty)}`
                    : `Ajouter au panier · ${formatPrice(priceCurrent * qty)}`}
              </button>

              <button
                className="pp-btn-buy-now"
                onClick={handleBuyNow}
                disabled={stockState?.cls === 'out'}
              >
                Acheter maintenant
              </button>

              {/* CTA Conseil WhatsApp (aligne native l.454-473) */}
              <button
                type="button"
                className="pp-btn-whatsapp"
                onClick={() => {
                  const msg = `Bonjour, j'aimerais des conseils sur ${product?.name || ''}${product?.brand_name ? ` (${product.brand_name})` : ''}`;
                  const num = String(getWhatsAppNumber() || '').replace(/[^\d]/g, '');
                  if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.48A11.9 11.9 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.98L0 24l6.2-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52zM12 21.82a9.83 9.83 0 0 1-5.02-1.38l-.36-.21-3.68.96.98-3.59-.24-.37A9.82 9.82 0 1 1 21.82 12c0 5.42-4.4 9.82-9.82 9.82zm5.4-7.36c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.62-.93-2.22-.24-.58-.5-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.22 5.08 4.52.71.3 1.26.48 1.7.62.71.22 1.36.19 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/>
                </svg>
                <span>Conseil WhatsApp</span>
              </button>

              <div className="pp-vendor-line">
                <span className="pp-vendor-label">Vendu par</span>
                <button
                  className="pp-vendor-name"
                  onClick={() => navigate('pharmacies')}
                >
                  {vendorName}
                </button>
              </div>

              <ul className="pp-trust">
                <li><Icon.Shield size={16} /> Authentique garanti</li>
                <li><Icon.Truck size={16} /> Livraison rapide</li>
                <li><Icon.Refresh size={16} /> Retours 14 jours</li>
              </ul>
            </aside>
          </section>
        )}

        {/* ─── AVANTAGES CLES (aligne native l.423-435) ─── */}
        {!productLoading && Array.isArray(product?.key_benefits) && product.key_benefits.length > 0 && (
          <section className="pp-section pp-section--benefits">
            <h2 className="pp-h2">Avantages cles</h2>
            <ul className="pp-benefits-list">
              {product.key_benefits.slice(0, 6).map((b, i) => (
                <li key={i} className="pp-benefit-li">
                  <span className="pp-benefit-check"><Icon.Check size={14} /></span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ─── SOUVENT ACHETE ENSEMBLE ─── */}
        {!productLoading && bundle.length >= 2 && (
          <section className="pp-section pp-section--bundle">
            <h2 className="pp-h2">Souvent achete ensemble</h2>
            <div className="pp-bundle">
              <div className="pp-bundle-items">
                {bundle.map((p, i) => (
                  <div key={p.id} className="pp-bundle-item-wrap">
                    {i > 0 && <span className="pp-bundle-plus" aria-hidden>+</span>}
                    <label className={bundleSel.has(p.id) ? 'pp-bundle-item is-checked' : 'pp-bundle-item'}>
                      <input
                        type="checkbox"
                        checked={bundleSel.has(p.id)}
                        onChange={() => toggleBundleItem(p.id)}
                      />
                      <div className="pp-bundle-img">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} loading="lazy" />
                        ) : (
                          <div className="pp-bundle-ph">—</div>
                        )}
                      </div>
                      <div className="pp-bundle-info">
                        <div className="pp-bundle-brand">{p.brand_name || ''}</div>
                        <div className="pp-bundle-name">{p.name}</div>
                        <div className="pp-bundle-price">{formatPrice(p.price)}</div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              <div className="pp-bundle-cta">
                <div className="pp-bundle-total-label">Total du bundle</div>
                <div className="pp-bundle-total">{formatPrice(bundleTotal)}</div>
                <button
                  className="pp-btn-primary"
                  onClick={handleAddBundle}
                  disabled={bundleSel.size === 0}
                >
                  Ajouter le bundle au panier
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ─── INFO ACCORDIONS ─── */}
        <section className="pp-section pp-section--info">
          <h2 className="pp-h2">A propos du produit</h2>
          {productLoading ? (
            <Sk w="100%" h={280} r={16} />
          ) : (
            <Accordion items={accordionItems} defaultOpen="description" />
          )}
        </section>

        {/* ─── PHARMACIES ─── */}
        <section id="pp-pharmacies" className="pp-section">
          <h2 className="pp-h2">Pharmacies qui ont ce produit</h2>
          {pharmaciesLoading ? (
            <div className="pp-pharm-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="pp-pharm-card">
                  <Sk w="60%" h={18} />
                  <div style={{ height: 8 }} />
                  <Sk w="80%" h={14} />
                  <div style={{ height: 16 }} />
                  <Sk w="100%" h={44} r={12} />
                </div>
              ))}
            </div>
          ) : pharmacies.length === 0 ? (
            <div className="pp-empty"><p>Bientot disponible dans nos pharmacies partenaires</p></div>
          ) : (
            <div className="pp-pharm-grid">
              {pharmacies.map((ph) => (
                <div key={ph.id} className="pp-pharm-card">
                  <div className="pp-pharm-head">
                    <h3 className="pp-pharm-name">{ph.name}</h3>
                    {ph.distance != null && (
                      <span className="pp-pharm-dist">{Number(ph.distance).toFixed(1)} km</span>
                    )}
                  </div>
                  <p className="pp-pharm-addr"><Icon.Pin /> {ph.address || 'Dakar'}</p>
                  <div className="pp-pharm-foot">
                    <span className="pp-pharm-price">{formatPrice(ph.price || product?.price)}</span>
                    <button className="pp-btn-primary pp-btn-sm" onClick={() => handleBuyAtPharmacy(ph)}>
                      Commander
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── REVIEWS ─── */}
        <section id="pp-reviews" className="pp-section pp-section--reviews">
          <h2 className="pp-h2">Avis clients</h2>
          {reviewsLoading ? (
            <div className="pp-reviews-grid">
              <Sk w="100%" h={140} r={16} />
              <div>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <Sk w="100%" h={64} r={14} />
                  </div>
                ))}
              </div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="pp-empty"><p>Sois la premiere personne a donner ton avis</p></div>
          ) : (
            <div className="pp-reviews-grid">
              <div className="pp-reviews-summary">
                <div className="pp-reviews-avg">
                  <div className="pp-reviews-avg-num">{reviewStats.avg.toFixed(1)}</div>
                  <Stars value={reviewStats.avg} size={20} />
                  <div className="pp-reviews-avg-count">{reviewStats.count} avis</div>
                </div>
                <div className="pp-reviews-dist">
                  {[5, 4, 3, 2, 1].map((r) => {
                    const pct = reviewStats.count ? (reviewStats.dist[r] / reviewStats.count) * 100 : 0;
                    const active = reviewFilter.rating === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        className={active ? 'pp-dist-row is-active' : 'pp-dist-row'}
                        onClick={() => setReviewFilter((f) => ({ ...f, rating: active ? 0 : r }))}
                        title={`Filtrer ${r} etoiles`}
                      >
                        <span className="pp-dist-label">{r} etoile{r > 1 ? 's' : ''}</span>
                        <div className="pp-dist-bar">
                          <div className="pp-dist-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="pp-dist-pct">{reviewStats.dist[r]}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="pp-reviews-filters">
                  <button
                    type="button"
                    className={reviewFilter.rating === 0 && !reviewFilter.withPhoto ? 'pp-rf-chip is-active' : 'pp-rf-chip'}
                    onClick={() => setReviewFilter({ rating: 0, withPhoto: false })}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    className={reviewFilter.withPhoto ? 'pp-rf-chip is-active' : 'pp-rf-chip'}
                    onClick={() => setReviewFilter((f) => ({ ...f, withPhoto: !f.withPhoto }))}
                  >
                    Avec photo ({reviewStats.withPhotoCount})
                  </button>
                </div>
              </div>

              <div className="pp-reviews-list">
                {filteredReviews.slice(0, reviewLimit).map((r) => (
                  <ReviewCard key={r.id || `${r.author_name}-${r.created_at}`} review={r} />
                ))}
                {filteredReviews.length === 0 && (
                  <div className="pp-empty pp-empty--soft">
                    <p>Aucun avis pour ce filtre.</p>
                  </div>
                )}
                {filteredReviews.length > reviewLimit && (
                  <button
                    className="pp-btn-ghost pp-reviews-more"
                    onClick={() => setReviewLimit((n) => n + 4)}
                  >
                    Charger plus ({filteredReviews.length - reviewLimit} restants)
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ─── PRODUITS SIMILAIRES ─── */}
        <section className="pp-section pp-section--related">
          <h2 className="pp-h2">Produits similaires</h2>
          {relatedLoading ? (
            <div className="pp-carousel">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="pp-rel-card">
                  <Sk w="100%" h={180} r={16} />
                  <div style={{ height: 10 }} />
                  <Sk w="50%" h={12} />
                  <div style={{ height: 6 }} />
                  <Sk w="80%" h={16} />
                  <div style={{ height: 10 }} />
                  <Sk w="40%" h={20} />
                </div>
              ))}
            </div>
          ) : related.length === 0 ? null : (
            <div className="pp-carousel">
              {related.map((p) => (
                <article
                  key={p.id}
                  className="pp-rel-card"
                  onClick={() => navigate({ name: 'product', params: { id: p.id } })}
                >
                  <div className="pp-rel-img-wrap">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="pp-rel-img" />
                    ) : (
                      <div className="pp-rel-placeholder">—</div>
                    )}
                  </div>
                  <div className="pp-rel-brand">{p.brand_name}</div>
                  <h3 className="pp-rel-name">{p.name}</h3>
                  <div className="pp-rel-foot">
                    <span className="pp-rel-price">{formatPrice(p.price)}</span>
                    <button
                      className="pp-rel-add"
                      onClick={(e) => {
                        e.stopPropagation();
                        const pharmacy = pharmacies?.[0] || { id: 'default', name: 'YARAM' };
                        addToCart(buildCartPayload(p, pharmacy, 1));
                        showToast('Ajoute au panier');
                      }}
                      aria-label="Ajouter au panier"
                    >
                      +
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Mobile sticky bar — qty + CTA total (aligne native l.496-571) */}
        {product && (
          <div className="pp-mobile-bar pp-show-mobile">
            <div className="pp-mobile-qty" aria-label="Quantite">
              <button
                type="button"
                className="pp-mobile-qty-btn"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Diminuer"
              >
                −
              </button>
              <span className="pp-mobile-qty-val">{qty}</span>
              <button
                type="button"
                className="pp-mobile-qty-btn pp-mobile-qty-btn--plus"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                aria-label="Augmenter"
              >
                +
              </button>
            </div>
            <button
              className="pp-btn-primary pp-mobile-cta"
              onClick={handleAddToCart}
              disabled={stockState?.cls === 'out'}
            >
              {stockState?.cls === 'out'
                ? 'Indisponible'
                : product?.is_imported
                  ? `Précommander · ${formatPrice(priceCurrent * qty)}`
                  : `Ajouter · ${formatPrice(priceCurrent * qty)}`}
            </button>
          </div>
        )}

        {toast && (
          <div className="pp-toast">
            <Icon.Check size={18} /> {toast}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
