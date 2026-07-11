// ════════════════════════════════════════════════════════════════════
// Admin — Trade-In program
// ════════════════════════════════════════════════════════════════════
// Liste toutes les demandes de rachat, permet d accepter, refuser,
// marquer comme recu et crediter le compte YARAM du client.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getAdminToken } from '../lib/adminAuth';
import { toast } from '../lib/toast';

function fmt(n) { return new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)); }
function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

const STATUS_META = {
  pending_review: { label: 'En cours d examen', color: '#B78B00', bg: '#FFF9E6' },
  accepted: { label: 'Accepte', color: '#1F8B4C', bg: '#EAF7F0' },
  rejected: { label: 'Refuse', color: '#D9342B', bg: '#FDECEA' },
  received: { label: 'Recu', color: '#2563EB', bg: '#DBEAFE' },
  credited: { label: 'Credite', color: '#065F46', bg: '#D1FAE5' },
};

const STATUS_TABS = [
  { id: 'pending_review', label: 'En attente' },
  { id: 'accepted', label: 'Acceptees' },
  { id: 'received', label: 'Recues' },
  { id: 'credited', label: 'Creditees' },
  { id: 'rejected', label: 'Refusees' },
  { id: 'all', label: 'Toutes' },
];

export default function TradeInSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending_review');
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) {
      toast.error('Session admin expiree');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('admin_trade_in_list', { p_admin_token: token });
    if (error) {
      toast.error('Erreur : ' + error.message);
      setRows([]);
    } else {
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (tab === 'all') return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const counts = useMemo(() => {
    const c = { pending_review: 0, accepted: 0, received: 0, credited: 0, rejected: 0 };
    rows.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
    return c;
  }, [rows]);

  const review = async (row, decision, finalCredit, notes) => {
    setBusyId(row.id);
    try {
      const token = getAdminToken();
      const { data, error } = await supabase.rpc('admin_trade_in_review', {
        p_admin_token: token,
        p_id: row.id,
        p_decision: decision,
        p_final_credit: finalCredit === null ? null : Number(finalCredit),
        p_notes: notes || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Erreur');
      toast.success('Mis a jour');
      await load();
    } catch (e) {
      toast.error('Erreur : ' + (e?.message || 'inconnue'));
    } finally {
      setBusyId(null);
    }
  };

  const promptCreditAndReview = (row, decision) => {
    const suggestion = row.yaram_credit_issued_fcfa || row.estimated_credit_fcfa || 0;
    const raw = window.prompt(
      `Credit final (FCFA) a accorder ?\nSuggestion : ${fmt(suggestion)} FCFA`,
      String(suggestion),
    );
    if (raw === null) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Montant invalide');
      return;
    }
    review(row, decision, value, null);
  };

  const promptNotesAndReject = (row) => {
    const notes = window.prompt('Raison du refus (facultatif)', row.admin_notes || '');
    review(row, 'rejected', 0, notes || null);
  };

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--y-n-900,#0F1F14)' }}>
          Trade-In cosmetiques
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--y-n-600,#4B5B52)', fontSize: 13 }}>
          Demandes de rachat de produits semi-neufs. Approuve, verifie a la reception, credite.
        </p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {STATUS_TABS.map((t) => {
          const active = t.id === tab;
          const count = t.id === 'all' ? rows.length : counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                background: active ? '#0F5132' : '#F1F5F3',
                color: active ? '#fff' : '#1B3626',
                border: 0,
                padding: '8px 14px',
                borderRadius: 999,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {t.label}{typeof count === 'number' ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Aucune demande.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((row) => {
            const meta = STATUS_META[row.status] || { label: row.status, color: '#333', bg: '#EEE' };
            const items = Array.isArray(row.items) ? row.items : [];
            const isOpen = !!expanded[row.id];
            return (
              <div
                key={row.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E7EEEA',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        background: meta.bg, color: meta.color, padding: '3px 10px',
                        borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.06,
                      }}>{meta.label}</span>
                      <strong style={{ color: '#0F1F14' }}>{items.length} produit(s)</strong>
                      <span style={{ color: '#4B5B52', fontSize: 12 }}>{fmtDate(row.created_at)}</span>
                    </div>
                    <div style={{ color: '#4B5B52', fontSize: 12, marginTop: 4 }}>
                      User : <code style={{ background: '#F1F5F3', padding: '1px 6px', borderRadius: 4 }}>{row.user_id?.slice(0, 8)}</code>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#4B5B52' }}>Estimation</div>
                    <div style={{ fontWeight: 800, color: '#0F1F14' }}>{fmt(row.estimated_credit_fcfa)} FCFA</div>
                    {row.yaram_credit_issued_fcfa ? (
                      <div style={{ fontSize: 12, color: '#065F46', marginTop: 4 }}>
                        Credit : <strong>{fmt(row.yaram_credit_issued_fcfa)} FCFA</strong>
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [row.id]: !isOpen }))}
                  style={{
                    background: 'transparent', border: 0, color: '#0F5132',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '10px 0 4px',
                  }}
                >
                  {isOpen ? '- Masquer le detail' : '+ Voir le detail'}
                </button>

                {isOpen ? (
                  <div style={{ marginTop: 8, borderTop: '1px solid #E7EEEA', paddingTop: 12 }}>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                      {items.map((it, i) => (
                        <li key={i} style={{ display: 'flex', gap: 10, background: '#F9FBFA', padding: 10, borderRadius: 8 }}>
                          {it.photo_url ? (
                            <img
                              src={it.photo_url}
                              alt=""
                              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: 56, height: 56, background: '#E7EEEA', borderRadius: 6, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, fontSize: 13 }}>
                            <div style={{ fontWeight: 600, color: '#0F1F14' }}>{it.name || '—'}</div>
                            <div style={{ color: '#4B5B52' }}>{it.brand || '—'} · {it.condition || '—'}</div>
                            {it.estimated_value ? (
                              <div style={{ color: '#065F46', fontSize: 12 }}>{fmt(it.estimated_value)} FCFA</div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>

                    {row.pickup_address ? (
                      <div style={{ marginTop: 10, fontSize: 13, color: '#1B3626' }}>
                        <strong>Collecte :</strong>{' '}
                        {row.pickup_address.address || ''}
                        {row.pickup_address.phone ? ` · ${row.pickup_address.phone}` : ''}
                      </div>
                    ) : null}

                    {row.admin_notes ? (
                      <div style={{ marginTop: 10, padding: 8, background: '#FEF3C7', borderRadius: 6, fontSize: 13, color: '#92590E' }}>
                        <strong>Note admin :</strong> {row.admin_notes}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {row.status === 'pending_review' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => promptCreditAndReview(row, 'accepted')}
                        style={btnPrimary}
                      >
                        Accepter
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => promptNotesAndReject(row)}
                        style={btnDanger}
                      >
                        Refuser
                      </button>
                    </>
                  ) : null}
                  {row.status === 'accepted' ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => review(row, 'received', row.yaram_credit_issued_fcfa || 0, null)}
                      style={btnPrimary}
                    >
                      Marquer recu
                    </button>
                  ) : null}
                  {row.status === 'received' ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => promptCreditAndReview(row, 'credited')}
                      style={btnPrimary}
                    >
                      Crediter le compte
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const btnPrimary = {
  background: '#0F5132',
  color: '#fff',
  border: 0,
  padding: '8px 14px',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
};
const btnDanger = {
  background: '#DC2626',
  color: '#fff',
  border: 0,
  padding: '8px 14px',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
};
