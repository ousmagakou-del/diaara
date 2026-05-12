import { useNav } from '../App';

export default function Payments() {
  const { navigate } = useNav();
  const methods = [
    { id: 'wave', icon: '🌊', name: 'Wave', desc: 'Paiement instantané', default: true },
    { id: 'om', icon: '🟠', name: 'Orange Money', desc: 'Code USSD' },
    { id: 'cod', icon: '💵', name: 'Cash à la livraison', desc: 'Tu paies au livreur' },
    { id: 'card', icon: '💳', name: 'Carte bancaire', desc: 'Visa / Mastercard · bientôt' },
  ];

  return (
    <div className="page-anim" style={{height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: 'calc(var(--safe-top) + 14px) 16px 14px', borderBottom: '1px solid var(--line)'}}>
        <button className="icon-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h1 style={{fontSize: 18, fontWeight: 700}}>Moyens de paiement</h1>
      </div>
      <div style={{flex: 1, overflowY: 'auto', padding: 16}}>
        {methods.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: 16, marginBottom: 8,
            background: 'var(--bg-soft)', borderRadius: 14,
          }}>
            <span style={{fontSize: 28}}>{m.icon}</span>
            <div style={{flex: 1}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <strong style={{fontSize: 14}}>{m.name}</strong>
                {m.default && <span style={{
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  padding: '2px 8px', borderRadius: 999,
                  fontSize: 10, fontWeight: 700,
                }}>Par défaut</span>}
              </div>
              <p style={{fontSize: 12, color: 'var(--ink-soft)', marginTop: 2}}>{m.desc}</p>
            </div>
          </div>
        ))}
        <div style={{marginTop: 14, padding: 12, background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: 10, fontSize: 12}}>
          ℹ️ Aucune donnée de carte n'est stockée par Diaara. Les paiements sont sécurisés par Wave, Orange Money et notre partenaire bancaire.
        </div>
      </div>
    </div>
  );
}