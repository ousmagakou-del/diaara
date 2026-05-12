import { useNav } from '../App';

export default function Evolution() {
  const { navigate } = useNav();
  return (
    <div className="page-anim" style={{height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: 'calc(var(--safe-top) + 14px) 16px 14px', borderBottom: '1px solid var(--line)'}}>
        <button className="icon-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h1 style={{fontSize: 18, fontWeight: 700}}>Mon évolution peau</h1>
      </div>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center'}}>
        <div style={{fontSize: 64, opacity: 0.2}}>📈</div>
        <h3 style={{marginTop: 14, color: 'var(--ink)'}}>Pas encore de scans</h3>
        <p style={{fontSize: 13, marginTop: 6, color: 'var(--ink-soft)'}}>
          Refais un diagnostic chaque mois pour suivre l'évolution de ta peau avant/après tes routines
        </p>
        <button className="btn-primary" onClick={() => navigate({name: 'scan', params: {}})} style={{maxWidth: 240, marginTop: 24}}>
          ✨ Faire mon 1er scan →
        </button>
      </div>
    </div>
  );
}