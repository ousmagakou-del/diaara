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
import Stepper from '../components/Stepper';
import { getCart, setCart, clearCart } from '../lib/cart';
import { toggleFavorite } from '../lib/supabase';
import './CartPage.css';

// ─── Helpers locaux ────────────────────────────────────────────────
function formatPrice(n) {
  return (Number(n) || 0).toLocaleString('fr-FR');
}

const DELIVERY_FEE = 1500;          // FCFA fixe Dakar
const SERVICE_FEE_PCT = 0.05;       // 5%
const SERVICE_FEE_MIN = 250;        // 250 FCFA min
const FREE_DELIVERY_THRESHOLD = 30000; // aligne native cart.jsx l.17

// ─── Save-for-later (localStorage v2) ──────────────────────────────
const SAVED_KEY = 'yaram-cart-v2-saved';
function getSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}
function setSaved(items) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(items)); } catch {}
}

// ─── Delivery estimate per pharmacy ────────────────────────────────
function pharmacyEta(pharmacyId) {
  // Deterministic pseudo-random 20-45 min based on pharmacyId
  const s = String(pharmacyId || 'default');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const mins = 20 + (Math.abs(h) % 25);
  return `Pret en ${mins}-${mins + 15} min`;
}

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
  const [savedItems, setSavedItems] = useState(() => getSaved());
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [priceDropAlerts, setPriceDropAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('yaram-cart-v2-alerts') || '[]'); } catch { return []; }
  });

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

  // ─── Save for later (wishlist) ──────────────────────────────────
  const saveForLater = useCallback((productId, pharmacyId) => {
    const current = getCart();
    const it = current.find((x) => x.productId === productId && x.pharmacyId === pharmacyId);
    if (!it) return;
    const filtered = current.filter(
      (x) => !(x.productId === productId && x.pharmacyId === pharmacyId)
    );
    setCart(filtered);
    setItems(filtered);
    const saved = getSaved();
    const nextSaved = [
      { ...it, savedAt: new Date().toISOString() },
      ...saved.filter((s) => s.productId !== productId),
    ];
    setSaved(nextSaved);
    setSavedItems(nextSaved);
    // Fire and forget: try to sync with wishlist backend
    if (user) {
      toggleFavorite(productId).catch(() => {});
    }
  }, [user]);

  const moveBackToCart = useCallback((productId) => {
    const saved = getSaved();
    const it = saved.find((s) => s.productId === productId);
    if (!it) return;
    const nextSaved = saved.filter((s) => s.productId !== productId);
    setSaved(nextSaved);
    setSavedItems(nextSaved);
    const current = getCart();
    const exists = current.find(
      (x) => x.productId === it.productId && x.pharmacyId === it.pharmacyId
    );
    let next;
    if (exists) {
      next = current.map((x) =>
        x.productId === it.productId && x.pharmacyId === it.pharmacyId
          ? { ...x, qty: (Number(x.qty) || 0) + (Number(it.qty) || 1) }
          : x
      );
    } else {
      next = [...current, { ...it, qty: Number(it.qty) || 1 }];
    }
    setCart(next);
    setItems(next);
  }, []);

  const removeSaved = useCallback((productId) => {
    const next = getSaved().filter((s) => s.productId !== productId);
    setSaved(next);
    setSavedItems(next);
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

  // ─── Sub-totals per pharmacy ────────────────────────────────────
  const groupTotals = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
      m.set(it.pharmacyId, (m.get(it.pharmacyId) || 0) + line);
    }
    return m;
  }, [items]);

  // ─── Totaux ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
      0
    );
    const itemCount = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const freeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
    const delivery = items.length ? (freeDelivery ? 0 : DELIVERY_FEE) : 0;
    const serviceFee = Math.max(
      Math.round(subtotal * SERVICE_FEE_PCT),
      items.length ? SERVICE_FEE_MIN : 0
    );
    const loyaltyAvail = Math.min(
      Math.floor((user?.loyalty_points || 0) || 0),
      Math.floor(subtotal * 0.1)
    );
    const promoOff = Math.min(promoDiscount, subtotal);
    const total = subtotal + delivery + serviceFee - promoOff;
    const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
    const freeProgress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);
    return { subtotal, delivery, serviceFee, total, itemCount, loyaltyAvail, promoOff, freeDelivery, remainingForFree, freeProgress };
  }, [items, user, promoDiscount]);

  // ─── Promo code (aligne native cart.jsx l.86-103) ─────────────
  const applyPromo = useCallback(() => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    // Codes memes libelles que native — la revalidation cote server a lieu au checkout.
    const st = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    const table = {
      BIENVENUE10: { off: Math.min(Math.round(st * 0.1), 2000), label: '-10 %' },
      YARAM2000: { off: 2000, label: '-2 000 FCFA' },
      LIVRAISON: { off: DELIVERY_FEE, label: 'Livraison offerte' },
    };
    const t = table[code];
    if (!t) {
      setPromoDiscount(0);
      setPromoMsg("Code invalide. Ce code promo n'existe pas ou est expire.");
      return;
    }
    setPromoDiscount(t.off);
    setPromoMsg(`Code applique : ${t.label} (-${formatPrice(t.off)} FCFA)`);
    try { sessionStorage.setItem('yaram-checkout-promo', JSON.stringify({ code, off: t.off })); } catch {}
  }, [promoCode, items]);

  // ─── Auto-reapply promo if items change ────────────────────────
  useEffect(() => {
    if (!promoCode.trim()) return;
    const t = setTimeout(applyPromo, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // ─── Empty state premium ────────────────────────────────────────
  if (items.length === 0) {
    return (
      <SiteLayout>
        <div className="cart-page">
          <div className="cart-empty">
            <CartEmptyArt />
            <h1 className="cart-empty-title">Ton panier est vide</h1>
            <p className="cart-empty-sub">
              Decouvre nos best-sellers et trouve les produits qui vont faire briller ta peau.
            </p>
            <div className="cart-empty-actions">
              <button
                className="cart-btn-primary cart-btn-lg"
                onClick={() => navigate('shop')}
              >
                Explorer la boutique
              </button>
              <button
                className="cart-empty-secondary"
                onClick={() => navigate('landing')}
              >
                Continuer sur la home
              </button>
            </div>

            {/* Suggestions populaires (aligne native l.177-201) */}
            <div className="cart-empty-suggest">
              <div className="cart-empty-suggest-label">Populaires en ce moment</div>
              <div className="cart-empty-suggest-chips">
                {[
                  { label: 'Visage', category: 'visage' },
                  { label: 'Solaire', category: 'solaire' },
                  { label: 'Corps', category: 'corps' },
                ].map((s) => (
                  <button
                    key={s.category}
                    className="cart-empty-chip"
                    onClick={() => navigate({ name: 'search', params: { category: s.category } })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cart-empty-trust">
              <span><IcoLock /> Paiement securise</span>
              <span><IcoReturn /> Retours 14 jours</span>
              <span><IcoSenegal /> Made in Senegal</span>
            </div>

            {savedItems.length > 0 && (
              <div className="cart-saved cart-saved--empty">
                <h2 className="cart-saved-title">Sauvegarde pour plus tard ({savedItems.length})</h2>
                <div className="cart-saved-list">
                  {savedItems.slice(0, 6).map((s) => (
                    <SavedTile
                      key={`${s.productId}-${s.pharmacyId}`}
                      item={s}
                      onMove={() => moveBackToCart(s.productId)}
                      onRemove={() => removeSaved(s.productId)}
                      onProduct={() => navigate({ name: 'product', params: { id: s.productId } })}
                    />
                  ))}
                </div>
              </div>
            )}
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

        {/* Progress livraison gratuite (aligne native l.137-151) */}
        {items.length > 0 && !totals.freeDelivery && (
          <div className="cart-free-progress">
            <p className="cart-free-progress-text">
              Plus que <strong>{formatPrice(totals.remainingForFree)} FCFA</strong> pour la livraison gratuite
            </p>
            <div className="cart-free-progress-bar">
              <div
                className="cart-free-progress-fill"
                style={{ width: `${totals.freeProgress}%` }}
              />
            </div>
          </div>
        )}
        {items.length > 0 && totals.freeDelivery && (
          <div className="cart-free-progress cart-free-progress--unlocked">
            <p className="cart-free-progress-text">
              <strong>Livraison gratuite debloquee</strong>
            </p>
          </div>
        )}

        <div className="cart-grid">
          {/* ───── LEFT : items list ───── */}
          <div className="cart-items-col">
            {groups.map((group) => (
              <PharmacyCard
                key={group.pharmacyId}
                group={group}
                subTotal={groupTotals.get(group.pharmacyId) || 0}
                showSubTotal={groups.length > 1}
                deliveryEta={pharmacyEta(group.pharmacyId)}
                onQty={updateQty}
                onRemove={removeItem}
                onSave={saveForLater}
                onProduct={(id) => navigate({ name: 'product', params: { id } })}
                onAddMore={() => navigate('shop')}
              />
            ))}

            {/* ─── Save for later section ─── */}
            {savedItems.length > 0 && (
              <div className="cart-saved">
                <div className="cart-saved-head">
                  <h2 className="cart-saved-title">Sauvegarde pour plus tard</h2>
                  <span className="cart-saved-count">{savedItems.length}</span>
                </div>
                <div className="cart-saved-list">
                  {savedItems.map((s) => (
                    <SavedTile
                      key={`${s.productId}-${s.pharmacyId}`}
                      item={s}
                      onMove={() => moveBackToCart(s.productId)}
                      onRemove={() => removeSaved(s.productId)}
                      onProduct={() => navigate({ name: 'product', params: { id: s.productId } })}
                    />
                  ))}
                </div>
              </div>
            )}
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
                <span>{totals.freeDelivery ? 'Livraison' : 'Livraison Dakar'}</span>
                <strong className={totals.freeDelivery ? 'cart-summary-free' : undefined}>
                  {totals.freeDelivery ? 'GRATUITE' : `${formatPrice(totals.delivery)} FCFA`}
                </strong>
              </div>

              <div className="cart-summary-row">
                <span>Frais de service</span>
                <strong>{formatPrice(totals.serviceFee)} FCFA</strong>
              </div>

              {totals.promoOff > 0 && (
                <div className="cart-summary-row cart-summary-row--accent">
                  <span>Code promo applique</span>
                  <strong>-{formatPrice(totals.promoOff)} FCFA</strong>
                </div>
              )}

              {totals.loyaltyAvail > 0 && (
                <div className="cart-summary-row cart-summary-row--accent">
                  <span>Points fidelite dispo</span>
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
                    placeholder="BIENVENUE10, YARAM2000..."
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
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
                Commander
              </button>

              <button
                className="cart-continue-link"
                onClick={() => navigate('shop')}
              >
                ← Continuer mes achats
              </button>

              <div className="cart-trust-row">
                <span><IcoLock /> Paiement sécurisé</span>
                <span><IcoReturn /> Retours 14j</span>
                <span><IcoSenegal /> Made in Senegal</span>
              </div>
            </div>
          </aside>
        </div>

        {/* ───── Mobile sticky bar (aligne native l.320-366) ───── */}
        <div className="cart-mobile-bar">
          <div className="cart-mobile-bar-info">
            <span className="cart-mobile-bar-label">TOTAL A PAYER</span>
            <strong className="cart-mobile-bar-total">{formatPrice(totals.total)} FCFA</strong>
          </div>
          <button
            className="cart-btn-primary cart-mobile-bar-btn"
            onClick={() => navigate('checkout')}
          >
            <span>Commander</span>
            <span className="cart-mobile-bar-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </SiteLayout>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-composant : carte pharmacie
// ════════════════════════════════════════════════════════════════════
function PharmacyCard({ group, subTotal, showSubTotal, deliveryEta, onQty, onRemove, onSave, onProduct, onAddMore }) {
  return (
    <div className="cart-pharmacy">
      <div className="cart-pharmacy-head">
        <div className="cart-pharmacy-head-l">
          <div className="cart-pharmacy-icon"><IcoStore /></div>
          <div>
            <div className="cart-pharmacy-name">{group.pharmacyName}</div>
            <div className="cart-pharmacy-meta">
              <IcoClock /> {deliveryEta || 'Pret en 25-40 min'}
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
            onSave={onSave}
            onProduct={onProduct}
          />
        ))}
      </div>

      {showSubTotal && (
        <div className="cart-pharmacy-subtotal">
          <span>Sous-total pharmacie</span>
          <strong>{formatPrice(subTotal)} FCFA</strong>
        </div>
      )}

      <button className="cart-add-more" onClick={onAddMore}>
        <IcoPlus /> Ajouter d autres produits de cette pharmacie
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Save-for-later tile
// ════════════════════════════════════════════════════════════════════
function SavedTile({ item, onMove, onRemove, onProduct }) {
  return (
    <div className="cart-saved-tile">
      <button className="cart-saved-tile-img" onClick={onProduct} aria-label={item.name}>
        {item.img ? (
          <img src={item.img} alt={item.name} loading="lazy" />
        ) : (
          <div className="cart-saved-tile-ph">{(item.name || '?').slice(0, 1)}</div>
        )}
      </button>
      <div className="cart-saved-tile-body">
        {item.brand && <div className="cart-saved-tile-brand">{item.brand}</div>}
        <button className="cart-saved-tile-name" onClick={onProduct}>{item.name}</button>
        <div className="cart-saved-tile-price">{formatPrice(item.price)} FCFA</div>
        <div className="cart-saved-tile-actions">
          <button className="cart-saved-tile-move" onClick={onMove}>Remettre au panier</button>
          <button className="cart-saved-tile-remove" onClick={onRemove} aria-label="Supprimer">
            <IcoTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-composant : ligne produit
// ════════════════════════════════════════════════════════════════════
function CartLine({ item, onQty, onRemove, onSave, onProduct }) {
  const lineTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
  const setQty = (next) => onQty(item.productId, item.pharmacyId, next);

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
            Import 10-15 jours
          </span>
        )}
        <div className="cart-line-unit">{formatPrice(item.price)} FCFA / unite</div>
        <div className="cart-line-inline-actions">
          {onSave && (
            <button
              className="cart-line-save"
              onClick={() => onSave(item.productId, item.pharmacyId)}
            >
              Sauvegarder pour plus tard
            </button>
          )}
        </div>
      </div>

      <div className="cart-line-actions">
        <Stepper
          value={item.qty}
          onChange={setQty}
          min={1}
          max={99}
          size="sm"
          ariaLabel="Quantite de l article"
        />

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
