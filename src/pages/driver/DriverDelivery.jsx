import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import Livreur from '../Livreur';
import DeliveryMap, { useDriverPosition, estimateRoute } from './DeliveryMap';
import { formatDistance } from '../../lib/geo';

/**
 * DriverDelivery
 * ---------------
 * Vue détail d'une livraison depuis l'app driver authentifiée.
 *
 * Stratégie :
 *  1) Récupère le delivery_token de l'order via la RPC `driver_get_order`
 *     (gatée par le session token).
 *  2) Au top de la page, affiche une carte Uber-style (pickup, delivery, driver
 *     live, polyline pointillée, distance/ETA, bouton recenter).
 *  3) En dessous, monte le composant <Livreur /> existant (UX premium DoorDash
 *     avec sourcing, signature, PIN, timeline, GPS, etc.) en y attachant le
 *     token comme query param.
 *  4) Push la position GPS du driver vers Supabase (driver_push_position) toutes
 *     les 10 s tant que le statut est entre "shipped" et "delivered".
 */
export default function DriverDelivery({ session, orderId, onBack }) {
  const [resolvedToken, setResolvedToken] = useState(null);
  const [orderData, setOrderData] = useState(null);   // { order, tracking, pharmacies }
  const [err, setErr] = useState('');
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const lastPushAtRef = useRef(0);
  const pollTimerRef = useRef(null);

  // GPS du driver (watchPosition)
  const { pos: driverPos } = useDriverPosition(true);

  // ── Charge l'order + tracking via RPC ─────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.token || !orderId) {
        setErr('Paramètres manquants');
        return;
      }
      try {
        const { data, error } = await supabase.rpc('driver_get_order', {
          p_token: session.token,
          p_order_id: orderId,
        });
        if (cancelled) return;
        if (error) {
          console.error('[DriverDelivery] RPC error:', error);
          setErr('Erreur réseau. Réessaie.');
          return;
        }
        if (!data?.success) {
          const code = data?.error || 'unknown';
          if (code === 'not_assigned') setErr("Cette commande ne t'est pas assignée.");
          else if (code === 'order_not_found') setErr('Commande introuvable.');
          else if (code === 'invalid_session') setErr('Session expirée.');
          else setErr('Impossible de charger cette livraison.');
          return;
        }
        const tk = data.tracking?.delivery_token;
        if (!tk) {
          setErr("Lien de livraison absent — contacte l'admin.");
          return;
        }
        // Injecte ?livreur=TOKEN dans l'URL et monte Livreur en remount complet.
        const newUrl = `${window.location.pathname}?livreur=${tk}`;
        window.history.replaceState({}, '', newUrl);
        setResolvedToken(tk);
        setOrderData({
          order: data.order || null,
          tracking: data.tracking || null,
          pharmacies: data.pharmacies || [],
        });
      } catch (e) {
        console.error('[DriverDelivery] fatal:', e);
        if (!cancelled) setErr('Erreur inattendue.');
      }
    })();
    return () => { cancelled = true; };
  }, [session?.token, orderId]);

  // ── Re-poll tracking toutes les 20s pour rester en phase ──
  useEffect(() => {
    if (!session?.token || !orderId || !resolvedToken) return;
    let stopped = false;
    const tick = async () => {
      try {
        const { data } = await supabase.rpc('driver_get_order', {
          p_token: session.token,
          p_order_id: orderId,
        });
        if (stopped) return;
        if (data?.success) {
          setOrderData((prev) => ({
            order: data.order || prev?.order || null,
            tracking: data.tracking || prev?.tracking || null,
            pharmacies: data.pharmacies || prev?.pharmacies || [],
          }));
        }
      } catch {
        /* silencieux — on retentera au prochain tick */
      }
    };
    pollTimerRef.current = setInterval(tick, 20000);
    return () => {
      stopped = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [session?.token, orderId, resolvedToken]);

  // ── Compute pickup / delivery coords ──────────────────
  const { pickup, delivery, picked, pushEnabled } = useMemo(() => {
    const o = orderData?.order || {};
    const t = orderData?.tracking || {};
    const phs = orderData?.pharmacies || [];
    const ph = phs[0] || null;
    const status = t.status || o.status || null;

    let _pickup = null;
    if (ph && Number.isFinite(ph.lat) && Number.isFinite(ph.lng)) {
      _pickup = { lat: ph.lat, lng: ph.lng, name: ph.name || 'Pharmacie', address: ph.address };
    }

    let _delivery = null;
    if (Number.isFinite(o.delivery_lat) && Number.isFinite(o.delivery_lng)) {
      const addr = o.address || {};
      const name = (typeof addr === 'object' ? addr.name : null) || 'Client';
      _delivery = { lat: o.delivery_lat, lng: o.delivery_lng, name, address: addr };
    }

    const _picked = !!(t.picked_at || t.in_route_at || ['in_route', 'arrived', 'delivered'].includes(status));
    // Push GPS si la livraison est active (shipped / in_route / arrived)
    const _push = ['shipped', 'in_route', 'arrived', 'picked', 'assigned'].includes(status) &&
                  status !== 'delivered' && status !== 'cancelled';

    return { pickup: _pickup, delivery: _delivery, picked: _picked, pushEnabled: _push };
  }, [orderData]);

  // ── Push position GPS vers Supabase toutes les 10s (throttling RPC géré côté DB) ──
  useEffect(() => {
    if (!pushEnabled) return;
    if (!driverPos || !session?.token || !orderId) return;
    const now = Date.now();
    if (now - lastPushAtRef.current < 9500) return;
    lastPushAtRef.current = now;
    (async () => {
      try {
        await supabase.rpc('driver_push_position', {
          p_token: session.token,
          p_order_id: orderId,
          p_lat: driverPos.lat,
          p_lng: driverPos.lng,
          p_accuracy: driverPos.accuracy || null,
        });
      } catch {
        /* silencieux — on retentera au prochain tick */
      }
    })();
  }, [driverPos?.lat, driverPos?.lng, driverPos?.ts, pushEnabled, session?.token, orderId]);

  // ── Distance + ETA ─────────────────────────────────────
  const route = useMemo(
    () => estimateRoute({ driver: driverPos, pickup, delivery, picked }),
    [driverPos, pickup, delivery, picked]
  );

  // ── Recenter button ───────────────────────────────────
  const [recenterTick, setRecenterTick] = useState(0);
  const handleRecenter = () => setRecenterTick((n) => n + 1);

  // ── Itinéraire externe (Google / Apple Maps deeplink) ─
  // Detection UA simple : iPhone / iPad / Mac -> Apple Maps ; sinon Google Maps.
  const openExternalRoute = () => {
    const target = picked ? delivery : pickup;
    if (!target) return;
    const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|Mac/.test(navigator.userAgent);
    const url = isApple
      ? `https://maps.apple.com/?daddr=${target.lat},${target.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`;
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* popup bloqué */ }
  };

  // ── Etape courante déduite du statut / tracking ─────────
  const status = orderData?.order?.status || orderData?.tracking?.status || null;
  const trk = orderData?.tracking || {};
  const currentStep = useMemo(() => {
    if (trk.delivered_at || status === 'delivered') return 'delivered';
    if (trk.arrived_at || status === 'arrived') return 'at_client';
    if (trk.picked_at || trk.in_route_at || ['in_route', 'picked'].includes(status)) return 'to_client';
    if (['at_pickup'].includes(status)) return 'at_pickup';
    return 'to_pickup';
  }, [status, trk.picked_at, trk.in_route_at, trk.arrived_at, trk.delivered_at]);

  const primaryLabel = {
    to_pickup: 'Arrivé chez la pharmacie',
    at_pickup: 'Colis récupéré',
    to_client: 'Arrivé chez le client',
    at_client: 'Livraison confirmée',
    delivered: 'Livraison terminée',
  }[currentStep];

  // Code de remise (4 chiffres) — supporte pickup_code / delivery_code / delivery_pin
  const remiseCode = orderData?.order?.pickup_code
    || orderData?.order?.delivery_code
    || orderData?.tracking?.pickup_code
    || orderData?.tracking?.delivery_code
    || orderData?.tracking?.delivery_pin
    || null;

  // ── States d'erreur / loading ──────────────────────────
  if (err) {
    return (
      <div className="dvr-page">
        <div className="dvr-card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 'var(--y-fs-4xl)', marginBottom: 10, color: 'var(--y-danger)' }} aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{err}</div>
          <button className="dvr-btn dvr-btn-ghost" onClick={onBack} style={{ marginTop: 20 }}>
            Retour au dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!resolvedToken) {
    return (
      <div className="dvr-page">
        <div className="dvr-skel" style={{ height: 200, marginBottom: 12 }} />
        <div className="dvr-skel" style={{ height: 160, marginBottom: 12 }} />
        <div className="dvr-skel" style={{ height: 240 }} />
      </div>
    );
  }

  const hasMapData = pickup || delivery || driverPos;

  return (
    <div className="dvr-detail-frame" key={resolvedToken}>
      {/* MAP HERO — visible si on a au moins 1 point géographique */}
      {hasMapData && (
        <div className={`dvr-map-wrapper ${mapCollapsed ? 'collapsed' : ''}`}>
          <DeliveryMap
            key={`map-${recenterTick}`}
            pickup={pickup}
            delivery={delivery}
            driver={driverPos}
            height={mapCollapsed ? 100 : 320}
            showRoute={true}
            followDriver={false}
          />

          {/* Overlay infos */}
          {!mapCollapsed && (
            <>
              <div className="dvr-map-overlay-top">
                {route?.km != null && (
                  <div className="dvr-map-badge">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z"/>
                      <circle cx="12" cy="10" r="2.5"/>
                    </svg>
                    {formatDistance(route.km)}
                  </div>
                )}
                {route?.etaMin != null && (
                  <div className="dvr-map-badge">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ~{route.etaMin} min
                  </div>
                )}
                {route?.label && (
                  <div className="dvr-map-badge dvr-map-badge-accent">{route.label}</div>
                )}
              </div>

              <button
                className="dvr-map-recenter-btn"
                onClick={handleRecenter}
                aria-label="Recentrer la carte"
                title="Recentrer"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
              </button>

              <button
                className="dvr-map-route-btn"
                onClick={openExternalRoute}
                aria-label="Ouvrir l'itinéraire"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Itinéraire
              </button>
            </>
          )}

          <button
            className="dvr-map-collapse-btn"
            onClick={() => setMapCollapsed((v) => !v)}
            aria-label={mapCollapsed ? 'Agrandir la carte' : 'Réduire la carte'}
            title={mapCollapsed ? 'Agrandir' : 'Réduire'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {mapCollapsed
                ? <polyline points="6 9 12 15 18 9" />
                : <polyline points="18 15 12 9 6 15" />}
            </svg>
          </button>
        </div>
      )}

      {/* Bouton retour flottant en haut à gauche, par-dessus la map/Livreur */}
      <button
        onClick={() => {
          // Nettoie l'URL pour ne pas rester sur le token
          window.history.replaceState({}, '', '/driver');
          onBack?.();
        }}
        aria-label="Retour"
        className="dvr-back-fab"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--y-n-900)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* ─── Résumé course : timeline waypoints + code remise + Maps ─── */}
      <div className="dvr-page" style={{ paddingTop: 12 }}>
        <div className="dvr-card dvr-course-summary">
          {/* Timeline pickup -> client */}
          <ol className="dvr-timeline" aria-label="Étapes de la livraison">
            <li className={`dvr-timeline-step ${['at_pickup','to_client','at_client','delivered'].includes(currentStep) ? 'done' : (currentStep === 'to_pickup' ? 'current' : '')}`}>
              <span className="dvr-timeline-dot" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>
                </svg>
              </span>
              <div className="dvr-timeline-body">
                <div className="dvr-timeline-title">Retrait pharmacie</div>
                <div className="dvr-timeline-sub">{pickup?.name || 'Pharmacie partenaire'}</div>
              </div>
            </li>
            <li className={`dvr-timeline-step ${currentStep === 'delivered' ? 'done' : (['to_client','at_client'].includes(currentStep) ? 'current' : '')}`}>
              <span className="dvr-timeline-dot" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12l2-9 4 3 4-3 4 3 4-3 2 9"/><path d="M3 12v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                </svg>
              </span>
              <div className="dvr-timeline-body">
                <div className="dvr-timeline-title">Livraison client</div>
                <div className="dvr-timeline-sub">{delivery?.name || 'Client'}</div>
              </div>
            </li>
          </ol>

          {/* Ouvrir dans Maps */}
          {(pickup || delivery) && (
            <button
              type="button"
              className="dvr-btn dvr-btn-ghost dvr-course-maps"
              onClick={openExternalRoute}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              Ouvrir dans Maps
            </button>
          )}

          {/* Code de remise (4 chiffres) — géant */}
          {remiseCode && (
            <div className="dvr-remise-block" aria-label="Code de remise">
              <div className="dvr-remise-label">Code de remise</div>
              <div className="dvr-remise-code" aria-live="polite">
                {String(remiseCode).padStart(4, '0').split('').map((d, i) => (
                  <span key={i} className="dvr-remise-digit">{d}</span>
                ))}
              </div>
              <div className="dvr-remise-help">
                Demandez au client de vous dicter ce code pour confirmer la livraison.
              </div>
            </div>
          )}
        </div>
      </div>

      <Livreur />

      {/* ─── Sticky bottom info bar : rappel de l'étape en cours ─── */}
      {primaryLabel && currentStep !== 'delivered' && (
        <div className="dvr-course-sticky" role="status" aria-live="polite">
          <span className="dvr-course-sticky-dot" aria-hidden="true" />
          <span className="dvr-course-sticky-label">Prochaine étape&nbsp;: {primaryLabel}</span>
        </div>
      )}
    </div>
  );
}
