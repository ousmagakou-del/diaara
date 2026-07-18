// ════════════════════════════════════════════════════════════════
// DermaConsultations — liste des consultations pour le dermato connecté
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { dermaGetConsultations, formatDateTimeFr, formatFcfa, CONSULT_STATUS_LABEL } from '../lib/dermato';

export default function DermaConsultations({ onOpen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await dermaGetConsultations();
      const list = res?.consultations || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (e) {
      console.warn('[DermaConsultations] load', e?.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const filtered = items.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['paid', 'in_review', 'scheduled', 'in_progress'].includes(c.status);
    if (filter === 'done') return c.status === 'completed';
    return c.status === filter;
  });

  const activeCount = items.filter((c) => ['paid', 'in_review', 'scheduled', 'in_progress'].includes(c.status)).length;

  return (
    <>
      <div className="drm-page-h">
        <div>
          <h1>Consultations</h1>
          <p>{activeCount} en cours · {items.length} au total</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'active', label: 'En cours' },
          { id: 'paid', label: 'Payées' },
          { id: 'in_review', label: 'À analyser' },
          { id: 'scheduled', label: 'Programmées' },
          { id: 'done', label: 'Terminées' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="drm-btn drm-btn-secondary"
            style={{
              padding: '7px 14px',
              fontSize: 12,
              background: filter === f.id ? '#1F8B4C' : 'white',
              color: filter === f.id ? 'white' : 'var(--y-n-800)',
              borderColor: filter === f.id ? '#1F8B4C' : 'var(--y-n-300)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--y-n-600)', fontSize: 13 }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="drm-card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--y-n-600)' }}>Aucune consultation pour ce filtre.</p>
        </div>
      ) : (
        <div className="drm-list">
          {filtered.map((c) => {
            const isVideo = c.type === 'video' || c.consult_type === 'video';
            const unread = c.patient_unread || c.unread_count || 0;
            return (
              <div key={c.id} className="drm-list-row" onClick={() => onOpen(c.id)}>
                <div className="drm-list-row-main">
                  <strong>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.patient_name || 'Patient'}
                    {unread > 0 && (
                      <span style={{
                        display: 'inline-block',
                        marginLeft: 8,
                        background: '#E94E1B',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                      }}>{unread} nouveau</span>
                    )}
                  </strong>
                  <span>
                    {isVideo ? 'Visio 20 min' : 'Consultation express'} · {formatDateTimeFr(isVideo && c.scheduled_at ? c.scheduled_at : c.created_at)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`drm-badge drm-badge-${c.status}`}>
                    {CONSULT_STATUS_LABEL[c.status] || c.status}
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--y-n-600)', marginTop: 4 }}>
                    {formatFcfa(c.price_fcfa || c.amount_fcfa || 0)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
