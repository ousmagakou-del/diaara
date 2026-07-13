import { useState, useEffect } from 'react';
import { supabase, pharmacyLogin, getAllPharmacies, invalidateCache } from '../lib/supabase';
import PharmaDashboard from '../pharma/PharmaDashboard';
import PharmaOrders from '../pharma/PharmaOrders';
import PharmaProducts from '../pharma/PharmaProducts';
import PharmaInventory from '../pharma/PharmaInventory';
import PharmaCommission from '../pharma/PharmaCommission';
import PharmaSettings from '../pharma/PharmaSettings';
import PharmaBrands from '../pharma/PharmaBrands';
import { useOrderAlerts } from '../lib/useOrderAlerts';
import './Pharma.css';

import { getWhatsAppNumber } from '../lib/utils';

// Securite : on ne persiste JAMAIS le PIN ni pin_set_at dans le localStorage
// (n'importe quelle extension ou script tiers peut lire localStorage).
function sanitizeForStorage(pharmacy) {
  if (!pharmacy) return pharmacy;
  // eslint-disable-next-line no-unused-vars
  const { pin, pin_set_at, ...safe } = pharmacy;
  return safe;
}

// SVG icons pour la nav pharma (aucun emoji)
const NavIcon = ({ id }) => {
  const props = {
    width: 18, height: 18, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (id) {
    case 'dashboard':
      return (<svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
    case 'orders':
      return (<svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
    case 'products':
      return (<svg {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>);
    case 'inventory':
      return (<svg {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>);
    case 'brands':
      return (<svg {...props}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>);
    case 'commission':
      return (<svg {...props}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
    case 'settings':
      return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
    default:
      return null;
  }
};

const NAV = [
  { id: 'dashboard',  label: "Vue d'ensemble" },
  { id: 'orders',     label: 'Commandes', badge: true },
  { id: 'products',   label: 'Mes produits' },
  { id: 'inventory',  label: 'Inventaire' },
  { id: 'brands',     label: 'Marques' },
  { id: 'commission', label: 'Mes commissions' },
  { id: 'settings',   label: 'Paramètres' },
];

const BANNED_PINS = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','0123','9876'];

export default function Pharma() {
  const [phase, setPhase] = useState('selectPharmacy'); // selectPharmacy, setPin, login, forgot, dashboard
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [section, setSection] = useState('dashboard');
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  // Notifications temps réel : son ding + notif navigateur + WhatsApp via trigger
  const {
    pendingCount,
    muted,
    setMuted,
    notifPermission,
    requestNotificationPermission,
    testDing,
  } = useOrderAlerts(selectedPharmacy?.id);

  useEffect(() => {
    (async () => {
      const data = await getAllPharmacies();
      setPharmacies(data);
    })();
  }, []);

  // Restaurer la session si déjà connectée
  useEffect(() => {
    const saved = localStorage.getItem('yaram-pharma-session');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        setSelectedPharmacy(session);
        setPhase('dashboard');
      } catch (e) { /* ignore */ }
    }
  }, []);

  const handleSelectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    // On utilise pin_set_at (timestamp non sensible) au lieu de pin (la valeur).
    // pharmacy.pin n'est plus expose par getAllPharmacies pour des raisons de securite.
    if (!pharmacy.pin_set_at) {
      setPhase('setPin');
    } else {
      setPhase('login');
    }
    setPinInput('');
    setConfirmPin('');
    setPinError('');
  };

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    if (!pinInput || pinInput.length < 4) {
      setPinError('PIN à 4 chiffres minimum');
      return;
    }
    const result = await pharmacyLogin(selectedPharmacy.id, pinInput);
    if (result.success) {
      setSelectedPharmacy(result.pharmacy);
      localStorage.setItem('yaram-pharma-session', JSON.stringify(sanitizeForStorage(result.pharmacy)));
      setPhase('dashboard');
      setPinError('');
    } else {
      setPinError(result.error || 'PIN incorrect');
      setPinInput('');
    }
  };

  const handleSetPin = async (e) => {
    e?.preventDefault?.();
    if (!pinInput || pinInput.length !== 6 || !/^\d{6}$/.test(pinInput)) {
      setPinError('PIN doit être exactement 6 chiffres');
      return;
    }
    if (BANNED_PINS.includes(pinInput)) {
      setPinError('PIN trop évident, choisis-en un autre');
      return;
    }
    if (pinInput !== confirmPin) {
      setPinError('Les deux PIN ne correspondent pas');
      return;
    }

    // RPC pharma_set_initial_pin (SECURITY DEFINER): l UPDATE direct sur
    // pharmacies etait refuse (aucune policy UPDATE). La RPC verifie que
    // pin IS NULL avant de setter (protection contre reset non-autorise).
    const { data: rpcRes, error } = await supabase.rpc('pharma_set_initial_pin', {
      p_pharmacy_id: selectedPharmacy.id,
      p_new_pin: pinInput,
    });
    if (error) { setPinError('Erreur : ' + error.message); return; }
    if (rpcRes && rpcRes.success === false) {
      setPinError('Erreur : ' + (rpcRes.error || 'inconnue'));
      return;
    }
    const nowIso = new Date().toISOString();

    // Important : pin_set_at est aussi mis a jour localement et le cache est invalide,
    // sinon une deconnexion / reconnexion dans les 10 min suivantes renverrait sur "setPin".
    const updated = { ...selectedPharmacy, pin: pinInput, pin_set_at: nowIso };
    setSelectedPharmacy(updated);
    localStorage.setItem('yaram-pharma-session', JSON.stringify(sanitizeForStorage(updated)));
    invalidateCache('all_pharmacies');
    setPhase('dashboard');
    setPinError('');
    setPinInput('');
    setConfirmPin('');
  };

  const openForgotWhatsApp = () => {
    const ph = selectedPharmacy;
    const msg = `Bonjour Ousmane,\n\nJe suis ${ph?.name || 'une pharmacie partenaire YARAM'}${ph?.city ? ` à ${ph.city}` : ''}.\n\nJ'ai oublié mon PIN d'accès au dashboard pharmacie. Peux-tu me le réinitialiser SVP ?\n\nMerci.`;
    window.open(`https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const logout = () => {
    localStorage.removeItem('yaram-pharma-session');
    setSelectedPharmacy(null);
    setPhase('selectPharmacy');
    setPinInput('');
    setConfirmPin('');
  };

  // Callback pour PharmaSettings : remet à jour la pharmacie courante
  const handlePharmacyUpdate = (updated) => {
    setSelectedPharmacy(updated);
    localStorage.setItem('yaram-pharma-session', JSON.stringify(sanitizeForStorage(updated)));
  };

  // === RENDER LOGIN PHASES ===

  if (phase === 'selectPharmacy') {
    return (
      <div className="phar-login">
        <div className="phar-login-card phar-login-wide">
          <div className="phar-login-logo">D</div>
          <h1>Dashboard Pharmacie</h1>
          <p>Sélectionne ta pharmacie</p>

          <div className="phar-pharmacy-list">
            {pharmacies.map(p => (
              <button
                key={p.id}
                className="phar-pharmacy-item"
                onClick={() => handleSelectPharmacy(p)}
              >
                <div className="phar-pharmacy-logo">
                  {p.logo || p.logo_url ? (
                    <img src={p.logo || p.logo_url} alt="" loading="lazy" decoding="async" onError={(e) => e.target.style.display = 'none'} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="10" y1="10" x2="14" y2="10"/>
                    </svg>
                  )}
                </div>
                <div className="phar-pharmacy-info">
                  <strong>{p.name}</strong>
                  <span>{p.city || p.neighborhood} · {p.phone}</span>
                </div>
                <span className="phar-pharmacy-arrow" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              </button>
            ))}
          </div>

          <a href="/" className="phar-back-link">Retour à l'app cliente</a>
        </div>
      </div>
    );
  }

  if (phase === 'setPin') {
    const pharmaLogo = selectedPharmacy?.logo || selectedPharmacy?.logo_url;
    return (
      <div className="phar-login">
        <div className="phar-login-card">
          <div className="phar-login-logo phar-login-logo-img">
            {pharmaLogo
              ? <img src={pharmaLogo} alt={selectedPharmacy.name} onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (selectedPharmacy.name?.charAt(0) || 'D').toUpperCase(); }} />
              : (selectedPharmacy?.name?.charAt(0) || 'D').toUpperCase()}
          </div>
          <h1>{selectedPharmacy.name}</h1>
          <p>Première connexion — Crée ton code PIN à 6 chiffres</p>
          <form onSubmit={handleSetPin}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`phar-pin-input ${pinError ? 'error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="••••"
              autoFocus
              maxLength={6}
            />
            <p style={{ fontSize: 'var(--y-fs-xs)', color: 'var(--y-n-600)', marginTop: -2, marginBottom: 10 }}>
              Astuce : évite 1234, 0000, 1111 et autres PIN évidents.
            </p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`phar-pin-input ${pinError ? 'error' : ''}`}
              value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="Confirme ton PIN"
              maxLength={6}
            />
            {pinError && <p className="phar-pin-error">{pinError}</p>}
            <p style={{ fontSize: 'var(--y-fs-xs)', color: 'var(--y-n-600)', marginBottom: 12 }}>
              Garde ce PIN en sécurité, tu en auras besoin à chaque connexion.
            </p>
            <button type="submit" className="phar-pin-btn">Créer mon PIN</button>
          </form>
          <button className="phar-back-link" onClick={() => setPhase('selectPharmacy')}>Choisir une autre pharmacie</button>
        </div>
      </div>
    );
  }

  if (phase === 'forgot') {
    const pharmaLogo = selectedPharmacy?.logo || selectedPharmacy?.logo_url;
    return (
      <div className="phar-login">
        <div className="phar-login-card">
          <div className="phar-login-logo phar-login-logo-img">
            {pharmaLogo
              ? <img src={pharmaLogo} alt={selectedPharmacy?.name || ''} onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (selectedPharmacy?.name?.charAt(0) || 'D').toUpperCase(); }} />
              : (selectedPharmacy?.name?.charAt(0) || 'D').toUpperCase()}
          </div>
          <h1>PIN oublié ?</h1>
          <p>Pas de souci ! Contacte Ousmane et il te réinitialise ton PIN.</p>

          {selectedPharmacy && (
            <div className="phar-forgot-target">
              <strong>{selectedPharmacy.name}</strong>
              <span>{selectedPharmacy.neighborhood ? `${selectedPharmacy.neighborhood}, ` : ''}{selectedPharmacy.city}</span>
            </div>
          )}

          <button onClick={openForgotWhatsApp} className="phar-pin-btn phar-pin-btn-wa">
            Contacter Ousmane sur WhatsApp
          </button>
          <button className="phar-back-link" onClick={() => { setPhase('login'); setPinError(''); }}>Retour à la connexion</button>
        </div>
      </div>
    );
  }

  if (phase === 'login') {
    const pharmaLogo = selectedPharmacy?.logo || selectedPharmacy?.logo_url;
    return (
      <div className="phar-login">
        <div className="phar-login-card">
          <div className="phar-login-logo phar-login-logo-img">
            {pharmaLogo
              ? <img src={pharmaLogo} alt={selectedPharmacy.name} onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (selectedPharmacy.name?.charAt(0) || 'D').toUpperCase(); }} />
              : (selectedPharmacy.name?.charAt(0) || 'D').toUpperCase()}
          </div>
          <h1>{selectedPharmacy.name}</h1>
          <p>Saisis ton code PIN</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`phar-pin-input ${pinError ? 'error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="••••"
              autoFocus
              maxLength={6}
            />
            {pinError && <p className="phar-pin-error">{pinError}</p>}
            <button type="submit" className="phar-pin-btn">Se connecter</button>
          </form>
          <button className="phar-back-link" onClick={() => setPhase('forgot')}>PIN oublié ?</button>
          <button className="phar-back-link" onClick={() => setPhase('selectPharmacy')}>Choisir une autre pharmacie</button>
        </div>
      </div>
    );
  }

  // === DASHBOARD ===
  return (
    <div className="phar-shell">
      <aside className="phar-side">
        <div className="phar-side-head">
          <div className="phar-side-logo phar-side-logo-img">
            {(selectedPharmacy.logo || selectedPharmacy.logo_url) ? (
              <img
                src={selectedPharmacy.logo || selectedPharmacy.logo_url}
                alt={selectedPharmacy.name}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.textContent = (selectedPharmacy.name?.charAt(0) || 'D').toUpperCase();
                }}
              />
            ) : (
              (selectedPharmacy.name?.charAt(0) || 'D').toUpperCase()
            )}
          </div>
          <div>
            <div className="phar-side-brand">{selectedPharmacy.name}</div>
            <div className="phar-side-role">Pharmacie partenaire</div>
          </div>
        </div>
        <nav className="phar-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`phar-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="phar-nav-icon"><NavIcon id={item.id} /></span>
              <span>{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span className="phar-nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="phar-side-foot">
          <button
            className="phar-mute-btn phar-mute-primary"
            onClick={() => setMuted(!muted)}
            title={muted ? 'Réactiver les sons' : 'Couper les sons'}
            aria-label={muted ? 'Réactiver les sons' : 'Couper les sons'}
          >
            <span className="phar-mute-label">{muted ? 'Sons coupés' : 'Sons activés'}</span>
          </button>

          {notifPermission !== 'granted' && notifPermission !== 'denied' && (
            <button
              className="phar-mute-btn phar-mute-warning"
              onClick={requestNotificationPermission}
              title="Active les notifications du navigateur"
            >
              <span className="phar-mute-label">Activer les notifs</span>
            </button>
          )}

          <button className="phar-mute-btn phar-mute-test" onClick={testDing}>
            <span className="phar-mute-label">Tester le son</span>
          </button>

          <a href="/" className="phar-app-link">Voir l'app cliente</a>
          <button className="phar-logout-btn" onClick={logout}>Déconnecter</button>
        </div>
      </aside>

      <main className="phar-main">
        {section === 'dashboard' && (
          <PharmaDashboard
            pharmacy={selectedPharmacy}
            setSection={setSection}
            onPendingChange={setNewOrdersCount}
          />
        )}
        {section === 'orders' && (
          <PharmaOrders
            pharmacyId={selectedPharmacy.id}
            pharmacyName={selectedPharmacy.name}
            onPendingChange={setNewOrdersCount}
          />
        )}
        {section === 'products' && (
          <PharmaProducts
            pharmacyId={selectedPharmacy.id}
            pharmacyName={selectedPharmacy.name}
          />
        )}
        {section === 'inventory' && (
          <PharmaInventory
            pharmacyId={selectedPharmacy.id}
          />
        )}
        {section === 'brands' && (
          <PharmaBrands />
        )}
        {section === 'commission' && (
          <PharmaCommission
            pharmacyId={selectedPharmacy.id}
            pharmacyName={selectedPharmacy.name}
          />
        )}
        {section === 'settings' && (
          <PharmaSettings
            pharmacy={selectedPharmacy}
            onUpdate={handlePharmacyUpdate}
          />
        )}
      </main>
    </div>
  );
}
