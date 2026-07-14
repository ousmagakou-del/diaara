// ════════════════════════════════════════════════════════════════
// BRAND DASHBOARD — Espace marques locales YARAM
// ────────────────────────────────────────────────────────────────
// Phases : selectBrand → setPin (1er login) → login → dashboard
// Le pattern reprend Pharma.jsx (login PIN + PWA + sidebar) mais
// avec la palette violette premium pour distinguer visuellement.
//
// Session : token JWT retourne par brand_login (RPC SECURITY DEFINER)
//           stocke en localStorage sous 'yaram-brand-session'.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BrandDashboard from '../brand/BrandDashboard';
import BrandProducts from '../brand/BrandProducts';
import BrandOrders from '../brand/BrandOrders';
import BrandInventory from '../brand/BrandInventory';
import BrandSettings from '../brand/BrandSettings';
import { getWhatsAppNumber } from '../lib/utils';
import './Brand.css';

// PINs interdits (trop evidents)
const BANNED_PINS = [
  '000000','111111','222222','333333','444444','555555','666666','777777','888888','999999',
  '123456','654321','012345','543210','111222','121212','123123','112233',
];

// ═══ Session helpers ═══
const SESSION_KEY = 'yaram-brand-session';

function sanitizeForStorage(brand) {
  if (!brand) return brand;
  // eslint-disable-next-line no-unused-vars
  const { pin, ...safe } = brand;
  return safe;
}

export function getBrandSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
export function getBrandToken() {
  const s = getBrandSession();
  return s?.token || null;
}

// ═══ SVG Icons pour la nav ═══
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
      return (<svg {...props}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
    case 'products':
      return (<svg {...props}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>);
    case 'inventory':
      return (<svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
    case 'settings':
      return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
    case 'arrow':
      return (<svg {...props} width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>);
    default:
      return null;
  }
};

const NAV = [
  { id: 'dashboard', label: "Vue d'ensemble" },
  { id: 'orders',    label: 'Commandes' },
  { id: 'products',  label: 'Mes produits' },
  { id: 'inventory', label: 'Mon stock' },
  { id: 'settings',  label: 'Paramètres' },
];

// ═══ Component racine ═══
export default function Brand() {
  const [phase, setPhase] = useState('selectBrand'); // selectBrand | setPin | login | forgot | dashboard
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [section, setSection] = useState('dashboard');
  const [brandStats, setBrandStats] = useState(null);
  const [pendingOrders, setPendingOrders] = useState(0);

  // ─── Restaurer la session si presente ────────────────────
  useEffect(() => {
    const s = getBrandSession();
    if (s && s.token && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now())) {
      setSelectedBrand(s.brand || s);
      setPhase('dashboard');
    }
  }, []);

  // ─── Fetch liste des marques actives-dashboard ───────────
  useEffect(() => {
    (async () => {
      setLoadingBrands(true);
      try {
        // Cherche toutes les marques ayant is_active_dashboard=true (colonne créée par la migration)
        // Fallback : si la colonne n'existe pas encore, on liste toutes les marques actives.
        const { data, error } = await supabase
          .from('brands')
          .select('id, name, slug, logo_url, tagline, phone, city, pin_set_at, is_active_dashboard')
          .eq('is_active_dashboard', true)
          .order('name', { ascending: true });
        if (error) {
          // La colonne n'existe peut-être pas ; on ne bloque pas l'écran (retente sans le filtre).
          const { data: fb } = await supabase
            .from('brands')
            .select('id, name, slug, logo_url, tagline, phone, city, pin_set_at')
            .order('name', { ascending: true });
          setBrands(fb || []);
        } else {
          setBrands(data || []);
        }
      } catch (e) {
        console.error('[Brand] loadBrands error:', e?.message);
        setBrands([]);
      }
      setLoadingBrands(false);
    })();
  }, []);

  // ─── Rebranding dynamique PWA (iOS Add to Home) ──────────
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalTitle = document.title;
    const originalAppleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const originalAppleTitleContent = originalAppleTitleMeta?.getAttribute('content');
    const originalDescMeta = document.querySelector('meta[name="description"]');
    const originalDescContent = originalDescMeta?.getAttribute('content');
    const originalThemeMeta = document.querySelector('meta[name="theme-color"]');
    const originalThemeContent = originalThemeMeta?.getAttribute('content');

    const brandTitle = selectedBrand?.name
      ? `${selectedBrand.name} · YARAM Marque`
      : 'YARAM Marque';
    document.title = brandTitle;

    // Apple: nom court
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleMeta) {
      appleMeta = document.createElement('meta');
      appleMeta.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleMeta);
    }
    appleMeta.setAttribute('content', 'YARAM Marque');

    // Theme color violet
    if (originalThemeMeta) originalThemeMeta.setAttribute('content', '#7C3AED');

    // Description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.setAttribute('name', 'description');
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute('content', 'Dashboard marque partenaire YARAM — gère tes produits en autonomie.');

    // Assure ?brand=1 dans l'URL pour que iOS mémorise la bonne route
    try {
      const url = new URL(window.location.href);
      if (window.location.pathname !== '/brand' && url.searchParams.get('brand') !== '1') {
        url.searchParams.set('brand', '1');
        window.history.replaceState({}, '', url.toString());
      }
    } catch { /* noop */ }

    return () => {
      document.title = originalTitle;
      if (originalAppleTitleContent !== undefined && originalAppleTitleMeta) {
        originalAppleTitleMeta.setAttribute('content', originalAppleTitleContent);
      }
      if (originalDescContent !== undefined && originalDescMeta) {
        originalDescMeta.setAttribute('content', originalDescContent);
      }
      if (originalThemeContent !== undefined && originalThemeMeta) {
        originalThemeMeta.setAttribute('content', originalThemeContent);
      }
    };
  }, [selectedBrand?.name]);

  // ─── Handlers phases ────────────────────────────────────
  const handleSelectBrand = (brand) => {
    setSelectedBrand(brand);
    setPinError('');
    setPinInput('');
    setConfirmPin('');
    if (!brand.pin_set_at) {
      setPhase('setPin');
    } else {
      setPhase('login');
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    if (!pinInput || !/^\d{4,6}$/.test(pinInput)) {
      setPinError('PIN à 4-6 chiffres');
      return;
    }
    const { data, error } = await supabase.rpc('brand_login', {
      p_phone: selectedBrand.phone,
      p_pin: pinInput,
      p_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    });
    if (error) {
      console.error('[Brand] login RPC error:', error.message);
      setPinError('Erreur serveur : ' + error.message);
      return;
    }
    if (!data || data.success === false || !data.token) {
      setPinError(data?.error === 'invalid_credentials' ? 'PIN incorrect ou marque inactive' : (data?.error || 'PIN incorrect'));
      setPinInput('');
      return;
    }
    const session = {
      token: data.token,
      expires_at: data.expires_at,
      brand: data.brand,
      ...data.brand,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sanitizeForStorage(session)));
    setSelectedBrand(data.brand);
    setPhase('dashboard');
    setPinError('');
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
    const { data, error } = await supabase.rpc('brand_set_initial_pin', {
      p_brand_id: selectedBrand.id,
      p_new_pin: pinInput,
    });
    if (error) {
      setPinError('Erreur : ' + error.message);
      return;
    }
    if (data && data.success === false) {
      setPinError('Erreur : ' + (data.error || 'inconnue'));
      return;
    }
    // PIN cree → on connecte l'user immediatement en appelant brand_login
    const { data: loginData, error: loginErr } = await supabase.rpc('brand_login', {
      p_phone: selectedBrand.phone,
      p_pin: pinInput,
      p_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    });
    if (loginErr || !loginData?.token) {
      // PIN set mais login rate → on redirige sur login classique
      setPinError('');
      setPinInput('');
      setConfirmPin('');
      // update pin_set_at local pour ne pas repasser en setPin
      setSelectedBrand({ ...selectedBrand, pin_set_at: new Date().toISOString() });
      setPhase('login');
      return;
    }
    const session = {
      token: loginData.token,
      expires_at: loginData.expires_at,
      brand: loginData.brand,
      ...loginData.brand,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sanitizeForStorage(session)));
    setSelectedBrand(loginData.brand);
    setPhase('dashboard');
    setPinError('');
    setPinInput('');
    setConfirmPin('');
  };

  const openForgotWhatsApp = () => {
    const b = selectedBrand;
    const msg = `Bonjour Ousmane,\n\nJe suis ${b?.name || 'une marque partenaire YARAM'}${b?.city ? ` à ${b.city}` : ''}.\n\nJ'ai oublié mon PIN d'accès au dashboard marque. Peux-tu me le réinitialiser SVP ?\n\nMerci.`;
    window.open(`https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSelectedBrand(null);
    setPhase('selectBrand');
    setPinInput('');
    setConfirmPin('');
    setSection('dashboard');
  };

  const handleBrandUpdate = (updated) => {
    setSelectedBrand(updated);
    const s = getBrandSession();
    if (s) {
      const merged = { ...s, brand: { ...(s.brand || {}), ...updated }, ...updated };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sanitizeForStorage(merged)));
    }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER — LOGIN PHASES
  // ═══════════════════════════════════════════════════════
  if (phase === 'selectBrand') {
    return (
      <div className="brnd-login">
        <div className="brnd-login-card brnd-login-wide">
          <div className="brnd-login-logo">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          <div className="brnd-login-eyebrow">Espace marque</div>
          <h1>Dashboard Marque</h1>
          <p>Sélectionne ta marque pour te connecter</p>

          {loadingBrands ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--y-n-600)', fontSize: 13 }}>
              Chargement des marques…
            </div>
          ) : brands.length === 0 ? (
            <div className="brnd-empty" style={{ margin: '10px 0' }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              </svg>
              <h3>Aucune marque activée</h3>
              <p>Contacte Ousmane pour activer ton dashboard marque.</p>
              <button className="brnd-btn-outline" onClick={openForgotWhatsApp}>
                Contacter Ousmane
              </button>
            </div>
          ) : (
            <div className="brnd-brand-list">
              {brands.map(b => (
                <button
                  key={b.id}
                  className="brnd-brand-item"
                  onClick={() => handleSelectBrand(b)}
                >
                  <div className="brnd-brand-logo">
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt=""
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = (b.name?.charAt(0) || 'M').toUpperCase(); }}
                      />
                    ) : (
                      (b.name?.charAt(0) || 'M').toUpperCase()
                    )}
                  </div>
                  <div className="brnd-brand-info">
                    <strong>{b.name}</strong>
                    <span>{b.city ? `${b.city} · ` : ''}{b.phone || 'Marque partenaire'}</span>
                  </div>
                  <span className="brnd-brand-arrow" aria-hidden="true">
                    <NavIcon id="arrow" />
                  </span>
                </button>
              ))}
            </div>
          )}

          <a href="/" className="brnd-back-link">Retour à l'app YARAM</a>
        </div>
      </div>
    );
  }

  if (phase === 'setPin') {
    const brandLogo = selectedBrand?.logo_url;
    return (
      <div className="brnd-login">
        <div className="brnd-login-card">
          <div className={`brnd-login-logo ${brandLogo ? 'brnd-login-logo-img' : ''}`}>
            {brandLogo
              ? <img src={brandLogo} alt={selectedBrand.name} onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (selectedBrand.name?.charAt(0) || 'M').toUpperCase(); }} />
              : (selectedBrand?.name?.charAt(0) || 'M').toUpperCase()}
          </div>
          <div className="brnd-login-eyebrow">Bienvenue</div>
          <h1>{selectedBrand.name}</h1>
          <p>Première connexion — crée ton PIN à 6 chiffres pour sécuriser ton compte.</p>
          <form onSubmit={handleSetPin}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`brnd-pin-input ${pinError ? 'error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="••••••"
              autoFocus
              maxLength={6}
            />
            <p style={{ fontSize: 11, color: 'var(--y-n-600)', margin: '2px 0 12px', textAlign: 'left' }}>
              Évite 123456, 000000, 111111 et autres PIN évidents.
            </p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`brnd-pin-input ${pinError ? 'error' : ''}`}
              value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="Confirme ton PIN"
              maxLength={6}
            />
            {pinError && <p className="brnd-pin-error">{pinError}</p>}
            <p style={{ fontSize: 11, color: 'var(--y-n-600)', margin: '0 0 8px' }}>
              Garde ce PIN en sécurité, tu en auras besoin à chaque connexion.
            </p>
            <button type="submit" className="brnd-pin-btn">Créer mon PIN</button>
          </form>
          <button className="brnd-back-link" onClick={() => setPhase('selectBrand')}>Choisir une autre marque</button>
        </div>
      </div>
    );
  }

  if (phase === 'forgot') {
    const brandLogo = selectedBrand?.logo_url;
    return (
      <div className="brnd-login">
        <div className="brnd-login-card">
          <div className={`brnd-login-logo ${brandLogo ? 'brnd-login-logo-img' : ''}`}>
            {brandLogo
              ? <img src={brandLogo} alt={selectedBrand?.name || ''} onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (selectedBrand?.name?.charAt(0) || 'M').toUpperCase(); }} />
              : (selectedBrand?.name?.charAt(0) || 'M').toUpperCase()}
          </div>
          <h1>PIN oublié ?</h1>
          <p>Pas de souci — contacte Ousmane et il te réinitialise ton PIN.</p>
          {selectedBrand && (
            <div className="brnd-forgot-target">
              <strong>{selectedBrand.name}</strong>
              <span>{selectedBrand.city || 'Marque partenaire YARAM'}</span>
            </div>
          )}
          <button onClick={openForgotWhatsApp} className="brnd-pin-btn brnd-pin-btn-wa">
            Contacter Ousmane sur WhatsApp
          </button>
          <button className="brnd-back-link" onClick={() => { setPhase('login'); setPinError(''); }}>Retour à la connexion</button>
        </div>
      </div>
    );
  }

  if (phase === 'login') {
    const brandLogo = selectedBrand?.logo_url;
    return (
      <div className="brnd-login">
        <div className="brnd-login-card">
          <div className={`brnd-login-logo ${brandLogo ? 'brnd-login-logo-img' : ''}`}>
            {brandLogo
              ? <img src={brandLogo} alt={selectedBrand.name} onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (selectedBrand.name?.charAt(0) || 'M').toUpperCase(); }} />
              : (selectedBrand?.name?.charAt(0) || 'M').toUpperCase()}
          </div>
          <div className="brnd-login-eyebrow">Espace marque</div>
          <h1>{selectedBrand.name}</h1>
          <p>Saisis ton code PIN pour te connecter</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`brnd-pin-input ${pinError ? 'error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="••••••"
              autoFocus
              maxLength={6}
            />
            {pinError && <p className="brnd-pin-error">{pinError}</p>}
            <button type="submit" className="brnd-pin-btn">Se connecter</button>
          </form>
          <button className="brnd-back-link" onClick={() => setPhase('forgot')}>PIN oublié ?</button>
          <button className="brnd-back-link" onClick={() => setPhase('selectBrand')}>Choisir une autre marque</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════
  return (
    <div className="brnd-shell">
      <aside className="brnd-side">
        <div className="brnd-side-head">
          <div className="brnd-side-logo">
            {selectedBrand?.logo_url ? (
              <img
                src={selectedBrand.logo_url}
                alt={selectedBrand.name}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.textContent = (selectedBrand.name?.charAt(0) || 'M').toUpperCase();
                }}
              />
            ) : (
              (selectedBrand?.name?.charAt(0) || 'M').toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="brnd-side-brand">{selectedBrand?.name}</div>
            <div className="brnd-side-role">Marque partenaire</div>
          </div>
        </div>

        <nav className="brnd-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`brnd-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="brnd-nav-icon"><NavIcon id={item.id} /></span>
              <span>{item.label}</span>
              {item.id === 'products' && brandStats?.pending_products > 0 && (
                <span className="brnd-nav-badge">{brandStats.pending_products}</span>
              )}
              {item.id === 'orders' && pendingOrders > 0 && (
                <span className="brnd-nav-badge">{pendingOrders}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="brnd-side-foot">
          <a href="/" className="brnd-app-link">Voir l'app YARAM</a>
          <button className="brnd-logout-btn" onClick={logout}>Déconnexion</button>
        </div>
      </aside>

      <main className="brnd-main">
        {section === 'dashboard' && (
          <BrandDashboard
            brand={selectedBrand}
            setSection={setSection}
            onStatsChange={setBrandStats}
          />
        )}
        {section === 'orders' && (
          <BrandOrders
            brand={selectedBrand}
            onPendingChange={setPendingOrders}
          />
        )}
        {section === 'products' && (
          <BrandProducts
            brand={selectedBrand}
            onStatsChange={setBrandStats}
          />
        )}
        {section === 'inventory' && (
          <BrandInventory
            brand={selectedBrand}
          />
        )}
        {section === 'settings' && (
          <BrandSettings
            brand={selectedBrand}
            onUpdate={handleBrandUpdate}
            onLogout={logout}
          />
        )}
      </main>
    </div>
  );
}
