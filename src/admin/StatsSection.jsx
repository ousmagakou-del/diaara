import { useState, useEffect } from 'react';
import { adminListOrders, adminUsersStats } from '../lib/adminApi';

export default function StatsSection() {
  const [period, setPeriod] = useState('30');
  const [stats, setStats] = useState({
    orders: [], topProducts: [], topPharmacies: [], conversionRate: 0,
  });

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      // Note : on charge jusqu'a 10k commandes pour la periode courante.
      // Si la boutique depasse 10k commandes/mois, il faudra une RPC dediee
      // qui aggrege cote serveur (admin_stats_period).
      const [ordersRes, statsRes] = await Promise.all([
        adminListOrders({ limit: 10000, offset: 0 }),
        adminUsersStats({ since: since.toISOString() }),
      ]);
      const sinceMs = since.getTime();
      const orders = (ordersRes.data || []).filter(o =>
        new Date(o.created_at).getTime() >= sinceMs
      );
      const newUsersCount = statsRes.data?.new_this_period || 0;
      const newUsers = { length: newUsersCount };

      // Top produits
      const productSales = {};
      orders.forEach(o => {
        (o.items || []).forEach(it => {
          if (!productSales[it.productId]) productSales[it.productId] = { name: it.name, qty: 0, revenue: 0 };
          productSales[it.productId].qty += it.qty;
          productSales[it.productId].revenue += it.qty * it.price;
        });
      });
      const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 10);

      // Top pharmacies
      const phSales = {};
      orders.forEach(o => {
        (o.items || []).forEach(it => {
          if (!phSales[it.pharmacyId]) phSales[it.pharmacyId] = { name: it.pharmacyName, qty: 0, revenue: 0 };
          phSales[it.pharmacyId].qty += it.qty;
          phSales[it.pharmacyId].revenue += it.qty * it.price;
        });
      });
      const topPharmacies = Object.values(phSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      const conversionRate = newUsers.length > 0
        ? Math.round((orders.length / newUsers.length) * 100)
        : 0;

      setStats({ orders, topProducts, topPharmacies, conversionRate, newUsers: newUsers.length });
    })();
  }, [period]);

  // Group orders by day for sparkline
  const ordersByDay = {};
  stats.orders.forEach(o => {
    const day = new Date(o.created_at).toISOString().slice(0, 10);
    ordersByDay[day] = (ordersByDay[day] || 0) + 1;
  });
  const days = Object.keys(ordersByDay).sort();
  const maxDay = Math.max(...Object.values(ordersByDay), 1);

  const totalRev = stats.orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Statistiques</h1>
          <p>Analyse de la performance · {stats.orders.length} commandes</p>
        </div>
        <div className="adm-filters" style={{ margin: 0 }}>
          {['7', '30', '90'].map(d => (
            <button key={d} className={`adm-filter ${period === d ? 'active' : ''}`} onClick={() => setPeriod(d)}>
              {d} jours
            </button>
          ))}
        </div>
      </header>

      <div className="adm-kpi-grid">
        <div className="adm-kpi">
          <div className="adm-kpi-label">CHIFFRE D'AFFAIRES</div>
          <div className="adm-kpi-value" style={{ color: '#1F8B4C' }}>
            {totalRev.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
          <div className="adm-kpi-meta">sur {period}j</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">COMMANDES</div>
          <div className="adm-kpi-value">{stats.orders.length}</div>
          <div className="adm-kpi-meta">{stats.orders.filter(o => o.status === 'delivered').length} livrées</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">NOUVELLES CLIENTES</div>
          <div className="adm-kpi-value">{stats.newUsers || 0}</div>
          <div className="adm-kpi-meta">inscriptions</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">TAUX CONVERSION</div>
          <div className="adm-kpi-value" style={{ color: '#1F8B4C' }}>{stats.conversionRate}<small>%</small></div>
          <div className="adm-kpi-meta">commandes / inscriptions</div>
        </div>
      </div>

      {days.length > 0 && (
        <div className="adm-recent-card">
          <h3>Commandes par jour</h3>
          <div className="adm-sparkline">
            {days.map(d => (
              <div key={d} className="adm-spark-bar-wrap" title={`${d}: ${ordersByDay[d]} commandes`}>
                <div className="adm-spark-bar" style={{ height: `${(ordersByDay[d] / maxDay) * 100}%` }} />
                <span className="adm-spark-day">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="adm-recent-card">
          <h3>🏆 Top produits</h3>
          {stats.topProducts.length === 0 ? (
            <div className="adm-empty" style={{ padding: 20 }}>Aucune vente</div>
          ) : (
            <table className="adm-table">
              <thead><tr><th>Produit</th><th>Qté</th><th>CA</th></tr></thead>
              <tbody>
                {stats.topProducts.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.qty}</td>
                    <td>{p.revenue.toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="adm-recent-card">
          <h3>🏥 Top pharmacies</h3>
          {stats.topPharmacies.length === 0 ? (
            <div className="adm-empty" style={{ padding: 20 }}>Aucune vente</div>
          ) : (
            <table className="adm-table">
              <thead><tr><th>Pharmacie</th><th>Articles</th><th>CA</th></tr></thead>
              <tbody>
                {stats.topPharmacies.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.qty}</td>
                    <td>{p.revenue.toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
