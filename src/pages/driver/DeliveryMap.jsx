import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { haversineDistance } from '../../lib/geo';

/**
 * DeliveryMap
 * -----------
 * Carte interactive Uber Driver-style affichant :
 *   - pickup pharmacy (vert clair, icône hôpital)
 *   - delivery customer (rouge, icône pin)
 *   - driver live (vert YARAM avec animation pulse, scooter)
 *   - polyline en pointillés entre les 3 points
 *
 * Props :
 *   pickup       { lat, lng, name?, address? }   — pharmacie (peut être null si pas encore connu)
 *   delivery     { lat, lng, name?, address? }   — client final
 *   driver       { lat, lng, accuracy? } | null  — position live du livreur
 *   height       number (px) — default 280
 *   showRoute    bool — trace une polyline entre les points
 *   followDriver bool — recentre auto sur le driver quand il bouge
 *   interactive  bool — autorise pan/zoom (true par défaut)
 *   onRecenter   fn() — exposé pour bouton externe (optional)
 */
export default function DeliveryMap({
  pickup,
  delivery,
  driver,
  height = 280,
  showRoute = true,
  followDriver = false,
  interactive = true,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);
  const lastDriverPosRef = useRef(null);
  const [ready, setReady] = useState(false);

  // ─── Init map ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Fallback default center : Dakar
    const fallbackCenter = [14.6928, -17.4467];
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      tap: interactive,
    }).setView(fallbackCenter, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    // Attribution discrète bas-droite
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© OSM')
      .addTo(map);

    mapRef.current = map;
    setReady(true);

    return () => {
      try { map.remove(); } catch { /* déjà détruit */ }
      mapRef.current = null;
      markersRef.current = {};
      polylineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Update markers + polyline + bounds ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

    // ── Pickup marker (vert clair, hôpital)
    if (valid(pickup)) {
      const icon = L.divIcon({
        html: `<div class="dvr-map-pin dvr-map-pin-pickup" title="${escapeHtml(pickup.name || 'Pharmacie')}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v18M3 12h18"/>
          </svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        className: 'dvr-map-icon',
      });
      if (markersRef.current.pickup) {
        markersRef.current.pickup.setLatLng([pickup.lat, pickup.lng]);
        markersRef.current.pickup.setIcon(icon);
      } else {
        markersRef.current.pickup = L.marker([pickup.lat, pickup.lng], { icon, zIndexOffset: 200 }).addTo(map);
      }
    } else if (markersRef.current.pickup) {
      map.removeLayer(markersRef.current.pickup);
      delete markersRef.current.pickup;
    }

    // ── Delivery marker (rouge, pin)
    if (valid(delivery)) {
      const icon = L.divIcon({
        html: `<div class="dvr-map-pin dvr-map-pin-delivery" title="${escapeHtml(delivery.name || 'Destination')}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z"/>
            <circle cx="12" cy="10" r="2.5"/>
          </svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 32],
        className: 'dvr-map-icon',
      });
      if (markersRef.current.delivery) {
        markersRef.current.delivery.setLatLng([delivery.lat, delivery.lng]);
        markersRef.current.delivery.setIcon(icon);
      } else {
        markersRef.current.delivery = L.marker([delivery.lat, delivery.lng], { icon, zIndexOffset: 200 }).addTo(map);
      }
    } else if (markersRef.current.delivery) {
      map.removeLayer(markersRef.current.delivery);
      delete markersRef.current.delivery;
    }

    // ── Driver marker (vert YARAM, scooter, pulse)
    if (valid(driver)) {
      const icon = L.divIcon({
        html: `<div class="dvr-map-pin dvr-map-pin-driver">
          <span class="dvr-map-pin-pulse"></span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="6" cy="17" r="3"/>
            <circle cx="18" cy="17" r="3"/>
            <path d="M9 17h6"/>
            <path d="M5 14l3-5h4l3 5"/>
            <path d="M15 9V6h3"/>
          </svg>
        </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        className: 'dvr-map-icon',
      });
      if (markersRef.current.driver) {
        markersRef.current.driver.setLatLng([driver.lat, driver.lng]);
        markersRef.current.driver.setIcon(icon);
      } else {
        markersRef.current.driver = L.marker([driver.lat, driver.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      }

      // followDriver : recentre quand le driver bouge significativement (>20m)
      if (followDriver) {
        const last = lastDriverPosRef.current;
        const moved = !last || haversineDistance(last.lat, last.lng, driver.lat, driver.lng) > 0.02;
        if (moved) {
          map.panTo([driver.lat, driver.lng], { animate: true, duration: 0.4 });
          lastDriverPosRef.current = { lat: driver.lat, lng: driver.lng };
        }
      }
    } else if (markersRef.current.driver) {
      map.removeLayer(markersRef.current.driver);
      delete markersRef.current.driver;
    }

    // ── Polyline (driver → pickup → delivery)
    if (showRoute) {
      const pts = [];
      if (valid(driver)) pts.push([driver.lat, driver.lng]);
      if (valid(pickup)) pts.push([pickup.lat, pickup.lng]);
      if (valid(delivery)) pts.push([delivery.lat, delivery.lng]);

      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      if (pts.length >= 2) {
        polylineRef.current = L.polyline(pts, {
          color: '#2AA5AC',
          weight: 4,
          opacity: 0.85,
          dashArray: '8 10',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    }

    // ── Auto-fit bounds si on n'est pas en mode followDriver
    const bounds = [];
    if (valid(pickup))   bounds.push([pickup.lat, pickup.lng]);
    if (valid(delivery)) bounds.push([delivery.lat, delivery.lng]);
    if (valid(driver))   bounds.push([driver.lat, driver.lng]);

    if (!followDriver && bounds.length >= 1) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 14, { animate: false });
      } else {
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        } catch { /* bounds invalides */ }
      }
    } else if (followDriver && valid(driver) && !lastDriverPosRef.current) {
      // 1er centrage sur driver en mode follow
      map.setView([driver.lat, driver.lng], 15, { animate: false });
      lastDriverPosRef.current = { lat: driver.lat, lng: driver.lng };
    }
  }, [pickup, delivery, driver, showRoute, followDriver, ready]);

  // Resize handler : Leaflet peut mal mesurer si parent change de taille
  useEffect(() => {
    if (!mapRef.current) return;
    const t = setTimeout(() => {
      try { mapRef.current?.invalidateSize(); } catch { /* map détruite */ }
    }, 80);
    return () => clearTimeout(t);
  }, [height]);

  return (
    <div
      ref={containerRef}
      className={`dvr-map-container ${className}`}
      style={{ height, width: '100%' }}
      aria-label="Carte de livraison"
    />
  );
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────
// Hook : suivi GPS live du driver
// ─────────────────────────────────────────────────────────
export function useDriverPosition(enabled = true) {
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErr('not_supported');
      return;
    }
    let watchId = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          setPos({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
            heading: p.coords.heading,
            speed: p.coords.speed,
            ts: Date.now(),
          });
          setErr(null);
        },
        (e) => {
          console.warn('[useDriverPosition] error', e?.message);
          setErr(e?.message || 'error');
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    } catch (e) {
      setErr(e?.message || 'fatal');
    }
    return () => {
      if (watchId != null && navigator.geolocation) {
        try { navigator.geolocation.clearWatch(watchId); } catch { /* déjà clearé */ }
      }
    };
  }, [enabled]);

  return { pos, error: err };
}

// ─────────────────────────────────────────────────────────
// Estimate distance + ETA pour next-stop
// ─────────────────────────────────────────────────────────
const AVG_SPEED_KMH = 25; // moto urbaine Dakar

export function estimateRoute({ driver, pickup, delivery, picked = false }) {
  // si picked = true → next stop = delivery, sinon = pickup
  const target = picked ? delivery : pickup;
  if (!driver || !target || !Number.isFinite(driver.lat) || !Number.isFinite(target.lat)) {
    return { km: null, etaMin: null, label: null };
  }
  const km = haversineDistance(driver.lat, driver.lng, target.lat, target.lng);
  if (km === Infinity) return { km: null, etaMin: null, label: null };
  const etaMin = Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60));
  return {
    km,
    etaMin,
    label: picked ? 'vers client' : 'vers pharmacie',
  };
}
