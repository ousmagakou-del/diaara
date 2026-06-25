// ════════════════════════════════════════════════════════════════════
// ProductPage — Page produit premium (desktop-first, Uber Eats style)
// ════════════════════════════════════════════════════════════════════
// Route : /product/:id  (remplace l'ancienne version PWA mobile-first)
// Wrappée dans SiteLayout (header + footer globaux).
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNav } from '../App';
import SiteLayout from '../components/SiteLayout';
import {
  getAllProducts,
  getAllPharmacies,
  getProductReviews,
} from '../lib/supabase';
import { addToCart } from '../lib/cart';

// Fallbacks : ces helpers n'existent pas en lib, on les construit ici à partir
// des fonctions disponibles (getAllProducts + getAllPharmacies).
async function getProductById(id) {
  if (!id) return null;
  try {
    const all = await getAllProducts();
    return (all || []).find((p) => String(p.id) === String(id)) || null;
  } catch { return null; }
}
async function getProductPharmacies(_productId) {
  // Pas de mapping product↔pharmacie en DB côté lib pour l'instant
  // → on retourne les pharmacies actives (toutes peuvent en théorie commander)
  try {
    const all = await getAllPharmacies();
    return (all || []).slice(0, 6);
  } catch { return []; }
}
import './ProductPage.css';

// ─── Helpers ──────────────────────────────────────────────────────
const formatPrice = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';

const flagFor = (code) => {
  if (!code) return '🌍';
  const map = {
    FR: '🇫🇷', SN: '🇸🇳', MA: '🇲🇦', US: '🇺🇸', DE: '🇩🇪',
    IT: '🇮🇹', ES: '🇪🇸', UK: '🇬🇧', GB: '🇬🇧', CH: '🇨🇭',
    JP: '🇯🇵', KR: '🇰🇷', BE: '🇧🇪', NL: '🇳🇱', CA: '🇨🇦',
  };
  return map[String(code).toUpperCase()] || '🌍';
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Icônes SVG inline ────────────────────────────────────────────
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
  ChevD: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
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
  Plus: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Minus: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
};

// ─── Rating Stars ─────────────────────────────────────────────────
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

// ─── Skeleton blocks ──────────────────────────────────────────────
const Sk = ({ w = '100%', h = 16, r = 8, style }) => (
  <div className="pp-sk" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

function HeroSkeleton() {
  return (
    <div className="pp-hero">
      <div className="pp-gallery">
        <Sk w="100%" h={520} r={24} />
        <div className="pp-thumbs">
          {[1, 2, 3, 4, 5].map((i) => <Sk key={i} w={84} h={84} r={14} />)}
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

// ─── Main component ───────────────────────────────────────────────
export default function ProductPage() {
  const { navigate, route } = useNav();
  const id = route?.params?.id || route?.id;

  // Data state
  const [product, setProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState(false);

  const [pharmacies, setPharmacies] = useState([]);
  const [pharmaciesLoading, setPharmaciesLoading] = useState(true);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [related, setRelated] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  // UI state
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [openAccordion, setOpenAccordion] = useState('description');
  const [toast, setToast] = useState(null);

  // ─── Load everything in parallel ────────────────────────────────
  useEffect(() => {
    if (!id) {
      setProductError(true);
      setProductLoading(false);
      return;
    }
    setProductLoading(true);
    setPharmaciesLoading(true);
    setReviewsLoading(true);
    setRelatedLoading(true);
    setProductError(false);
    setGalleryIdx(0);
    setQty(1);
    window.scrollTo(0, 0);

    Promise.allSettled([
      getProductById(id),
      getProductPharmacies(id).catch(() => []),
      getProductReviews(id).catch(() => []),
      getAllProducts().catch(() => []),
    ]).then(([pRes, phRes, rvRes, allRes]) => {
      // Product
      if (pRes.status === 'fulfilled' && pRes.value) {
        setProduct(pRes.value);
        setProductError(false);
      } else {
        setProductError(true);
      }
      setProductLoading(false);

      // Pharmacies
      setPharmacies(phRes.status === 'fulfilled' ? (phRes.value || []) : []);
      setPharmaciesLoading(false);

      // Reviews
      setReviews(rvRes.status === 'fulfilled' ? (rvRes.value || []) : []);
      setReviewsLoading(false);

      // Related (filter same brand/category, exclude self)
      if (allRes.status === 'fulfilled' && pRes.status === 'fulfilled' && pRes.value) {
        const all = allRes.value || [];
        const self = pRes.value;
        const same = all.filter(
          (x) =>
            x.id !== self.id &&
            (x.brand_name === self.brand_name || x.category_name === self.category_name)
        );
        setRelated(same.slice(0, 8));
      } else {
        setRelated([]);
      }
      setRelatedLoading(false);
    });
  }, [id]);

  // ─── Gallery images ─────────────────────────────────────────────
  const images = useMemo(() => {
    if (!product) return [];
    const main = product.image_url || product.img || '';
    const extras = product.images || product.gallery || [];
    const list = [main, ...(Array.isArray(extras) ? extras : [])].filter(Boolean);
    // Pad with placeholders so we have a nice thumb strip
    const unique = Array.from(new Set(list));
    return unique.length ? unique : [main].filter(Boolean);
  }, [product]);

  // ─── Reviews stats ──────────────────────────────────────────────
  const reviewStats = useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return { avg: 0, count: 0, dist: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    reviews.forEach((r) => {
      const rt = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
      dist[rt] = (dist[rt] || 0) + 1;
      sum += rt;
    });
    return { avg: sum / reviews.length, count: reviews.length, dist };
  }, [reviews]);

  // ─── Handlers ───────────────────────────────────────────────────
  const handleAddToCart = () => {
    if (!product) return;
    const pharmacy =
      pharmacies && pharmacies.length > 0
        ? pharmacies[0]
        : { id: 'default', name: 'YARAM' };
    addToCart({
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand_name || '',
        img: images[0] || product.image_url || '',
        price: product.price,
        is_imported: !!product.is_imported,
        lead_time_days: product.lead_time_days || 1,
        origin_country: product.origin_country || 'SN',
      },
      pharmacy,
      qty,
    });
    setToast('Ajouté au panier');
    setTimeout(() => setToast(null), 2200);
  };

  const handleBuyAtPharmacy = (ph) => {
    if (!product) return;
    addToCart({
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand_name || '',
        img: images[0] || product.image_url || '',
        price: ph.price || product.price,
        is_imported: !!product.is_imported,
        lead_time_days: product.lead_time_days || 1,
        origin_country: product.origin_country || 'SN',
      },
      pharmacy: ph,
      qty,
    });
    navigate('cart');
  };

  // ─── Stock indicator ────────────────────────────────────────────
  const stockState = product
    ? product.in_stock === false
      ? { label: 'Indisponible', cls: 'out', icon: '✗' }
      : product.stock_qty != null && Number(product.stock_qty) < 5
      ? { label: 'Stock limité', cls: 'low', icon: '⚠' }
      : { label: 'En stock', cls: 'ok', icon: '✓' }
    : null;

  // ─── Tab content ────────────────────────────────────────────────
  const tabs = [
    { id: 'description', label: 'Description' },
    { id: 'composition', label: 'Composition' },
    { id: 'usage', label: 'Mode d\'emploi' },
    { id: 'precautions', label: 'Précautions' },
  ];

  const renderTabBody = (id) => {
    if (!product) return null;
    const txt =
      id === 'description'
        ? product.description ||
          'Découvrez ce produit sélectionné par notre équipe d\'experts. Authenticité garantie, livraison rapide partout au Sénégal.'
        : id === 'composition'
        ? product.composition ||
          product.ingredients ||
          'Composition détaillée disponible sur l\'emballage. Référez-vous à la notice fournie avec le produit.'
        : id === 'usage'
        ? product.usage ||
          product.instructions ||
          'Suivre les indications du fabricant ou les conseils de votre pharmacien.'
        : product.precautions ||
          product.warnings ||
          'Tenir hors de portée des enfants. En cas de doute, demandez conseil à votre pharmacien.';
    return <p className="pp-tab-text">{txt}</p>;
  };

  // ─── Error: product not found ───────────────────────────────────
  if (productError && !productLoading) {
    return (
      <SiteLayout>
        <div className="pp-root">
          <div className="pp-empty pp-empty--center">
            <div className="pp-empty-emoji">🔍</div>
            <h2>Produit introuvable</h2>
            <p>Ce produit n'existe pas ou a été retiré du catalogue.</p>
            <button className="pp-btn-primary" onClick={() => navigate('shop')}>
              Retour au catalogue
            </button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="pp-root">
        {/* ─── Breadcrumb ─── */}
        <nav className="pp-breadcrumb" aria-label="Fil d'Ariane">
          <button onClick={() => navigate('landing')}>Accueil</button>
          <Icon.ChevR />
          <button onClick={() => navigate('shop')}>Catalogue</button>
          {product?.brand_name && (
            <>
              <Icon.ChevR />
              <button onClick={() => product.brand_id && navigate({ name: 'brand', id: product.brand_id })}>
                {product.brand_name}
              </button>
            </>
          )}
          {product?.name && (
            <>
              <Icon.ChevR />
              <span className="pp-breadcrumb-current">{product.name}</span>
            </>
          )}
        </nav>

        {/* ─── Section 1 : Hero (gallery + buybox) ─── */}
        {productLoading ? (
          <HeroSkeleton />
        ) : (
          <section className="pp-hero">
            {/* LEFT — Gallery */}
            <div className="pp-gallery">
              <div className="pp-gallery-main">
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={product?.name || ''}
                    className={i === galleryIdx ? 'pp-gallery-img pp-gallery-img--active' : 'pp-gallery-img'}
                    onError={(e) => { e.currentTarget.style.opacity = 0.3; }}
                  />
                ))}
                {!images.length && (
                  <div className="pp-gallery-placeholder">📦</div>
                )}
              </div>
              {images.length > 1 && (
                <div className="pp-thumbs">
                  {images.slice(0, 6).map((src, i) => (
                    <button
                      key={i}
                      className={i === galleryIdx ? 'pp-thumb pp-thumb--active' : 'pp-thumb'}
                      onClick={() => setGalleryIdx(i)}
                      aria-label={`Image ${i + 1}`}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT — Buy box */}
            <aside className="pp-buybox">
              {product?.brand_name && (
                <button
                  className="pp-brand-link"
                  onClick={() => product.brand_id && navigate({ name: 'brand', id: product.brand_id })}
                >
                  {product.brand_name}
                </button>
              )}
              <h1 className="pp-title">{product?.name}</h1>

              <div className="pp-rating-row">
                <Stars value={reviewStats.avg || 0} size={16} />
                <span className="pp-rating-text">
                  {reviewStats.count > 0
                    ? `${reviewStats.avg.toFixed(1)} (${reviewStats.count} avis)`
                    : 'Aucun avis'}
                </span>
              </div>

              <div className="pp-price">{formatPrice(product?.price)}</div>

              {product?.is_imported && (
                <div className="pp-import-badge">
                  <span className="pp-import-flag">{flagFor(product.origin_country)}</span>
                  <span>Import {product.origin_country || ''}</span>
                </div>
              )}

              <div className="pp-delivery">
                <Icon.Truck size={18} />
                <span>
                  {product?.is_imported
                    ? `Délai ${product.lead_time_days || '7-14'} jours`
                    : 'Livraison à domicile sous 24-48h'}
                </span>
              </div>

              {stockState && (
                <div className={`pp-stock pp-stock--${stockState.cls}`}>
                  <span>{stockState.icon}</span>
                  <span>{stockState.label}</span>
                </div>
              )}

              {/* Quantity */}
              <div className="pp-qty-row">
                <label className="pp-qty-label">Quantité</label>
                <div className="pp-qty">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Diminuer"
                    disabled={qty <= 1}
                  >
                    <Icon.Minus />
                  </button>
                  <span className="pp-qty-value">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    aria-label="Augmenter"
                  >
                    <Icon.Plus />
                  </button>
                </div>
              </div>

              <button
                className="pp-btn-primary pp-btn-add"
                onClick={handleAddToCart}
                disabled={stockState?.cls === 'out'}
              >
                {stockState?.cls === 'out' ? 'Indisponible' : `Ajouter au panier · ${formatPrice((product?.price || 0) * qty)}`}
              </button>

              <button
                className="pp-btn-outline"
                onClick={() => {
                  const el = document.getElementById('pp-pharmacies');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <Icon.Pin /> Voir en pharmacie
              </button>

              <ul className="pp-trust">
                <li><Icon.Shield size={16} /> Authentique garanti</li>
                <li><Icon.Truck size={16} /> Livraison rapide</li>
                <li><Icon.Refresh size={16} /> Retours sous 14j</li>
              </ul>
            </aside>
          </section>
        )}

        {/* ─── Section 2 : Description tabs / mobile accordion ─── */}
        <section className="pp-section pp-section--info">
          <h2 className="pp-h2">À propos du produit</h2>

          {/* Desktop tabs */}
          <div className="pp-tabs pp-show-desktop">
            <div className="pp-tabs-head" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  className={activeTab === t.id ? 'pp-tab pp-tab--active' : 'pp-tab'}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="pp-tabs-body">{renderTabBody(activeTab)}</div>
          </div>

          {/* Mobile accordion */}
          <div className="pp-accordion pp-show-mobile">
            {tabs.map((t) => {
              const open = openAccordion === t.id;
              return (
                <div key={t.id} className={open ? 'pp-acc pp-acc--open' : 'pp-acc'}>
                  <button
                    className="pp-acc-head"
                    onClick={() => setOpenAccordion(open ? null : t.id)}
                  >
                    <span>{t.label}</span>
                    <span className="pp-acc-chev"><Icon.ChevD /></span>
                  </button>
                  {open && <div className="pp-acc-body">{renderTabBody(t.id)}</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Section 3 : Pharmacies ─── */}
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
            <div className="pp-empty">
              <p>Bientôt disponible dans nos pharmacies partenaires</p>
            </div>
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
                    <button
                      className="pp-btn-primary pp-btn-sm"
                      onClick={() => handleBuyAtPharmacy(ph)}
                    >
                      Commander
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Section 4 : Reviews ─── */}
        <section className="pp-section pp-section--reviews">
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
            <div className="pp-empty">
              <p>Sois la première à donner ton avis</p>
            </div>
          ) : (
            <div className="pp-reviews-grid">
              <div className="pp-reviews-summary">
                <div className="pp-reviews-avg">
                  <div className="pp-reviews-avg-num">{reviewStats.avg.toFixed(1)}</div>
                  <Stars value={reviewStats.avg} size={20} />
                  <div className="pp-reviews-avg-count">
                    {reviewStats.count} avis
                  </div>
                </div>
                <div className="pp-reviews-dist">
                  {[5, 4, 3, 2, 1].map((r) => {
                    const pct = reviewStats.count
                      ? (reviewStats.dist[r] / reviewStats.count) * 100
                      : 0;
                    return (
                      <div key={r} className="pp-dist-row">
                        <span className="pp-dist-label">{r}★</span>
                        <div className="pp-dist-bar">
                          <div className="pp-dist-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="pp-dist-pct">{Math.round(pct)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pp-reviews-list">
                {reviews.slice(0, 4).map((r) => (
                  <article key={r.id} className="pp-review">
                    <header className="pp-review-head">
                      <div className="pp-review-author">
                        <div className="pp-review-avatar">
                          {(r.author_name || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="pp-review-name">{r.author_name || 'Anonyme'}</div>
                          <div className="pp-review-date">{timeAgo(r.created_at)}</div>
                        </div>
                      </div>
                      <Stars value={r.rating} size={14} />
                    </header>
                    {r.comment && <p className="pp-review-comment">{r.comment}</p>}
                  </article>
                ))}
                {reviews.length > 4 && (
                  <button className="pp-btn-ghost">
                    Voir tous les avis ({reviews.length})
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ─── Section 5 : Related products ─── */}
        <section className="pp-section pp-section--related">
          <h2 className="pp-h2">Vous aimerez aussi</h2>
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
                  onClick={() => navigate({ name: 'product', id: p.id })}
                >
                  <div className="pp-rel-img-wrap">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="pp-rel-img" />
                    ) : (
                      <div className="pp-rel-placeholder">📦</div>
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
                        addToCart({
                          product: {
                            id: p.id,
                            name: p.name,
                            brand: p.brand_name || '',
                            img: p.image_url || '',
                            price: p.price,
                            is_imported: !!p.is_imported,
                            lead_time_days: p.lead_time_days || 1,
                            origin_country: p.origin_country || 'SN',
                          },
                          pharmacy: { id: 'default', name: 'YARAM' },
                          qty: 1,
                        });
                        setToast('Ajouté au panier');
                        setTimeout(() => setToast(null), 2200);
                      }}
                      aria-label="Ajouter au panier"
                    >
                      <Icon.Plus size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ─── Mobile sticky bar ─── */}
        {product && (
          <div className="pp-mobile-bar pp-show-mobile">
            <div className="pp-mobile-price">{formatPrice(product.price)}</div>
            <button
              className="pp-btn-primary pp-mobile-cta"
              onClick={handleAddToCart}
              disabled={stockState?.cls === 'out'}
            >
              {stockState?.cls === 'out' ? 'Indisponible' : 'Ajouter au panier'}
            </button>
          </div>
        )}

        {/* ─── Toast ─── */}
        {toast && (
          <div className="pp-toast">
            <Icon.Check size={18} /> {toast}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
