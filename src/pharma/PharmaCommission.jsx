import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PharmaCommission({ pharmacy }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });
      const mine = (data || []).filter(o =>
        (o.items || []).some(it => it.pharmacyId === pharmacy.id)
      );
      setOrders(mine);
      setLoading(false);
    })();
  }, [pharmacy.id]);

  const rate = (pharmacy.commission || 17.5) / 100;
  const now = new Date();
  let filtered = orders;
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    filtered = orders.filter(o => new Date(o.created_at) > weekAgo);
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    filtered = orders.filter(o => new Date(o.created_at) > monthAgo);
  }

  const totals = filtered.reduce((acc, o) => {
    const myItems = (o.items || []).filter(it => it.pharmacyId === pharmacy.id);
    const sub = myItems.reduce((s, it) => s + (it.price * it.qty), 0);
    return {
      ca: acc.ca + sub,
      commission: acc.commission + Math.round(sub * rate),
      payout: acc.payout + Math.round(sub * (1 - rate)),
      orders: acc.orders + 1,
    };
  }, { ca: 0, commission: 0, payout: 0, orders: 0 });

  return (
    <div className="ph-section">
      <header className="ph-header">
        <div>
          <h1>Ma commission</h1>
          <p>Suivi des paiements Diaara à recevoir</p>
        </div>
        <div className="ph-filters" style={{ margin: 0 }}>
          {['week', 'month', 'all'].map(p => (
            <button key={p} className={`ph-filter ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 'week' ? '7 jours' : p === 'month' ? '30 jours' : 'Tout'}
            </button>
          ))}
        </div>
      </header>

      <div className="ph-kpi-grid">
        <div className="ph-kpi">
          <div className="ph-kpi-label">💰 À RECEVOIR</div>
          <div className="ph-kpi-value" style={{ color: '#1F8B4C' }}>
            {totals.payout.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
          <div className="ph-kpi-meta">Net après commission Diaara</div>
        </div>
        <div className="ph-kpi">
          <div className="ph-kpi-label">CA TOTAL</div>
          <div className="ph-kpi-value">
            {totals.ca.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
          <div className="ph-kpi-meta">Brut · {totals.orders} commandes livrées</div>
        </div>
        <div className="ph-kpi">
          <div className="ph-kpi-label">Commission Diaara</div>
          <div className="ph-kpi-value" style={{ color: '#F4B53A' }}>
            {totals.commission.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
          <div className="ph-kpi-meta">{pharmacy.commission || 17.5}% du CA</div>
        </div>
      </div>

      <div className="ph-info-banner">
        ℹ️ Les paiements sont effectués chaque vendredi pour les commandes livrées de la semaine. Tu seras notifié(e) par WhatsApp.
      </div>

      {loading ? (
        <div className="ph-empty">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="ph-empty">
          <div style={{ fontSize: 48, opacity: 0.2 }}>💰</div>
          <p>Aucune vente sur cette période</p>
        </div>
      ) : (
        <table className="ph-table">
          <thead>
            <tr>
              <th>Commande</th>
              <th>Date</th>
              <th>CA</th>
              <th>Commission</th>
              <th>À recevoir</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const myItems = (o.items || []).filter(it => it.pharmacyId === pharmacy.id);
              const sub = myItems.reduce((s, it) => s + (it.price * it.qty), 0);
              return (
                <tr key={o.id}>
                  <td><code>{o.id}</code></td>
                  <td>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{sub.toLocaleString('fr-FR')} FCFA</td>
                  <td style={{ color: '#F4B53A' }}>-{Math.round(sub * rate).toLocaleString('fr-FR')} FCFA</td>
                  <td><strong style={{ color: '#1F8B4C' }}>{Math.round(sub * (1 - rate)).toLocaleString('fr-FR')} FCFA</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
