import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getAdminToken } from '../lib/adminAuth';
import { adminListOrdersFull } from '../lib/adminApi';

export default function CommissionsSection() {
  const [orders, setOrders] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [brandRows, setBrandRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [oRes, pRes, bRes] = await Promise.all([
        adminListOrdersFull({ statuses: ['delivered'] }),
        supabase.from('pharmacies').select('id, name, commission'),
        supabase.rpc('admin_brand_commissions', { p_token: getAdminToken() }),
      ]);
      setOrders(oRes.data || []);
      setPharmacies(pRes.data || []);
      setBrandRows(Array.isArray(bRes.data) ? bRes.data : []);
      setLoading(false);
    })();
  }, []);

  // Agrège les commissions marques (toutes périodes confondues)
  const brandAgg = {};
  brandRows.forEach(r => {
    if (!brandAgg[r.brand_id]) brandAgg[r.brand_id] = { name: r.brand_name, revenue: 0, commission: 0, payout: 0, orders: 0 };
    brandAgg[r.brand_id].revenue += Number(r.revenue) || 0;
    brandAgg[r.brand_id].commission += Number(r.commission_yaram) || 0;
    brandAgg[r.brand_id].payout += Number(r.payout_brand) || 0;
    brandAgg[r.brand_id].orders += Number(r.orders_count) || 0;
  });
  const brandList = Object.values(brandAgg).sort((a, b) => b.revenue - a.revenue);
  const brandTotals = brandList.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue, commission: acc.commission + r.commission, payout: acc.payout + r.payout,
  }), { revenue: 0, commission: 0, payout: 0 });

  // Calcul par pharmacie
  const byPharmacy = {};
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      const phId = it.pharmacyId;
      if (!byPharmacy[phId]) byPharmacy[phId] = { name: it.pharmacyName, total: 0, articles: 0, orders: new Set() };
      const sub = it.qty * it.price;
      byPharmacy[phId].total += sub;
      byPharmacy[phId].articles += it.qty;
      byPharmacy[phId].orders.add(o.id);
    });
  });

  const rows = Object.entries(byPharmacy).map(([id, d]) => {
    const ph = pharmacies.find(p => p.id === id);
    const rate = (ph?.commission || 8) / 100;
    return {
      id, name: d.name, total: d.total, articles: d.articles,
      orders: d.orders.size,
      commission: Math.round(d.total * rate),
      payout: Math.round(d.total * (1 - rate)),
      rate: ph?.commission || 8,
    };
  }).sort((a, b) => b.total - a.total);

  const totals = rows.reduce((acc, r) => ({
    ca: acc.ca + r.total,
    commission: acc.commission + r.commission,
    payout: acc.payout + r.payout,
  }), { ca: 0, commission: 0, payout: 0 });

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Commissions</h1>
          <p>Suivi des paiements à reverser aux pharmacies</p>
        </div>
      </header>

      <div className="adm-kpi-grid">
        <div className="adm-kpi">
          <div className="adm-kpi-label">CA TOTAL MARKETPLACE</div>
          <div className="adm-kpi-value" style={{ color: '#1F8B4C' }}>
            {totals.ca.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">💰 COMMISSION YARAM</div>
          <div className="adm-kpi-value" style={{ color: '#166635' }}>
            {totals.commission.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">À REVERSER PHARMACIES</div>
          <div className="adm-kpi-value" style={{ color: '#F4B53A' }}>
            {totals.payout.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="adm-empty">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="adm-empty">
          <div style={{ fontSize: 48, opacity: 0.2 }}>💰</div>
          <p>Aucune commande livrée pour l'instant</p>
        </div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Pharmacie</th>
              <th>Commandes</th>
              <th>Articles</th>
              <th>CA</th>
              <th>Commission</th>
              <th>À reverser</th>
              <th>Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td><strong>🏥 {r.name}</strong></td>
                <td>{r.orders}</td>
                <td>{r.articles}</td>
                <td>{r.total.toLocaleString('fr-FR')} FCFA</td>
                <td style={{ color: '#1F8B4C' }}><strong>{r.commission.toLocaleString('fr-FR')} FCFA</strong></td>
                <td style={{ color: '#F4B53A' }}><strong>{r.payout.toLocaleString('fr-FR')} FCFA</strong></td>
                <td>{r.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─────────── COMMISSIONS MARQUES PARTENAIRES ─────────── */}
      <header className="adm-header" style={{ marginTop: 40 }}>
        <div>
          <h1>Commissions Marques</h1>
          <p>YARAM garde 5% · le reste est reversé à la marque partenaire</p>
        </div>
      </header>

      <div className="adm-kpi-grid">
        <div className="adm-kpi">
          <div className="adm-kpi-label">CA MARQUES</div>
          <div className="adm-kpi-value" style={{ color: '#1F8B4C' }}>
            {brandTotals.revenue.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">COMMISSION YARAM (5%)</div>
          <div className="adm-kpi-value" style={{ color: '#166635' }}>
            {brandTotals.commission.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">À REVERSER AUX MARQUES</div>
          <div className="adm-kpi-value" style={{ color: '#F4B53A' }}>
            {brandTotals.payout.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="adm-empty">Chargement…</div>
      ) : brandList.length === 0 ? (
        <div className="adm-empty">
          <p>Aucune commande marque livrée pour l'instant</p>
        </div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Marque</th>
              <th>Commandes</th>
              <th>CA</th>
              <th>Commission YARAM</th>
              <th>À reverser</th>
              <th>Taux</th>
            </tr>
          </thead>
          <tbody>
            {brandList.map((r, i) => (
              <tr key={i}>
                <td><strong>{r.name}</strong></td>
                <td>{r.orders}</td>
                <td>{r.revenue.toLocaleString('fr-FR')} FCFA</td>
                <td style={{ color: '#1F8B4C' }}><strong>{r.commission.toLocaleString('fr-FR')} FCFA</strong></td>
                <td style={{ color: '#F4B53A' }}><strong>{r.payout.toLocaleString('fr-FR')} FCFA</strong></td>
                <td>5%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
