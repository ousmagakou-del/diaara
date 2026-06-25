import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

// Helpers
const fmtFcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
const fmtAddrShort = (addr) => {
  if (!addr) return 'Adresse non précisée';
  if (typeof addr === 'string') return addr;
  const line = addr.line || addr.address || '';
  const city = addr.neighborhood || addr.city || 'Dakar';
  return [line, city].filter(Boolean).join(' · ') || 'Adresse non précisée';
};
const fmtClientName = (addr) => {
  if (!addr) return 'Cliente';
  if (typeof addr === 'string') return 'Cliente';
  return addr.name || 'Cliente';
};
const fmtPay = (m) => {
  if (!m) return 'Paiement';
  const v = String(m).toLowerCase();
  if (v === 'cod' || v === 'cash') return 'Cash à la livraison';
  if (v === 'wave') return 'Wave (payé)';
  if (v === 'om' || v === 'orange_money') return 'Orange Money (payé)';
  if (v === 'stripe' || v === 'card') return 'Carte (payé)';
  return m;
};
const isCash = (m) => {
  const v = String(m || '').toLowerCase();
  return v === 'cod' || v === 'cash';
};
const statusBadge = (s) => {
  const map = {
    preparing: { cls: 'dvr-status-preparing', txt: 'En préparation' },
    shipped:   { cls: 'dvr-status-shipped',   txt: 'En route' },
    awaiting_confirm: { cls: 'dvr-status-awaiting', txt: 'À confirmer' },
    delivered: { cls: 'dvr-status-delivered', txt: 'Livrée' },
    paid:      { cls: 'dvr-status-paid',      txt: 'Payée' },
    accepted:  { cls: 'dvr-status-paid',      txt: 'Acceptée' },
    ready:     { cls: 'dvr-status-ready',     txt: 'Prête' },
  };
  return map[s] || { cls: 'dvr-status-paid', txt: s || '—' };
};
const shortOrderId = (id) => {
  if (!id) return '—';
  const s = String(id);
  return s.length > 8 ? `#${s.slice(0, 8)}` : `#${s}`;
};

// SVG ICONS (inline, no extra deps)
const Icons = {
  Settings: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Box: () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Pin: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Empty: () => (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

function DeliveryCard({ order, onClick, accent }) {
  const sb = statusBadge(order.status);
  const cash = isCash(order.payment_method);
  return (
    <div
      className={`dvr-delivery-card ${accent === 'available' ? 'dvr-available' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
    >
      <div className="dvr-delivery-head">
        <div className="dvr-delivery-icon"><Icons.Box /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dvr-delivery-id">{shortOrderId(order.id)}</div>
          <div className="dvr-delivery-amount">{fmtFcfa(order.total)}</div>
        </div>
        <span className={`dvr-status-badge ${sb.cls}`}>{sb.txt}</span>
      </div>

      <div className="dvr-delivery-loc">
        <span className="dvr-loc-icon"><Icons.Pin /></span>
        <span>
          <strong>{fmtClientName(order.address)}</strong>
          <br />
          {fmtAddrShort(order.address)}
        </span>
      </div>

      <div className="dvr-delivery-pay">
        <span className={`dvr-pay-chip ${cash ? '' : 'paid'}`}>
          {cash ? `Encaisser ${fmtFcfa(order.total)}` : 'Payé'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11 }}>
          {fmtPay(order.payment_method)}
        </span>
      </div>
    </div>
  );
}

function AvailableDeliveryCard({ order, onAccept, accepting }) {
  return (
    <div className="dvr-delivery-card dvr-available">
      <div className="dvr-delivery-head">
        <div className="dvr-delivery-icon" style={{ background: '#FFF7E0', color: '#856404' }}>
          <Icons.Box />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dvr-delivery-id">{shortOrderId(order.id)} · Nouvelle</div>
          <div className="dvr-delivery-amount">{fmtFcfa(order.total)}</div>
        </div>
      </div>
      <div className="dvr-delivery-loc">
        <span className="dvr-loc-icon"><Icons.Pin /></span>
        <span>
          <strong>{fmtClientName(order.address)}</strong>
          <br />
          {fmtAddrShort(order.address)}
        </span>
      </div>
      <button
        className="dvr-accept-btn"
        onClick={() => onAccept(order.id)}
        disabled={accepting}
      >
        {accepting ? 'Acceptation…' : 'Accepter cette livraison'}
      </button>
    </div>
  );
}

export default function DriverDashboard({ session, onLogout, onOpenDelivery, onNavigate }) {
  const [data, setData] = useState({ in_progress: [], available: [], recent: [] });
  const [todayStats, setTodayStats] = useState({ count: 0, fcfa: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(session?.active !== false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined'
      ? (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true)
      : false,
  );

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
        setData({
          in_progress: ordersRes.data.in_progress || [],
          available:   ordersRes.data.available   || [],
          recent:      ordersRes.data.recent      || [],
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
    // Refresh quand on revient sur l'onglet
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  // ─── beforeinstallprompt (Android / desktop Chrome) ───
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      setInstallPrompt(null);
      setInstalled(true);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const toggleAvailable = async () => {
    const next = !available;
    setAvailable(next);
    try {
      const { data: r, error } = await supabase.rpc('driver_set_active', {
        p_token: session.token,
        p_active: next,
      });
      if (error || !r?.success) {
        setAvailable(!next);
        toast.error('Impossible de changer ta disponibilité.');
        return;
      }
      // Update session local
      try {
        const raw = localStorage.getItem('yaram_driver_session');
        if (raw) {
          const s = JSON.parse(raw);
          s.active = next;
          localStorage.setItem('yaram_driver_session', JSON.stringify(s));
        }
      } catch {}
      toast.success(next ? 'Tu es maintenant disponible' : 'Tu es maintenant hors-ligne');
    } catch (e) {
      setAvailable(!next);
      toast.error('Erreur réseau.');
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
      // Ouvre la commande direct
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

  return (
    <>
      {/* HEADER */}
      <header className="dvr-header">
        <div className="dvr-header-card">
          <div className="dvr-avatar">{initials}</div>
          <div className="dvr-header-text">
            <div className="dvr-header-name">Salut, {firstName} 👋</div>
            <div className="dvr-header-sub">
              {available
                ? <><span className="dvr-online"><span className="dvr-dot-pulse" />Disponible</span></>
                : <><span className="dvr-offline"><span className="dvr-dot-pulse" />Hors-ligne</span></>}
            </div>
          </div>
          <button
            className="dvr-header-action"
            onClick={() => onNavigate?.('profile')}
            aria-label="Profil"
            title="Profil"
          >
            <Icons.Settings />
          </button>
        </div>
      </header>

      <div className="dvr-page">
        {/* STATS RAPIDES */}
        <div className="dvr-stats-row">
          <div className="dvr-kpi">
            <div className="dvr-kpi-label">Aujourd'hui</div>
            <div className="dvr-kpi-value">{todayStats.count}</div>
            <div className="dvr-kpi-sub">livraison{todayStats.count > 1 ? 's' : ''}</div>
          </div>
          <div className="dvr-kpi">
            <div className="dvr-kpi-label">Gains</div>
            <div className="dvr-kpi-value">{fmtFcfa(todayStats.fcfa)}</div>
            <div className="dvr-kpi-sub">aujourd'hui</div>
          </div>
        </div>

        {/* DISPONIBILITÉ */}
        <div className="dvr-availability">
          <div className="dvr-availability-text">
            <div className="dvr-availability-title">Disponible pour les courses</div>
            <div className="dvr-availability-sub">
              {available ? 'Tu reçois les nouvelles livraisons' : 'Active pour recevoir des courses'}
            </div>
          </div>
          <div
            className={`dvr-switch ${available ? 'on' : ''}`}
            role="switch"
            aria-checked={available}
            tabIndex={0}
            onClick={toggleAvailable}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleAvailable(); }}
          />
        </div>

        {/* INSTALL PWA */}
        {installPrompt && !installed && (
          <div className="dvr-install">
            <div className="dvr-install-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="dvr-install-text">
              <strong>Installe l'app</strong>
              <div style={{ color: 'var(--dvr-text-mute)' }}>Plus rapide, accès depuis l'écran d'accueil</div>
            </div>
            <button onClick={handleInstall}>Installer</button>
          </div>
        )}

        {/* SECTION : LIVRAISONS EN COURS */}
        <div className="dvr-section">
          <div className="dvr-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Livraisons en cours</span>
            <button
              className="dvr-header-action"
              style={{ width: 32, height: 32, borderRadius: 10 }}
              onClick={handleRefresh}
              aria-label="Rafraîchir"
            >
              {refreshing ? <span className="dvr-spin" /> : <Icons.Refresh />}
            </button>
          </div>

          {loading ? (
            <>
              <div className="dvr-skel" style={{ height: 140, marginBottom: 10 }} />
              <div className="dvr-skel" style={{ height: 140 }} />
            </>
          ) : data.in_progress.length === 0 ? (
            <div className="dvr-empty">
              <div className="dvr-empty-icon"><Icons.Box /></div>
              <div className="dvr-empty-title">Aucune livraison en cours</div>
              <div className="dvr-empty-sub">
                {available
                  ? 'Tu seras notifié dès qu\'une course t\'est assignée.'
                  : 'Active la disponibilité pour recevoir des courses.'}
              </div>
            </div>
          ) : (
            data.in_progress.map((o) => (
              <DeliveryCard
                key={o.id}
                order={o}
                onClick={() => onOpenDelivery?.(o.id)}
              />
            ))
          )}
        </div>

        {/* SECTION : NOUVELLES LIVRAISONS PROPOSÉES */}
        {data.available.length > 0 && (
          <div className="dvr-section">
            <div className="dvr-section-label">Nouvelles livraisons proposées</div>
            {data.available.map((o) => (
              <AvailableDeliveryCard
                key={o.id}
                order={o}
                onAccept={acceptOrder}
                accepting={acceptingId === o.id}
              />
            ))}
          </div>
        )}

        {/* SECTION : HISTORIQUE RÉCENT */}
        {data.recent.length > 0 && (
          <div className="dvr-section">
            <div className="dvr-section-label">Historique récent</div>
            <div className="dvr-card" style={{ padding: '8px 16px' }}>
              {data.recent.map((o) => (
                <div className="dvr-history-row" key={o.id}>
                  <div className="dvr-history-icon"><Icons.Box /></div>
                  <div className="dvr-history-mid">
                    <div className="dvr-history-name">{fmtClientName(o.address)}</div>
                    <div className="dvr-history-date">
                      {shortOrderId(o.id)} · {new Date(o.client_confirmed_at || o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div className="dvr-history-amt">{fmtFcfa(o.total)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
