// ════════════════════════════════════════════════════════════════════
// CheckoutPage — Single page checkout Uber Eats / Stripe style
// ════════════════════════════════════════════════════════════════════
// Refactor UX Marshall (juillet 2026) : on retire les 3 etapes
// (Adresse -> Livraison -> Paiement -> Confirmation) au profit d une
// page unique scrollable avec recap sticky a droite (desktop) ou en
// haut (mobile) + CTA principal "Commander" toujours visible.
//
// Motivation : le flow 3-etapes multipliait les clics "Continuer" pour
// une friction inutile (paniers courts, users mobile). Le pattern
// single-page :
//   - reduit le nb de taps
//   - garde tout le contexte visible (total + articles) pendant le fill
//   - focus sur le CTA final (disable + hint quand donnee manquante)
//
// Toutes les regles metier restent en place :
//   - detection isPreorder / hasImportedItem (masque today/express/standard,
//     force le mode "import", masque COD)
//   - split acompte 50 % / solde 50 % dans le recap si preorder
//   - filtre payment methods (COD hors preorder)
//   - promo, cheque cadeau MySargal, points fidelite
//   - createOrder(...) inchange
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNav, useUser } from '../App';
import SiteLayout from '../components/SiteLayout';
import { getCart, clearCart } from '../lib/cart';
import { getMyAddresses, supabase } from '../lib/supabase';
import { formatPrice } from '../lib/utils';
import './CheckoutPage.css';

// ─── Constants ────────────────────────────────────────────────────
const PROGRESS_KEY = 'yaram-checkout-progress';

const DELIVERY_MODES = [
  { id: 'today',    name: 'Aujourd hui',  time: 'Livre avant 20h', price: 3500, desc: 'Meme jour, Dakar uniquement' },
  { id: 'express',  name: 'Express',      time: '15 - 25 min',     price: 2500, desc: 'Priorite maximale' },
  { id: 'standard', name: 'Standard',     time: '30 - 45 min',     price: 1500, desc: 'Livraison classique YARAM' },
];

// Mode dedie pour les commandes contenant au moins un produit import.
// Le produit doit d abord etre importe (2-3 semaines), puis livre a Dakar.
// Les modes today/express/standard sont masques dans ce cas — sinon promesse
// mensongere de livraison en 30 min pour un produit qui arrive dans 3 semaines.
function buildImportDeliveryMode(/* leadDays */) {
  // Libelle fixe 10-15 jours max (pas de variation selon lead_time_days du produit).
  return {
    id: 'import',
    name: 'Import YARAM',
    time: '10-15 jours',
    price: 1500,
    desc: 'Import international puis livraison Dakar',
  };
}

// ─── Payment methods — CALQUE EXACT app native (yaram-native/app/checkout.jsx)
const WAVE_LOGO = 'https://qxhhnrnworwrnwmqekmb.supabase.co/storage/v1/object/public/banner-images/logo-wave.jpg';
const OM_LOGO   = 'https://qxhhnrnworwrnwmqekmb.supabase.co/storage/v1/object/public/banner-images/logo-orange.png';

const PAYMENTS = [
  { id: 'wave', name: 'Wave',                logoUrl: WAVE_LOGO, sub: 'Paiement instantane',  enabled: true,  preorderOk: true  },
  { id: 'cod',  name: 'Cash a la livraison', logoUrl: null,      sub: 'Tu paies au livreur',  enabled: true,  preorderOk: false },
  { id: 'om',   name: 'Orange Money',        logoUrl: OM_LOGO,   sub: 'OM Senegal',           enabled: false, preorderOk: true  },
];

// ─── Icons ────────────────────────────────────────────────────────
const Icon = {
  pin: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>),
  scooter: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l2 6"/><path d="M9 17.5h6l3-6h-7l-2-4H6"/></svg>),
  card: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/></svg>),
  note: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="13" y2="18"/></svg>),
  check: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  back: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>),
  lock: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
  shield: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>),
  cash: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>),
  tag: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>),
  gift: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>),
  loyalty: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
  target: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>),
  info: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>),
  plane: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>),
};

function PayLogo({ method }) {
  if (method.logoUrl) {
    return (
      <span className={`ck-pay-logo ck-pay-logo--${method.id}`}>
        <img src={method.logoUrl} alt={method.name} loading="lazy" decoding="async" />
      </span>
    );
  }
  return (
    <span className="ck-pay-logo ck-pay-logo--fallback" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    </span>
  );
}

// ─── Session helpers ──────────────────────────────────────────────
function loadProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveProgress(state) {
  try { sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(state)); } catch {}
}
function clearProgress() {
  try { sessionStorage.removeItem(PROGRESS_KEY); } catch {}
}

// ═══════════════════════════════════════════════════════════════════
export default function CheckoutPage() {
  const { navigate } = useNav();
  const { user } = useUser();
  const submitLockRef = useRef(false);

  // ─── Cart ───────────────────────────────────────────────────────
  const [items] = useState(() => getCart());

  // ─── Persisted state (session) ──────────────────────────────────
  const persisted = useMemo(() => loadProgress() || {}, []);

  // ─── Addresses ──────────────────────────────────────────────────
  const [addresses, setAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(persisted.selectedAddrId || null);
  const [, setAddrLoading] = useState(true);
  const [, setAddrError] = useState(false);
  const [geoloc, setGeoloc] = useState(persisted.geoloc || null);

  // Guest / new address form
  const [guestAddr, setGuestAddr] = useState(persisted.guestAddr || { label: 'Domicile', street: '', city: 'Dakar', phone: '' });
  const [useNewAddress, setUseNewAddress] = useState(persisted.useNewAddress || false);

  // ─── Delivery + payment + notes ─────────────────────────────────
  const [deliveryMode, setDeliveryMode] = useState(persisted.deliveryMode || 'standard');

  // ─── Detection Import / Preorder ────────────────────────────────
  const hasImportedItem = useMemo(
    () => items.some((it) => it.is_imported === true),
    [items]
  );
  const importLeadDays = useMemo(() => {
    if (!hasImportedItem) return 0;
    const days = items
      .filter((it) => it.is_imported)
      .map((it) => Number(it.lead_time_days) || 15);
    return days.length > 0 ? Math.max(...days) : 15;
  }, [items, hasImportedItem]);
  const isPreorder = hasImportedItem;

  // Liste de modes visible : soit les 3 modes normaux, soit UN SEUL mode import.
  const availableDeliveryModes = useMemo(
    () => (hasImportedItem ? [buildImportDeliveryMode(importLeadDays)] : DELIVERY_MODES),
    [hasImportedItem, importLeadDays]
  );

  // Force le mode adequat des qu on detecte / retire des items import.
  useEffect(() => {
    if (hasImportedItem && deliveryMode !== 'import') {
      setDeliveryMode('import');
    } else if (!hasImportedItem && deliveryMode === 'import') {
      setDeliveryMode('standard');
    }
  }, [hasImportedItem, deliveryMode]);

  // Filtre calque native : masque methodes non compatibles preorder si preorder.
  const visiblePayments = useMemo(
    () => {
      const base = PAYMENTS.filter((p) => (isPreorder ? p.preorderOk : true));
      // Corporate B2B : ajout methode "Facture entreprise 30j" quand user rattache a un compte actif
      if (corporate && !isPreorder) {
        base.unshift({
          id: 'corp_invoice',
          name: 'Facture entreprise (paiement 30j)',
          logoUrl: null,
          sub: `Compte pro ${corporate.account.legal_name} · credit ${new Intl.NumberFormat('fr-FR').format(creditAvailable)} FCFA dispo`,
          enabled: true,
          preorderOk: false,
        });
      }
      return base;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPreorder, corporate, creditAvailable]
  );
  const defaultPayment = useMemo(
    () => (visiblePayments.find((p) => p.enabled)?.id) || 'wave',
    [visiblePayments]
  );
  const initialPayment = (() => {
    const candidate = persisted.payment;
    const found = candidate && PAYMENTS.find((p) => p.id === candidate);
    if (!found || !found.enabled) return defaultPayment;
    if (isPreorder && !found.preorderOk) return defaultPayment;
    return candidate;
  })();
  const [payment, setPayment] = useState(initialPayment);
  const [notes, setNotes] = useState(persisted.notes || '');

  // ─── Promo / Gift card / Loyalty ────────────────────────────────
  const [promoCode, setPromoCode] = useState(persisted.promoCode || '');
  const [promoOff, setPromoOff] = useState(persisted.promoOff || 0);
  const [promoMsg, setPromoMsg] = useState('');

  const [giftCode, setGiftCode] = useState(persisted.giftCode || '');
  const [giftValue, setGiftValue] = useState(persisted.giftValue || 0);
  const [giftMsg, setGiftMsg] = useState('');
  const [giftChecking, setGiftChecking] = useState(false);

  const [loyaltyToUse, setLoyaltyToUse] = useState(persisted.loyaltyToUse || 0);

  // ─── Loyalty tier snapshot (cashback + free delivery) ─────────────
  const [tierSnapshot, setTierSnapshot] = useState(null); // { tier, tier_config:{cashback_pct, free_delivery_from} }
  useEffect(() => {
    if (!user?.id) return;
    let cancel = false;
    supabase.rpc('loyalty_get_my_tier').then((r) => {
      if (!cancel && r?.data?.success) setTierSnapshot(r.data);
    }).catch(() => {});
    return () => { cancel = true; };
  }, [user?.id]);
  const tierCashbackPct = Number(tierSnapshot?.tier_config?.cashback_pct || 3);
  const tierFreeFrom    = tierSnapshot?.tier_config?.free_delivery_from;
  const tierId          = tierSnapshot?.tier || user?.loyalty_tier || 'bronze';

  // ─── Submission ─────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  // ─── Corporate account detection (bulk discount + invoice payment) ─────
  const [corporate, setCorporate] = useState(null); // { account, balance_owed } quand actif
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('corporate_get_my_account');
        if (cancelled) return;
        if (data?.success && data.account && data.account.status === 'active') {
          setCorporate({ account: data.account, balance_owed: data.balance_owed || 0 });
        }
      } catch { /* silent : compte pro optionnel */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Load addresses ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getMyAddresses();
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setAddresses(arr);
        if (!selectedAddrId) {
          const def = arr.find((a) => a.is_default) || arr[0];
          if (def) setSelectedAddrId(def.id);
        }
      } catch {
        if (!cancelled) setAddrError(true);
      } finally {
        if (!cancelled) setAddrLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto geoloc (best effort) ──────────────────────────────────
  const requestGeoloc = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoloc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoloc(null),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // ─── Persist progress to sessionStorage ─────────────────────────
  useEffect(() => {
    saveProgress({
      selectedAddrId, guestAddr, useNewAddress, deliveryMode, payment,
      notes, promoCode, promoOff, giftCode, giftValue, loyaltyToUse, geoloc,
    });
  }, [selectedAddrId, guestAddr, useNewAddress, deliveryMode, payment,
      notes, promoCode, promoOff, giftCode, giftValue, loyaltyToUse, geoloc]);

  // ─── Empty cart guard ───────────────────────────────────────────
  if ((!items || items.length === 0) && !success) {
    return (
      <SiteLayout hideFooter={true}>
        <div className="checkout-page">
          <div className="ck-empty">
            <h2 className="ck-empty-title">Ton panier est vide</h2>
            <p className="ck-empty-sub">Decouvre nos produits authentiques.</p>
            <button className="ck-btn ck-btn-primary" onClick={() => navigate('shop')}>
              Continuer mes achats
            </button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── Totals cascade ─────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const currentDelivery = availableDeliveryModes.find((m) => m.id === deliveryMode) || availableDeliveryModes[0];

  // ─── Tier free delivery override ─────────────────────────────────
  // Regle : ne s applique PAS aux imports (garde-fou fix precommande).
  let deliveryFee = currentDelivery.price;
  let freeDeliveryReason = null;
  if (!hasImportedItem) {
    if (tierId === 'gold') {
      deliveryFee = 0;
      freeDeliveryReason = 'gold_always';
    } else if (typeof tierFreeFrom === 'number' && tierFreeFrom > 0 && subtotal >= tierFreeFrom) {
      deliveryFee = 0;
      freeDeliveryReason = 'tier_threshold';
    }
  }

  const serviceFee = 0; // Zero frais de service (promesse YARAM, aligne app native)

  // Cashback preview : X% du (subtotal + livraison) hors imports
  const cashbackEligibleAmount = hasImportedItem ? 0 : subtotal;
  const cashbackPointsPreview = Math.round(cashbackEligibleAmount * tierCashbackPct / 100);

  const maxLoyaltyPoints = Math.min(
    Math.floor((user?.loyalty_points || 0)),
    Math.floor(subtotal * 0.1)
  );
  const loyaltyApplied = Math.min(loyaltyToUse, maxLoyaltyPoints);

  // Corporate B2B : remise volume appliquee sur subtotal (hors imports)
  const corporateDiscountPct = corporate && !hasImportedItem ? Number(corporate.account?.discount_pct || 0) : 0;
  const corporateDiscount = Math.round(subtotal * corporateDiscountPct / 100);
  const creditAvailable = corporate
    ? Math.max(0, Number(corporate.account?.credit_limit_fcfa || 0) - Number(corporate.balance_owed || 0))
    : 0;

  const beforeDiscounts = subtotal + deliveryFee + serviceFee;
  const totalDiscounts = promoOff + Math.min(giftValue, subtotal) + loyaltyApplied + corporateDiscount;
  const total = Math.max(0, beforeDiscounts - totalDiscounts);

  // Preorder split (acompte 50 % / solde 50 %) — affiche dans le recap.
  const preorderDeposit = isPreorder ? Math.round(total * 0.5) : 0;
  const preorderBalance = isPreorder ? total - preorderDeposit : 0;

  const selectedAddr = useMemo(
    () => addresses.find((a) => a.id === selectedAddrId) || null,
    [addresses, selectedAddrId]
  );

  const activeAddress = !user || useNewAddress || !selectedAddr ? guestAddr : {
    label: selectedAddr.label,
    street: selectedAddr.line1 || selectedAddr.line || '',
    city: selectedAddr.city || 'Dakar',
    phone: selectedAddr.phone || user?.phone || '',
  };

  const addressValid =
    activeAddress.street && activeAddress.street.trim().length > 3 &&
    activeAddress.city && activeAddress.city.trim().length > 1 &&
    activeAddress.phone && activeAddress.phone.trim().length >= 8;

  const paymentValid = (() => {
    const chosen = PAYMENTS.find((p) => p.id === payment);
    return !!chosen && chosen.enabled && (!isPreorder || chosen.preorderOk);
  })();

  const canConfirm = addressValid && paymentValid && !submitting && !success;

  // Message d aide au CTA — pointe la premiere donnee manquante.
  const missingHint = (() => {
    if (!addressValid) return 'Ajoute une adresse de livraison valide';
    if (!paymentValid) return 'Choisis un mode de paiement';
    return null;
  })();

  // ─── Promo / Gift card validation ───────────────────────────────
  const applyPromo = useCallback(() => {
    const code = promoCode.trim().toUpperCase();
    if (!code) { setPromoOff(0); setPromoMsg(''); return; }
    const table = {
      YARAM10: { type: 'pct', value: 0.1, label: '-10 %' },
      YARAM5: { type: 'pct', value: 0.05, label: '-5 %' },
      BIENVENUE: { type: 'flat', value: 2000, label: '-2 000 FCFA' },
    };
    const t = table[code];
    if (!t) {
      setPromoOff(0);
      setPromoMsg('Code invalide');
      return;
    }
    const off = t.type === 'pct' ? Math.round(subtotal * t.value) : t.value;
    setPromoOff(off);
    setPromoMsg(`Code applique : ${t.label}`);
  }, [promoCode, subtotal]);

  useEffect(() => {
    // Auto-load promo from cart page if set
    if (!promoCode) {
      try {
        const raw = sessionStorage.getItem('yaram-checkout-promo');
        if (raw) {
          const { code, off } = JSON.parse(raw);
          setPromoCode(code);
          setPromoOff(off);
          setPromoMsg(`Code repris du panier : ${code}`);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyGiftCard = useCallback(async () => {
    const code = giftCode.trim().toUpperCase();
    if (!code) { setGiftValue(0); setGiftMsg(''); return; }
    setGiftChecking(true); setGiftMsg('');
    try {
      const mod = await import('../lib/supabase');
      const supabase = mod.supabase;
      if (supabase && typeof supabase.rpc === 'function') {
        const { data, error } = await supabase.rpc('public_check_gift_card', { code_input: code });
        if (!error && data && data.valid) {
          const val = Math.min(Number(data.value) || 0, subtotal);
          setGiftValue(val);
          setGiftMsg(`Cheque cadeau applique : ${formatPrice(val)} FCFA`);
          setGiftChecking(false);
          return;
        }
      }
    } catch { /* RPC absent */ }
    // Mock table
    const mock = { SARGAL5000: 5000, SARGAL10000: 10000 };
    if (mock[code]) {
      const val = Math.min(mock[code], subtotal);
      setGiftValue(val);
      setGiftMsg(`Cheque cadeau applique : ${formatPrice(val)} FCFA`);
    } else {
      setGiftValue(0);
      setGiftMsg('Cheque cadeau introuvable');
    }
    setGiftChecking(false);
  }, [giftCode, subtotal]);

  // ─── Submit ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (submitLockRef.current || submitting) return;
    submitLockRef.current = true;

    const nextErrors = {};
    if (!addressValid) nextErrors.address = 'Adresse invalide';
    if (!paymentValid) nextErrors.payment = 'Choisis un mode de paiement';
    // Corporate : verifie ligne de credit avant validation
    if (payment === 'corp_invoice' && corporate) {
      if (total > creditAvailable) {
        nextErrors.payment = `Credit insuffisant. Disponible : ${new Intl.NumberFormat('fr-FR').format(creditAvailable)} FCFA`;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      submitLockRef.current = false;
      // Scroll vers l element manquant.
      const anchor = !addressValid ? 'ck-anchor-address' : 'ck-anchor-payment';
      const el = document.getElementById(anchor);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    setSubmitting(true);

    // Preorder : acompte 50 % + solde 50 % + date arrivee estimee.
    const deposit = preorderDeposit;
    const balance = preorderBalance;
    let expectedArrival = null;
    if (isPreorder && importLeadDays > 0) {
      const arrival = new Date();
      arrival.setDate(arrival.getDate() + importLeadDays + 3);
      expectedArrival = arrival.toISOString().split('T')[0];
    }

    try {
      const ordersMod = await import('../lib/supabase/orders');
      const created = await ordersMod.createOrder({
        items,
        address: activeAddress,
        paymentMethod: payment,
        subtotal,
        shipping: deliveryFee,
        total,
        promoCode,
        promoDiscount: (promoOff || 0) + (giftValue || 0) + (loyaltyApplied || 0),
        isPreorder,
        depositAmount: deposit,
        balanceAmount: balance,
        expectedArrivalDate: expectedArrival,
      });

      if (!created?.id) {
        setSubmitting(false);
        submitLockRef.current = false;
        alert('Impossible de creer la commande. Reessaie ou contacte le support WhatsApp.');
        return;
      }

      // Corporate B2B : facture 30j (paiement differe) — cree une entree corporate_invoices.
      if (payment === 'corp_invoice' && corporate) {
        try {
          await supabase.rpc('corporate_create_invoice_for_order', {
            p_order_id: String(created.id),
            p_amount: total,
          });
        } catch (invErr) {
          console.warn('[checkout] corporate invoice create failed:', invErr?.message);
        }
      }

      clearCart();
      clearProgress();
      setSuccess(true);

      const isCash = payment === 'cod';
      const isCorpInvoice = payment === 'corp_invoice';
      setTimeout(() => {
        // COD ou facture entreprise : pas de paiement en ligne, direct au tracking
        if (isCash || isCorpInvoice) navigate({ name: 'order_tracking', params: { orderId: created.id } });
        else navigate({ name: 'payment', params: { orderId: created.id } });
      }, 1200);
    } catch (e) {
      console.error('[checkout] submit failed:', e?.message);
      submitLockRef.current = false;
      setSubmitting(false);
      alert('Une erreur est survenue : ' + (e?.message || 'inconnue') + '. Reessaie ou contacte le support.');
    }
  };

  // ─── Rendering ──────────────────────────────────────────────────
  const previewItems = items.slice(0, 3);
  const extraCount = Math.max(0, items.length - previewItems.length);

  return (
    <SiteLayout hideFooter={true}>
      <div className="checkout-page checkout-page--single">
        {/* Header */}
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

        {success ? (
          <div className="ck-success-wrap">
            <div className="ck-card ck-section">
              <div className="ck-success">
                <div className="ck-success-icon">{Icon.check}</div>
                <h3>Merci pour ta commande !</h3>
                <p>Redirection vers le suivi de commande…</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="ck-grid ck-grid--v2 ck-grid--single">
            <div className="ck-left">
              {/* Bandeau Import (preorder) — informe sur le delai 10-15j. */}
              {isPreorder && (
                <div className="ck-import-banner" role="note">
                  <span className="ck-import-icon">{Icon.plane}</span>
                  <div className="ck-import-copy">
                    <strong>Commande Import YARAM</strong>
                    <p>
                      Ton panier contient un produit importe. Delai estime <b>10-15 jours</b> avant
                      livraison a Dakar. Un acompte de 50 % est demande maintenant, le solde a la reception.
                    </p>
                  </div>
                </div>
              )}

              {/* ═══ ADRESSE ═══ */}
              <section id="ck-anchor-address" className={`ck-card ck-section ${errors.address ? 'ck-section--error' : ''}`}>
                <div className="ck-section-head">
                  <span className="ck-section-icon">{Icon.pin}</span>
                  <h2 className="ck-section-title">Adresse de livraison</h2>
                  {addressValid && <span className="ck-section-ok" aria-hidden>{Icon.check}</span>}
                </div>

                <div className="ck-section-body">
                  {user && addresses.length > 0 && !useNewAddress ? (
                    <div className="ck-addr-list">
                      {addresses.map((a) => {
                        const active = a.id === selectedAddrId;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={`ck-addr-card ${active ? 'is-active' : ''}`}
                            onClick={() => setSelectedAddrId(a.id)}
                          >
                            <span className="ck-addr-radio">{active && <span />}</span>
                            <div className="ck-addr-info">
                              <div className="ck-addr-head">
                                <strong>{a.label || 'Adresse'}</strong>
                                {a.is_default && <span className="ck-tag">Defaut</span>}
                              </div>
                              <p className="ck-addr-line">{a.line1 || a.line || '—'}</p>
                              <p className="ck-addr-city">{a.city}{a.phone ? ` · ${a.phone}` : ''}</p>
                            </div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="ck-addr-new"
                        onClick={() => setUseNewAddress(true)}
                      >
                        + Ajouter une nouvelle adresse
                      </button>
                    </div>
                  ) : (
                    <div className="ck-guest-form">
                      <div className="ck-field-row">
                        <div className="ck-field">
                          <label>Libelle</label>
                          <input
                            type="text"
                            value={guestAddr.label}
                            placeholder="Domicile, Bureau…"
                            onChange={(e) => setGuestAddr({ ...guestAddr, label: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="ck-field">
                        <label>Rue / Quartier</label>
                        <input
                          type="text"
                          value={guestAddr.street}
                          placeholder="Ex : Mermoz, en face de la pharmacie"
                          onChange={(e) => setGuestAddr({ ...guestAddr, street: e.target.value })}
                          className={errors.street ? 'ck-input-err' : ''}
                        />
                      </div>
                      <div className="ck-field-row">
                        <div className="ck-field">
                          <label>Ville</label>
                          <input
                            type="text"
                            value={guestAddr.city}
                            onChange={(e) => setGuestAddr({ ...guestAddr, city: e.target.value })}
                          />
                        </div>
                        <div className="ck-field">
                          <label>Telephone</label>
                          <input
                            type="tel"
                            value={guestAddr.phone}
                            placeholder="77 123 45 67"
                            onChange={(e) => setGuestAddr({ ...guestAddr, phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="ck-geo-row">
                        <button type="button" className="ck-btn-ghost" onClick={requestGeoloc}>
                          {Icon.target} Utiliser ma position
                        </button>
                        {geoloc && (
                          <span className="ck-geo-badge">
                            Position captee ({geoloc.lat.toFixed(3)}, {geoloc.lng.toFixed(3)})
                          </span>
                        )}
                      </div>
                      {user && (
                        <button
                          type="button"
                          className="ck-link ck-back-to-list"
                          onClick={() => setUseNewAddress(false)}
                        >
                          Revenir a mes adresses enregistrees
                        </button>
                      )}
                    </div>
                  )}
                  {errors.address && <span className="ck-err">{errors.address}</span>}
                </div>
              </section>

              {/* ═══ LIVRAISON ═══ */}
              <section className="ck-card ck-section">
                <div className="ck-section-head">
                  <span className="ck-section-icon">{Icon.scooter}</span>
                  <h2 className="ck-section-title">Mode de livraison</h2>
                </div>
                <div className="ck-section-body">
                  <div className="ck-delivery-list">
                    {availableDeliveryModes.map((m) => {
                      const active = deliveryMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`ck-radio-card ${active ? 'active' : ''}`}
                          onClick={() => setDeliveryMode(m.id)}
                        >
                          <div className="ck-radio-dot">{active && <span />}</div>
                          <div className="ck-radio-icon">{m.id === 'import' ? Icon.plane : Icon.scooter}</div>
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

                  <div className="ck-field ck-notes-field">
                    <label><span className="ck-section-icon-sm">{Icon.note}</span> Notes au livreur (optionnel)</label>
                    <textarea
                      className="ck-textarea"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex : Sonner 2 fois, code porte 1234"
                      maxLength={240}
                    />
                    <div className="ck-textarea-count">{notes.length} / 240</div>
                  </div>
                </div>
              </section>

              {/* ═══ PAIEMENT ═══ */}
              <section id="ck-anchor-payment" className={`ck-card ck-section ${errors.payment ? 'ck-section--error' : ''}`}>
                <div className="ck-section-head">
                  <span className="ck-section-icon">{Icon.card}</span>
                  <h2 className="ck-section-title">Methode de paiement</h2>
                  {paymentValid && <span className="ck-section-ok" aria-hidden>{Icon.check}</span>}
                </div>
                <div className="ck-section-body">
                  <div className="ck-pay-list">
                    {visiblePayments.map((p) => {
                      const active = payment === p.id;
                      const disabled = !p.enabled;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`ck-radio-card ck-pay-card ${active ? 'active' : ''} ${disabled ? 'is-disabled' : ''}`}
                          onClick={() => { if (!disabled) setPayment(p.id); }}
                          aria-disabled={disabled}
                          disabled={disabled}
                        >
                          <div className="ck-radio-dot">{active && <span />}</div>
                          <PayLogo method={p} />
                          <div className="ck-radio-body">
                            <div className="ck-pay-name-row">
                              <strong>{p.name}</strong>
                              {disabled && <span className="ck-pay-badge">Bientot</span>}
                            </div>
                            <span className="ck-radio-sub-line">{p.sub}</span>
                          </div>
                          {active && !disabled && (
                            <div className="ck-check-mark" aria-hidden>{Icon.check}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {errors.payment && <span className="ck-err">{errors.payment}</span>}
                </div>
              </section>

              {/* ═══ CODES & FIDELITE (optionnel) ═══ */}
              <section className="ck-card ck-section ck-section--optional">
                <div className="ck-section-head">
                  <span className="ck-section-icon">{Icon.tag}</span>
                  <h2 className="ck-section-title">Codes & fidelite</h2>
                  <span className="ck-optional">optionnel</span>
                </div>
                <div className="ck-section-body ck-optional-body">
                  {/* Code promo */}
                  <div className="ck-mini-block">
                    <div className="ck-mini-block-head">
                      <span className="ck-section-icon-sm">{Icon.tag}</span>
                      <span>Code promo</span>
                    </div>
                    <div className="ck-inline-row">
                      <input
                        className="ck-inline-input"
                        placeholder="Ex : YARAM10"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyPromo(); }}
                      />
                      <button className="ck-inline-apply" onClick={applyPromo}>Appliquer</button>
                    </div>
                    {promoMsg && (
                      <div className={promoOff > 0 ? 'ck-msg ck-msg--ok' : 'ck-msg ck-msg--err'}>
                        {promoMsg}
                      </div>
                    )}
                  </div>

                  {/* Cheque cadeau MySargal */}
                  <div className="ck-mini-block">
                    <div className="ck-mini-block-head">
                      <span className="ck-section-icon-sm">{Icon.gift}</span>
                      <span>Cheque cadeau MySargal</span>
                    </div>
                    <div className="ck-inline-row">
                      <input
                        className="ck-inline-input"
                        placeholder="Code du cheque cadeau"
                        value={giftCode}
                        onChange={(e) => setGiftCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyGiftCard(); }}
                      />
                      <button className="ck-inline-apply" onClick={applyGiftCard} disabled={giftChecking}>
                        {giftChecking ? 'Verification…' : 'Verifier'}
                      </button>
                    </div>
                    {giftMsg && (
                      <div className={giftValue > 0 ? 'ck-msg ck-msg--ok' : 'ck-msg ck-msg--err'}>
                        {giftMsg}
                      </div>
                    )}
                  </div>

                  {/* Points fidelite */}
                  {maxLoyaltyPoints > 0 && (
                    <div className="ck-mini-block">
                      <div className="ck-mini-block-head">
                        <span className="ck-section-icon-sm">{Icon.loyalty}</span>
                        <span>Points fidelite</span>
                      </div>
                      <p className="ck-muted">Tu peux utiliser jusqu a {formatPrice(maxLoyaltyPoints)} points sur cette commande.</p>
                      <div className="ck-loyalty-row">
                        <input
                          type="range"
                          min={0}
                          max={maxLoyaltyPoints}
                          step={100}
                          value={loyaltyApplied}
                          onChange={(e) => setLoyaltyToUse(Number(e.target.value))}
                          className="ck-loyalty-slider"
                        />
                        <div className="ck-loyalty-value">
                          <strong>{formatPrice(loyaltyApplied)}</strong>
                          <span> pts</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Legal notice */}
              <div className="ck-legal">
                En confirmant, tu acceptes nos{' '}
                <button type="button" className="ck-link" onClick={() => navigate('terms')}>CGV</button>
                {' '}et notre{' '}
                <button type="button" className="ck-link" onClick={() => navigate('privacy')}>politique de confidentialite</button>.
              </div>
            </div>

            {/* ═══ SUMMARY (sticky) ═══ */}
            <aside className="ck-right">
              <div className="ck-summary ck-card">
                <h2 className="ck-summary-title">Ta commande</h2>

                <div className="ck-mini-cart">
                  {previewItems.map((it, i) => (
                    <div key={i} className="ck-mini-row">
                      <div className="ck-mini-thumb">
                        {it.img ? (
                          <img src={it.img} alt={it.name} loading="lazy" />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div className="ck-mini-info">
                        <div className="ck-mini-name">{it.name}</div>
                        <div className="ck-mini-meta">
                          x{it.qty} · {formatPrice(it.price)} FCFA
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

                <div className="ck-totals">
                  <div className="ck-total-row">
                    <span>Sous-total</span>
                    <strong>{formatPrice(subtotal)} FCFA</strong>
                  </div>
                  <div className="ck-total-row">
                    <span>
                      Livraison <span className="ck-mode-tag">{currentDelivery.name}</span>
                      {freeDeliveryReason && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: 'rgba(31,139,76,0.12)',
                          color: 'var(--y-brand, #1F8B4C)',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}>{freeDeliveryReason === 'gold_always' ? 'Gold offert' : 'Palier offert'}</span>
                      )}
                    </span>
                    <strong>{deliveryFee === 0 ? 'GRATUIT' : `${formatPrice(deliveryFee)} FCFA`}</strong>
                  </div>
                  <div className="ck-total-row">
                    <span>Frais de service</span>
                    <strong>{formatPrice(serviceFee)} FCFA</strong>
                  </div>
                  {promoOff > 0 && (
                    <div className="ck-total-row ck-total-row--discount">
                      <span>Promo {promoCode}</span>
                      <strong>-{formatPrice(promoOff)} FCFA</strong>
                    </div>
                  )}
                  {giftValue > 0 && (
                    <div className="ck-total-row ck-total-row--discount">
                      <span>Cheque cadeau</span>
                      <strong>-{formatPrice(giftValue)} FCFA</strong>
                    </div>
                  )}
                  {loyaltyApplied > 0 && (
                    <div className="ck-total-row ck-total-row--discount">
                      <span>Points fidelite</span>
                      <strong>-{formatPrice(loyaltyApplied)} FCFA</strong>
                    </div>
                  )}
                  {corporateDiscount > 0 && (
                    <div className="ck-total-row ck-total-row--discount">
                      <span>Remise YARAM Pro ({corporateDiscountPct}%)</span>
                      <strong>-{formatPrice(corporateDiscount)} FCFA</strong>
                    </div>
                  )}
                  <div className="ck-total-divider" />
                  <div className="ck-total-row ck-total-final">
                    <span>Total TTC</span>
                    <strong>{formatPrice(total)} FCFA</strong>
                  </div>

                  {/* Loyalty cashback preview */}
                  {cashbackPointsPreview > 0 && (
                    <div style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'linear-gradient(90deg, rgba(31,139,76,0.10) 0%, rgba(31,139,76,0.02) 100%)',
                      border: '1px solid rgba(31,139,76,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 10,
                        background: 'var(--y-brand, #1F8B4C)',
                        color: '#fff', fontSize: 11, fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{tierCashbackPct}%</div>
                      <div style={{ flex: 1, fontSize: 12, color: '#1A1A1A', fontWeight: 700 }}>
                        Tu gagneras <strong style={{ color: 'var(--y-brand, #1F8B4C)' }}>{formatPrice(cashbackPointsPreview)} pts</strong> avec cette commande
                      </div>
                    </div>
                  )}

                  {/* Preorder split — visible seulement si preorder */}
                  {isPreorder && (
                    <div className="ck-preorder-split">
                      <div className="ck-total-row ck-preorder-row">
                        <span>Acompte 50 % (maintenant)</span>
                        <strong>{formatPrice(preorderDeposit)} FCFA</strong>
                      </div>
                      <div className="ck-total-row ck-preorder-row ck-preorder-row--balance">
                        <span>Solde a la reception</span>
                        <strong>{formatPrice(preorderBalance)} FCFA</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* CTA principal — Uber Eats style */}
                <button
                  className="ck-btn ck-btn-primary ck-cta-main"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                >
                  {submitting ? (
                    <>
                      <span className="ck-cta-spinner" />
                      <span>Traitement…</span>
                    </>
                  ) : (
                    <>
                      <span>Commander</span>
                      <span className="ck-cta-price">{formatPrice(isPreorder ? preorderDeposit : total)} FCFA</span>
                    </>
                  )}
                </button>
                {missingHint && !submitting && (
                  <div className="ck-cta-warn" role="status">
                    <span className="ck-cta-warn-icon">{Icon.info}</span>
                    <span>{missingHint}</span>
                  </div>
                )}

                <div className="ck-trust">
                  <div className="ck-trust-item">
                    <span className="ck-trust-icon">{Icon.lock}</span>
                    <span>Paiement securise</span>
                  </div>
                  <div className="ck-trust-item">
                    <span className="ck-trust-icon">{Icon.shield}</span>
                    <span>Authentique garanti</span>
                  </div>
                </div>

                <button className="ck-back-link" onClick={() => navigate('cart')}>
                  Retour au panier
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Sticky mobile bar — CTA principal sur mobile */}
        {!success && (
          <div className="ck-mobile-bar">
            <div className="ck-mobile-bar-info">
              <span className="ck-mobile-bar-label">
                {isPreorder ? 'Acompte' : 'Total'}
              </span>
              <strong className="ck-mobile-bar-total">
                {formatPrice(isPreorder ? preorderDeposit : total)} FCFA
              </strong>
            </div>
            <button
              className="ck-btn ck-btn-primary ck-mobile-bar-cta"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {submitting ? 'Traitement…' : 'Commander'}
            </button>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
