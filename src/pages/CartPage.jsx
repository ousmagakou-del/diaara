// ════════════════════════════════════════════════════════════════════
// CartPage — version desktop premium e-commerce style Uber Eats/DoorDash
// ════════════════════════════════════════════════════════════════════
// Wrappée dans SiteLayout pour avoir Header + Footer cohérents.
// Lit le panier synchrone via getCart() (localStorage), groupe par
// pharmacie, et calcule le total côté client.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNav, useUser } from '../App';
import SiteLayout from '../components/SiteLayout';
import { getCart, setCart, clearCart } from '../lib/cart';
import './CartPage.css';

// ─── Helpers locaux ────────────────────────────────────────────────
function formatPrice(n) {
  return (Number(n) || 0).toLocaleString('fr-FR');
}

const DELIVERY_FEE = 1500;          // FCFA fixe Dakar
const SERVICE_FEE_PCT = 0.05;       // 5%
const SERVICE_FEE_MIN = 250;        // 250 FCFA min

// ─── Icônes inline SVG ─────────────────────────────────────────────
const IcoTrash = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
  </svg>
);

const IcoMinus = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IcoPlus = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IcoStore = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 7l1.5-4h15L21 7"/>
    <path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/>
    <path d="M8 21V12h8v9"/>
  </svg>
);

const IcoClock = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
  </svg>
);

const IcoTag = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const IcoChevron = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IcoLock = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IcoReturn = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);

const IcoSenegal = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 22s-8-4.5-8-12a8 8 0 0 1 16 0c0 7.5-8 12-8 12z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

// ─── Empty state icon ──────────────────────────────────────────────
const CartEmptyArt = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="58" fill="#EAF5EE"/>
    <path d="M32 42h8l5.5 28a4 4 0 0 0 4 3.2h22a4 4 0 0 0 3.9-3l4-16H43"
      stroke="#1F8B4C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="52" cy="84" r="3.5" fill="#1F8B4C"/>
    <circle cx="76" cy="84" r="3.5" fill="#1F8B4C"/>
    <path d="M68 36l4-6M80 38l8-4M84 50l8-1" stroke="#1F8B4C" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
  </svg>
);

// ════════════════════════════════════════════════════════════════════
// Composant principal
// ════════════════════════════════════════════════════════════════════
export default function CartPage() {
  const { navigate } = useNav();
  const { user } = useUser();

  // Items synchrone depuis localStorage
  const [items, setItems] = useState(() => getCart());
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');

  // ─── Refresh sur focus + cross-tab via event custom ─────────────
  useEffect(() => {
    const refresh = () => setItems(getCart());
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('yaram-cart-updated', refresh);
    const id = setInterval(refresh, 2000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('yaram-cart-updated', refresh);
      clearInterval(id);
    };
  }, []);

  // ─── Mutations panier ───────────────────────────────────────────
  const updateQty = useCallback((productId, pharmacyId, nextQty) => {
    const current = getCart();
    if (nextQty <= 0) {
      const filtered = current.filter(
        (it) => !(it.productId === productId && it.pharmacyId === pharmacyId)
      );
      setCart(filtered);
      setItems(filtered);
      return;
    }
    const updated = current.map((it) =>
      it.productId === productId && it.pharmacyId === pharmacyId
        ? { ...it, qty: nextQty }
        : it
    );
    setCart(updated);
    setItems(updated);
  }, []);

  const removeItem = useCallback((productId, pharmacyId) => {
    const current = getCart();
    const filtered = current.filter(
      (it) => !(it.productId === productId && it.pharmacyId === pharmacyId)
    );
    setCart(filtered);
    setItems(filtered);
  }, []);

  const handleClearAll = useCallback(() => {
    if (!window.confirm('Vider tout le panier ?')) return;
    clearCart();
    setItems([]);
  }, []);

  // ─── Groupement par pharmacie ───────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.pharmacyId;
      if (!map.has(key)) {
        map.set(key, {
          pharmacyId: it.pharmacyId,
          pharmacyName: it.pharmacyName || 'Pharmacie',
          items: [],
        });
      }
      map.get(key).items.push(it);
    }
    return Array.from(map.values());
  }, [items]);

  // ─── Totaux ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
      0
    );
    const itemCount = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const delivery = items.length ? DELIVERY_FEE : 0;
    const serviceFee = Math.max(
      Math.round(subtotal * SERVICE_FEE_PCT),
      items.length ? SERVICE_FEE_MIN : 0
    );
    // Points fidélité dispo (1 point = 1 FCFA, plafonné à 10% du subtotal)
    const loyaltyAvail = Math.min(
      Math.floor((user?.loyalty_points || 0) || 0),
      Math.floor(subtotal * 0.1)
    );
    const total = subtotal + delivery + serviceFee;
    return { subtotal, delivery, serviceFee, total, itemCount, loyaltyAvail };
  }, [items, user]);

  // ─── Promo code (mock — la vraie validation est côté checkout) ──
  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (code === 'YARAM10') {
      setPromoMsg('Code valide — 10% appliqué à l\'étape suivante');
    } else {
      setPromoMsg('Code non reconnu, réessaie à l\'étape suivante');
    }
  };

  // ─── Empty state ────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <SiteLayout>
        <div className="cart-page">
          <div className="cart-empty">
            <CartEmptyArt />
            <h1 className="cart-empty-title">Ton panier est vide</h1>
            <p className="cart-empty-sub">
              Découvre nos 5 000+ produits beauté & santé, livrés en moins de 60 minutes à Dakar.
            </p>
            <button
              className="cart-btn-primary cart-btn-lg"
              onClick={() => navigate('shop')}
            >
              Explorer le catalogue
            </button>
            <div className="cart-empty-trust">
              <span><IcoLock /> Paiement sécurisé</span>
              <span><IcoReturn /> Retours 14 jours</span>
              <span><IcoSenegal /> Made in Senegal</span>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── Filled state ───────────────────────────────────────────────
  return (
    <SiteLayout>
      <div className="cart-page">
        <div className="cart-header">
          <div>
            <h1 className="cart-title">Mon panier</h1>
            <p className="cart-subtitle">
              {totals.itemCount} {totals.itemCount > 1 ? 'articles' : 'article'} · {groups.length}{' '}
              {groups.length > 1 ? 'pharmacies' : 'pharmacie'}
            </p>
          </div>
          <button className="cart-clear-btn" onClick={handleClearAll} aria-label="Vider le panier">
            Vider le panier
          </button>
        </div>

        <div className="cart-grid">
          {/* ───── LEFT : items list ───── */}
          <div className="cart-items-col">
            {groups.map((group) => (
              <PharmacyCard
                key={group.pharmacyId}
                group={group}
                onQty={updateQty}
                onRemove={removeItem}
                onProduct={(id) => navigate({ name: 'product', params: { id } })}
                onAddMore={() => navigate('shop')}
              />
            ))}
          </div>

          {/* ───── RIGHT : summary ───── */}
          <aside className="cart-summary-col">
            <div className="cart-summary">
              <h2 className="cart-summary-title">Récapitulatif</h2>

              <div className="cart-summary-row">
                <span>Sous-total ({totals.itemCount} {totals.itemCount > 1 ? 'articles' : 'article'})</span>
                <strong>{formatPrice(totals.subtotal)} FCFA</strong>
              </div>

              <div className="cart-summary-row">
                <span>Livraison</span>
                <strong>{formatPrice(totals.delivery)} FCFA</strong>
              </div>

              <div className="cart-summary-row">
                <span>Frais de service</span>
                <strong>{formatPrice(totals.serviceFee)} FCFA</strong>
              </div>

              {totals.loyaltyAvail > 0 && (
                <div className="cart-summary-row cart-summary-row--accent">
                  <span>Points fidélité dispo</span>
                  <strong>-{formatPrice(totals.loyaltyAvail)} FCFA</strong>
                </div>
              )}

              {/* Promo collapsible */}
              <button
                className={`cart-promo-toggle ${promoOpen ? 'is-open' : ''}`}
                onClick={() => setPromoOpen((v) => !v)}
              >
                <span><IcoTag /> Ajouter un code promo</span>
                <IcoChevron />
              </button>
              {promoOpen && (
                <div className="cart-promo-row">
                  <input
                    className="cart-promo-input"
                    placeholder="Code promo"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyPromo(); }}
                  />
                  <button className="cart-promo-apply" onClick={applyPromo}>
                    Appliquer
                  </button>
                </div>
              )}
              {promoMsg && <div className="cart-promo-msg">{promoMsg}</div>}

              <div className="cart-summary-divider" />

              <div className="cart-summary-total">
                <span>Total</span>
                <strong>{formatPrice(totals.total)} FCFA</strong>
              </div>

              <button
                className="cart-btn-primary cart-btn-lg cart-checkout-btn"
                onClick={() => navigate('checkout')}
              >
                Passer la commande
              </button>

              <button
                className="cart-continue-link"
                onClick={() => navigate('shop')}
              >
                Continuer mes achats
              </button>

              <div className="cart-trust-row">
                <span><IcoLock /> Paiement sécurisé</span>
                <span><IcoReturn /> Retours 14j</span>
                <span><IcoSenegal /> Made in Senegal</span>
              </div>
            </div>
          </aside>
        </div>

        {/* ───── Mobile sticky bar ───── */}
        <div className="cart-mobile-bar">
          <div className="cart-mobile-bar-info">
            <span className="cart-mobile-bar-label">Total</span>
            <strong className="cart-mobile-bar-total">{formatPrice(totals.total)} FCFA</strong>
          </div>
          <button
            className="cart-btn-primary cart-mobile-bar-btn"
            onClick={() => navigate('checkout')}
          >
            Commander
          </button>
        </div>
      </div>
    </SiteLayout>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-composant : carte pharmacie
// ════════════════════════════════════════════════════════════════════
function PharmacyCard({ group, onQty, onRemove, onProduct, onAddMore }) {
  return (
    <div className="cart-pharmacy">
      <div className="cart-pharmacy-head">
        <div className="cart-pharmacy-head-l">
          <div className="cart-pharmacy-icon"><IcoStore /></div>
          <div>
            <div className="cart-pharmacy-name">{group.pharmacyName}</div>
            <div className="cart-pharmacy-meta">
              <IcoClock /> Prêt en 25-40 min
            </div>
          </div>
        </div>
        <button className="cart-pharmacy-change" onClick={onAddMore}>
          Changer
        </button>
      </div>

      <div className="cart-items-list">
        {group.items.map((it) => (
          <CartLine
            key={`${it.productId}-${it.pharmacyId}`}
            item={it}
            onQty={onQty}
            onRemove={onRemove}
            onProduct={onProduct}
          />
        ))}
      </div>

      <button className="cart-add-more" onClick={onAddMore}>
        <IcoPlus /> Ajouter d'autres produits de cette pharmacie
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-composant : ligne produit
// ════════════════════════════════════════════════════════════════════
function CartLine({ item, onQty, onRemove, onProduct }) {
  const [bump, setBump] = useState(0);
  const lineTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);

  const change = (delta) => {
    onQty(item.productId, item.pharmacyId, (Number(item.qty) || 0) + delta);
    setBump((k) => k + 1);
  };

  return (
    <div className="cart-line">
      <button
        className="cart-line-img-btn"
        onClick={() => onProduct(item.productId)}
        aria-label={item.name}
      >
        {item.img ? (
          <img src={item.img} alt={item.name} loading="lazy" decoding="async" />
        ) : (
          <div className="cart-line-img-fallback">{(item.name || '?').slice(0, 1)}</div>
        )}
      </button>

      <div className="cart-line-info">
        {item.brand && <div className="cart-line-brand">{item.brand}</div>}
        <button className="cart-line-name" onClick={() => onProduct(item.productId)}>
          {item.name}
        </button>
        {item.is_imported && (
          <span className="cart-line-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
            </svg>
            Import · délai {item.lead_time_days || 7}-{(item.lead_time_days || 7) + 7} jours
          </span>
        )}
        <div className="cart-line-unit">{formatPrice(item.price)} FCFA / unité</div>
      </div>

      <div className="cart-line-actions">
        <div className="cart-qty" key={bump}>
          <button
            className="cart-qty-btn"
            onClick={() => change(-1)}
            aria-label="Diminuer"
            disabled={item.qty <= 1}
          >
            <IcoMinus />
          </button>
          <span className="cart-qty-value">{item.qty}</span>
          <button
            className="cart-qty-btn"
            onClick={() => change(1)}
            aria-label="Augmenter"
          >
            <IcoPlus />
          </button>
        </div>

        <div className="cart-line-total">{formatPrice(lineTotal)} FCFA</div>

        <button
          className="cart-line-remove"
          onClick={() => onRemove(item.productId, item.pharmacyId)}
          aria-label="Supprimer"
        >
          <IcoTrash />
        </button>
      </div>
    </div>
  );
}
