import { useState, useEffect } from 'react';
import { supabase, pharmacyLogin, setPharmacyPin } from '../lib/supabase';
import PharmaDashboard from '../pharma/PharmaDashboard';
import PharmaOrders from '../pharma/PharmaOrders';
import PharmaInventory from '../pharma/PharmaInventory';
import PharmaCommission from '../pharma/PharmaCommission';
import './Pharma.css';

const ADMIN_WHATSAPP = '221777608983';

export default function Pharma() {
  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // États création PIN
  const [mode, setMode] = useState('login'); // 'login' | 'setup' | 'forgot'
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const selected = pharmacies.find(p => p.id === selectedId);
  const hasPin = !!selected?.pin;

  useEffect(() => {
    const saved = sessionStorage.getItem('diaara-pharma');
    if (saved) {
      try {
        const ph = JSON.parse(saved);
        setPharmacy(ph);
        return;
      } catch (e) {}
    }
    (async () => {
      const { data } = await supabase
        .from('pharmacies')
        .select('id, name, neighborhood, city, pin')
        .eq('active', true)
        .order('name');
      setPharmacies(data || []);
    })();
  }, []);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLogin = async () => {
    resetMessages();
    if (!selectedId) return setError('Choisis ta pharmacie');
    
    // Pharmacie sans PIN → automatiquement passer en mode setup
    if (!hasPin) {
      setMode('setup');
      return;
    }
    
    if (!pin || pin.length !== 4) return setError('Le PIN doit faire 4 chiffres');
    
    const result = await pharmacyLogin(selectedId, pin);
    if (!result.success) {
      setError(result.error || 'PIN incorrect');
      return;
    }
    sessionStorage.setItem('diaara-pharma', JSON.stringify(result.pharmacy));
    setPharmacy(result.pharmacy);
  };

  const handleSetupPin = async () => {
    resetMessages();
    
    // Validations
    if (!newPin) return setError('Choisis un PIN');
    if (newPin.length !== 4) return setError('Le PIN doit faire exactement 4 chiffres');
    if (!/^\d{4}$/.test(newPin)) return setError('Le PIN doit contenir uniquement des chiffres');
    
    // PIN trop simples
    if (newPin === '0000' || newPin === '1111' || newPin === '2222' || newPin === '3333' ||
        newPin === '4444' || newPin === '5555' || newPin === '6666' || newPin === '7777' ||
        newPin === '8888' || newPin === '9999') {
      return setError('Choisis un PIN moins évident (ex: 4827 plutôt que 1111)');
    }
    if (newPin === '1234' || newPin === '0123' || newPin === '4321') {
      return setError('Évite les PIN trop classiques comme 1234');
    }
    
    if (!confirmPin) return setError('Confirme ton PIN');
    if (newPin !== confirmPin) return setError('Les deux PIN ne correspondent pas');
    
    // Setup
    await setPharmacyPin(selectedId, newPin);
    const result = await pharmacyLogin(selectedId, newPin);
    if (result.success) {
      sessionStorage.setItem('diaara-pharma', JSON.stringify(result.pharmacy));
      setPharmacy(result.pharmacy);
      setMode('login');
      setNewPin('');
      setConfirmPin('');
    } else {
      setError('Erreur lors de la création du PIN');
    }
  };

  const handleForgot = () => {
    const ph = selected;
    const msg = `Bonjour Ousmane 👋

Je suis ${ph?.name || 'une pharmacie partenaire Diaara'}${ph?.city ? ` à ${ph.city}` : ''}.

J'ai oublié mon PIN d'accès au dashboard pharmacie.

Peux-tu me le réinitialiser SVP ?

Merci 💚`;
    
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('diaara-pharma');
    setPharmacy(null);
    setPin('');
    setSelectedId('');
    setMode('login');
    resetMessages();
  };

  // ═══ MODE FORGOT ═══
  if (!pharmacy && mode === 'forgot') {
    return (
      <div className="pharma-login">
        <div className="pharma-login-card">
          <div className="pharma-login-logo">D</div>
          <h1 style={{ marginBottom: 8 }}>PIN oublié ?</h1>
          <p style={{ color: '#6B6B6B', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
            Pas de souci ! Contacte Ousmane sur WhatsApp et il te réinitialise ton PIN en 2 minutes.
          </p>

          {selected && (
            <div style={{
              background: '#E8F5EC',
              borderRadius: 10,
              padding: 12,
              fontSize: 13,
              marginBottom: 16,
            }}>
              <strong>{selected.name}</strong>
              <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>
                {selected.neighborhood ? `${selected.neighborhood}, ` : ''}{selected.city}
              </div>
            </div>
          )}

          <button onClick={handleForgot} style={{ background: '#25D366' }}>
            💬 Contacter Ousmane sur WhatsApp
          </button>
          
          <button 
            onClick={() => { setMode('login'); resetMessages(); }} 
            style={{ background: '#F4F4F2', color: '#1A1A1A', marginTop: 8 }}
          >
            ← Retour au login
          </button>
        </div>
      </div>
    );
  }

  // ═══ MODE SETUP (1ère connexion) ═══
  if (!pharmacy && mode === 'setup') {
    return (
      <div className="pharma-login">
        <div className="pharma-login-card">
          <div style={{
            background: '#FEF6E5',
            color: '#A07700',
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            textAlign: 'center',
            margin: '0 auto 12px',
            display: 'inline-block',
            letterSpacing: '0.05em',
          }}>
            🎉 PREMIÈRE CONNEXION
          </div>
          
          <div className="pharma-login-logo">D</div>
          
          <h1 style={{ marginBottom: 4 }}>Bienvenue !</h1>
          
          {selected && (
            <p style={{ textAlign: 'center', color: '#1F8B4C', fontWeight: 700, marginBottom: 8 }}>
              {selected.name}
            </p>
          )}
          
          <p style={{ color: '#6B6B6B', fontSize: 13, marginBottom: 20, lineHeight: 1.5, textAlign: 'center' }}>
            Crée ton code PIN à 4 chiffres pour sécuriser ton dashboard.
            <br />
            <strong style={{ color: '#1A1A1A' }}>Ne le partage avec personne.</strong>
          </p>

          <label>Choisis ton PIN (4 chiffres)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength="4"
            value={newPin}
            onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); resetMessages(); }}
            placeholder="••••"
            autoFocus
          />
          <p style={{ fontSize: 11, color: '#6B6B6B', marginTop: 4 }}>
            💡 Évite les PIN évidents comme 1234, 0000, 1111, etc.
          </p>

          <label>Confirme ton PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength="4"
            value={confirmPin}
            onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); resetMessages(); }}
            placeholder="••••"
            onKeyDown={e => e.key === 'Enter' && handleSetupPin()}
          />

          {error && <div className="pharma-error">⚠️ {error}</div>}

          <button onClick={handleSetupPin}>✅ Créer mon PIN</button>
          
          <button 
            onClick={() => { setMode('login'); resetMessages(); setNewPin(''); setConfirmPin(''); }} 
            style={{ background: '#F4F4F2', color: '#1A1A1A', marginTop: 8 }}
          >
            ← Annuler
          </button>
        </div>
      </div>
    );
  }

  // ═══ MODE LOGIN (par défaut) ═══
  if (!pharmacy) {
    return (
      <div className="pharma-login">
        <div className="pharma-login-card">
          <div className="pharma-login-logo">D</div>
          <h1>Dashboard Pharmacie</h1>
          <p style={{ color: '#6B6B6B', marginBottom: 20, textAlign: 'center', fontSize: 13 }}>
            Diaara · Espace partenaire
          </p>

          <label>Ta pharmacie</label>
          <select 
            value={selectedId} 
            onChange={e => { setSelectedId(e.target.value); resetMessages(); }}
          >
            <option value="">— Choisis ta pharmacie —</option>
            {pharmacies.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.neighborhood || p.city}
              </option>
            ))}
          </select>

          {/* Badge info selon état */}
          {selected && !hasPin && (
            <div style={{
              background: '#FEF6E5',
              color: '#A07700',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 12,
              marginTop: 12,
              fontWeight: 600,
            }}>
              🎉 Première connexion pour cette pharmacie — clique "Continuer" pour créer ton PIN
            </div>
          )}

          {selected && hasPin && (
            <>
              <label>Ton code PIN (4 chiffres)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength="4"
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); resetMessages(); }}
                placeholder="••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </>
          )}

          {error && <div className="pharma-error">⚠️ {error}</div>}
          {success && <div style={{ background: '#E8F5EC', color: '#1F8B4C', padding: 10, borderRadius: 8, fontSize: 13, marginTop: 12 }}>{success}</div>}

          <button onClick={handleLogin}>
            {selected && !hasPin ? 'Continuer →' : 'Se connecter'}
          </button>

          {selected && hasPin && (
            <button 
              onClick={() => { setMode('forgot'); resetMessages(); }}
              style={{ background: 'transparent', color: '#1F8B4C', marginTop: 8, fontSize: 13, textDecoration: 'underline' }}
            >
              🔑 PIN oublié ?
            </button>
          )}

          <p className="pharma-help">
            Besoin d'aide ? <a href={`https://wa.me/${ADMIN_WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1F8B4C', fontWeight: 700 }}>WhatsApp Ousmane</a>
          </p>
        </div>
      </div>
    );
  }

  // ═══ DASHBOARD ═══
  return (
    <div className="pharma-shell">
      <header className="pharma-header">
        <div>
          <strong>{pharmacy.name}</strong>
          <span>{pharmacy.neighborhood ? `${pharmacy.neighborhood}, ` : ''}{pharmacy.city}</span>
        </div>
        <button onClick={handleLogout} className="pharma-logout">Déconnexion</button>
      </header>

      <main className="pharma-main">
        {tab === 'dashboard' && <PharmaDashboard pharmacy={pharmacy} onNavigate={setTab} />}
        {tab === 'orders' && <PharmaOrders pharmacy={pharmacy} />}
        {tab === 'inventory' && <PharmaInventory pharmacy={pharmacy} />}
        {tab === 'commissions' && <PharmaCommission pharmacy={pharmacy} />}
      </main>

      <nav className="pharma-tabs">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
          🏠<span>Accueil</span>
        </button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          📦<span>Commandes</span>
        </button>
        <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>
          📚<span>Stock</span>
        </button>
        <button className={tab === 'commissions' ? 'active' : ''} onClick={() => setTab('commissions')}>
          💰<span>Revenus</span>
        </button>
      </nav>
    </div>
  );
}
