// ════════════════════════════════════════════════════════════════════
// YARAM — ShopHome (route /shop)
// ────────────────────────────────────────────────────────────────────
// Homepage premium e-commerce style DoorDash / Uber Eats (desktop-first)
// avec fallback mobile. Wrappée dans SiteLayout (header + footer).
// Sections : Hero search · Categories · Brands · Promo banner ·
// Featured products · Pharmacies · International · Testimonials · B2B
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useNav } from '../App';
import {
  getAllProducts,
  getAllBrands,
  getAllCategories,
  getAllPharmacies,
  getAllBanners,
} from '../lib/supabase';
import { addToCart } from '../lib/cart';
import SiteLayout from '../components/SiteLayout';
import './ShopHome.css';

// ─── Mock fallback pour catégories si la table renvoie vide ──────────
const FALLBACK_CATEGORIES = [
  { id: 'visage', name: 'Soins visage', icon: 'sparkle', color: '#FFE5DC' },
  { id: 'corps', name: 'Soins corps', icon: 'drop', color: '#E0F2FE' },
  { id: 'cheveux', name: 'Cheveux', icon: 'flower', color: '#FCE7F3' },
  { id: 'maquillage', name: 'Maquillage', icon: 'lipstick', color: '#F3E8FF' },
  { id: 'parfum', name: 'Parfums', icon: 'bottle', color: '#FEF3C7' },
  { id: 'bebe', name: 'Bébé & Maman', icon: 'baby', color: '#DCFCE7' },
  { id: 'hygiene', name: 'Hygiène', icon: 'soap', color: '#E0E7FF' },
  { id: 'sante', name: 'Santé', icon: 'pill', color: '#FFE4E6' },
  { id: 'solaire', name: 'Solaires', icon: 'sun', color: '#FEF9C3' },
  { id: 'homme', name: 'Homme', icon: 'razor', color: '#D1FAE5' },
  { id: 'minceur', name: 'Minceur', icon: 'leaf', color: '#FED7AA' },
  { id: 'complements', name: 'Compléments', icon: 'capsule', color: '#E0F2FE' },
];

const TESTIMONIALS = [
  {
    name: 'Aïssatou D.',
    city: 'Dakar — Almadies',
    rating: 5,
    text: "Je commande mes crèmes Avène toutes les semaines sur YARAM. Livraison en moins de 30 min, produits authentiques. Je ne reviens plus en pharmacie.",
    initial: 'A',
    color: '#FFE5DC',
  },
  {
    name: 'Mariam S.',
    city: 'Pikine',
    rating: 5,
    text: "Ce que j'aime, c'est de pouvoir trouver des marques importées de Dubai qu'on ne trouve nulle part ailleurs. Et le prix est correct !",
    initial: 'M',
    color: '#E0F2FE',
  },
  {
    name: 'Khady N.',
    city: 'Saly',
    rating: 5,
    text: "Service client impeccable. J'ai eu un souci avec une commande, ils m'ont remboursée immédiatement. Une vraie pharmacie digitale, comme à Paris.",
    initial: 'K',
    color: '#FCE7F3',
  },
];

// ─── Petites icônes SVG inline (zéro dépendance externe) ──────────────
function Icon({ name, size = 32, color = '#1F8B4C' }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (name) {
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case 'pin':
      return <svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'arrow':
      return <svg {...props}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
    case 'cart':
      return <svg {...props}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
    case 'star':
      return <svg {...props} fill={color} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'chevron-left':
      return <svg {...props}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'chevron-right':
      return <svg {...props}><polyline points="9 18 15 12 9 6"/></svg>;
    case 'globe':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
    case 'truck':
      return <svg {...props}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'shop':
      return <svg {...props}><path d="M2 7l1-4h18l1 4"/><path d="M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/><path d="M9 21V11h6v10"/></svg>;
    case 'spark':
      return <svg {...props}><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

// ─── Emoji par catégorie (basé sur le nom) ─────────────────────────────
function categoryEmoji(name = '') {
  const n = name.toLowerCase();
  if (n.includes('visage')) return '🧴';
  if (n.includes('corps')) return '💧';
  if (n.includes('cheveu')) return '💇‍♀️';
  if (n.includes('maquill')) return '💄';
  if (n.includes('parfum')) return '🌸';
  if (n.includes('bébé') || n.includes('bebe') || n.includes('maman')) return '👶';
  if (n.includes('hygi')) return '🧼';
  if (n.includes('santé') || n.includes('sante')) return '💊';
  if (n.includes('solaire') || n.includes('soleil')) return '☀️';
  if (n.includes('homme')) return '🧔';
  if (n.includes('mince')) return '🌿';
  if (n.includes('complé') || n.includes('comple')) return '💊';
  if (n.includes('dent')) return '🦷';
  return '✨';
}

function formatPrice(p) {
  const n = Number(p) || 0;
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

export default function ShopHome() {
  const { navigate } = useNav();

  // ─── State ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  // Refs pour scroll horizontal contrôlé
  const brandsRailRef = useRef(null);
  const pharmaciesRailRef = useRef(null);

  // ─── Fetch initial ──────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getAllProducts(),
      getAllBrands(),
      getAllCategories(),
      getAllPharmacies(),
      getAllBanners(),
    ]).then(([prodR, brandR, catR, phaR, banR]) => {
      if (!alive) return;
      if (prodR.status === 'fulfilled') setProducts(prodR.value || []);
      if (brandR.status === 'fulfilled') setBrands(brandR.value || []);
      if (catR.status === 'fulfilled') {
        const cats = catR.value || [];
        setCategories(cats.length > 0 ? cats : FALLBACK_CATEGORIES);
      } else {
        setCategories(FALLBACK_CATEGORIES);
      }
      if (phaR.status === 'fulfilled') setPharmacies(phaR.value || []);
      if (banR.status === 'fulfilled') {
        const banners = (banR.value || []).filter((b) => b.active !== false);
        setBanner(banners[0] || null);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────
  const onSubmitSearch = (e) => {
    e.preventDefault();
    navigate('search');
  };

  const goCategory = (cat) => {
    navigate('search');
  };

  const goBrand = (b) => navigate({ name: 'brand', id: b.id });

  const goProduct = (p) => navigate({ name: 'product', id: p.id });

  const goPharmacy = (ph) => navigate({ name: 'pharmacy', id: ph.id });

  const onAddToCart = (p, e) => {
    e.stopPropagation();
    // Sélection auto d'une pharmacie : si on a la liste chargée on prend la première active,
    // sinon on délègue au flow d'ajout depuis la fiche produit.
    const ph = pharmacies[0];
    if (!ph) {
      navigate({ name: 'product', id: p.id });
      return;
    }
    addToCart({
      product: {
        id: p.id,
        name: p.name,
        brand: p.brand_name || p.brand || '',
        img: p.image_url || p.img || '',
        price: p.price,
        is_imported: p.is_imported,
        lead_time_days: p.lead_time_days,
        origin_country: p.origin_country,
      },
      pharmacy: ph,
      qty: 1,
    });
    // Petite UX : on flash bouton, déjà géré au scope CSS via :active
  };

  const scrollRail = (ref, dir) => {
    if (!ref?.current) return;
    const w = ref.current.clientWidth * 0.7;
    ref.current.scrollBy({ left: dir * w, behavior: 'smooth' });
  };

  // ─── Data derived ──────────────────────────────────────────────────
  const featuredProducts = products.slice(0, 12);
  const featuredBrands = brands.slice(0, 10);
  const visibleCategories = categories.slice(0, 12);
  const visiblePharmacies = pharmacies.slice(0, 6);

  return (
    <SiteLayout>
      <div className="shop-home">

        {/* ═══════════════ HERO + SEARCH ═══════════════ */}
        <section className="sh-hero">
          <div className="sh-hero-bg-orb sh-orb-1" />
          <div className="sh-hero-bg-orb sh-orb-2" />
          <div className="sh-hero-inner">
            <div className="sh-location-chip">
              <Icon name="pin" size={16} color="#1F8B4C" />
              <span>Livré à <strong>Dakar</strong></span>
              <span className="sh-location-dot">·</span>
              <span className="sh-location-eta">30 min</span>
            </div>
            <h1 className="sh-hero-title">
              Plus de <span className="sh-hero-accent">5 000 produits beauté</span><br/>
              à portée de main.
            </h1>
            <p className="sh-hero-sub">
              Parapharmacie, maquillage, soins, parfums — livrés en 30 min à Dakar.
            </p>
            <form className="sh-search-bar" onSubmit={onSubmitSearch}>
              <div className="sh-search-icon">
                <Icon name="search" size={22} color="#7A7A78" />
              </div>
              <input
                type="text"
                placeholder="Recherche un produit, une marque ou une pharmacie…"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => navigate('search')}
                className="sh-search-input"
              />
              <button type="submit" className="sh-search-submit">
                Rechercher
              </button>
            </form>
            <div className="sh-hero-quick">
              <button className="sh-quick-chip" onClick={() => navigate('search')}>🧴 Soins visage</button>
              <button className="sh-quick-chip" onClick={() => navigate('search')}>💄 Maquillage</button>
              <button className="sh-quick-chip" onClick={() => navigate('search')}>🌸 Parfums</button>
              <button className="sh-quick-chip" onClick={() => navigate('international')}>🌍 International</button>
              <button className="sh-quick-chip" onClick={() => navigate('search')}>👶 Bébé</button>
            </div>
          </div>
        </section>

        {/* ═══════════════ CATEGORIES ═══════════════ */}
        <section className="sh-section">
          <div className="sh-section-head">
            <h2 className="sh-h2">Par catégorie</h2>
            <button className="sh-link" onClick={() => navigate('search')}>
              Tout voir <Icon name="arrow" size={14} color="#1F8B4C" />
            </button>
          </div>
          <div className="sh-categories-grid">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="sh-cat-tile sh-skeleton-tile" />
                ))
              : visibleCategories.map((c) => (
                  <button
                    key={c.id}
                    className="sh-cat-tile"
                    onClick={() => goCategory(c)}
                    style={{ background: c.color || '#F4F4F2' }}
                  >
                    <div className="sh-cat-emoji">
                      {c.icon_url ? (
                        <img
                          src={c.icon_url}
                          alt={c.name}
                          loading="lazy"
                          decoding="async"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement.textContent = categoryEmoji(c.name);
                          }}
                        />
                      ) : (
                        categoryEmoji(c.name)
                      )}
                    </div>
                    <div className="sh-cat-name">{c.name}</div>
                  </button>
                ))
            }
          </div>
        </section>

        {/* ═══════════════ BRANDS CAROUSEL ═══════════════ */}
        <section className="sh-section">
          <div className="sh-section-head">
            <h2 className="sh-h2">Marques en vedette</h2>
            <button className="sh-link" onClick={() => navigate('brands')}>
              Voir toutes les marques <Icon name="arrow" size={14} color="#1F8B4C" />
            </button>
          </div>
          <div className="sh-rail-wrap">
            <button
              className="sh-rail-arrow sh-rail-arrow--left"
              onClick={() => scrollRail(brandsRailRef, -1)}
              aria-label="Précédent"
            >
              <Icon name="chevron-left" size={20} color="#1A1A1A" />
            </button>
            <div className="sh-brand-rail" ref={brandsRailRef}>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="sh-brand-card sh-skeleton-tile" />
                  ))
                : featuredBrands.map((b) => (
                    <button key={b.id} className="sh-brand-card" onClick={() => goBrand(b)}>
                      {b.img ? (
                        <img
                          src={b.img}
                          alt={b.name}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement.querySelector('.sh-brand-fallback') &&
                              (e.currentTarget.parentElement.querySelector('.sh-brand-fallback').style.display = 'flex');
                          }}
                        />
                      ) : (
                        <div className="sh-brand-fallback">{(b.name || '?').slice(0, 2).toUpperCase()}</div>
                      )}
                      <span className="sh-brand-name">{b.name}</span>
                    </button>
                  ))
              }
            </div>
            <button
              className="sh-rail-arrow sh-rail-arrow--right"
              onClick={() => scrollRail(brandsRailRef, 1)}
              aria-label="Suivant"
            >
              <Icon name="chevron-right" size={20} color="#1A1A1A" />
            </button>
          </div>
        </section>

        {/* ═══════════════ PROMO BANNER ═══════════════ */}
        <section className="sh-section sh-section--promo">
          {banner ? (
            <button
              className="sh-promo-banner sh-promo-banner--img"
              onClick={() => banner.link_url && window.open(banner.link_url, '_self')}
              style={{ backgroundImage: `url(${banner.image_url})` }}
            >
              <div className="sh-promo-overlay">
                <div className="sh-promo-text">
                  <span className="sh-promo-eyebrow">Offre du moment</span>
                  <h3 className="sh-promo-title">{banner.title || 'Découvrez nos promos exclusives'}</h3>
                  <span className="sh-promo-cta">
                    Découvrir <Icon name="arrow" size={14} color="#fff" />
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="sh-promo-banner sh-promo-banner--gradient">
              <div className="sh-promo-text">
                <span className="sh-promo-eyebrow">Nouveau sur YARAM</span>
                <h3 className="sh-promo-title">
                  -15% sur ta première commande<br/>
                  <span className="sh-promo-thin">code <strong>BIENVENUE</strong></span>
                </h3>
                <button className="sh-btn-light" onClick={() => navigate('search')}>
                  Profiter de l'offre
                </button>
              </div>
              <div className="sh-promo-art">🎁</div>
            </div>
          )}
        </section>

        {/* ═══════════════ FEATURED PRODUCTS ═══════════════ */}
        <section className="sh-section">
          <div className="sh-section-head">
            <h2 className="sh-h2">À découvrir cette semaine</h2>
            <button className="sh-link" onClick={() => navigate('search')}>
              Voir tout le catalogue <Icon name="arrow" size={14} color="#1F8B4C" />
            </button>
          </div>
          <div className="sh-products-grid">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="sh-product-card sh-skeleton-product">
                    <div className="sh-skel-img" />
                    <div className="sh-skel-line sh-skel-line--short" />
                    <div className="sh-skel-line" />
                    <div className="sh-skel-line sh-skel-line--price" />
                  </div>
                ))
              : featuredProducts.map((p) => (
                  <div key={p.id} className="sh-product-card" onClick={() => goProduct(p)}>
                    <div className="sh-product-img-wrap">
                      {(p.image_url || p.img) ? (
                        <img src={p.image_url || p.img} alt={p.name} loading="lazy" />
                      ) : (
                        <div className="sh-product-img-fallback">🧴</div>
                      )}
                      {p.is_imported && (
                        <span className="sh-product-tag">🌍 Import</span>
                      )}
                    </div>
                    <div className="sh-product-info">
                      <span className="sh-product-brand">{p.brand_name || p.brand || 'YARAM'}</span>
                      <span className="sh-product-name">{p.name}</span>
                      <div className="sh-product-bottom">
                        <span className="sh-product-price">{formatPrice(p.price)}</span>
                        <button
                          className="sh-product-add"
                          onClick={(e) => onAddToCart(p, e)}
                          aria-label="Ajouter au panier"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            }
          </div>
          <div className="sh-section-foot">
            <button className="sh-btn-outline" onClick={() => navigate('search')}>
              Voir tout le catalogue
            </button>
          </div>
        </section>

        {/* ═══════════════ PHARMACIES NEAR YOU ═══════════════ */}
        <section className="sh-section">
          <div className="sh-section-head">
            <h2 className="sh-h2">Pharmacies près de toi</h2>
            <button className="sh-link" onClick={() => navigate('pharmacies')}>
              Voir toutes les pharmacies <Icon name="arrow" size={14} color="#1F8B4C" />
            </button>
          </div>
          <div className="sh-rail-wrap">
            <button
              className="sh-rail-arrow sh-rail-arrow--left"
              onClick={() => scrollRail(pharmaciesRailRef, -1)}
              aria-label="Précédent"
            >
              <Icon name="chevron-left" size={20} color="#1A1A1A" />
            </button>
            <div className="sh-pharma-rail" ref={pharmaciesRailRef}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="sh-pharma-card sh-skeleton-tile" />
                  ))
                : visiblePharmacies.map((ph) => (
                    <button key={ph.id} className="sh-pharma-card" onClick={() => goPharmacy(ph)}>
                      <div className="sh-pharma-cover">
                        {ph.cover || ph.logo ? (
                          <img src={ph.cover || ph.logo} alt={ph.name} loading="lazy" />
                        ) : (
                          <div className="sh-pharma-cover-fallback">
                            <Icon name="shop" size={40} color="#1F8B4C" />
                          </div>
                        )}
                      </div>
                      <div className="sh-pharma-body">
                        <span className="sh-pharma-name">{ph.name}</span>
                        <span className="sh-pharma-addr">
                          <Icon name="pin" size={12} color="#7A7A78" />
                          {ph.city || ph.address || 'Dakar'}
                        </span>
                        <div className="sh-pharma-meta">
                          <span className="sh-pharma-rating">
                            <Icon name="star" size={12} color="#F59E0B" />
                            {ph.rating ? Number(ph.rating).toFixed(1) : '4.8'}
                          </span>
                          <span className="sh-pharma-eta">
                            <Icon name="truck" size={12} color="#1F8B4C" /> 30 min
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
              }
            </div>
            <button
              className="sh-rail-arrow sh-rail-arrow--right"
              onClick={() => scrollRail(pharmaciesRailRef, 1)}
              aria-label="Suivant"
            >
              <Icon name="chevron-right" size={20} color="#1A1A1A" />
            </button>
          </div>
        </section>

        {/* ═══════════════ INTERNATIONAL ═══════════════ */}
        <section className="sh-international">
          <div className="sh-international-inner">
            <div className="sh-international-text">
              <div className="sh-international-badge">
                <Icon name="globe" size={14} color="#1F8B4C" />
                Section International
              </div>
              <h2 className="sh-h2 sh-h2--light">
                Marques exclusives<br/>
                <span className="sh-international-accent">importées d'Europe & Dubai.</span>
              </h2>
              <p className="sh-international-sub">
                Tu veux une crème Bioderma achetée à Paris, un parfum Maison Margiela
                de Dubai, ou un soin K-Beauty introuvable au Sénégal ?
                Notre service International te livre l'authentique en 7 à 14 jours.
              </p>
              <button className="sh-btn-light" onClick={() => navigate('international')}>
                Explorer International <Icon name="arrow" size={16} color="#fff" />
              </button>
            </div>
            <div className="sh-international-flags">
              <div className="sh-flag-tile">🇫🇷<span>Paris</span></div>
              <div className="sh-flag-tile">🇦🇪<span>Dubai</span></div>
              <div className="sh-flag-tile">🇰🇷<span>Séoul</span></div>
              <div className="sh-flag-tile">🇮🇹<span>Milan</span></div>
            </div>
          </div>
        </section>

        {/* ═══════════════ TESTIMONIALS ═══════════════ */}
        <section className="sh-section">
          <div className="sh-section-head sh-section-head--center">
            <h2 className="sh-h2">Elles parlent de YARAM</h2>
            <p className="sh-section-sub">+ de 12 000 clientes nous font confiance chaque mois</p>
          </div>
          <div className="sh-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="sh-testimonial">
                <div className="sh-testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, k) => (
                    <Icon key={k} name="star" size={16} color="#F59E0B" />
                  ))}
                </div>
                <p className="sh-testimonial-text">"{t.text}"</p>
                <div className="sh-testimonial-author">
                  <div className="sh-testimonial-avatar" style={{ background: t.color }}>
                    {t.initial}
                  </div>
                  <div>
                    <span className="sh-testimonial-name">{t.name}</span>
                    <span className="sh-testimonial-city">{t.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════ B2B CTA ═══════════════ */}
        <section className="sh-section sh-section--b2b">
          <div className="sh-b2b-grid">
            <div className="sh-b2b-card sh-b2b-card--pharma">
              <div className="sh-b2b-icon">🏥</div>
              <h3>Vous êtes pharmacien ?</h3>
              <p>Rejoignez le réseau YARAM et touchez des milliers de clients à Dakar et au Sénégal.</p>
              <button className="sh-btn-primary" onClick={() => navigate('partner-application')}>
                Devenir partenaire <Icon name="arrow" size={14} color="#fff" />
              </button>
            </div>
            <div className="sh-b2b-card sh-b2b-card--driver">
              <div className="sh-b2b-icon">🛵</div>
              <h3>Vous êtes livreur ?</h3>
              <p>Roulez avec YARAM, gérez vos horaires, et soyez payé à la livraison.</p>
              <button className="sh-btn-primary" onClick={() => navigate('driver-application')}>
                Devenir livreur <Icon name="arrow" size={14} color="#fff" />
              </button>
            </div>
          </div>
        </section>

      </div>
    </SiteLayout>
  );
}
