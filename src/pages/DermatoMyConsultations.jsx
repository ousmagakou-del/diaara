// ════════════════════════════════════════════════════════════════
// DermatoMyConsultations — /dermato/mes-consultations
// Liste des consultations dermato du patient
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNav, useUser } from '../App';
import {
  getMyDermatoConsultations,
  formatDateTimeFr,
  formatFcfa,
  CONSULT_STATUS_LABEL,
} from '../lib/dermato';
import './Dermato.css';

export default function DermatoMyConsultations() {
  const { navigate, goBack } = useNav();
  const { user } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    (async () => {
      try {
        const list = await getMyDermatoConsultations(user.id);
        setItems(list);
      } catch (e) {
        console.warn('[MyConsults] load', e?.message);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  // Active (paid, in_review, scheduled, in_progress) → top ; puis completed, cancelled
  const active = items.filter(x => ['paid', 'in_review', 'scheduled', 'in_progress', 'pending_payment'].includes(x.status));
  const past = items.filter(x => !['paid', 'in_review', 'scheduled', 'in_progress', 'pending_payment'].includes(x.status));

  const goDetail = (id) => navigate({ name: 'dermato_consultation', params: { id } });

  return (
    <div className="derm-page">
      <div className="derm-topbar">
        <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="derm-topbar-title">Mes consultations dermato</div>
      </div>

      <div style={{ padding: 20 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--y-n-600)' }}>Chargement…</p>
        ) : items.length === 0 ? (
          <div className="derm-empty">
            <h3>Aucune consultation pour le moment</h3>
            <p>Consulte un dermatologue certifié en quelques clics.</p>
            <button className="derm-btn-primary" style={{ maxWidth: 260, margin: '0 auto' }} onClick={() => navigate({ name: 'dermato_landing' })}>
              Voir les dermatologues
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <h3 style={{ maxWidth: 800, margin: '0 auto 12px', fontWeight: 800, fontSize: 15 }}>En cours</h3>
                <div className="derm-consult-list" style={{ marginBottom: 30 }}>
                  {active.map(c => (
                    <ConsultRow key={c.id} c={c} onClick={() => goDetail(c.id)} />
                  ))}
                </div>
              </>
            )}
            {past.length > 0 && (
              <>
                <h3 style={{ maxWidth: 800, margin: '0 auto 12px', fontWeight: 800, fontSize: 15 }}>Passées</h3>
                <div className="derm-consult-list">
                  {past.map(c => (
                    <ConsultRow key={c.id} c={c} onClick={() => goDetail(c.id)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConsultRow({ c, onClick }) {
  const isVideo = c.type === 'video' || c.consult_type === 'video';
  const dermName = c.dermatologist_name || c.dermato_name || 'Dermatologue';
  return (
    <div className="derm-consult-row" onClick={onClick} role="button">
      <div className="derm-consult-row-main">
        <strong>Dr {dermName}</strong>
        <span>{isVideo ? 'Visio 20 min' : 'Consultation express'} · {formatDateTimeFr(c.created_at)}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span className={`derm-status-badge derm-status-${c.status}`}>
          {CONSULT_STATUS_LABEL[c.status] || c.status}
        </span>
        <div style={{ fontSize: 12, color: 'var(--y-n-600)', marginTop: 4 }}>
          {formatFcfa(c.price_fcfa || c.amount_fcfa || 0)}
        </div>
      </div>
    </div>
  );
}
