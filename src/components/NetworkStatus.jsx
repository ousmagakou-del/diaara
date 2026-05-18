import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// <NetworkStatus /> : bandeau global en haut quand l'utilisatrice est offline
// ou sur une connexion tres lente (2g / slow-2g).
// Monte une fois a la racine (App.jsx) — pas de prop, autonome.
// ─────────────────────────────────────────────────────────────────────────────

function getEffectiveType() {
  // navigator.connection : Chrome/Edge/Opera (Android principalement).
  // Pas supporte sur Safari iOS (l'API NetworkInformation n'existe pas).
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c?.effectiveType || null; // '4g', '3g', '2g', 'slow-2g' ou null
}

export default function NetworkStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [effective, setEffective] = useState(() => getEffectiveType());
  const [dismissedSlow, setDismissedSlow] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = navigator.connection;
    const handleChange = () => setEffective(getEffectiveType());
    if (conn?.addEventListener) {
      conn.addEventListener('change', handleChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn?.removeEventListener) {
        conn.removeEventListener('change', handleChange);
      }
    };
  }, []);

  // ─── Aucun banner ───
  if (online && !['slow-2g', '2g'].includes(effective)) return null;
  if (online && dismissedSlow) return null;

  const isOffline = !online;
  const bg = isOffline ? '#1A1A1A' : '#A07700';
  const icon = isOffline ? '⚡' : '🐌';
  const text = isOffline
    ? 'Hors ligne — certaines fonctions sont indisponibles'
    : 'Connexion lente détectée';

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: bg,
        color: 'white',
        fontSize: 12,
        fontWeight: 600,
        padding: '8px 14px',
        textAlign: 'center',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        animation: 'yaramNetSlide 220ms ease-out',
        paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ flex: 1, textAlign: 'center' }}>{text}</span>
      {!isOffline && (
        <button
          onClick={() => setDismissedSlow(true)}
          aria-label="Fermer"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 4px',
            cursor: 'pointer',
            opacity: 0.85,
          }}
        >×</button>
      )}
      <style>{`
        @keyframes yaramNetSlide {
          from { transform: translateY(-100%); opacity: 0 }
          to   { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </div>
  );
}
