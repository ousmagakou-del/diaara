// ════════════════════════════════════════════════════════════════
// Admin — DermatoConsultationsSection : liste globale + revenue
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { getAdminToken } from '../lib/adminAuth';
import {
  adminListDermatoConsultations,
  formatFcfa,
  formatDateTimeFr,
  CONSULT_STATUS_LABEL,
} from '../lib/dermato';

const STATUS_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'paid', label: 'Payées' },
  { id: 'in_review', label: 'À analyser' },
  { id: 'scheduled', label: 'Programmées' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'completed', label: 'Terminées' },
  { id: 'cancelled', label: 'Annulées' },
];

const TYPE_FILTERS = [
  { id: 'all', label: 'Tous types' },
  { id: 'async', label: 'Chat async' },
  { id: 'video', label: 'Visio' },
];

export default function DermatoConsultationsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAdminToken();
      if (!token) { setError('Session admin requise'); setLoading(false); return; }
      const res = await adminListDermatoConsultations(token);
      const list = res?.consultations || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (e) {
      setError('Erreur : ' + (e?.message || ''));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (type !== 'all') {
        const t = c.type || c.consult_type;
        if (t !== type) return false;
      }
      if (q) {
        const s = q.toLowerCase();
        const hay = `${c.patient_name || ''} ${c.dermatologist_name || c.dermato_name || ''} ${c.id || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, status, type, q]);

  const kpis = useMemo(() => {
    const rev = filtered.reduce((sum, c) => sum + Number(c.price_fcfa || c.amount_fcfa || 0), 0);
    const commission = filtered.reduce((sum, c) => {
      const price = Number(c.price_fcfa || c.amount_fcfa || 0);
      const pct = Number(c.commission_pct || 20);
      return sum + Math.round(price * pct / 100);
    }, 0);
    return {
      count: filtered.length,
      revenue: rev,
      commission,
      done: filtered.filter((c) => c.status === 'completed').length,
    };
  }, [filtered]);

  return (
    <div className="adm-section">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Consultations dermato</h1>
        <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Vue globale de toutes les consultations · revenue & tracking</p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Consultations" value={kpis.count} />
        <Kpi label="Revenue" value={formatFcfa(kpis.revenue)} />
        <Kpi label="Commission YARAM" value={formatFcfa(kpis.commission)} />
        <Kpi label="Terminées" value={kpis.done} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Recherche patient / dermato / ID"
          style={{ padding: '9px 14px', border: '1.5px solid #E5E4DC', borderRadius: 10, minWidth: 240, fontSize: 13 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '9px 14px', border: '1.5px solid #E5E4DC', borderRadius: 10, fontSize: 13 }}>
          {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: '9px 14px', border: '1.5px solid #E5E4DC', borderRadius: 10, fontSize: 13 }}>
          {TYPE_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <button onClick={load} style={{ padding: '9px 14px', background: 'white', border: '1.5px solid #E5E4DC', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          Rafraîchir
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#FDECEA', color: '#D9342B', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7280' }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#FAFAF7', borderRadius: 12, color: '#6B7280' }}>
          Aucune consultation pour ce filtre.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <thead>
              <tr style={{ background: '#FAFAF7', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#6B7280', letterSpacing: '0.05em' }}>
                <th style={{ padding: 12 }}>Patient</th>
                <th style={{ padding: 12 }}>Dermato</th>
                <th style={{ padding: 12 }}>Type</th>
                <th style={{ padding: 12 }}>Statut</th>
                <th style={{ padding: 12 }}>Prix</th>
                <th style={{ padding: 12 }}>Comm.</th>
                <th style={{ padding: 12 }}>Créée</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const price = Number(c.price_fcfa || c.amount_fcfa || 0);
                const pct = Number(c.commission_pct || 20);
                const comm = Math.round(price * pct / 100);
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #EEEDE8', fontSize: 13 }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{c.patient_name || c.patient_id?.slice(0, 8) || '—'}</td>
                    <td style={{ padding: 12 }}>Dr {c.dermatologist_name || c.dermato_name || '—'}</td>
                    <td style={{ padding: 12 }}>{(c.type || c.consult_type) === 'video' ? 'Visio' : 'Chat'}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{
                        padding: '3px 9px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: statusBg(c.status),
                        color: statusFg(c.status),
                      }}>
                        {CONSULT_STATUS_LABEL[c.status] || c.status}
                      </span>
                    </td>
                    <td style={{ padding: 12, fontWeight: 700 }}>{formatFcfa(price)}</td>
                    <td style={{ padding: 12, color: '#0E5B33', fontWeight: 700 }}>{formatFcfa(comm)}</td>
                    <td style={{ padding: 12, color: '#6B7280', fontSize: 12 }}>{formatDateTimeFr(c.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={{ background: 'white', border: '1px solid #EEEDE8', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0A0A0A' }}>{value}</div>
    </div>
  );
}

function statusBg(s) {
  return {
    paid: '#FFF9E6', in_review: '#EAF3FE', scheduled: '#EAF3FE', in_progress: '#EAF7F0',
    completed: '#EAF7F0', cancelled: '#FDECEA', refunded: '#FDECEA', pending_payment: '#F4F4F2',
  }[s] || '#F4F4F2';
}
function statusFg(s) {
  return {
    paid: '#B78B00', in_review: '#0066CC', scheduled: '#0066CC', in_progress: '#1F8B4C',
    completed: '#0E5B33', cancelled: '#D9342B', refunded: '#D9342B', pending_payment: '#6B7280',
  }[s] || '#6B7280';
}
