import { useState, useEffect } from 'react';
import { supabase, updateOrderStatus } from '../lib/supabase';

const STATUS_LABELS = {
  pending_payment: { label: 'Paiement', color: 'medium', emoji: '⏳' },
  paid: { label: 'Payée · À préparer', color: 'good', emoji: '✅' },
  preparing: { label: 'En préparation', color: 'good', emoji: '📦' },
  shipped: { label: 'Récupérée par livreur', color: 'excellent', emoji: '🛵' },
  delivered: { label: 'Livrée', color: 'excellent', emoji: '🎉' },
  cancelled: { label: 'Annulée', color: 'bad', emoji: '❌' },
};

export default function PharmaOrders({ pharmacy }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    const mine = (data || []).filter(o =>
      (o.items || []).some(it => it.pharmacyId === pharmacy.id)
    );
    setOrders(mine);
    setLoading(false);
  };

  const markPreparing = async (order) => {
    await updateOrderStatus(order.id, 'preparing');
    refresh();
  };

  const markReady = async (order) => {
    await updateOrderStatus(order.id, 'shipped');
    refresh();
  };

  const filtered = filter === 'active'
    ? orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
    : filter === 'delivered'
      ? orders.filter(o => o.status === 'delivered')
      : orders;

  return (
    <div className="ph-section">
      <header className="ph-header">
        <div>
          <h1>Mes commandes</h1>
          <p>{orders.length} commandes au total · {orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length} en cours</p>
        </div>
        <button className="ph-btn-sec" onClick={refresh}>🔄 Actualiser</button>
      </header>

      <div className="ph-filters">
        {[
          { id: 'active', label: 'En cours', count: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length },
          { id: 'delivered', label: '✅ Livrées', count: orders.filter(o => o.status === 'delivered').length },
          { id: 'all', label: 'Toutes', count: orders.length },
        ].map(f => (
          <button key={f.id} className={`ph-filter ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label} <span className="ph-filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ph-empty">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="ph-empty">
          <div style={{ fontSize: 48, opacity: 0.2 }}>📦</div>
          <p>Aucune commande</p>
        </div>
      ) : (
        <div className="ph-order-list">
          {filtered.map(o => {
            const myItems = (o.items || []).filter(it => it.pharmacyId === pharmacy.id);
            const myTotal = myItems.reduce((s, it) => s + (it.price * it.qty), 0);
            const s = STATUS_LABELS[o.status];
            const waUrl = o.address?.phone ? 'https://wa.me/' + o.address.phone.replace(/\D/g, '') : null;

            return (
              <div key={o.id} className="ph-order-card">
                <div className="ph-order-head">
                  <div>
                    <code>{o.id}</code>
                    <div className="ph-order-date">{new Date(o.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <span className={`ph-badge ${s?.color}`}>{s?.emoji} {s?.label}</span>
                </div>

                <div className="ph-order-body">
                  <p><strong>👤 {o.address?.name}</strong> · 📞 {o.address?.phone}</p>
                  <p style={{ fontSize: 12, color: '#6B6B6B' }}>📍 {o.address?.line}, {o.address?.neighborhood}, {o.address?.city}</p>

                  <div className="ph-order-items">
                    {myItems.map((it, i) => (
                      <div key={i} className="ph-order-item">
                        <img src={it.img} alt="" />
                        <div style={{ flex: 1 }}>
                          <strong>{it.name}</strong>
                          <div style={{ fontSize: 11, color: '#6B6B6B' }}>{it.brand}</div>
                        </div>
                        <div className="ph-order-qty">×{it.qty}</div>
                        <div className="ph-order-price">{(it.price * it.qty).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                    ))}
                  </div>

                  <div className="ph-order-total">
                    <span>Mon CA sur cette commande</span>
                    <strong>{myTotal.toLocaleString('fr-FR')} FCFA</strong>
                  </div>
                </div>

                <div className="ph-order-actions">
                  {waUrl && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="ph-wa-btn">
                      💬 Cliente
                    </a>
                  )}
                  {o.status === 'paid' && (
                    <button className="ph-btn-pri" onClick={() => markPreparing(o)}>
                      📦 Commencer prépa
                    </button>
                  )}
                  {o.status === 'preparing' && (
                    <button className="ph-btn-pri" onClick={() => markReady(o)}>
                      ✅ Prêt pour livreur
                    </button>
                  )}
                  {o.status === 'shipped' && (
                    <span style={{ fontSize: 12, color: '#1F8B4C', fontWeight: 700 }}>🛵 Récupérée par Diaara</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
