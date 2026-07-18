// ════════════════════════════════════════════════════════════════
// DermaApp — /derma root : session check + dashboard layout
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { getDermaSession, clearDermaSession } from '../lib/dermato';
import DermaLogin from './DermaLogin';
import DermaConsultations from './DermaConsultations';
import DermaConsultDetail from './DermaConsultDetail';
import DermaSlots from './DermaSlots';
import DermaSettings from './DermaSettings';
import './Derma.css';

const NAV = [
  { id: 'consultations', label: 'Consultations', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ) },
  { id: 'slots', label: 'Créneaux', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ) },
  { id: 'settings', label: 'Paramètres', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ) },
];

export default function DermaApp() {
  const [session, setSession] = useState(() => getDermaSession());
  const [section, setSection] = useState('consultations');
  const [openConsult, setOpenConsult] = useState(null); // consultation id
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'YARAM Dermato';
      const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (meta) meta.setAttribute('content', 'YARAM Dermato');
    }
  }, []);

  const logout = () => {
    clearDermaSession();
    setSession(null);
    setOpenConsult(null);
  };

  if (!session) {
    return <DermaLogin onSuccess={(dermato) => setSession(getDermaSession())} />;
  }

  const dermato = session.dermato || {};

  return (
    <div className="drm-shell">
      {/* SIDEBAR desktop */}
      <aside className="drm-side">
        <div className="drm-side-head">
          <div className="drm-side-logo">
            {dermato.photo_url ? (
              <img src={dermato.photo_url} alt={dermato.full_name} />
            ) : (
              (dermato.full_name || 'D').charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drm-side-brand">{dermato.full_name || 'Dermato'}</div>
            <div className="drm-side-role">{dermato.speciality || 'Dermatologie'}</div>
          </div>
        </div>
        <nav className="drm-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`drm-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => { setSection(item.id); setOpenConsult(null); }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="drm-side-foot">
          <a href="/">Voir YARAM</a>
          <button onClick={logout}>Déconnecter</button>
        </div>
      </aside>

      <main className="drm-main">
        {openConsult ? (
          <DermaConsultDetail
            consultId={openConsult}
            onBack={() => { setOpenConsult(null); setReloadKey(k => k + 1); }}
          />
        ) : (
          <>
            {section === 'consultations' && (
              <DermaConsultations key={reloadKey} onOpen={(id) => setOpenConsult(id)} />
            )}
            {section === 'slots' && <DermaSlots />}
            {section === 'settings' && <DermaSettings dermato={dermato} />}
          </>
        )}
      </main>

      {/* BOTTOM NAV mobile */}
      <nav className="drm-bnav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`drm-bnav-item ${section === item.id && !openConsult ? 'active' : ''}`}
            onClick={() => { setSection(item.id); setOpenConsult(null); }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
