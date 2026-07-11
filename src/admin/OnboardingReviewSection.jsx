// ═══════════════════════════════════════════════════════════════
// Admin — Merchant Onboarding Review
// ═══════════════════════════════════════════════════════════════
// Piste tous les onboardings pharmacie en cours : progres, docs KYC,
// import catalogue, statut contrat. Permet d approuver / rejeter les
// documents et de valider le catalogue.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAdminToken } from '../lib/adminAuth';
import { toast } from '../lib/toast';
import { adminLogAction } from '../lib/adminApi';

const STEP_LABELS = [
  { key: 'step_kyc_uploaded',      label: 'KYC uploade' },
  { key: 'step_kyc_verified',      label: 'KYC valide' },
  { key: 'step_contract_sent',     label: 'Contrat envoye' },
  { key: 'step_contract_signed',   label: 'Contrat signe' },
  { key: 'step_catalogue_uploaded',label: 'Catalogue uploade' },
  { key: 'step_catalogue_approved',label: 'Catalogue publie' },
  { key: 'step_payment_setup',     label: 'Wave configure' },
  { key: 'step_live',              label: 'Live' },
];

export default function OnboardingReviewSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) { toast.error('Session admin expiree'); setLoading(false); return; }
    const { data, error } = await supabase.rpc('admin_list_merchant_onboardings', {
      p_admin_token: token,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
    } else {
      setRows(data.onboardings || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (application_id) => {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_get_merchant_onboarding', {
      p_admin_token: token,
      p_application_id: application_id,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    setDetail(data);
  };

  const openDetail = (row) => {
    setSelected(row);
    setDetail(null);
    loadDetail(row.application_id);
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  const approveKyc = async (doc_id) => {
    setBusy(true);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_approve_kyc', {
      p_admin_token: token, p_document_id: doc_id,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Document approuve');
    adminLogAction({ action: 'merchant_kyc_approve', targetType: 'kyc_document', targetId: doc_id }).catch(() => {});
    loadDetail(selected.application_id);
    load();
  };

  const rejectKyc = async (doc_id) => {
    const reason = prompt('Motif du rejet ?', 'Document illisible');
    if (!reason) return;
    setBusy(true);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_reject_kyc', {
      p_admin_token: token, p_document_id: doc_id, p_reason: reason,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Document rejete');
    adminLogAction({ action: 'merchant_kyc_reject', targetType: 'kyc_document', targetId: doc_id, after: { reason } }).catch(() => {});
    loadDetail(selected.application_id);
    load();
  };

  const approveCatalogue = async (import_id) => {
    if (!confirm('Publier ce catalogue ? Les produits seront crees dans la base.')) return;
    setBusy(true);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_approve_catalogue', {
      p_admin_token: token, p_import_id: import_id,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success(`Catalogue publie : ${data.products_created} produits crees`);
    adminLogAction({ action: 'merchant_catalogue_approve', targetType: 'catalogue_import', targetId: import_id, after: { products_created: data.products_created } }).catch(() => {});
    loadDetail(selected.application_id);
    load();
  };

  const getKycFileUrl = async (path) => {
    try {
      const { data, error } = await supabase.storage
        .from('merchant-kyc')
        .createSignedUrl(path, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch (e) {
      toast.error('Impossible d ouvrir : ' + (e.message || ''));
    }
  };

  const stats = useMemo(() => ({
    total:      rows.length,
    live:       rows.filter(r => r.step_live).length,
    kyc_review: rows.filter(r => r.kyc_pending > 0).length,
    stuck:      rows.filter(r => !r.step_live && r.step_catalogue_uploaded && !r.step_catalogue_approved).length,
  }), [rows]);

  return (
    <div style={{ padding: '24px 28px 60px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
          Onboarding partenaires
        </h2>
        <p style={{ margin: '6px 0 0', color: 'var(--y-n-600)', fontSize: 14 }}>
          Suivi des pharmacies en cours d onboarding.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Live" value={stats.live} accent="var(--y-brand)" />
        <StatCard label="A revoir (KYC)" value={stats.kyc_review} accent="var(--y-warning-text)" />
        <StatCard label="Bloques catalogue" value={stats.stuck} accent="var(--y-danger)" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={load} style={btnLight}>Rafraichir</button>
      </div>

      <div style={{ background: 'var(--y-n-0)', border: '1px solid var(--y-n-300)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--y-n-500)' }}>Chargement...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--y-n-500)' }}>Aucun onboarding en cours</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'var(--y-n-50)', position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <Th>Pharmacie</Th><Th>Gerant</Th><Th>Ville</Th>
                  <Th>Progres</Th><Th>KYC</Th><Th>Statut</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const done = STEP_LABELS.filter(s => r[s.key]).length;
                  const pct = Math.round((done / STEP_LABELS.length) * 100);
                  return (
                    <tr key={r.application_id} style={{ borderTop: '1px solid var(--y-n-200)', cursor: 'pointer' }}
                        onClick={() => openDetail(r)}>
                      <Td>
                        <div style={{ fontWeight: 800 }}>{r.pharmacy_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--y-n-600)' }}>{r.email}</div>
                      </Td>
                      <Td>{r.owner_name}</Td>
                      <Td>{r.city || '—'}</Td>
                      <Td>
                        <div style={{ width: 140, height: 8, background: 'var(--y-n-100)', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--y-brand)' }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--y-n-600)', marginTop: 3 }}>{done}/{STEP_LABELS.length}</div>
                      </Td>
                      <Td>
                        {r.kyc_pending > 0
                          ? <span style={badgeWarn}>{r.kyc_pending} en revue</span>
                          : r.kyc_count > 0
                            ? <span style={badgeOk}>{r.kyc_count} valides</span>
                            : <span style={badgeMuted}>0</span>
                        }
                      </Td>
                      <Td>
                        {r.step_live
                          ? <span style={badgeOk}>Live</span>
                          : r.step_contract_signed
                            ? <span style={badgeInfo}>Config</span>
                            : r.step_kyc_verified
                              ? <span style={badgeInfo}>KYC OK</span>
                              : <span style={badgeWarn}>KYC</span>
                        }
                      </Td>
                      <Td>
                        <button style={btnLight} onClick={(e) => { e.stopPropagation(); openDetail(r); }}>
                          Voir
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && detail && (
        <DetailDrawer
          data={detail}
          busy={busy}
          onClose={closeDetail}
          onApproveKyc={approveKyc}
          onRejectKyc={rejectKyc}
          onApproveCatalogue={approveCatalogue}
          onOpenDoc={getKycFileUrl}
        />
      )}
      {selected && !detail && (
        <div style={overlayLoading}>Chargement...</div>
      )}
    </div>
  );
}

function DetailDrawer({ data, busy, onClose, onApproveKyc, onRejectKyc, onApproveCatalogue, onOpenDoc }) {
  const app = data.application || {};
  const progress = data.progress || {};
  const docs = data.docs || [];
  const catalogue = data.catalogue;
  const signature = data.signature;

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <aside style={drawerStyle}>
        <div style={drawerHeader}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--y-brand)', fontWeight: 800, letterSpacing: 0.4 }}>
              ONBOARDING PARTENAIRE
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>{app.pharmacy_name}</h3>
            <div style={{ fontSize: 12, color: 'var(--y-n-600)', marginTop: 4 }}>
              {app.owner_name} · {app.email} · {app.phone}
            </div>
            <div style={{ fontSize: 11, color: 'var(--y-n-500)', marginTop: 8 }}>
              Lien pharmacie : /merchant/onboarding/{app.id}
            </div>
          </div>
          <button style={btnGhost} onClick={onClose}>Fermer</button>
        </div>

        <section style={sectionStyle}>
          <h4 style={h4Style}>Progres</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {STEP_LABELS.map(s => (
              <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{
                  display: 'inline-block', width: 20, height: 20,
                  borderRadius: '50%', textAlign: 'center', lineHeight: '20px',
                  fontSize: 10, fontWeight: 900,
                  background: progress[s.key] ? 'var(--y-brand)' : 'var(--y-n-100)',
                  color: progress[s.key] ? '#fff' : 'var(--y-n-500)',
                }}>
                  {progress[s.key] ? 'OK' : ''}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        </section>

        <section style={sectionStyle}>
          <h4 style={h4Style}>Documents KYC ({docs.length})</h4>
          {docs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--y-n-500)' }}>Aucun document.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {docs.map(d => (
                <div key={d.id} style={docRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{d.doc_type}</div>
                    <div style={{ fontSize: 11, color: 'var(--y-n-500)' }}>
                      {new Date(d.uploaded_at).toLocaleString('fr-FR')}
                    </div>
                    {d.status === 'rejected' && d.rejection_reason && (
                      <div style={{ fontSize: 11, color: 'var(--y-danger)', marginTop: 4 }}>
                        Motif : {d.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={
                      d.status === 'approved' ? badgeOk :
                      d.status === 'rejected' ? badgeErr : badgeWarn
                    }>{d.status}</span>
                    <button style={btnLight} onClick={() => onOpenDoc(d.file_url)}>Ouvrir</button>
                    {d.status !== 'approved' && (
                      <button style={btnPrimary} disabled={busy} onClick={() => onApproveKyc(d.id)}>Approuver</button>
                    )}
                    {d.status !== 'rejected' && (
                      <button style={btnDanger} disabled={busy} onClick={() => onRejectKyc(d.id)}>Rejeter</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <h4 style={h4Style}>Contrat</h4>
          {signature ? (
            <div style={{ fontSize: 13 }}>
              <div>Statut : <strong>{signature.status}</strong></div>
              {signature.signed_at && (
                <div>Signe le {new Date(signature.signed_at).toLocaleString('fr-FR')}</div>
              )}
              <div style={{ marginTop: 6 }}>
                <a href={`/sign/${signature.token}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--y-brand)', fontWeight: 700 }}>
                  Ouvrir le contrat
                </a>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--y-n-500)' }}>Contrat pas encore envoye.</div>
          )}
        </section>

        <section style={sectionStyle}>
          <h4 style={h4Style}>Catalogue</h4>
          {catalogue ? (
            <div style={{ fontSize: 13, display: 'grid', gap: 8 }}>
              <div>
                Import du {new Date(catalogue.uploaded_at).toLocaleString('fr-FR')} —
                <strong> {catalogue.rows_valid}/{catalogue.rows_total}</strong> lignes valides
                <span style={{ marginLeft: 10 }}>
                  Statut : <strong>{catalogue.status}</strong>
                </span>
              </div>
              {Array.isArray(catalogue.rows_errors) && catalogue.rows_errors.length > 0 && (
                <details style={{ padding: 10, background: '#FDECEA', borderRadius: 10 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#D9342B' }}>
                    Voir {catalogue.rows_errors.length} erreur(s)
                  </summary>
                  <ul style={{ margin: 8, fontSize: 12, maxHeight: 180, overflowY: 'auto' }}>
                    {catalogue.rows_errors.slice(0, 30).map((e, i) => (
                      <li key={i}>
                        Ligne {e.row} {e.name ? `(${e.name})` : ''} : {(e.errors || []).join(', ')}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {catalogue.status !== 'approved' && catalogue.rows_valid > 0 && (
                <button style={btnPrimary} disabled={busy} onClick={() => onApproveCatalogue(catalogue.id)}>
                  Publier le catalogue ({catalogue.rows_valid} produits)
                </button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--y-n-500)' }}>Aucun catalogue importe.</div>
          )}
        </section>
      </aside>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const Th = ({ children }) => <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--y-n-600)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 800 }}>{children}</th>;
const Td = ({ children }) => <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>{children}</td>;

const StatCard = ({ label, value, accent = 'var(--y-n-900)' }) => (
  <div style={{ background: 'var(--y-n-0)', border: '1px solid var(--y-n-200)', borderRadius: 12, padding: 14 }}>
    <div style={{ fontSize: 11, color: 'var(--y-n-600)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900, color: accent, marginTop: 4 }}>{value}</div>
  </div>
);

const btnLight   = { padding: '7px 12px', border: '1px solid var(--y-n-300)', borderRadius: 8, background: 'var(--y-n-0)', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const btnPrimary = { padding: '7px 14px', border: 'none', borderRadius: 8, background: 'var(--y-brand)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' };
const btnGhost   = { padding: '7px 12px', border: 'none', background: 'transparent', color: 'var(--y-n-600)', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const btnDanger  = { padding: '7px 14px', border: 'none', borderRadius: 8, background: '#D9342B', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' };

const badgeOk    = { display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: '#EAF7F0', color: '#1F8B4C', fontSize: 11, fontWeight: 800 };
const badgeWarn  = { display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: '#FFF9E6', color: '#B78B00', fontSize: 11, fontWeight: 800 };
const badgeErr   = { display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: '#FDECEA', color: '#D9342B', fontSize: 11, fontWeight: 800 };
const badgeInfo  = { display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: '#EAF3FE', color: '#0066CC', fontSize: 11, fontWeight: 800 };
const badgeMuted = { display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: '#F1F3F1', color: '#666', fontSize: 11, fontWeight: 800 };

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 };
const overlayLoading = { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.6)', zIndex: 95 };
const drawerStyle = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)',
  background: 'var(--y-n-0)', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
  overflowY: 'auto', zIndex: 100, padding: 24,
};
const drawerHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 };
const sectionStyle = { borderTop: '1px solid var(--y-n-200)', padding: '18px 0' };
const h4Style = { margin: '0 0 12px', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--y-n-800)' };
const docRowStyle = { display: 'flex', gap: 10, padding: 12, border: '1px solid var(--y-n-200)', borderRadius: 10, alignItems: 'center', flexWrap: 'wrap' };
