// ════════════════════════════════════════════════════════════════
// BrandOrders — Commandes marque (Option B "vendeur direct")
// ────────────────────────────────────────────────────────────────
// Marque = pseudo-pharmacie liee (is_brand_direct=true). Le RPC
// brand_get_orders retourne les orders assignes a cette pseudo-pharma,
// et brand_update_order_status permet d'accepter/refuser/marquer pret.
//
// Copie fidele du pattern PharmaOrders mais violet + strings adaptes.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast, confirmDialog } from '../lib/toast';
import { getBrandToken } from '../pages/Brand';

const REFUSAL_REASONS = [
  'Produit en rupture de stock',
  'Produit indisponible',
  'Prix incorrect dans le catalogue',
  'Fermé pour le moment',
  'Autre',
];

// SVG icons
const Icon = ({ name, ...p }) => {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p };
  switch (name) {
    case 'refresh': return (<svg {...props}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>);
    case 'phone': return (<svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);
    case 'wa': return (<svg {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>);
    case 'check': return (<svg {...props}><polyline points="20 6 9 17 4 12"/></svg>);
    case 'x': return (<svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
    case 'truck': return (<svg {...props}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
    case 'box': return (<svg {...props}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>);
    case 'bell': return (<svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>);
    case 'pin': return (<svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>);
    case 'user': return (<svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
    default: return null;
  }
};

const STATUS_META = {
  paid:              { label: 'Nouvelle', dot: 'var(--y-warning)', cls: 'nouv' },
  preparing:         { label: 'En préparation', dot: '#0EA5E9', cls: 'prep' },
  ready:             { label: 'Prête à livrer', dot: 'var(--y-success)', cls: 'ready' },
  shipped:           { label: 'En livraison', dot: 'var(--brand-violet)', cls: 'ship' },
  awaiting_cash:     { label: 'Encaissement', dot: 'var(--brand-violet)', cls: 'ship' },
  awaiting_confirm:  { label: 'Confirm cliente', dot: 'var(--brand-violet)', cls: 'ship' },
  delivered:         { label: 'Livrée', dot: 'var(--y-success)', cls: 'done' },
  refused:           { label: 'Refusée', dot: 'var(--y-danger)', cls: 'ko' },
  cancelled:         { label: 'Annulée', dot: 'var(--y-danger)', cls: 'ko' },
};

function formatFcfa(n) {
  return `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
}

// Ding sonore court (data URI, ~440Hz beep) pour ne pas dependre d'un asset
const DING_DATA = 'data:audio/wav;base64,UklGRhIEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YfADAAA=';

export default function BrandOrders({ brand, onPendingChange }) {
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('pending');
  const [refusing, setRefusing]     = useState(null);
  const commission                  = Number(brand?.commission ?? brand?.brand?.commission ?? 10);
  const seenEventIdsRef             = useRef(new Set());
  const audioRef                    = useRef(null);

  const ding = () => {
    try {
      if (!audioRef.current) audioRef.current = new Audio(DING_DATA);
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch { /* silencieux */ }
  };

  // ─── Refresh via brand_get_orders ────────────────────────────
  const refresh = async () => {
    const token = getBrandToken();
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('brand_get_orders', { p_token: token });
      if (error) {
        console.warn('[BrandOrders] brand_get_orders error:', error.message);
        return;
      }
      if (data?.success === false) {
        console.warn('[BrandOrders] refus:', data.error);
        return;
      }
      const list = data?.orders || data || [];
      setOrders(Array.isArray(list) ? list : []);
      const pending = (Array.isArray(list) ? list : []).filter(o => o.status === 'paid').length;
      onPendingChange?.(pending);
    } catch (e) {
      console.error('[BrandOrders] refresh error:', e?.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Poll new events (ding + browser notif) ──────────────────
  const pollEvents = async () => {
    const token = getBrandToken();
    if (!token) return;
    try {
      const { data } = await supabase.rpc('brand_get_new_events', { p_token: token });
      const events = data?.events || data || [];
      if (!Array.isArray(events) || events.length === 0) return;

      let hasNew = false;
      for (const ev of events) {
        const id = ev.id || `${ev.type}-${ev.created_at}`;
        if (seenEventIdsRef.current.has(id)) continue;
        seenEventIdsRef.current.add(id);
        if (ev.type === 'new_order' || ev.type === 'order_paid' || ev.type === 'order.new') {
          hasNew = true;
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`${brand?.name || 'YARAM Marque'} — Nouvelle commande`, {
                body: ev.message || 'Une commande vient de tomber.',
                icon: '/icon-192.png',
                tag: 'brand-new-order',
              });
            } catch { /* noop */ }
          }
        }
      }
      if (hasNew) {
        ding();
        refresh();
        // Best-effort : marque les events vus cote serveur
        try { await supabase.rpc('brand_mark_events_seen', { p_token: token }); } catch { /* noop */ }
      }
    } catch { /* silencieux */ }
  };

  // ─── Realtime + polling ──────────────────────────────────────
  useEffect(() => {
    if (!brand?.id) return;
    refresh();

    // Realtime broadcast + postgres changes (safety net)
    const channel = supabase
      .channel(`brand-orders-${brand.id}`)
      .on('broadcast', { event: 'new_order' }, ({ payload }) => {
        const ids = Array.isArray(payload?.pharmacy_ids) ? payload.pharmacy_ids : [];
        const brandIds = Array.isArray(payload?.brand_ids) ? payload.brand_ids : [];
        if (brandIds.includes(brand.id) || ids.includes(brand?.pharmacy_id)) {
          ding();
          refresh();
        }
      })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => refresh()
      )
      .subscribe();

    // Poll events + orders toutes les 15s
    const interval = setInterval(() => {
      pollEvents();
      refresh();
    }, 15000);

    // Refresh au retour foreground
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        pollEvents();
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.id]);

  // ─── Helper : verifie succes RPC ─────────────────────────────
  const rpcOk = (res, label) => {
    if (res?.error) {
      console.error(`[BrandOrders] ${label} RPC error:`, res.error);
      toast.error(`Erreur ${label} : ${res.error.message || 'RPC en échec'}`);
      return false;
    }
    if (res?.data?.success === false) {
      console.error(`[BrandOrders] ${label} RPC refus:`, res.data);
      toast.error(`Refusé : ${res.data.error || 'opération non autorisée'}`);
      return false;
    }
    return true;
  };

  // ─── Actions ─────────────────────────────────────────────────
  const handleAccept = async (order) => {
    if (!(await confirmDialog(`Accepter la commande ${order.id} ?`, { confirmLabel: 'Accepter' }))) return;
    const token = getBrandToken();
    const res = await supabase.rpc('brand_update_order_status', {
      p_token: token, p_order_id: order.id, p_action: 'accept',
    });
    if (!rpcOk(res, 'acceptation')) return;
    toast.success('Commande acceptée.');
    refresh();
  };

  const handleReady = async (order) => {
    if (!(await confirmDialog('Marquer cette commande prête à livrer ?', { confirmLabel: 'Prête' }))) return;
    const token = getBrandToken();
    const res = await supabase.rpc('brand_update_order_status', {
      p_token: token, p_order_id: order.id, p_action: 'ready',
    });
    if (!rpcOk(res, 'marquage prêt')) return;
    toast.success('YARAM va assigner un livreur.');
    refresh();
  };

  const handleRefuse = async (order, reason) => {
    const token = getBrandToken();
    const res = await supabase.rpc('brand_update_order_status', {
      p_token: token, p_order_id: order.id, p_action: 'refuse', p_reason: reason,
    });
    if (!rpcOk(res, 'refus')) return;
    toast.success('Commande refusée. YARAM recontacte la cliente.');
    setRefusing(null);
    refresh();
  };

  // ─── Filtres + counts ────────────────────────────────────────
  const counts = {
    pending:   orders.filter(o => o.status === 'paid').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
    shipped:   orders.filter(o => ['shipped', 'awaiting_cash', 'awaiting_confirm'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    all:       orders.length,
  };

  const filtered = orders.filter(o => {
    if (filter === 'pending')   return o.status === 'paid';
    if (filter === 'preparing') return o.status === 'preparing';
    if (filter === 'ready')     return o.status === 'ready';
    if (filter === 'shipped')   return ['shipped', 'awaiting_cash', 'awaiting_confirm'].includes(o.status);
    if (filter === 'delivered') return o.status === 'delivered';
    return true;
  });

  return (
    <div className="brnd-section">
      <div className="brnd-header">
        <div>
          <h1>Mes commandes</h1>
          <p>
            {counts.pending > 0
              ? <><strong style={{ color: 'var(--y-warning)' }}>{counts.pending} à traiter</strong> · refresh auto 15s</>
              : <>{orders.length} commande{orders.length > 1 ? 's' : ''} · refresh auto 15s</>}
          </p>
        </div>
        <button className="brnd-btn-sec" onClick={refresh} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="refresh" width={14} height={14} />
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="brnd-filters">
        <button className={`brnd-filter ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          Nouvelles <span className="brnd-filter-count">{counts.pending}</span>
        </button>
        <button className={`brnd-filter ${filter === 'preparing' ? 'active' : ''}`} onClick={() => setFilter('preparing')}>
          En préparation <span className="brnd-filter-count">{counts.preparing}</span>
        </button>
        <button className={`brnd-filter ${filter === 'ready' ? 'active' : ''}`} onClick={() => setFilter('ready')}>
          Prêtes <span className="brnd-filter-count">{counts.ready}</span>
        </button>
        <button className={`brnd-filter ${filter === 'shipped' ? 'active' : ''}`} onClick={() => setFilter('shipped')}>
          En livraison <span className="brnd-filter-count">{counts.shipped}</span>
        </button>
        <button className={`brnd-filter ${filter === 'delivered' ? 'active' : ''}`} onClick={() => setFilter('delivered')}>
          Livrées <span className="brnd-filter-count">{counts.delivered}</span>
        </button>
        <button className={`brnd-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Toutes <span className="brnd-filter-count">{counts.all}</span>
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--y-n-600)' }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="brnd-empty">
          <Icon name="box" width={42} height={42} />
          <h3>Aucune commande</h3>
          <p>Pas de commande dans cette catégorie pour l'instant.</p>
        </div>
      ) : (
        <div className="brnd-orders-list">
          {filtered.map(o => {
            const meta = STATUS_META[o.status] || { label: o.status, dot: 'var(--y-n-500)', cls: 'ship' };
            const items = Array.isArray(o.items) ? o.items : [];
            const total = Number(o.total || items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0));
            const netAfterCommission = Math.round(total * (1 - (commission / 100)));
            const phone = o.address?.phone || o.phone || '';
            const shortId = String(o.id || '').slice(-6).toUpperCase();

            return (
              <div key={o.id} className="brnd-order-card">
                <div className="brnd-order-head">
                  <div style={{ minWidth: 0 }}>
                    <code className="brnd-order-code">#{shortId}</code>
                    <span className="brnd-order-date">
                      {o.created_at ? new Date(o.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <span className={`brnd-order-badge brnd-order-badge--${meta.cls}`}>
                    <span className="brnd-order-badge-dot" style={{ background: meta.dot }} />
                    {meta.label}
                  </span>
                </div>

                {/* Client */}
                <div className="brnd-order-client">
                  <div className="brnd-order-client-line">
                    <Icon name="user" width={13} height={13} />
                    <strong>{o.address?.name || 'Cliente'}</strong>
                  </div>
                  {phone && (
                    <div className="brnd-order-client-line">
                      <Icon name="phone" width={13} height={13} />
                      <a href={`tel:${phone}`}>{phone}</a>
                    </div>
                  )}
                  {(o.address?.line || o.address?.city) && (
                    <div className="brnd-order-client-line">
                      <Icon name="pin" width={13} height={13} />
                      <span>{[o.address?.line, o.address?.city].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                {items.length > 0 && (
                  <div className="brnd-order-items">
                    {items.map((it, i) => (
                      <div key={`${it.id || it.name}-${i}`} className="brnd-order-item">
                        <img
                          src={it.img || it.image_url || 'https://placehold.co/44x44/F3E8FF/7C3AED/png?text=?'}
                          alt=""
                          onError={(e) => { e.target.src = 'https://placehold.co/44x44/F3E8FF/7C3AED/png?text=?'; }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{it.name}</strong>
                          <span>×{it.qty || 1} · {formatFcfa(Number(it.price) || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totaux */}
                <div className="brnd-order-totals">
                  <div className="brnd-order-total-row">
                    <span>Total commande</span>
                    <strong>{formatFcfa(total)}</strong>
                  </div>
                  <div className="brnd-order-total-row brnd-order-total-net">
                    <span>Net après commission YARAM ({commission}%)</span>
                    <strong>{formatFcfa(netAfterCommission)}</strong>
                  </div>
                </div>

                {o.payment_method === 'cod' && (
                  <div className="brnd-order-cod">
                    Cash à la livraison : {formatFcfa(total)}
                  </div>
                )}

                {o.refusal_reason && (
                  <div className="brnd-order-refused">
                    Motif refus : {o.refusal_reason}
                  </div>
                )}

                {/* Actions */}
                <div className="brnd-order-actions">
                  {phone && (
                    <a
                      href={`https://wa.me/${String(phone).replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="brnd-order-wa"
                    >
                      <Icon name="wa" width={14} height={14} />
                      WhatsApp
                    </a>
                  )}

                  {o.status === 'paid' && (
                    <>
                      <button className="brnd-btn-primary brnd-order-cta" onClick={() => handleAccept(o)}>
                        <Icon name="check" width={14} height={14} />
                        Accepter
                      </button>
                      <button className="brnd-btn-danger" onClick={() => setRefusing(o)}>
                        <Icon name="x" width={14} height={14} />
                        Refuser
                      </button>
                    </>
                  )}

                  {o.status === 'preparing' && (
                    <button className="brnd-btn-primary brnd-order-cta brnd-order-cta-green" onClick={() => handleReady(o)}>
                      <Icon name="truck" width={14} height={14} />
                      Marquer prête à livrer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {refusing && (
        <RefuseModal
          order={refusing}
          onRefuse={(reason) => handleRefuse(refusing, reason)}
          onCancel={() => setRefusing(null)}
        />
      )}
    </div>
  );
}

function RefuseModal({ order, onRefuse, onCancel }) {
  const [reason, setReason]           = useState('');
  const [customReason, setCustomReason] = useState('');

  const submit = () => {
    const final = reason === 'Autre' ? customReason : reason;
    if (!final.trim()) { toast.error('Sélectionne un motif'); return; }
    onRefuse(final.trim());
  };

  return (
    <div className="brnd-modal-overlay" onClick={onCancel}>
      <div className="brnd-modal" onClick={e => e.stopPropagation()}>
        <h3>Refuser la commande</h3>
        <p className="brnd-modal-sub">
          La cliente sera notifiée et YARAM lui proposera une autre solution.
        </p>

        <div className="brnd-refuse-reasons">
          {REFUSAL_REASONS.map(r => (
            <button
              key={r}
              type="button"
              className={`brnd-refuse-reason ${reason === r ? 'active' : ''}`}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {reason === 'Autre' && (
          <textarea
            className="brnd-textarea"
            value={customReason}
            onChange={e => setCustomReason(e.target.value)}
            placeholder="Précise la raison…"
            rows={3}
            style={{ marginTop: 10 }}
          />
        )}

        <div className="brnd-modal-actions">
          <button className="brnd-btn-sec" onClick={onCancel} style={{ flex: 1 }}>Annuler</button>
          <button className="brnd-btn-danger" onClick={submit} style={{ flex: 2 }}>
            Confirmer le refus
          </button>
        </div>
      </div>
    </div>
  );
}
