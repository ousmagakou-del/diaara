import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { PEDALEL_LOGO_URL, PEDALEL_META } from './pedalel-brand';
import { toast } from '../../lib/toast';
import { useDriverPosition } from './DeliveryMap';

// ─── Phase 5 — Persistance locale du statut online/offline ───
const ONLINE_STATUS_KEY = 'pedalel-online-status';
function readOnlineStatus() {
  try {
    const raw = localStorage.getItem(ONLINE_STATUS_KEY);
    if (raw === null) return true; // default = online
    return raw === '1' || raw === 'true';
  } catch { return true; }
}
function writeOnlineStatus(next) {
  try { localStorage.setItem(ONLINE_STATUS_KEY, next ? '1' : '0'); } catch {}
}

// ═══ Notification sound + vibration quand nouvelle course ═══
let audioCtx = null;
function playNewOrderSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const playBeep = (freq, when, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, audioCtx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + when + duration);
      osc.start(audioCtx.currentTime + when);
      osc.stop(audioCtx.currentTime + when + duration);
    };
    playBeep(587.33, 0,    0.18); // D5
    playBeep(739.99, 0.20, 0.18); // F#5
    playBeep(987.77, 0.40, 0.35); // B5
  } catch (e) {
    console.warn('[driver] sound failed:', e?.message);
  }
}
function vibrateNewOrder() {
  try { if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 300]); } catch {}
}
function notifyNewOrder(orderInfo) {
  playNewOrderSound();
  vibrateNewOrder();
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nouvelle livraison Pedalel', {
        body: orderInfo
          ? `Commande ${orderInfo.id} · ${orderInfo.total?.toLocaleString('fr-FR')} FCFA`
          : 'Une nouvelle livraison t\'a été assignée',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'new-order',
        requireInteraction: false,
      });
    }
  } catch {}
}

// ─── Helpers ────────────────────────────────────────────
const fmtFcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
const fmtClientName = (addr) => {
  if (!addr) return 'Cliente';
  if (typeof addr === 'string') return 'Cliente';
  return addr.name || 'Cliente';
};
const shortOrderId = (id) => {
  if (!id) return '—';
  const s = String(id);
  return s.length > 8 ? `#${s.slice(0, 8)}` : `#${s}`;
};

// ─── SVG ICONS (inline, no extra deps) ──────────────────
const Icons = {
  Settings: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Box: () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Chevron: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Trophy: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

// ─── Popular hours mock (24h heatmap Dakar-style, 0..100 %) ───
// Peaks : matin 8-11 (livraison bureaux), midi 12-14, soir 18-22
const POPULAR_HOURS_MOCK = [
  15, 10, 8,  6,  6,  12, 22, 40, 65, 78, 82, 70, // 0-11
  85, 90, 72, 55, 60, 78, 92, 95, 88, 74, 52, 28, // 12-23
];

// ─── Hero map component (Leaflet, pharmacies + driver) ───
function PedaHeroMap({ driverPos, pharmacies }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ pharmas: [], driver: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
      tap: false,
    }).setView([14.6928, -17.4467], 13);

    // Tileset CartoDB Voyager — style epure moderne (Uber-like)
    // Gratuit, pas de cle API requise, plus premium que OSM classique
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      maxZoom: 20,
      crossOrigin: true,
      subdomains: 'abcd',
    }).addTo(map);

    // Deuxieme couche : labels uniquement (villes/rues principales)
    // pour un rendu plus lisible sans surcharger
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      maxZoom: 20,
      crossOrigin: true,
      subdomains: 'abcd',
      pane: 'shadowPane',
    }).addTo(map);

    mapRef.current = map;
    setReady(true);

    return () => {
      try { map.remove(); } catch {}
      mapRef.current = null;
      markersRef.current = { pharmas: [], driver: null };
    };
  }, []);

  // Redraw pharmacies
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Clean previous pharma pins
    markersRef.current.pharmas.forEach((m) => { try { map.removeLayer(m); } catch {} });
    markersRef.current.pharmas = [];

    (pharmacies || []).forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      const icon = L.divIcon({
        html: `<div class="ped-map-pharma" title="${escapeHtml(p.name || 'Pharmacie')}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v18M3 12h18"/>
          </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: 'ped-map-icon',
      });
      const m = L.marker([p.lat, p.lng], { icon, zIndexOffset: 100 }).addTo(map);
      markersRef.current.pharmas.push(m);
    });
  }, [pharmacies, ready]);

  // Driver dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const valid = driverPos && Number.isFinite(driverPos.lat) && Number.isFinite(driverPos.lng);

    if (!valid) {
      if (markersRef.current.driver) {
        try { map.removeLayer(markersRef.current.driver); } catch {}
        markersRef.current.driver = null;
      }
      return;
    }

    const icon = L.divIcon({
      html: `<div class="ped-map-me">
        <span class="ped-map-me-pulse"></span>
        <span class="ped-map-me-dot"></span>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: 'ped-map-icon',
    });
    if (markersRef.current.driver) {
      markersRef.current.driver.setLatLng([driverPos.lat, driverPos.lng]);
      markersRef.current.driver.setIcon(icon);
    } else {
      markersRef.current.driver = L.marker([driverPos.lat, driverPos.lng], {
        icon,
        zIndexOffset: 500,
      }).addTo(map);
      // Recenter softly on driver first time we have him
      map.setView([driverPos.lat, driverPos.lng], 13, { animate: true });
    }
  }, [driverPos?.lat, driverPos?.lng, ready]);

  // Handle resize
  useEffect(() => {
    if (!mapRef.current) return;
    const t = setTimeout(() => { try { mapRef.current?.invalidateSize(); } catch {} }, 150);
    const onResize = () => { try { mapRef.current?.invalidateSize(); } catch {} };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return <div ref={containerRef} className="ped-hero-map-canvas" aria-label="Carte Dakar" />;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Available delivery card (accept flow) ────────────────
function AvailableDeliveryCard({ order, onAccept, accepting }) {
  return (
    <div className="ped-queue-item ped-queue-item-available">
      <div className="ped-queue-item-icon"><Icons.Box /></div>
      <div className="ped-queue-item-body">
        <div className="ped-queue-item-name">Nouvelle course · {shortOrderId(order.id)}</div>
        <div className="ped-queue-item-meta">{fmtClientName(order.address)}</div>
      </div>
      <button
        type="button"
        className="ped-queue-accept"
        onClick={(e) => { e.stopPropagation(); onAccept(order.id); }}
        disabled={accepting}
      >
        {accepting ? '…' : 'Accepter'}
      </button>
    </div>
  );
}

export default function DriverDashboard({ session, onLogout, onOpenDelivery, onNavigate }) {
  const [data, setData] = useState({ in_progress: [], available: [], recent: [] });
  const [todayStats, setTodayStats] = useState({ count: 0, fcfa: 0 });
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [isOnline, setIsOnline] = useState(() => readOnlineStatus());
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [gpsGranted, setGpsGranted] = useState(false);

  // ─── Track counter pour détecter les nouvelles courses ───
  const previousOrderCountRef = useRef(null);
  const firstLoadRef = useRef(true);

  // Position GPS live du driver — pin bleu pulsant sur la carte hero
  const { pos: driverPos, error: gpsErr } = useDriverPosition(true);

  useEffect(() => {
    if (driverPos && Number.isFinite(driverPos.lat)) setGpsGranted(true);
  }, [driverPos]);

  // Fallback Dakar si pas de GPS (garantit un pin visible sur la map)
  const displayDriverPos = useMemo(() => {
    if (driverPos && Number.isFinite(driverPos.lat)) return driverPos;
    return { lat: 14.6928, lng: -17.4467 };
  }, [driverPos]);

  // ─── Chargement orders + earnings ────────────────────────
  const load = useCallback(async () => {
    if (!session?.token) return;
    try {
      const [ordersRes, earnRes] = await Promise.all([
        supabase.rpc('driver_get_orders', { p_token: session.token }),
        supabase.rpc('driver_get_earnings', { p_token: session.token }),
      ]);

      if (ordersRes.error || !ordersRes.data?.success) {
        if (ordersRes.data?.error === 'invalid_session') {
          toast.error('Session expirée, reconnecte-toi.');
          onLogout?.();
          return;
        }
        console.warn('[Driver] get_orders error:', ordersRes.error || ordersRes.data);
      } else {
        const newInProgress = ordersRes.data.in_progress || [];
        const newAvailable = ordersRes.data.available || [];
        const totalNewOrders = newInProgress.length + newAvailable.length;
        const newOrderInfo = newInProgress[0] || newAvailable[0] || null;

        if (!firstLoadRef.current
            && previousOrderCountRef.current !== null
            && totalNewOrders > previousOrderCountRef.current) {
          notifyNewOrder(newOrderInfo);
          toast.success('Nouvelle livraison');
        }
        previousOrderCountRef.current = totalNewOrders;
        firstLoadRef.current = false;

        setData({
          in_progress: newInProgress,
          available:   newAvailable,
          recent:      ordersRes.data.recent || [],
        });
      }

      if (!earnRes.error && earnRes.data?.success) {
        setTodayStats(earnRes.data.today || { count: 0, fcfa: 0 });
      }
    } catch (e) {
      console.error('[Driver] load fatal:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.token, onLogout]);

  useEffect(() => {
    load();
    const pollInterval = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  // ─── Charge les pharmacies actives (pins sur la map) ─────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('pharmacies')
          .select('id, name, lat, lng, logo')
          .eq('active', true)
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .limit(80);
        if (cancelled) return;
        if (error) {
          console.warn('[Driver] pharmacies load error:', error.message);
          return;
        }
        setPharmacies(rows || []);
      } catch (e) {
        console.warn('[Driver] pharmacies fatal:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Demande la permission notifications au montage ───
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  // ─── Toggle Online/Offline (optimistic + RPC + localStorage) ─
  const togglePedalelOnline = async () => {
    if (togglingOnline) return;
    const next = !isOnline;
    setIsOnline(next);
    writeOnlineStatus(next);
    setTogglingOnline(true);
    if (navigator.vibrate) navigator.vibrate(next ? 30 : [20, 30, 20]);
    try {
      const { data: r, error } = await supabase.rpc('driver_set_online_status', {
        p_token: session.token,
        p_online: next,
      });
      const missingFn = error && (
        String(error.message || '').includes('not find the function')
        || String(error.message || '').includes('does not exist')
        || error.code === 'PGRST202'
      );
      if (missingFn) {
        console.warn('[Pedalel] driver_set_online_status RPC missing — local-only for now');
        toast.success(next ? 'En ligne' : 'Hors ligne');
        return;
      }
      if (error || (r && r.success === false)) {
        setIsOnline(!next);
        writeOnlineStatus(!next);
        toast.error('Impossible de changer ton statut. Réessaie.');
        return;
      }
      toast.success(next ? 'En ligne · Prêt à livrer' : 'Hors ligne');
    } catch (e) {
      console.error('[Pedalel] toggle online fatal:', e);
      toast.success(next ? 'En ligne' : 'Hors ligne');
    } finally {
      setTogglingOnline(false);
    }
  };

  const acceptOrder = async (orderId) => {
    setAcceptingId(orderId);
    try {
      const { data: r, error } = await supabase.rpc('driver_accept_order', {
        p_token: session.token,
        p_order_id: orderId,
      });
      if (error || !r?.success) {
        const code = r?.error || error?.message || 'erreur';
        if (code === 'already_taken') {
          toast.error('Cette livraison vient d\'être prise par un autre livreur.');
        } else {
          toast.error('Impossible d\'accepter cette livraison.');
        }
        setAcceptingId(null);
        return;
      }
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
      toast.success('Livraison acceptée !');
      setAcceptingId(null);
      await load();
      onOpenDelivery?.(orderId);
    } catch (e) {
      console.error('[Driver] accept fatal:', e);
      toast.error('Erreur réseau.');
      setAcceptingId(null);
    }
  };

  const firstName = session?.full_name?.split(' ')[0] || 'Livreur';
  const initials = session?.full_name
    ? session.full_name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : 'L';
  const rating = Number(session?.rating) > 0 ? Number(session.rating).toFixed(1) : '5.0';

  // Heure courante pour le graph
  const currentHour = new Date().getHours();
  const showTipCard = !gpsGranted && !!gpsErr;
  const notifCount = data.available.length; // nb offres en attente

  return (
    <div className="ped-home">
      {/* ═══ HERO MAP (background, ~55vh) ═══ */}
      <div className="ped-hero-map" aria-hidden="true">
        <PedaHeroMap driverPos={displayDriverPos} pharmacies={pharmacies} />
        <div className="ped-hero-map-overlay" />
      </div>

      {/* ═══ HEADER GLASSMORPHISM ═══ */}
      <header className="ped-hero-header">
        <button
          type="button"
          className="ped-hero-avatar"
          onClick={() => onNavigate?.('profile')}
          aria-label="Profil"
        >
          <span className="ped-hero-avatar-initials">{initials}</span>
        </button>
        <div className="ped-hero-greet">
          <div className="ped-hero-greet-name">Salut {firstName}</div>
          <div className="ped-hero-greet-sub">
            <Icons.Star />
            <span>{rating}</span>
            <span className="ped-hero-greet-dot">·</span>
            <span>{todayStats.count} course{todayStats.count > 1 ? 's' : ''} aujourd'hui</span>
          </div>
        </div>
        <button
          type="button"
          className="ped-hero-notif"
          onClick={() => onNavigate?.('help')}
          aria-label={notifCount > 0 ? `${notifCount} notification${notifCount > 1 ? 's' : ''}` : 'Notifications'}
        >
          <Icons.Bell />
          {notifCount > 0 && <span className="ped-hero-notif-badge">{notifCount}</span>}
        </button>
      </header>

      {/* ═══ BOTTOM SHEET (bg #F7F7F5, rounded top) ═══ */}
      <section className="ped-sheet">
        {/* Big CTA online/offline — overlaps map/sheet edge */}
        <div className="ped-sheet-cta-wrap">
          <button
            type="button"
            className={`ped-hero-cta ${isOnline ? 'is-online' : 'is-offline'}`}
            onClick={togglePedalelOnline}
            disabled={togglingOnline}
            aria-pressed={isOnline}
          >
            <span className="ped-hero-cta-dot" aria-hidden="true" />
            <span className="ped-hero-cta-label">
              {isOnline ? 'En ligne · Livrer maintenant' : 'Passer en ligne'}
            </span>
          </button>
          <div className="ped-sheet-cta-sub">
            {isOnline
              ? 'Tu apparais aux marchands · reste sur cette page'
              : 'Active pour recevoir des courses Pedalel'}
          </div>
        </div>

        {/* ═══ SECTION 1 : Tip card (GPS) ═══ */}
        {showTipCard && (
          <button
            type="button"
            className="ped-tip-card"
            onClick={() => toast.info('Ouvre les réglages du navigateur pour autoriser la position')}
          >
            <div className="ped-tip-icon"><Icons.Settings /></div>
            <div className="ped-tip-text">
              <div className="ped-tip-title">Améliore tes offres</div>
              <div className="ped-tip-sub">
                Autorise l'accès à ta position pour recevoir plus de courses proches de toi.
              </div>
            </div>
            <span className="ped-tip-chev"><Icons.Chevron /></span>
          </button>
        )}

        {/* ═══ SECTION 2 : Heures populaires ═══ */}
        <div className="ped-hours-card">
          <div className="ped-hours-head">
            <div className="ped-hours-title">Heures populaires · aujourd'hui</div>
            <div className="ped-hours-sub">Explore les autres jours de la semaine</div>
          </div>

          <div className="ped-hours-graph" aria-hidden="true">
            {POPULAR_HOURS_MOCK.map((value, hour) => {
              const isNow = hour === currentHour;
              const isPast = hour < currentHour;
              const cls = isNow ? 'is-now' : isPast ? 'is-past' : 'is-future';
              return (
                <div key={hour} className={`ped-hours-bar ${cls}`}>
                  <div
                    className="ped-hours-bar-fill"
                    style={{ height: `${Math.max(6, value)}%` }}
                  />
                  {isNow && <span className="ped-hours-bar-label">{value >= 60 ? 'Forte' : value >= 30 ? 'Moyenne' : 'Calme'}</span>}
                </div>
              );
            })}
          </div>

          <div className="ped-hours-axis">
            <span>6h</span>
            <span>9h</span>
            <span>12h</span>
            <span>15h</span>
            <span>18h</span>
            <span>21h</span>
          </div>

          <div className="ped-hours-footer">
            <div className="ped-hours-incentive">
              <span className="ped-hours-incentive-icon"><Icons.Trophy /></span>
              <div className="ped-hours-incentive-body">
                <div className="ped-hours-incentive-title">Incentives</div>
                <div className="ped-hours-incentive-sub">1 en cours · +500 FCFA / course de nuit</div>
              </div>
            </div>
            <button
              type="button"
              className="ped-hours-more"
              onClick={() => onNavigate?.('earnings')}
              aria-label="Voir toutes les incentives"
            >
              <Icons.Chevron />
            </button>
          </div>
        </div>

        {/* ═══ SECTION 3 : Queue en attente ═══ */}
        <div className="ped-queue">
          <div className="ped-queue-head">
            <div className="ped-queue-title">En attente</div>
            <button
              type="button"
              className="ped-queue-refresh"
              onClick={handleRefresh}
              aria-label="Rafraîchir"
              disabled={refreshing}
            >
              {refreshing ? <span className="dvr-spin" /> : <Icons.Refresh />}
            </button>
          </div>

          {loading ? (
            <>
              <div className="ped-queue-skel" />
              <div className="ped-queue-skel" />
            </>
          ) : (data.in_progress.length === 0 && data.available.length === 0) ? (
            <div className="ped-queue-empty">
              <div className="ped-queue-empty-icon"><Icons.Box /></div>
              <div className="ped-queue-empty-title">Rien pour l'instant</div>
              <div className="ped-queue-empty-sub">
                {isOnline
                  ? 'Reste en ligne, une course va arriver.'
                  : 'Passe en ligne pour recevoir des courses.'}
              </div>
            </div>
          ) : (
            <>
              {data.in_progress.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="ped-queue-item"
                  onClick={() => onOpenDelivery?.(o.id)}
                >
                  <div className="ped-queue-item-icon"><Icons.Box /></div>
                  <div className="ped-queue-item-body">
                    <div className="ped-queue-item-name">
                      {o.pickup_name || fmtClientName(o.address)}
                    </div>
                    <div className="ped-queue-item-meta">
                      {shortOrderId(o.id)} · en cours
                    </div>
                  </div>
                  <div className="ped-queue-item-amt">{fmtFcfa(o.total)}</div>
                </button>
              ))}
              {data.available.map((o) => (
                <AvailableDeliveryCard
                  key={o.id}
                  order={o}
                  onAccept={acceptOrder}
                  accepting={acceptingId === o.id}
                />
              ))}
            </>
          )}
        </div>

        {/* Espace bas pour la tab bar */}
        <div className="ped-sheet-bottom-space" />
      </section>
    </div>
  );
}

// Silence warning : garder la ref sur la variable exportée du meta au cas où
// l'import de PEDALEL_META / LOGO serait utilisé plus tard pour l'écran splash.
void PEDALEL_META;
void PEDALEL_LOGO_URL;
