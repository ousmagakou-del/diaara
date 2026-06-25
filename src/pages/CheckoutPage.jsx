// ════════════════════════════════════════════════════════════════════
// CheckoutPage — Premium checkout (DoorDash / Uber Eats style)
// ════════════════════════════════════════════════════════════════════
// Desktop-first, 2 columns (1.5fr 1fr), sticky order summary.
// IMPORTANT : la logique de paiement reste sur Checkout.jsx (legacy).
// Ici, on construit la NEW UI uniquement. "Payer" => placeholder.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNav, useUser } from '../App';
import SiteLayout from '../components/SiteLayout';
import { getCart } from '../lib/cart';
import { getMyAddresses } from '../lib/supabase';
import { formatPrice } from '../lib/utils';
import './CheckoutPage.css';

// ─── Delivery modes ───────────────────────────────────────────────
const DELIVERY_MODES = [
  {
    id: 'standard',
    name: 'Standard',
    time: '30 - 45 min',
    price: 1500,
    desc: 'Livraison classique YARAM',
  },
  {
    id: 'express',
    name: 'Express',
    time: '15 - 25 min',
    price: 2500,
    desc: 'Priorité maximale',
  },
  {
    id: 'scheduled',
    name: 'Programmée',
    time: 'Choisir un créneau',
    price: 1500,
    desc: 'Te livre quand tu veux',
  },
];

// ─── Payment methods ──────────────────────────────────────────────
const PAYMENTS = [
  { id: 'cod', name: 'Espèces à la livraison', sub: 'Tu paies le livreur', kind: 'cod' },
  { id: 'wave', name: 'Wave', sub: 'Paiement instantané', kind: 'wave' },
  { id: 'om', name: 'Orange Money', sub: 'Paiement instantané', kind: 'om' },
  { id: 'card', name: 'Carte bancaire', sub: 'Visa, Mastercard', kind: 'card' },
];

// ─── SVG Icons (inline, premium thin-stroke) ─────────────────────
const Icon = {
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  scooter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5"/>
      <circle cx="18.5" cy="17.5" r="3.5"/>
      <path d="M15 6h3l2 6"/>
      <path d="M9 17.5h6l3-6h-7l-2-4H6"/>
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="3"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="14 3 14 9 20 9"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
      <line x1="9" y1="18" x2="13" y2="18"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="2.5"/>
      <path d="M6 10v.01"/>
      <path d="M18 14v.01"/>
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

// ─── Payment glyph (mini logo) ───────────────────────────────────
function PayGlyph({ kind }) {
  if (kind === 'cod') return <span className="ck-pay-glyph ck-glyph-cod">{Icon.cash}</span>;
  if (kind === 'wave') return <span className="ck-pay-glyph ck-glyph-wave">Wave</span>;
  if (kind === 'om') return <span className="ck-pay-glyph ck-glyph-om">OM</span>;
  if (kind === 'card') {
    return (
      <span className="ck-pay-glyph ck-glyph-card">
        <span className="ck-glyph-visa">VISA</span>
        <span className="ck-glyph-mc"><span/><span/></span>
      </span>
    );
  }
  return null;
}

// ─── Step badge (1, 2, 3, 4) ─────────────────────────────────────
function StepBadge({ n }) {
  return <span className="ck-step-num">{n}</span>;
}

export default function CheckoutPage() {
  const { navigate } = useNav();
  const { user } = useUser();

  // ─── Cart (synchronous) ───────────────────────────────────────
  const [items] = useState(() => getCart());

  // ─── Addresses ────────────────────────────────────────────────
  const [addresses, setAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrError, setAddrError] = useState(false);

  // ─── Manual address (guest) ───────────────────────────────────
  const [guestAddr, setGuestAddr] = useState({ street: '', city: 'Dakar', phone: '' });

  // ─── Delivery + payment + notes ───────────────────────────────
  const [deliveryMode, setDeliveryMode] = useState('standard');
  const [payment, setPayment] = useState('cod');
  const [notes, setNotes] = useState('');

  // ─── Mobile accordions ────────────────────────────────────────
  const [openSection, setOpenSection] = useState('all'); // 'all' on desktop
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

  // ─── Submission ───────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ─── Load addresses ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getMyAddresses();
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setAddresses(arr);
        const def = arr.find((a) => a.is_default) || arr[0];
        if (def) setSelectedAddrId(def.id);
      } catch (e) {
        if (!cancelled) setAddrError(true);
      } finally {
        if (!cancelled) setAddrLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Empty cart guard ────────────────────────────────────────
  if (!items || items.length === 0) {
    return (
      <SiteLayout hideFooter={true}>
        <div className="checkout-page">
          <div className="ck-empty">
            <div className="ck-empty-icon">🛒</div>
            <h2 className="ck-empty-title">Ton panier est vide</h2>
            <p className="ck-empty-sub">Découvre nos produits authentiques.</p>
            <button className="ck-btn ck-btn-primary" onClick={() => navigate('shop')}>
              Continuer mes achats
            </button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── Totals ───────────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const currentDelivery = DELIVERY_MODES.find((m) => m.id === deliveryMode) || DELIVERY_MODES[0];
  const deliveryFee = currentDelivery.price;
  const serviceFee = Math.max(250, Math.round(subtotal * 0.05));
  const total = subtotal + deliveryFee + serviceFee;

  const selectedAddr = useMemo(
    () => addresses.find((a) => a.id === selectedAddrId) || null,
    [addresses, selectedAddrId]
  );

  // ─── Guest address validity ───────────────────────────────────
  const guestAddrValid =
    guestAddr.street.trim().length > 3 &&
    guestAddr.city.trim().length > 1 &&
    guestAddr.phone.trim().length >= 8;

  const canSubmit = user
    ? !!selectedAddr
    : guestAddrValid;

  // ─── Submit (placeholder) ────────────────────────────────────
  const handleSubmit = () => {
    const nextErrors = {};
    if (user && !selectedAddr) nextErrors.address = 'Sélectionne une adresse';
    if (!user) {
      if (guestAddr.street.trim().length < 3) nextErrors.street = 'Rue requise';
      if (guestAddr.city.trim().length < 2) nextErrors.city = 'Ville requise';
      if (guestAddr.phone.trim().length < 8) nextErrors.phone = 'Téléphone invalide';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    console.log('[CheckoutPage] place order (placeholder)', {
      items,
      address: user ? selectedAddr : guestAddr,
      deliveryMode,
      payment,
      notes,
      subtotal,
      deliveryFee,
      serviceFee,
      total,
    });
    // Simule un délai pour le feedback visuel
    setTimeout(() => {
      setSubmitting(false);
      // TODO : intégrer payment réel. Pour le moment :
      window.alert('Commande prise en compte ! (placeholder)');
      // Optionnel : redirect vers le legacy checkout pour le real payment flow
      // navigate('checkout');
    }, 800);
  };

  // ─── Section toggle (mobile only) ─────────────────────────────
  const toggleSection = (id) => {
    if (!isMobile) return;
    setOpenSection((cur) => (cur === id ? null : id));
  };
  const isOpen = (id) => !isMobile || openSection === 'all' || openSection === id;

  // ─── Mini items preview (max 3) ───────────────────────────────
  const previewItems = items.slice(0, 3);
  const extraCount = Math.max(0, items.length - previewItems.length);

  return (
    <SiteLayout hideFooter={true}>
      <div className="checkout-page">
        {/* ─── HEADER ─────────────────────────────────────── */}
        <header className="ck-header">
          <button className="ck-back" onClick={() => navigate('cart')} aria-label="Retour au panier">
            {Icon.back}
            <span>Retour au panier</span>
          </button>
          <div className="ck-header-titles">
            <h1 className="ck-title">Finaliser ma commande</h1>
            <p className="ck-subtitle">
              {items.length} article{items.length > 1 ? 's' : ''} · livraison YARAM
            </p>
          </div>
        </header>

        {/* ─── GRID 2 COLS ────────────────────────────────── */}
        <div className="ck-grid">
          {/* ════════ LEFT COLUMN ════════ */}
          <div className="ck-left">
            {/* ─── 1. ADRESSE ───────────────────────────── */}
            <section className={`ck-card ck-section ${isOpen('address') ? 'ck-open' : ''}`}>
              <button
                className="ck-section-head"
                onClick={() => toggleSection('address')}
                aria-expanded={isOpen('address')}
              >
                <StepBadge n={1} />
                <span className="ck-section-icon">{Icon.pin}</span>
                <h2 className="ck-section-title">Adresse de livraison</h2>
                {isMobile && <span className="ck-section-chev">{Icon.chevron}</span>}
              </button>

              <div className="ck-section-body">
                {!user ? (
                  <div className="ck-guest">
                    <div className="ck-guest-banner">
                      <strong>Connecte-toi</strong> pour utiliser tes adresses sauvegardées.
                      <button
                        className="ck-guest-link"
                        onClick={() => navigate('auth')}
                      >
                        Se connecter →
                      </button>
                    </div>
                    <div className="ck-guest-form">
                      <div className="ck-field">
                        <label>Rue / Quartier</label>
                        <input
                          type="text"
                          value={guestAddr.street}
                          placeholder="Ex : Mermoz, en face de la pharmacie"
                          onChange={(e) => setGuestAddr({ ...guestAddr, street: e.target.value })}
                          className={errors.street ? 'ck-input-err' : ''}
                        />
                        {errors.street && <span className="ck-err">{errors.street}</span>}
                      </div>
                      <div className="ck-field-row">
                        <div className="ck-field">
                          <label>Ville</label>
                          <input
                            type="text"
                            value={guestAddr.city}
                            onChange={(e) => setGuestAddr({ ...guestAddr, city: e.target.value })}
                            className={errors.city ? 'ck-input-err' : ''}
                          />
                          {errors.city && <span className="ck-err">{errors.city}</span>}
                        </div>
                        <div className="ck-field">
                          <label>Téléphone</label>
                          <input
                            type="tel"
                            value={guestAddr.phone}
                            placeholder="77 123 45 67"
                            onChange={(e) => setGuestAddr({ ...guestAddr, phone: e.target.value })}
                            className={errors.phone ? 'ck-input-err' : ''}
                          />
                          {errors.phone && <span className="ck-err">{errors.phone}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : addrLoading ? (
                  <div className="ck-loading">
                    <div className="ck-spinner" />
                    <span>Chargement des adresses…</span>
                  </div>
                ) : addresses.length === 0 ? (
                  <button
                    className="ck-addr-empty"
                    onClick={() => navigate('addresses')}
                  >
                    <span className="ck-addr-empty-plus">+</span>
                    <div>
                      <strong>Ajouter une adresse</strong>
                      <span>On a besoin d'une adresse pour te livrer</span>
                    </div>
                    {Icon.chevron}
                  </button>
                ) : (
                  <>
                    <div className="ck-addr-selected">
                      <div className="ck-addr-icon">{Icon.pin}</div>
                      <div className="ck-addr-info">
                        <div className="ck-addr-head">
                          <strong>{selectedAddr?.label || 'Adresse'}</strong>
                          {selectedAddr?.is_default && <span className="ck-tag">Défaut</span>}
                        </div>
                        <p className="ck-addr-line">{selectedAddr?.line1 || selectedAddr?.line || '—'}</p>
                        <p className="ck-addr-city">{selectedAddr?.city}</p>
                      </div>
                      <button
                        className="ck-link"
                        onClick={() => navigate('addresses')}
                      >
                        Changer
                      </button>
                    </div>
                    {errors.address && <span className="ck-err">{errors.address}</span>}
                  </>
                )}
              </div>
            </section>

            {/* ─── 2. MODE LIVRAISON ───────────────────── */}
            <section className={`ck-card ck-section ${isOpen('delivery') ? 'ck-open' : ''}`}>
              <button
                className="ck-section-head"
                onClick={() => toggleSection('delivery')}
                aria-expanded={isOpen('delivery')}
              >
                <StepBadge n={2} />
                <span className="ck-section-icon">{Icon.scooter}</span>
                <h2 className="ck-section-title">Mode de livraison</h2>
                {isMobile && <span className="ck-section-chev">{Icon.chevron}</span>}
              </button>

              <div className="ck-section-body">
                <div className="ck-delivery-list">
                  {DELIVERY_MODES.map((m) => {
                    const active = deliveryMode === m.id;
                    return (
                      <button
                        key={m.id}
                        className={`ck-radio-card ${active ? 'active' : ''}`}
                        onClick={() => setDeliveryMode(m.id)}
                      >
                        <div className="ck-radio-dot">
                          {active && <span />}
                        </div>
                        <div className="ck-radio-icon">{Icon.scooter}</div>
                        <div className="ck-radio-body">
                          <div className="ck-radio-head">
                            <strong>{m.name}</strong>
                            <span className="ck-radio-price">{formatPrice(m.price)} FCFA</span>
                          </div>
                          <div className="ck-radio-sub">
                            <span className="ck-radio-time">{m.time}</span>
                            <span className="ck-dot-sep">·</span>
                            <span>{m.desc}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ─── 3. PAIEMENT ───────────────────────────── */}
            <section className={`ck-card ck-section ${isOpen('payment') ? 'ck-open' : ''}`}>
              <button
                className="ck-section-head"
                onClick={() => toggleSection('payment')}
                aria-expanded={isOpen('payment')}
              >
                <StepBadge n={3} />
                <span className="ck-section-icon">{Icon.card}</span>
                <h2 className="ck-section-title">Paiement</h2>
                {isMobile && <span className="ck-section-chev">{Icon.chevron}</span>}
              </button>

              <div className="ck-section-body">
                <div className="ck-pay-list">
                  {PAYMENTS.map((p) => {
                    const active = payment === p.id;
                    return (
                      <button
                        key={p.id}
                        className={`ck-radio-card ck-pay-card ${active ? 'active' : ''}`}
                        onClick={() => setPayment(p.id)}
                      >
                        <div className="ck-radio-dot">
                          {active && <span />}
                        </div>
                        <PayGlyph kind={p.kind} />
                        <div className="ck-radio-body">
                          <strong>{p.name}</strong>
                          <span className="ck-radio-sub-line">{p.sub}</span>
                        </div>
                        {active && (
                          <div className="ck-check-mark" aria-hidden>
                            {Icon.check}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ─── 4. NOTES ──────────────────────────────── */}
            <section className={`ck-card ck-section ${isOpen('notes') ? 'ck-open' : ''}`}>
              <button
                className="ck-section-head"
                onClick={() => toggleSection('notes')}
                aria-expanded={isOpen('notes')}
              >
                <StepBadge n={4} />
                <span className="ck-section-icon">{Icon.note}</span>
                <h2 className="ck-section-title">Notes au livreur <span className="ck-optional">(optionnel)</span></h2>
                {isMobile && <span className="ck-section-chev">{Icon.chevron}</span>}
              </button>

              <div className="ck-section-body">
                <textarea
                  className="ck-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex : Sonner 2 fois, code porte 1234"
                  maxLength={240}
                />
                <div className="ck-textarea-count">{notes.length} / 240</div>
              </div>
            </section>
          </div>

          {/* ════════ RIGHT COLUMN — SUMMARY ════════ */}
          <aside className="ck-right">
            <div className="ck-summary ck-card">
              <h2 className="ck-summary-title">Ta commande</h2>

              {/* Mini cart */}
              <div className="ck-mini-cart">
                {previewItems.map((it, i) => (
                  <div key={i} className="ck-mini-row">
                    <div className="ck-mini-thumb">
                      {it.img ? (
                        <img src={it.img} alt={it.name} loading="lazy" />
                      ) : (
                        <span>💊</span>
                      )}
                    </div>
                    <div className="ck-mini-info">
                      <div className="ck-mini-name">{it.name}</div>
                      <div className="ck-mini-meta">
                        ×{it.qty} · {formatPrice(it.price)} FCFA
                      </div>
                    </div>
                    <div className="ck-mini-total">
                      {formatPrice((Number(it.price) || 0) * (Number(it.qty) || 0))}
                    </div>
                  </div>
                ))}
                {extraCount > 0 && (
                  <div className="ck-mini-more">+ {extraCount} autre{extraCount > 1 ? 's' : ''}</div>
                )}
              </div>

              {/* Totals */}
              <div className="ck-totals">
                <div className="ck-total-row">
                  <span>Sous-total</span>
                  <strong>{formatPrice(subtotal)} FCFA</strong>
                </div>
                <div className="ck-total-row">
                  <span>Livraison <span className="ck-mode-tag">{currentDelivery.name}</span></span>
                  <strong>{formatPrice(deliveryFee)} FCFA</strong>
                </div>
                <div className="ck-total-row">
                  <span>Frais de service</span>
                  <strong>{formatPrice(serviceFee)} FCFA</strong>
                </div>
                <div className="ck-total-divider" />
                <div className="ck-total-row ck-total-final">
                  <span>Total</span>
                  <strong>{formatPrice(total)} FCFA</strong>
                </div>
              </div>

              {/* CTA */}
              <button
                className="ck-btn ck-btn-primary ck-cta"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <>
                    <span className="ck-cta-spinner" />
                    <span>Traitement…</span>
                  </>
                ) : (
                  <>Payer {formatPrice(total)} FCFA</>
                )}
              </button>

              {/* Trust badges */}
              <div className="ck-trust">
                <div className="ck-trust-item">
                  <span className="ck-trust-icon">{Icon.lock}</span>
                  <span>Paiement sécurisé</span>
                </div>
                <div className="ck-trust-item">
                  <span className="ck-trust-icon">{Icon.shield}</span>
                  <span>Authentique garanti</span>
                </div>
              </div>

              <button className="ck-back-link" onClick={() => navigate('cart')}>
                ← Retour au panier
              </button>
            </div>
          </aside>
        </div>

        {/* ─── STICKY MOBILE BAR ──────────────────────────── */}
        <div className="ck-mobile-bar">
          <div className="ck-mobile-bar-info">
            <span className="ck-mobile-bar-label">Total</span>
            <strong className="ck-mobile-bar-total">{formatPrice(total)} FCFA</strong>
          </div>
          <button
            className="ck-btn ck-btn-primary ck-mobile-bar-cta"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Traitement…' : 'Payer'}
          </button>
        </div>
      </div>
    </SiteLayout>
  );
}
