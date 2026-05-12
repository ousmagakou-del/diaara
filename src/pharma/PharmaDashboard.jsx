import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PharmaDashboard({ pharmacy, setSection }) {
  const [stats, setStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    todayCommission: 0,
    toShip: 0,
    pendingProducts: 0,
    totalStock: 0,
  });

  useEffect(() => {
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [ordersRes, productsRes, inventoryRes] = await Promise.all([
        supabase.from('orders').select('*').gte('created_at', today.toISOString()),
        supabase.from('products').select('id, status').eq('submitted_by_pharmacy_id', pharmacy.id),
        supabase.from('inventory').select('stock').eq('pharmacy_id', pharmacy.id),
      ]);

      const myOrders = (ordersRes.data || []).filter(o =>
        (o.items || []).some(it => it.pharmacyId === pharmacy.id)
      );
      const delivered = myOrders.filter(o => o.status === 'delivered');
      const rev = delivered.reduce((s, o) => {
        const myItems = (o.items || []).filter(it => it.pharmacyId === pharmacy.id);
        return s + myItems.reduce((sub, it) => sub + (it.price * it.qty), 0);
      }, 0);
      const rate = (pharmacy.commission || 17.5) / 100;
      const toShip = myOrders.filter(o => ['paid', 'preparing'].includes(o.status)).length;

      setStats({
        todayOrders: myOrders.length,
        todayRevenue: Math.round(rev * (1 - rate)),
        todayCommission: Math.round(rev * rate),
        toShip,
        pendingProducts: (productsRes.data || []).filter(p => p.status === 'pending').length,
        totalStock: (inventoryRes.data || []).reduce((s, i) => s + (i.stock || 0), 0),
      });
    })();
  }, [pharmacy.id]);

  return (
    <div className="ph-section">
      <header className="ph-header">
        <div>
          <h1>Salut {pharmacy.owner || pharmacy.name} 👋</h1>
          <p>Vue d'ensemble aujourd'hui · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </header>

      <div className="ph-kpi-grid">
        <button className="ph-kpi clickable" onClick={() => setSection('orders')}>
          <div className="ph-kpi-label">📦 Commandes aujourd'hui</div>
          <div className="ph-kpi-value">{stats.todayOrders}</div>
          <div className="ph-kpi-meta">{stats.toShip} à préparer</div>
        </button>
        <div className="ph-kpi">
          <div className="ph-kpi-label">💰 À recevoir aujourd'hui</div>
          <div className="ph-kpi-value" style={{ color: '#1F8B4C' }}>
            {stats.todayRevenue.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
          <div className="ph-kpi-meta">Après commission Diaara</div>
        </div>
        <div className="ph-kpi">
          <div className="ph-kpi-label">📊 Commission Diaara</div>
          <div className="ph-kpi-value" style={{ color: '#F4B53A' }}>
            {stats.todayCommission.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
          <div className="ph-kpi-meta">{pharmacy.commission || 17.5}% du CA</div>
        </div>
        <button className="ph-kpi clickable" onClick={() => setSection('inventory')}>
          <div className="ph-kpi-label">📋 Stock total</div>
          <div className="ph-kpi-value">{stats.totalStock}</div>
          <div className="ph-kpi-meta">unités au total</div>
        </button>
      </div>

      {stats.toShip > 0 && (
        <button className="ph-alert urgent" onClick={() => setSection('orders')}>
          <span>⏰</span>
          <div>
            <strong>{stats.toShip} commandes à préparer maintenant</strong>
            <span>Les clientes attendent leurs produits</span>
          </div>
          <span>→</span>
        </button>
      )}

      {stats.pendingProducts > 0 && (
        <button className="ph-alert" onClick={() => setSection('products')}>
          <span>⏳</span>
          <div>
            <strong>{stats.pendingProducts} produits en attente de validation</strong>
            <span>Diaara va les vérifier sous 24h</span>
          </div>
          <span>→</span>
        </button>
      )}

      <div className="ph-quick-actions">
        <button className="ph-action-card" onClick={() => setSection('orders')}>
          <div className="ph-action-icon">📦</div>
          <h3>Gérer mes commandes</h3>
          <p>Préparer · Marquer prête</p>
        </button>
        <button className="ph-action-card" onClick={() => setSection('inventory')}>
          <div className="ph-action-icon">📋</div>
          <h3>Mettre à jour stock</h3>
          <p>Cocher disponible · Quantité</p>
        </button>
        <button className="ph-action-card" onClick={() => setSection('products')}>
          <div className="ph-action-icon">✨</div>
          <h3>Ajouter un produit</h3>
          <p>Proposer un nouveau produit</p>
        </button>
        <button className="ph-action-card" onClick={() => setSection('commission')}>
          <div className="ph-action-icon">💰</div>
          <h3>Mes commissions</h3>
          <p>Voir mes paiements</p>
        </button>
      </div>
    </div>
  );
}
