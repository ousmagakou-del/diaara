// src/admin/QAModerationSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// YARAM — Admin · Moderation Q&A publique produits
// ─────────────────────────────────────────────────────────────────────────────
// Liste des questions/answers avec status pending_moderation ou rejected.
// Actions : approve / reject.
//
// RPC :
//   admin_qa_list_moderation(p_limit)
//   admin_qa_moderate(p_target_type, p_target_id, p_action)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { adminListQAModeration, adminModerateQA } from '../lib/supabase';
import { toast } from '../lib/toast';

const TABS = [
  { key: 'questions', label: 'Questions' },
  { key: 'answers', label: 'Reponses' },
];

export default function QAModerationSection() {
  const [tab, setTab] = useState('questions');
  const [data, setData] = useState({ questions: [], answers: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminListQAModeration(100);
      setData(r || { questions: [], answers: [] });
    } catch (e) {
      console.warn('[QAModerationSection] refresh:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAction = useCallback(async (targetType, targetId, action) => {
    setBusyId(targetId);
    try {
      const r = await adminModerateQA(targetType, targetId, action);
      if (r?.ok) {
        if (toast?.success) toast.success(action === 'approve' ? 'Approuve' : 'Rejete');
        await refresh();
      } else {
        if (toast?.error) toast.error(r?.error || 'Erreur');
      }
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const items = tab === 'questions' ? (data.questions || []) : (data.answers || []);
  const counts = {
    questions: (data.questions || []).length,
    answers: (data.answers || []).length,
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Moderation Q&A</h2>
          <p style={styles.sub}>Questions et reponses en attente de moderation ou rejetees.</p>
        </div>
        <button
          type="button"
          style={styles.refreshBtn}
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Chargement...' : 'Rafraichir'}
        </button>
      </div>

      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
            onClick={() => setTab(t.key)}
          >
            {t.label} <span style={styles.tabCount}>({counts[t.key]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}>Chargement...</div>
      ) : items.length === 0 ? (
        <div style={styles.empty}>Aucun element a moderer.</div>
      ) : (
        <div style={styles.list}>
          {items.map((it) => (
            <div key={it.id} style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.cardMeta}>
                  <span style={styles.metaProduct}>{it.product_name || 'Produit inconnu'}</span>
                  <span style={styles.metaSep}>·</span>
                  <span style={styles.metaUser}>{it.user_name || 'Anonyme'}</span>
                  <span style={styles.metaSep}>·</span>
                  <span style={styles.metaDate}>{new Date(it.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div style={{
                  ...styles.statusBadge,
                  background: it.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                  color: it.status === 'rejected' ? '#B91C1C' : '#B45309',
                }}>
                  {it.status === 'rejected' ? 'REJETE' : 'EN ATTENTE'}
                </div>
              </div>

              {tab === 'answers' && it.question && (
                <div style={styles.questionQuote}>
                  <span style={styles.questionLabel}>Question</span>
                  <p style={styles.questionText}>{it.question}</p>
                </div>
              )}

              <div style={styles.contentBlock}>
                <p style={styles.contentText}>{tab === 'questions' ? it.question : it.answer}</p>
                {tab === 'answers' && (it.is_pharmacist || it.is_yaram_team) && (
                  <div style={styles.badgeRow}>
                    {it.is_pharmacist && <span style={{ ...styles.roleBadge, background: '#EBF7EF', color: '#1F8B4C' }}>Pharmacien</span>}
                    {it.is_yaram_team && <span style={{ ...styles.roleBadge, background: '#EFF6FF', color: '#1D4ED8' }}>Equipe YARAM</span>}
                  </div>
                )}
              </div>

              <div style={styles.actions}>
                <button
                  type="button"
                  style={{ ...styles.actionBtn, ...styles.approveBtn }}
                  onClick={() => handleAction(tab === 'questions' ? 'question' : 'answer', it.id, 'approve')}
                  disabled={busyId === it.id}
                >
                  {busyId === it.id ? '...' : 'Approuver'}
                </button>
                <button
                  type="button"
                  style={{ ...styles.actionBtn, ...styles.rejectBtn }}
                  onClick={() => handleAction(tab === 'questions' ? 'question' : 'answer', it.id, 'reject')}
                  disabled={busyId === it.id}
                >
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '24px 28px', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: 800, margin: 0, color: '#111' },
  sub: { fontSize: 13, color: '#666', margin: '4px 0 0' },
  refreshBtn: { padding: '10px 18px', border: '1.5px solid #E5E7EB', background: '#FFFFFF', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  tabs: { display: 'flex', gap: 8, borderBottom: '1px solid #E5E7EB', marginBottom: 20 },
  tab: { padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#666', borderBottom: '2px solid transparent' },
  tabActive: { color: '#1F8B4C', borderBottom: '2px solid #1F8B4C' },
  tabCount: { color: '#999', fontSize: 12, marginLeft: 4 },
  loading: { padding: 60, textAlign: 'center', color: '#888' },
  empty: { padding: 60, textAlign: 'center', color: '#888', border: '1.5px dashed #E5E7EB', borderRadius: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { border: '1px solid #E5E7EB', borderRadius: 14, background: '#FFFFFF', padding: 18 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  cardMeta: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#666', flexWrap: 'wrap' },
  metaProduct: { fontWeight: 700, color: '#1A1A1A' },
  metaSep: { color: '#CCC' },
  metaUser: { color: '#444' },
  metaDate: { color: '#888' },
  statusBadge: { padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em' },
  questionQuote: { borderLeft: '3px solid #D1D5DB', padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, marginBottom: 10 },
  questionLabel: { fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' },
  questionText: { fontSize: 13, color: '#333', margin: '4px 0 0', lineHeight: 1.5 },
  contentBlock: { marginBottom: 14 },
  contentText: { fontSize: 15, color: '#1A1A1A', lineHeight: 1.55, margin: 0 },
  badgeRow: { display: 'flex', gap: 6, marginTop: 8 },
  roleBadge: { padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn: { padding: '8px 16px', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  approveBtn: { background: '#1F8B4C', color: '#FFFFFF' },
  rejectBtn: { background: '#FFFFFF', color: '#B91C1C', border: '1.5px solid #B91C1C' },
};
