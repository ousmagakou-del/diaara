import { useState, useEffect } from 'react';
import { supabase, updateOrderStatus, subscribeToNewOrders } from '../lib/supabase';
import DashboardSection from '../admin/DashboardSection';
import OrdersSection from '../admin/OrdersSection';
import PharmaciesSection from '../admin/PharmaciesSection';
import ProductsSection from '../admin/ProductsSection';
import BrandsSection from '../admin/BrandsSection';
import StatsSection from '../admin/StatsSection';
import PromosSection from '../admin/PromosSection';
import MarketingSection from '../admin/MarketingSection';
import ReviewsSection from '../admin/ReviewsSection';
import UsersSection from '../admin/UsersSection';
import DeliveriesSection from '../admin/DeliveriesSection';
import StaffSection from '../admin/StaffSection';
import HistorySection from '../admin/HistorySection';
import SettingsSection from '../admin/SettingsSection';
import ProductsValidationSection from '../admin/ProductsValidationSection';
import CommissionsSection from '../admin/CommissionsSection';
import BannersSection from '../admin/BannersSection';
import './Admin.css';

const ADMIN_PIN = '1234';

const NAV = [
  { id: 'dashboard', icon: '📊', label: "Vue d'ensemble" },
  { id: 'orders', icon: '📦', label: 'Commandes', badge: true },
  { id: 'stats', icon: '📈', label: 'Statistiques' },
  { id: 'pharmacies', icon: '🏥', label: 'Pharmacies' },
  { id: 'commissions', icon: '💰', label: 'Commissions' },
  { id: 'products', icon: '🛍️', label: 'Produits' },
  { id: 'validation', icon: '✨', label: 'Validation produits', badge: true },
  { id: 'brands', icon: '🏷️', label: 'Marques' },
  { id: 'banners', icon: '🎨', label: 'Bannières' },
  { id: 'promos', icon: '🎁', label: 'Codes promo' },
  { id: 'marketing', icon: '📣', label: 'Marketing' },
  { id: 'reviews', icon: '⭐', label: 'Modération avis' },
  { id: 'users', icon: '👥', label: 'Utilisatrices' },
  { id: 'deliveries', icon: '🛵', label: 'Livraisons' },
  { id: 'staff', icon: '👷', label: 'Équipe' },
  { id: 'history', icon: '📜', label: 'Historique' },
  { id: 'settings', icon: '⚙️', label: 'Paramètres' },
];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [section, setSection] = useState('dashboard');
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  useEffect(() => {
    if (!authed) return;
    const sub = subscribeToNewOrders(() => setNewOrdersCount(c => c + 1));
    return () => sub?.unsubscribe?.();
  }, [authed]);

  useEffect(() => {
    if (section === 'orders') setNewOrdersCount(0);
  }, [section]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  if (!authed) {
    return (
      <div className="adm-login">
        <div className="adm-login-card">
          <div className="adm-login-logo">D</div>
          <h1>Admin Diaara</h1>
          <p>Saisis ton code PIN d'accès</p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              className={`adm-pin-input ${pinError ? 'error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false); }}
              placeholder="••••"
              autoFocus
              maxLength={6}
            />
            {pinError && <p className="adm-pin-error">PIN incorrect</p>}
            <button type="submit" className="adm-pin-btn">Se connecter →</button>
          </form>
          <a href="/" className="adm-back-link">← Retour à l'app cliente</a>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="adm-side-head">
          <div className="adm-side-logo">D</div>
          <div>
            <div className="adm-side-brand">Diaara</div>
            <div className="adm-side-role">Business Console</div>
          </div>
        </div>
        <nav className="adm-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`adm-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="adm-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && newOrdersCount > 0 && (
                <span className="adm-nav-badge">{newOrdersCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="adm-side-foot">
          <a href="/" className="adm-app-link">👁️ Voir l'app cliente</a>
          <button className="adm-logout-btn" onClick={() => setAuthed(false)}>🔒 Verrouiller</button>
        </div>
      </aside>

      <main className="adm-main">
        {section === 'dashboard' && <DashboardSection setSection={setSection} />}
        {section === 'orders' && <OrdersSection />}
        {section === 'stats' && <StatsSection />}
        {section === 'pharmacies' && <PharmaciesSection />}
        {section === 'commissions' && <CommissionsSection />}
        {section === 'products' && <ProductsSection />}
        {section === 'validation' && <ProductsValidationSection />}
        {section === 'brands' && <BrandsSection />}
        {section === 'banners' && <BannersSection />}
        {section === 'promos' && <PromosSection />}
        {section === 'marketing' && <MarketingSection />}
        {section === 'reviews' && <ReviewsSection />}
        {section === 'users' && <UsersSection />}
        {section === 'deliveries' && <DeliveriesSection />}
        {section === 'staff' && <StaffSection />}
        {section === 'history' && <HistorySection />}
        {section === 'settings' && <SettingsSection />}
      </main>
    </div>
  );
}