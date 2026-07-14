// ════════════════════════════════════════════════════════════════
// BrandInventory — Gestion du stock des produits de la marque
// ────────────────────────────────────────────────────────────────
// Marque = vendeur direct. Chaque produit approuve de la marque a
// un stock (stock_quantity) + un seuil d'alerte (low_stock_threshold)
// gere via les RPCs brand_get_inventory / brand_update_stock.
//
// UX : compteur -/+ large tap, input direct, auto-save debounced,
// badge Rupture/Faible, filtres Tous/Rupture/Faible/OK.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { getBrandToken } from '../pages/Brand';

const Icon = ({ name, ...p }) => {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p };
  switch (name) {
    case 'minus': return (<svg {...props}><line x1="5" y1="12" x2="19" y2="12"/></svg>);
    case 'plus':  return (<svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
    case 'box':   return (<svg {...props}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>);
    case 'alert': return (<svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
    case 'check': return (<svg {...props}><polyline points="20 6 9 17 4 12"/></svg>);
    case 'refresh': return (<svg {...props}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>);
    default: return null;
  }
};

const STATUS_META = {
  approved: { label: 'Validé', cls: 'approved' },
  pending:  { label: 'En attente', cls: 'pending' },
  rejected: { label: 'Rejeté', cls: 'rejected' },
};

export default function BrandInventory({ brand }) {
  const [items, setItems]       = useState([]);      // items renvoyes par brand_get_inventory
  const [loading, setLoading]   = useState(true);
  const [savingIds, setSavingIds] = useState(new Set());
  const [filter, setFilter]     = useState('all');   // all | out | low | ok
  const [search, setSearch]     = useState('');

  // debounce timers par produit pour auto-save
  const saveTimersRef = useRef({});

  const refresh = useCallback(async () => {
    const token = getBrandToken();
    if (!token) return;
    try {
      const { data, error } = await supabase.rpc('brand_get_inventory', { p_token: token });
      if (error) {
        console.warn('[BrandInventory] error:', error.message);
        setLoading(false);
        return;
      }
      if (data?.success === false) {
        console.warn('[BrandInventory] refus:', data.error);
        setLoading(false);
        return;
      }
      const list = data?.inventory || data || [];
      setItems(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ─── Persistance stock/seuil (RPC brand_update_stock) ────────
  const persist = async (productId, stock, threshold) => {
    const token = getBrandToken();
    if (!token) return;
    setSavingIds(prev => {
      const next = new Set(prev); next.add(productId); return next;
    });
    try {
      const { data, error } = await supabase.rpc('brand_update_stock', {
        p_token: token,
        p_product_id: productId,
        p_stock_quantity: Number(stock),
        p_low_stock_threshold: Number(threshold),
      });
      if (error) {
        console.error('[BrandInventory] update error:', error.message);
        toast.error('Erreur MAJ stock : ' + error.message);
        return;
      }
      if (data?.success === false) {
        toast.error('Refusé : ' + (data.error || 'inconnu'));
        return;
      }
      // On ne toast pas systematiquement (auto-save silencieux), sauf action manuelle
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev); next.delete(productId); return next;
      });
    }
  };

  // ─── Update local + debounce serveur ─────────────────────────
  const patchItem = (productId, patch) => {
    setItems(prev => prev.map(it => it.product_id === productId ? { ...it, ...patch } : it));
    // Trigger debounced save
    const item = items.find(i => i.product_id === productId);
    if (!item) return;
    const next = { ...item, ...patch };
    clearTimeout(saveTimersRef.current[productId]);
    saveTimersRef.current[productId] = setTimeout(() => {
      persist(productId, next.stock_quantity, next.low_stock_threshold);
    }, 700);
  };

  const setStock = (productId, stock) => {
    const s = Math.max(0, Number.isFinite(Number(stock)) ? parseInt(stock, 10) : 0);
    patchItem(productId, { stock_quantity: s });
  };

  const incStock = (productId, delta) => {
    const item = items.find(i => i.product_id === productId);
    if (!item) return;
    const next = Math.max(0, (item.stock_quantity || 0) + delta);
    patchItem(productId, { stock_quantity: next });
  };

  const setThreshold = (productId, t) => {
    const v = Math.max(0, Number.isFinite(Number(t)) ? parseInt(t, 10) : 0);
    patchItem(productId, { low_stock_threshold: v });
  };

  const forceSaveNow = async (productId) => {
    const item = items.find(i => i.product_id === productId);
    if (!item) return;
    clearTimeout(saveTimersRef.current[productId]);
    await persist(productId, item.stock_quantity, item.low_stock_threshold);
    toast.success('Stock sauvegardé.');
  };

  // ─── Filtres ─────────────────────────────────────────────────
  const withStatus = items.map(it => {
    const stock = Number(it.stock_quantity || 0);
    const threshold = Number(it.low_stock_threshold || 0);
    let stockStatus = 'ok';
    if (stock === 0) stockStatus = 'out';
    else if (threshold > 0 && stock <= threshold) stockStatus = 'low';
    return { ...it, _stockStatus: stockStatus };
  });

  const counts = {
    all: withStatus.length,
    out: withStatus.filter(i => i._stockStatus === 'out').length,
    low: withStatus.filter(i => i._stockStatus === 'low').length,
    ok:  withStatus.filter(i => i._stockStatus === 'ok').length,
  };

  const filtered = withStatus.filter(it => {
    if (filter !== 'all' && it._stockStatus !== filter) return false;
    if (search.trim() && !it.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="brnd-section">
      <div className="brnd-header">
        <div>
          <h1>Mon stock</h1>
          <p>
            {counts.out > 0
              ? <><strong style={{ color: 'var(--y-danger)' }}>{counts.out} en rupture</strong> · met à jour ton stock pour ne pas rater de commandes</>
              : <>{counts.all} produit{counts.all > 1 ? 's' : ''} · sauvegarde auto</>}
          </p>
        </div>
        <button className="brnd-btn-sec" onClick={refresh} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="refresh" width={14} height={14} />
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="brnd-filters">
        <button className={`brnd-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Tous <span className="brnd-filter-count">{counts.all}</span>
        </button>
        <button className={`brnd-filter ${filter === 'out' ? 'active' : ''}`} onClick={() => setFilter('out')}>
          Rupture <span className="brnd-filter-count">{counts.out}</span>
        </button>
        <button className={`brnd-filter ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>
          Faible <span className="brnd-filter-count">{counts.low}</span>
        </button>
        <button className={`brnd-filter ${filter === 'ok' ? 'active' : ''}`} onClick={() => setFilter('ok')}>
          OK <span className="brnd-filter-count">{counts.ok}</span>
        </button>
      </div>

      <input
        type="search"
        className="brnd-input"
        placeholder="Rechercher un produit…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--y-n-600)' }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="brnd-empty">
          <Icon name="box" width={42} height={42} />
          <h3>Aucun produit</h3>
          <p>Ajoute d'abord des produits dans "Mes produits".</p>
        </div>
      ) : (
        <div className="brnd-inv-list">
          {filtered.map(it => {
            const status = STATUS_META[it.status] || null;
            const stock = Number(it.stock_quantity || 0);
            const threshold = Number(it.low_stock_threshold || 0);
            const isOut = stock === 0;
            const isLow = !isOut && threshold > 0 && stock <= threshold;
            const saving = savingIds.has(it.product_id);

            return (
              <div key={it.product_id} className={`brnd-inv-card ${isOut ? 'is-out' : ''} ${isLow ? 'is-low' : ''}`}>
                <div className="brnd-inv-top">
                  <img
                    src={it.image_url || 'https://placehold.co/56x56/F3E8FF/7C3AED/png?text=?'}
                    alt=""
                    onError={(e) => { e.target.src = 'https://placehold.co/56x56/F3E8FF/7C3AED/png?text=?'; }}
                    className="brnd-inv-img"
                  />
                  <div className="brnd-inv-info">
                    <strong className="brnd-inv-name">{it.name}</strong>
                    <div className="brnd-inv-meta">
                      <span className="brnd-inv-price">{Number(it.price || 0).toLocaleString('fr-FR')} FCFA</span>
                      {status && <span className={`brnd-inv-status brnd-inv-status--${status.cls}`}>{status.label}</span>}
                      {isOut && <span className="brnd-inv-status brnd-inv-status--out">Rupture</span>}
                      {isLow && <span className="brnd-inv-status brnd-inv-status--low">Stock faible</span>}
                    </div>
                  </div>
                </div>

                <div className="brnd-inv-stock-row">
                  <div className="brnd-inv-counter">
                    <button
                      type="button"
                      className="brnd-inv-btn"
                      onClick={() => incStock(it.product_id, -1)}
                      disabled={stock === 0}
                      aria-label="Diminuer stock"
                    >
                      <Icon name="minus" width={18} height={18} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="brnd-inv-input"
                      value={stock}
                      onChange={e => setStock(it.product_id, e.target.value)}
                      min={0}
                    />
                    <button
                      type="button"
                      className="brnd-inv-btn"
                      onClick={() => incStock(it.product_id, +1)}
                      aria-label="Augmenter stock"
                    >
                      <Icon name="plus" width={18} height={18} />
                    </button>
                  </div>

                  <div className="brnd-inv-threshold">
                    <label className="brnd-inv-threshold-label">Seuil alerte</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="brnd-inv-threshold-input"
                      value={threshold}
                      onChange={e => setThreshold(it.product_id, e.target.value)}
                      min={0}
                      placeholder="0"
                    />
                  </div>

                  <button
                    type="button"
                    className="brnd-inv-save"
                    onClick={() => forceSaveNow(it.product_id)}
                    disabled={saving}
                  >
                    {saving ? '…' : (<><Icon name="check" width={14} height={14} /> Sauver</>)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="brnd-card" style={{ marginTop: 20, background: 'var(--brand-violet-softer)', borderColor: 'var(--brand-violet-soft)' }}>
        <div className="brnd-card-title">
          <Icon name="alert" width={16} height={16} />
          Astuce
        </div>
        <p style={{ fontSize: 13, color: 'var(--y-n-700)', margin: 0, lineHeight: 1.5 }}>
          Coche un seuil d'alerte (ex : 3) pour être notifié quand un produit passe en stock faible.
          Quand le stock arrive à 0, le produit devient automatiquement indisponible côté clientes.
        </p>
      </div>
    </div>
  );
}
