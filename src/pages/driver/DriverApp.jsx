import { useEffect, useState, useCallback } from 'react';
import DriverLogin from './DriverLogin';
import DriverSignup from './DriverSignup';
import DriverDashboard from './DriverDashboard';
import DriverDelivery from './DriverDelivery';
import DriverProfile from './DriverProfile';
import DriverEarnings from './DriverEarnings';
import DriverHelp from './DriverHelp';
import { setupWebPushForDriver } from './driverPush';
import './driver-app.css';

const SESSION_KEY = 'yaram_driver_session';

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token || !s?.driver_id) return null;
    if (s.expires_at && s.expires_at < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/**
 * Parse pathname pour déterminer le tab actif.
 * /driver               → dashboard
 * /driver/dashboard     → dashboard
 * /driver/login         → login
 * /driver/profile       → profile
 * /driver/earnings      → earnings
 * /driver/help          → help
 * /driver/delivery/:id  → delivery detail
 */
function pathToView(pathname) {
  const parts = (pathname || '').replace(/^\//, '').split('/').filter(Boolean);
  // parts[0] === 'driver'
  const sub = parts[1] || 'dashboard';
  if (sub === 'login')     return { name: 'login' };
  if (sub === 'signup')    return { name: 'signup' };
  if (sub === 'profile')   return { name: 'profile' };
  if (sub === 'earnings')  return { name: 'earnings' };
  if (sub === 'help')      return { name: 'help' };
  if (sub === 'delivery' && parts[2]) return { name: 'delivery', orderId: parts[2] };
  return { name: 'dashboard' };
}

function viewToPath(view) {
  if (!view) return '/driver';
  if (view.name === 'dashboard') return '/driver';
  if (view.name === 'delivery')  return `/driver/delivery/${view.orderId}`;
  return `/driver/${view.name}`;
}

const Icons = {
  Truck: ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  Wallet: ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
  User: ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Question: ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const TABS = [
  { key: 'dashboard', label: 'Livraisons', Icon: Icons.Truck },
  { key: 'earnings',  label: 'Gains',      Icon: Icons.Wallet },
  { key: 'profile',   label: 'Profil',     Icon: Icons.User },
  { key: 'help',      label: 'Aide',       Icon: Icons.Question },
];

export default function DriverApp() {
  const [session, setSession] = useState(() => readSession());
  const [view, setView] = useState(() => pathToView(window.location.pathname));

  // Patch index.html manifest link to driver-specific manifest
  useEffect(() => {
    try {
      const link = document.getElementById('manifest-link') || document.querySelector('link[rel="manifest"]');
      if (link && !link.dataset.dvrSwapped) {
        link.href = '/driver-manifest.webmanifest';
        link.dataset.dvrSwapped = '1';
      }
    } catch {}
  }, []);

  // Set body/root background + theme-color to Pedalel teal
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    // Pedalel brand teal (hex, pas var — les meta ne résolvent pas les CSS vars)
    if (meta) meta.setAttribute('content', '#2AA5AC');
    document.body.style.background = 'var(--dvr-bg, #F5F5F5)';
    return () => {
      if (meta && prev) meta.setAttribute('content', prev);
      document.body.style.background = '';
    };
  }, []);

  // Sync view ↔ URL
  useEffect(() => {
    const onPop = () => setView(pathToView(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ═══ BLOQUE le pinch-zoom viewport iOS Safari ═══════════════════
  // iOS Safari ignore user-scalable=no depuis iOS 10. Le CSS
  // touch-action ne bloque pas non plus le zoom viewport. Le SEUL fix
  // fiable est preventDefault sur les evenements gesture (Safari) +
  // touchmove multi-touch (Chrome/Firefox) + double-tap.
  useEffect(() => {
    // 1. Safari-specific gesture events (pinch)
    const onGesture = (e) => { try { e.preventDefault(); } catch {} };
    document.addEventListener('gesturestart',  onGesture, { passive: false });
    document.addEventListener('gesturechange', onGesture, { passive: false });
    document.addEventListener('gestureend',    onGesture, { passive: false });

    // 2. Multi-touch touchmove (backup Android/cross-browser)
    const onTouchMove = (e) => {
      if (e.touches && e.touches.length > 1) {
        try { e.preventDefault(); } catch {}
      }
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    // 3. Double-tap zoom (iOS Safari)
    let lastTouchEnd = 0;
    const onTouchEnd = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300) {
        try { e.preventDefault(); } catch {}
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('gesturestart',  onGesture);
      document.removeEventListener('gesturechange', onGesture);
      document.removeEventListener('gestureend',    onGesture);
      document.removeEventListener('touchmove',     onTouchMove);
      document.removeEventListener('touchend',      onTouchEnd);
    };
  }, []);

  const navigate = useCallback((next) => {
    setView(next);
    const path = viewToPath(next);
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  const handleLogin = useCallback((s) => {
    setSession(s);
    navigate({ name: 'dashboard' });
    // ─── WEB PUSH : demande permission + subscribe + save subscription ───
    // Différé de 1.5s pour laisser le dashboard se monter d'abord (meilleur taux d'acceptation)
    setTimeout(() => {
      setupWebPushForDriver(s).then((res) => {
        if (res.ok) {
          console.log('[driver] web push enabled');
        } else {
          console.warn('[driver] web push not enabled:', res.error);
        }
      });
    }, 1500);
  }, [navigate]);

  // ─── Si déjà loggué au reload, re-tente d'enregistrer la subscription ───
  // (cas : user désinstalle puis réinstalle la PWA → l'ancienne sub n'existe plus)
  useEffect(() => {
    if (!session) return;
    setupWebPushForDriver(session).then((res) => {
      if (res.ok) console.log('[driver] web push re-validated');
    });
  }, [session?.token]); // une seule fois par session

  const handleLogout = useCallback(() => {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    setSession(null);
    navigate({ name: 'dashboard' }); // après /driver login s'affichera car !session
  }, [navigate]);

  // ── Signup route (public, avant meme la verif session) ──
  if (view.name === 'signup') {
    return (
      <div className="dvr-root" style={{ paddingBottom: 0 }}>
        <DriverSignup
          onBack={() => navigate({ name: 'login' })}
          onDone={() => navigate({ name: 'login' })}
        />
      </div>
    );
  }

  // ── Auto-redirect to login if no session ──
  if (!session) {
    return (
      <div className="dvr-root">
        <DriverLogin
          onLogin={handleLogin}
          onSignup={() => navigate({ name: 'signup' })}
        />
      </div>
    );
  }

  // ── Forced login view ──
  if (view.name === 'login') {
    return (
      <div className="dvr-root">
        <DriverLogin
          onLogin={handleLogin}
          onSignup={() => navigate({ name: 'signup' })}
        />
      </div>
    );
  }

  // ── Sub-page : delivery detail (full screen, hides tab bar) ──
  if (view.name === 'delivery') {
    return (
      <div className="dvr-root" style={{ paddingBottom: 0 }}>
        <DriverDelivery
          session={session}
          orderId={view.orderId}
          onBack={() => navigate({ name: 'dashboard' })}
        />
      </div>
    );
  }

  // ── Main tabs ──
  return (
    <div className="dvr-root">
      {view.name === 'dashboard' && (
        <DriverDashboard
          session={session}
          onLogout={handleLogout}
          onOpenDelivery={(orderId) => navigate({ name: 'delivery', orderId })}
          onNavigate={(name) => navigate({ name })}
        />
      )}

      {view.name === 'earnings' && (
        <DriverEarnings session={session} />
      )}

      {view.name === 'profile' && (
        <DriverProfile
          session={session}
          onLogout={handleLogout}
          onBack={() => navigate({ name: 'dashboard' })}
          onSessionUpdate={(s) => setSession(s)}
        />
      )}

      {view.name === 'help' && (
        <DriverHelp />
      )}

      {/* BOTTOM TAB BAR */}
      <nav className="dvr-tabbar" aria-label="Navigation principale">
        {TABS.map(({ key, label, Icon }) => {
          const active = view.name === key || (key === 'dashboard' && view.name === 'delivery');
          return (
            <button
              key={key}
              className={`dvr-tab ${active ? 'active' : ''}`}
              onClick={() => navigate({ name: key })}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
            >
              <Icon active={active} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
