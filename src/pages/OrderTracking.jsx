import { useEffect, useState, useRef, useMemo } from 'react';
import { useNav, useUser } from '../App';
import { supabase } from '../lib/supabase';
import { clientReportDispute } from '../lib/supabase';
import { toast, confirmDialog } from '../lib/toast';
import { formatPrice, safeFormatDate, safeNumber, YARAM_WHATSAPP } from '../lib/utils';
import { formatArrivalDate } from '../lib/preorder';
import SignedImage from '../components/SignedImage';
import TrackingTimeline from '../components/TrackingTimeline';
import {
  IconBagCheck, IconPreparing, IconPackage,
  IconScooter, IconPharmacy, IconHandDelivery,
  IconPlane, IconArrival,
} from '../components/TrackingIcons';
import './OrderTracking.css';

// Statuts autorisant l annulation cote client (commandes locales)
const CANCELLABLE_STATUSES = new Set(['pending', 'pending_payment', 'confirmed', 'paid']);
// Statuts autorisant l annulation d une commande import (preorder)
const PREORDER_CANCELLABLE_STATUSES = new Set([
  'paid',
  'awaiting_supplier',
  'in_transit_intl',
  'arrived_local',
  'awaiting_balance',
]);

/* ═══════════════════════════════════════════════════════════
   Cache module-level pour retour navigation instantane.
   ═══════════════════════════════════════════════════════════ */
const _orderCache = new Map();
const _trackingCache = new Map();

/* ═══════════════════════════════════════════════════════════
   Timelines : 5 etapes horizontales, style Papa Track.
   Chaque etape a un icone SVG dedie + un label small caps.
   ═══════════════════════════════════════════════════════════ */
const STEPS_LOCAL = (isPickup) => [
  { key: 'confirmed', label: 'Confirmee',           icon: IconBagCheck },
  { key: 'preparing', label: 'Preparation',         icon: IconPreparing },
  { key: 'ready',     label: 'Prete',               icon: IconPackage },
  { key: 'transit',   label: isPickup ? 'Retrait dispo' : 'En livraison', icon: isPickup ? IconPharmacy : IconScooter },
  { key: 'done',      label: isPickup ? 'Retiree'   : 'Livree',           icon: IconHandDelivery },
];

const STEPS_IMPORT = [
  { key: 'ordered',  label: 'Commandee',      icon: IconBagCheck },
  { key: 'transit',  label: 'En transit',     icon: IconPlane },
  { key: 'arrived',  label: 'Arrivee Dakar',  icon: IconArrival },
  { key: 'ready',    label: 'Prete',          icon: IconPackage },
  { key: 'done',     label: 'Livree',         icon: IconHandDelivery },
];

/* Type de commande -> badge small caps green */
function orderTypeLabel(order) {
  if (order.is_preorder) return 'IMPORT INTERNATIONAL';
  if (order.pickup_at_pharmacy || order.delivery_mode === 'pickup') return 'RETRAIT PHARMACIE';
  return 'LIVRAISON DAKAR';
}

/* Titre principal type Papa Track "A tout de suite, Ousmane!" */
function heroTitle(status, firstName) {
  const fn = (firstName || '').split(' ')[0] || 'toi';
  if (status === 'delivered') return `Merci, ${fn} !`;
  if (status === 'cancelled') return `Commande annulee, ${fn}`;
  if (status === 'shipped' || status === 'in_delivery') return `A tout de suite, ${fn} !`;
  if (status === 'awaiting_balance') return `Solde a regler, ${fn}`;
  return `Bientot chez toi, ${fn} !`;
}

/* ETA sous le titre (petite pill) */
function computeETA(order, tracking) {
  if (tracking?.eta_at) {
    const d = new Date(tracking.eta_at);
    if (!isNaN(d.getTime())) {
      return `Livraison vers ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }
  if (order.status === 'shipped') {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return `Livraison vers ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (order.is_preorder && order.expected_arrival_date) {
    return `Arrivee prevue ${formatArrivalDate(order.expected_arrival_date)}`;
  }
  if (!order.is_preorder && (order.status === 'paid' || order.status === 'preparing')) {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return `Livraison estimee ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}`;
  }
  return null;
}

/* Mapping status -> index d etape courante (0..N-1) */
function computeCurrentIndex(order) {
  if (order.is_preorder) {
    // Import 5 etapes
    if (order.status === 'delivered') return 4;
    if (order.status === 'shipped' || order.status === 'in_delivery') return 4;
    if (order.status === 'awaiting_balance' || order.status === 'arrived_local') return 3;
    if (order.status === 'in_transit_intl') return 2;
    if (order.status === 'awaiting_supplier') return 1;
    return 0;
  }
  // Local 5 etapes
  if (order.status === 'delivered') return 4;
  if (order.status === 'shipped' || order.status === 'in_delivery') return 3;
  if (order.status === 'preparing') return 2;
  if (order.status === 'paid' || order.status === 'confirmed' || order.status === 'awaiting_verification') return 1;
  if (order.status === 'pending_payment' || order.status === 'pending') return 0;
  if (order.status === 'cancelled') {
    if (order.delivered_at) return 4;
    if (order.shipped_at || order.out_for_delivery_at) return 3;
    if (order.prepared_at) return 2;
    if (order.paid_at || order.payment_confirmed_at) return 1;
    return 0;
  }
  return 0;
}

/* ═══════════════════════════════════════════════════════════
   Composant principal
   ═══════════════════════════════════════════════════════════ */
export default function OrderTracking({ orderId }) {
  const { navigate } = useNav();
  const { user } = useUser();
  const [order, setOrder] = useState(() => (orderId ? _orderCache.get(orderId) || null : null));
  const [tracking, setTracking] = useState(() => (orderId ? _trackingCache.get(orderId) || null : null));
  const [loadError, setLoadError] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(() => !!_orderCache.get(orderId));
  const [showRating, setShowRating] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevStatusRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!orderId) {
      setFirstLoadDone(true);
      setLoadError(true);
      return;
    }
    let cancelled = false;
    setFirstLoadDone(false);
    setLoadError(false);
    const safety = setTimeout(() => {
      if (cancelled) return;
      setFirstLoadDone(true);
      setLoadError(true);
    }, 12000);
    refresh(true).finally(() => { if (!cancelled) clearTimeout(safety); });
    const sub = supabase
      .channel('order-tracking-tr-' + orderId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_tracking', filter: `order_id=eq.${orderId}` },
        (payload) => { if (payload.new) setTracking(payload.new); })
      .subscribe();
    const interval = setInterval(() => refresh(false), 8000);
    return () => { cancelled = true; clearTimeout(safety); sub.unsubscribe(); clearInterval(interval); };
  }, [orderId]);

  const refresh = async (isFirst = false) => {
    try {
      // Token de suivi (lien magique WhatsApp/email) : autorise la lecture sans session connectée.
      const _tok = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search).get('t') : null;
      const { data: orderData, error: orderErr } = await supabase.rpc('client_get_order_by_id', { p_order_id: orderId, p_token: _tok });
      if (orderErr) console.warn('[OrderTracking] order RPC error:', orderErr.message);
      if (orderData) {
        setOrder(orderData);
        _orderCache.set(orderId, orderData);
      }
      else if (isFirst && !_orderCache.get(orderId)) setLoadError(true);
      const { data: trackingData } = await supabase.from('delivery_tracking').select('*').eq('order_id', orderId).maybeSingle();
      if (trackingData) {
        setTracking(trackingData);
        _trackingCache.set(orderId, trackingData);
      }
    } catch (e) {
      console.warn('[OrderTracking] refresh failed:', e?.message);
      if (isFirst && !_orderCache.get(orderId)) setLoadError(true);
    } finally {
      if (isFirst) setFirstLoadDone(true);
    }
  };

  // Confetti quand on passe en delivered en live
  useEffect(() => {
    if (!order) return;
    if (prevStatusRef.current && prevStatusRef.current !== 'delivered' && order.status === 'delivered') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    }
    prevStatusRef.current = order.status;
  }, [order?.status]);

  // Carte Leaflet en fond du header quand shipped
  useEffect(() => {
    if (!tracking?.current_lat || !mapContainerRef.current) return;
    if (!window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }
    function initMap() {
      const L = window.L;
      if (!L) return;
      if (mapRef.current) {
        markerRef.current.setLatLng([tracking.current_lat, tracking.current_lng]);
        mapRef.current.setView([tracking.current_lat, tracking.current_lng], 15);
        return;
      }
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      }).setView([tracking.current_lat, tracking.current_lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
      }).addTo(mapRef.current);
      const livreurIcon = L.divIcon({
        html: '<div class="yt-rider-pin"></div>',
        className: '', iconSize: [44, 44], iconAnchor: [22, 22],
      });
      markerRef.current = L.marker([tracking.current_lat, tracking.current_lng], { icon: livreurIcon }).addTo(mapRef.current);
    }
  }, [tracking?.current_lat, tracking?.current_lng]);

  useEffect(() => {
    if (order?.status === 'delivered' && !order?.delivery_rating) {
      const t = setTimeout(() => setShowRating(true), 2500);
      return () => clearTimeout(t);
    }
  }, [order?.status, order?.delivery_rating]);

  const compactId = useMemo(() => {
    if (!order?.id) return '';
    const s = String(order.id);
    return s.length > 6 ? '#' + s.slice(-6).toUpperCase() : '#' + s.toUpperCase();
  }, [order?.id]);

  if (!order) {
    if (firstLoadDone) {
      return (
        <div className="track-screen page-anim">
          <div className="track-loading" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>
              {loadError ? 'Impossible de charger cette commande' : 'Commande introuvable'}
            </p>
            {loadError && (
              <p style={{ fontSize: 13, color: '#8B8B8B', marginBottom: 20 }}>
                Verifie ta connexion puis reessaye.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
              {loadError && (
                <button
                  onClick={() => { setFirstLoadDone(false); setLoadError(false); refresh(true); }}
                  style={{ padding: '10px 20px', background: '#1F8B4C', color: 'white', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 700 }}
                >
                  Reessayer
                </button>
              )}
              <button
                onClick={() => navigate('/orders')}
                style={{ padding: '10px 20px', background: '#F4F4F2', color: '#222', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 700 }}
              >
                Mes commandes
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="track-screen page-anim">
        <div className="track-loading">
          <div className="track-loading-spinner" />
          <p>Chargement du suivi...</p>
        </div>
      </div>
    );
  }

  const isPreorderOrder = order.is_preorder === true;
  const isPickup = !isPreorderOrder && (order.pickup_at_pharmacy || order.delivery_mode === 'pickup');
  const STEPS = isPreorderOrder ? STEPS_IMPORT : STEPS_LOCAL(isPickup);
  const currentStep = computeCurrentIndex(order);
  const isCancelled = order.status === 'cancelled';
  const timelineSteps = STEPS.map((s, i) => ({
    ...s,
    status: isCancelled
      ? (i <= currentStep ? 'done' : 'pending')
      : (i < currentStep
        ? 'done'
        : i === currentStep
        ? (order.status === 'delivered' ? 'done' : 'active')
        : 'pending'),
  }));

  const hasGPS = tracking?.current_lat && (order.status === 'shipped' || order.status === 'in_delivery');
  const lastUpdate = tracking?.last_update ? new Date(tracking.last_update) : null;
  const secondsAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null;

  const eta = computeETA(order, tracking);
  const firstName = user?.first_name || order.address?.name?.split(' ')[0] || '';
  const bigTitle = heroTitle(order.status, firstName);
  const typeBadge = orderTypeLabel(order);

  const paymentLabel =
    order.payment_method === 'wave' ? 'Paye via Wave' :
    order.payment_method === 'orange_money' ? 'Paye via Orange Money' :
    order.payment_method === 'card' ? 'Paye par carte' :
    order.payment_method === 'cod' ? 'Cash a la livraison' :
    'Paiement enregistre';

  const helpHref = `https://wa.me/${YARAM_WHATSAPP}?text=${encodeURIComponent(
    `Bonjour YARAM, j ai besoin d aide concernant ma commande ${compactId}.`
  )}`;

  const driverPhoneClean = tracking?.delivery_person_phone?.replace(/\D/g, '');

  const canCancel = order && !isPreorderOrder && CANCELLABLE_STATUSES.has(order.status);
  const canCancelPreorder = order && isPreorderOrder && PREORDER_CANCELLABLE_STATUSES.has(order.status);

  // Info marchand (premiere pharmacie liee aux items)
  const merchantName = order.items?.find(it => it.pharmacyName)?.pharmacyName || null;
  const merchantAddress = order.pickup_address || null;
  const merchantPhone = order.pickup_phone || null;

  // Adresse pour Directions Google Maps (lien "Directions")
  const directionsQuery = encodeURIComponent(
    [order.address?.line, order.address?.neighborhood, order.address?.city].filter(Boolean).join(', ')
  );
  const directionsHref = directionsQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${directionsQuery}`
    : null;

  const handleCancelPreorder = async () => {
    if (!order) return;
    const ok = await confirmDialog(
      'Es-tu sur ? Ton acompte sera rembourse sous 5 jours ouvrables sur le meme moyen de paiement.',
      { confirmLabel: 'Annuler ma commande', cancelLabel: 'Retour', danger: true }
    );
    if (!ok) return;
    try {
      const { data, error } = await supabase.rpc('client_cancel_preorder', { p_order_id: order.id });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'cancel_failed');
      toast.success('Commande annulee. Ton acompte sera rembourse sous 5 jours ouvrables.');
      refresh(false);
    } catch (e) {
      console.warn('[OrderTracking] cancel preorder failed:', e?.message);
      toast.error('Impossible d annuler pour le moment. Contacte-nous WhatsApp.');
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    const ok = await confirmDialog(
      'Confirmer l annulation de cette commande ?',
      { confirmLabel: 'Annuler la commande', cancelLabel: 'Retour', danger: true }
    );
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .in('status', ['pending', 'pending_payment', 'confirmed', 'paid']);
      if (error) throw error;
      toast.success('Commande annulee');
      refresh(false);
    } catch (e) {
      console.warn('[OrderTracking] cancel failed, fallback WA:', e?.message);
      toast.info('On finalise l annulation avec le support');
      const msg = encodeURIComponent(`Bonjour YARAM, je souhaite annuler ma commande ${compactId}.`);
      window.open(`https://wa.me/${YARAM_WHATSAPP}?text=${msg}`, '_blank');
    }
  };

  const handleReportIssue = async () => {
    if (!order) return;
    if (order.status === 'delivered') {
      const reason = await (async () => {
        try {
          const { promptDialog } = await import('../lib/toast');
          return await promptDialog('Decris brievement le probleme rencontre', {
            placeholder: 'Colis incomplet, article endommage...',
            confirmLabel: 'Envoyer',
          });
        } catch { return null; }
      })();
      if (!reason) return;
      try {
        await clientReportDispute(order.id, reason);
        toast.success('Signalement envoye. On revient vers toi rapidement.');
      } catch (e) {
        console.warn('[OrderTracking] dispute failed:', e?.message);
        toast.error('Impossible d envoyer. Contacte-nous sur WhatsApp.');
      }
      return;
    }
    const msg = encodeURIComponent(
      `Bonjour YARAM, j ai un probleme sur ma commande ${compactId} (statut : ${order.status}).`
    );
    window.open(`https://wa.me/${YARAM_WHATSAPP}?text=${msg}`, '_blank');
  };

  return (
    <div className="track-screen track-pj page-anim">
      {/* ═══ Header sticky sobre ═══ */}
      <header className="track-top">
        <button className="track-top-btn" onClick={() => navigate('/orders')} aria-label="Retour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div className="track-top-id">
          <span className="track-top-id-label">Commande</span>
          <strong className="track-top-id-num">{compactId}</strong>
        </div>
        <a className="track-top-help" href={helpHref} target="_blank" rel="noopener noreferrer">
          Aide
        </a>
      </header>

      <div className="track-scroll">
        {/* ═══════════════════════════════════════════════════
            HERO Papa-Track : map en fond + badge flottant + card
            ═══════════════════════════════════════════════════ */}
        <section className="yt-hero">
          <div className="yt-hero-map" aria-hidden="true">
            {hasGPS ? (
              <div ref={mapContainerRef} className="yt-hero-mapinner" />
            ) : (
              <div className="yt-hero-mapfake">
                {/* Fond degrade + pattern subtil pour donner l illusion d une carte */}
                <svg className="yt-hero-pattern" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <defs>
                    <linearGradient id="ytmap" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#E7F3EA" />
                      <stop offset="1" stopColor="#D5EBDD" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="220" fill="url(#ytmap)" />
                  <path d="M0 80 Q 100 40 200 90 T 400 80" stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.7" />
                  <path d="M0 140 Q 120 100 220 150 T 400 140" stroke="#FFFFFF" strokeWidth="4" fill="none" opacity="0.55" />
                  <circle cx="80" cy="80" r="4" fill="#1F8B4C" />
                  <circle cx="220" cy="90" r="4" fill="#1F8B4C" />
                  <circle cx="330" cy="140" r="4" fill="#1F8B4C" />
                </svg>
              </div>
            )}
            {/* Badge YARAM Track flottant */}
            <div className="yt-hero-badge">
              <span className="yt-hero-badge-dot" />
              YARAM Track
            </div>
          </div>

          {/* Card blanche qui overlap la map */}
          <div className="yt-hero-card">
            <div className="yt-hero-type">{typeBadge}</div>
            <h1 className="yt-hero-title">{bigTitle}</h1>
            {eta && !isCancelled && (
              <div className="yt-hero-eta">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
                </svg>
                <span>{eta}</span>
              </div>
            )}

            {/* Timeline HORIZONTALE Papa Track */}
            <TrackingTimeline steps={timelineSteps} />
          </div>
        </section>

        <div className="track-grid">
          {/* ═══ Info marchand + Directions ═══ */}
          {(merchantName || order.address) && (
            <section className="track-card yt-store track-col-main">
              <div className="yt-store-head">
                <div>
                  <div className="yt-store-caps">
                    {isPreorderOrder ? 'FOURNISSEUR INTERNATIONAL' : (isPickup ? 'PHARMACIE DE RETRAIT' : 'PHARMACIE DEPART')}
                  </div>
                  <strong className="yt-store-name">{merchantName || 'Reseau YARAM'}</strong>
                  {merchantAddress && <div className="yt-store-addr">{merchantAddress}</div>}
                  {merchantPhone && (
                    <a className="yt-store-phone" href={`tel:${merchantPhone.replace(/\s+/g, '')}`}>{merchantPhone}</a>
                  )}
                </div>
                {directionsHref && !isPreorderOrder && (
                  <a className="yt-store-directions" href={directionsHref} target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    Directions
                  </a>
                )}
              </div>

              <div className="yt-store-divider" />

              <div className="yt-store-caps">LIVRAISON A</div>
              <div className="yt-store-name">{order.address?.name}</div>
              {order.address?.line && <div className="yt-store-addr">{order.address.line}</div>}
              {(order.address?.neighborhood || order.address?.city) && (
                <div className="yt-store-addr muted">
                  {order.address?.neighborhood}{order.address?.neighborhood && order.address?.city ? ', ' : ''}{order.address?.city}
                </div>
              )}
              {order.address?.phone && (
                <a className="yt-store-phone" href={`tel:${order.address.phone.replace(/\s+/g, '')}`}>{order.address.phone}</a>
              )}
            </section>
          )}

          {/* ═══ Livreur GPS (si assigne + shipped) ═══ */}
          {(tracking?.delivery_person_name || hasGPS) && (
            <section className="track-card track-col-aside track-driver-card">
              <h3 className="track-card-title">Ton livreur</h3>

              {hasGPS && (
                <div className="track-mapwrap">
                  <div className="track-map" style={{ minHeight: 240, background: '#EAF3EA' }}>
                    <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="track-map-overlay">
                    <span className="live-dot" />
                    <span>Position en direct</span>
                  </div>
                </div>
              )}

              {tracking?.delivery_person_name && (
                <>
                  <div className="track-driver">
                    <div className="track-driver-avatar">
                      {tracking.delivery_person_photo ? (
                        <img src={tracking.delivery_person_photo} alt={tracking.delivery_person_name} loading="lazy" decoding="async" />
                      ) : (
                        <span>{(tracking.delivery_person_name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="track-driver-info">
                      <small>Livreur YARAM</small>
                      <strong>{tracking.delivery_person_name}</strong>
                      {secondsAgo !== null && hasGPS && (
                        <span className="track-driver-live">
                          <span className="live-dot" />
                          {secondsAgo < 60 ? `Position il y a ${secondsAgo}s` : `Il y a ${Math.floor(secondsAgo / 60)}min`}
                        </span>
                      )}
                    </div>
                    <div className="track-driver-actions">
                      {driverPhoneClean && (
                        <a className="track-driver-call" href={`tel:+${driverPhoneClean}`} aria-label="Appeler">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </a>
                      )}
                      {driverPhoneClean && (
                        <a className="track-driver-wa" href={`https://wa.me/${driverPhoneClean}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.18 1.6 6L0 24l6.21-1.63A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52zM12 21.82c-1.79 0-3.55-.48-5.09-1.39l-.36-.21-3.69.97.99-3.59-.24-.37A9.78 9.78 0 0 1 2.18 12C2.18 6.57 6.57 2.18 12 2.18S21.82 6.57 21.82 12 17.43 21.82 12 21.82z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                  {driverPhoneClean && (
                    <a
                      className="track-driver-pill"
                      href={`https://wa.me/${driverPhoneClean}?text=${encodeURIComponent(`Bonjour, concernant ma commande ${compactId}...`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Contacter le livreur
                    </a>
                  )}
                </>
              )}
            </section>
          )}

          {/* ═══ Preorder import : suivi paiement + arrivee ═══ */}
          {isPreorderOrder && (
            <section className="track-card yt-import track-col-main">
              <div className="yt-import-head">
                <strong>Import en cours</strong>
                <span>Delai estime : 15 jours</span>
              </div>
              <div className="yt-import-bar">
                <div
                  className="yt-import-fill"
                  style={{ width: `${Math.max(0, Math.min(100, ((currentStep + 1) / STEPS.length) * 100))}%` }}
                />
              </div>
              <div className="yt-import-rows">
                <div className="yt-import-row">
                  <span>Acompte (50%)</span>
                  <strong className={order.deposit_paid_at ? 'ok' : 'wait'}>
                    {formatPrice(order.deposit_amount || 0)} FCFA
                  </strong>
                </div>
                <div className="yt-import-row">
                  <span>Solde (50%)</span>
                  <strong className={order.balance_paid_at ? 'ok' : 'wait'}>
                    {formatPrice(order.balance_amount || 0)} FCFA
                  </strong>
                </div>
                {order.expected_arrival_date && (
                  <div className="yt-import-row">
                    <span>Arrivee prevue</span>
                    <strong>{formatArrivalDate(order.expected_arrival_date)}</strong>
                  </div>
                )}
                {order.arrived_dakar_at && (
                  <div className="yt-import-row">
                    <span>Arrive le</span>
                    <strong className="ok">{safeFormatDate(order.arrived_dakar_at)}</strong>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═══ Preuve de livraison ═══ */}
          {order.status === 'delivered' && tracking && (tracking.delivery_photo_url || tracking.delivery_signature || tracking.delivery_pin) && (
            <section className="track-card track-col-main">
              <h3 className="track-card-title">Preuve de livraison</h3>
              {tracking.delivery_photo_url && (
                <div className="track-proof-img">
                  <SignedImage src={tracking.delivery_photo_url} alt="Preuve livraison" style={{ width: '100%', borderRadius: 12, maxHeight: 280, objectFit: 'cover' }} />
                  <small>Photo du colis remis</small>
                </div>
              )}
              {tracking.delivery_signature && (
                <div className="track-proof-sig">
                  <img src={tracking.delivery_signature} alt="Signature" loading="lazy" decoding="async" />
                  <small>Signature recue</small>
                </div>
              )}
              {tracking.delivery_pin && (
                <p className="track-proof-pin">Confirmee par code PIN <strong>{tracking.delivery_pin}</strong></p>
              )}
              {tracking.delivered_at && (
                <p className="track-proof-time">Livre le {safeFormatDate(tracking.delivered_at, { type: 'datetime' })}</p>
              )}
            </section>
          )}

          {/* ═══ Order confirmation accordion (details commande) ═══ */}
          <section className="track-card yt-accordion track-col-main">
            <button
              type="button"
              className="yt-accordion-head"
              onClick={() => setDetailsOpen(v => !v)}
              aria-expanded={detailsOpen}
            >
              <div>
                <div className="yt-accordion-caps">CONFIRMATION</div>
                <strong>Commande {compactId}</strong>
                <span className="yt-accordion-meta">
                  {order.items?.length} article{order.items?.length > 1 ? 's' : ''} · {formatPrice(order.total)} FCFA
                </span>
              </div>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`yt-accordion-chevron ${detailsOpen ? 'open' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {detailsOpen && (
              <div className="yt-accordion-body">
                <div className="yt-items">
                  {order.items?.map((it, i) => (
                    <div key={`${it.id || it.name}-${i}`} className="yt-item">
                      {it.img
                        ? <img src={it.img} alt="" loading="lazy" decoding="async" />
                        : <div className="yt-item-noimg" aria-hidden="true" />
                      }
                      <div className="yt-item-info">
                        <strong>{it.name}</strong>
                        <span>Qte {safeNumber(it.qty, 1)}</span>
                        {it.pharmacyName && <small>{it.pharmacyName}</small>}
                      </div>
                      <div className="yt-item-price">
                        {(safeNumber(it.price) * safeNumber(it.qty, 1)).toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                  ))}
                </div>
                <div className="yt-totals">
                  <div className="yt-totals-row"><span>Sous-total</span><strong>{order.subtotal?.toLocaleString('fr-FR')} FCFA</strong></div>
                  <div className="yt-totals-row"><span>Livraison</span><strong>{order.shipping?.toLocaleString('fr-FR')} FCFA</strong></div>
                  <div className="yt-totals-row yt-totals-grand"><span>Total</span><strong>{order.total?.toLocaleString('fr-FR')} FCFA</strong></div>
                </div>
                <div className="yt-payment">
                  <span>Paiement</span>
                  <strong>{paymentLabel}</strong>
                  {order.paid_at && <small>{safeFormatDate(order.paid_at, { type: 'datetime' })}</small>}
                </div>
              </div>
            )}
          </section>

          {/* ═══ Notation existante ═══ */}
          {order.delivery_rating && (
            <section className="track-card yt-rating-recap track-col-main">
              <div className="yt-store-caps">TON AVIS</div>
              <div className="yt-rating-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} viewBox="0 0 24 24" width="18" height="18" fill={i < order.delivery_rating ? '#F4B53A' : 'none'} stroke="#F4B53A" strokeWidth="1.8">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              {order.delivery_comment && <p className="yt-rating-com">"{order.delivery_comment}"</p>}
            </section>
          )}

          {/* ═══ Actions secondaires ═══ */}
          <section className="track-card track-actions track-col-main" aria-label="Actions">
            <h3 className="track-card-title">Aide sur cette commande</h3>
            <div className="track-actions-row">
              {canCancel && (
                <button
                  type="button"
                  className="track-action-btn track-action-danger"
                  onClick={handleCancelOrder}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  Annuler la commande
                </button>
              )}
              {canCancelPreorder && (
                <button
                  type="button"
                  className="track-action-btn track-action-danger"
                  onClick={handleCancelPreorder}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  Annuler ma commande
                </button>
              )}
              <button
                type="button"
                className="track-action-btn track-action-ghost"
                onClick={handleReportIssue}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                Signaler un probleme
              </button>
              {order.status === 'delivered' && !order.delivery_rating && (
                <button
                  type="button"
                  className="track-action-btn track-action-star"
                  onClick={() => setShowRating(true)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Noter la livraison
                </button>
              )}
            </div>
          </section>

          {/* ═══ Footer links Papa Track style ═══ */}
          <section className="yt-footlinks track-col-main">
            <a href={helpHref} target="_blank" rel="noopener noreferrer" className="yt-footlink">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="#25D366">
                <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.18 1.6 6L0 24l6.21-1.63A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52z" />
              </svg>
              Customer Service
            </a>
            <a href="/legal" onClick={(e) => { e.preventDefault(); navigate('/legal'); }} className="yt-footlink">
              Conditions et confidentialite
            </a>
          </section>

        </div>{/* /.track-grid */}
        <div style={{ height: 100 }} />
      </div>

      {/* Bottom CTA */}
      <BottomCTA
        order={order}
        onRate={() => setShowRating(true)}
        navigate={navigate}
      />

      {showRating && (
        <RatingModal
          orderId={orderId}
          driverName={tracking?.delivery_person_name}
          onClose={() => { setShowRating(false); refresh(); }}
        />
      )}

      {showConfetti && <Confetti />}
    </div>
  );
}

/* ───────────── Bottom CTA ───────────── */
function BottomCTA({ order, onRate, navigate }) {
  const isDelivered = order.status === 'delivered';
  const isAwaitingConfirm = order.status === 'awaiting_confirm';
  const isAwaitingBalance = order.status === 'awaiting_balance';

  if (isAwaitingBalance) {
    const balanceAmount = Number(order.balance_amount || 0);
    const balanceLabel = balanceAmount > 0
      ? `Payer le solde (${balanceAmount.toLocaleString('fr-FR')} FCFA)`
      : 'Payer le solde';
    return (
      <div className="track-bottom">
        <button
          className="track-cta track-cta-warn"
          onClick={() => navigate({ name: 'payment', params: { orderId: order.id, mode: 'balance' } })}
        >
          {balanceLabel}
        </button>
      </div>
    );
  }
  if (isAwaitingConfirm) {
    return (
      <div className="track-bottom">
        <button
          className="track-cta track-cta-pri"
          onClick={async () => {
            await supabase.rpc('client_confirm_delivery', { p_order_id: order.id });
            toast.success('Livraison confirmee');
          }}
        >
          Confirmer la livraison
        </button>
      </div>
    );
  }
  if (isDelivered && !order.delivery_rating) {
    return (
      <div className="track-bottom">
        <button className="track-cta track-cta-star" onClick={onRate}>
          Noter ma livraison
        </button>
      </div>
    );
  }
  if (isDelivered) {
    return (
      <div className="track-bottom">
        <button className="track-cta track-cta-ghost" onClick={() => navigate('/shop')}>
          Refaire cette commande
        </button>
      </div>
    );
  }
  return null;
}

/* ───────────── Confettis ───────────── */
function Confetti() {
  const pieces = Array.from({ length: 36 });
  return (
    <div className="track-confetti" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="track-confetti-piece"
          style={{
            left: `${(i * 100) / pieces.length}%`,
            animationDelay: `${(i % 8) * 80}ms`,
            background: ['#1F8B4C', '#F4B53A', '#0066CC', '#E89B1B', '#25D366'][i % 5],
          }}
        />
      ))}
    </div>
  );
}

/* ───────────── Modal notation ───────────── */
function RatingModal({ orderId, driverName, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (rating === 0) {
      toast.error('Selectionne au moins 1 etoile');
      return;
    }
    setSaving(true);
    await supabase.rpc('client_rate_order', {
      p_id_or_token: orderId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="liv-modal-overlay" onClick={onClose}>
      <div className="liv-modal" onClick={e => e.stopPropagation()}>
        <h3 style={{ textAlign: 'center', fontSize: 22 }}>Note ta livraison</h3>
        <p style={{ textAlign: 'center', color: '#6B6B6B', fontSize: 13, marginBottom: 20 }}>
          Comment s est passe ton experience{driverName ? ` avec ${driverName}` : ''} ?
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} etoile${n > 1 ? 's' : ''}`}
              style={{
                background: 'transparent', border: 'none',
                cursor: 'pointer', padding: 4,
              }}
            >
              <svg viewBox="0 0 24 24" width="34" height="34" fill={n <= rating ? '#F4B53A' : 'none'} stroke="#F4B53A" strokeWidth="1.8">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Un mot pour le livreur ? (optionnel)"
          rows={3}
          style={{
            width: '100%', padding: 12,
            border: '1.5px solid #EEE', borderRadius: 10,
            fontSize: 13, fontFamily: 'inherit',
            marginBottom: 12,
          }}
        />
        <button
          className="liv-btn-pri"
          onClick={submit}
          disabled={saving}
        >{saving ? 'Envoi...' : 'Valider mon avis'}</button>
        <button className="liv-btn-stop" onClick={onClose} style={{ marginTop: 8 }}>Plus tard</button>
      </div>
    </div>
  );
}
