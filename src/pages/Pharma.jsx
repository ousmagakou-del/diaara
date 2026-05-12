import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PharmaDashboard from '../pharma/PharmaDashboard';
import PharmaOrders from '../pharma/PharmaOrders';
import PharmaInventory from '../pharma/PharmaInventory';
import PharmaProducts from '../pharma/PharmaProducts';
import PharmaCommission from '../pharma/PharmaCommission';
import './Pharma.css';

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Aujourd\'hui' },
  { id: 'orders', icon: '📦', label: 'Commandes' },
  { id: 'inventory', icon: '📋', label: 'Mon stock' },
  { id: 'products', icon: '✨', label: 'Mes produits' },
  { id: 'commission', icon: '💰', label: 'Commission' },
];

export default function Pharma() {
  const [pharmacy, setPharmacy] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [section, setSection] = useState('dashboard');
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Reconnexion auto si pharmacie déjà loggée
      const saved = localStorage.getItem('diaara_pharma_id');
      if (saved) {
        const { data } = await supabase.from('pharmacies').select('*').eq('id', saved).single();
        if (data) setPharmacy(data);
      }
      const { data: list } = await supabase.from('pharmacies').select('id, name, pin').eq('active', true);
      setPharmacies(list || []);
      setLoading(false);
    })();
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const found = pharmacies.find(p => p.pin === pinInput);
    if (!found) {
      setPinError('PIN incorrect');
      setPinInput('');
      return;
    }
    setPharmacy(found);
    localStorage.setItem('diaara_pharma_id', found.id);
    setPinError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('diaara_pharma_id');
    setPharmacy(null);
    setPinInput('');
  };

  if (loading) {
    return (
      <div className="ph-login">
        <div className="ph-login-card">
          <div className="ph-login-logo">D</div>
          <p>Chargement…</p>
        </div>
      </div>
    );
  }

  if (!pharmacy) {
    return (
      <div className="ph-login">
        <div className="ph-login-card">
          <div className="ph-login-logo">🏥</div>
          <h1>Espace Pharmacie</h1>
          <p>Diaara · Connexion partenaire</p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              className={`ph-pin-input ${pinError ? 'error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(''); }}
              placeholder="PIN d'accès"
              autoFocus
              maxLength={6}
            />
            {pinError && <p className="ph-pin-error">{pinError}</p>}
            <button type="submit" className="ph-pin-btn">Se connecter →</button>
          </form>
          <a href="/" className="ph-back-link">← Retour à l'app Diaara</a>
        </div>
      </div>
    );
  }

  return (
    <div className="ph-shell">
      <header className="ph-topbar">
        <div className="ph-topbar-left">
          <div className="ph-topbar-logo">D</div>
          <div>
            <div className="ph-topbar-brand">{pharmacy.name}</div>
            <div className="ph-topbar-meta">📍 {pharmacy.neighborhood ? `${pharmacy.neighborhood}, ` : ''}{pharmacy.city}</div>
          </div>
        </div>
        <button className="ph-logout" onClick={handleLogout}>🔒 Déconnexion</button>
      </header>

      <nav className="ph-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={`ph-nav-item ${section === item.id ? 'active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            <span className="ph-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="ph-main">
        {section === 'dashboard' && <PharmaDashboard pharmacy={pharmacy} setSection={setSection} />}
        {section === 'orders' && <PharmaOrders pharmacy={pharmacy} />}
        {section === 'inventory' && <PharmaInventory pharmacy={pharmacy} />}
        {section === 'products' && <PharmaProducts pharmacy={pharmacy} />}
        {section === 'commission' && <PharmaCommission pharmacy={pharmacy} />}
      </main>
    </div>
  );
}
