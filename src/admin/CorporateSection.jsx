// ═══════════════════════════════════════════════════════════════
// Admin — Corporate Accounts B2B
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

function fmt(n) { return new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)); }

const STATUS_META = {
  pending_approval: { label: 'En attente', color: '#B78B00', bg: '#FFF9E6' },
  active: { label: 'Actif', color: '#1F8B4C', bg: '#EAF7F0' },
  suspended: { label: 'Suspendu', color: '#D9342B', bg: '#FDECEA' },
};

export default function CorporateSection() {
  const [rows, setRows] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tab, setTab] = useState('accounts');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [approveModal, setApproveModal] = useState(null);

  const load = async () => {
    setLoading(true);
    const [accRes, invRes] = await Promise.all([
      supabase.rpc('admin_corporate_list_all'),
      supabase.rpc('admin_corporate_list_invoices', { p_corp_id: null }),
    ]);
    if (accRes.error) toast.error('Erreur accounts : ' + accRes.error.message);
    if (invRes.error) toast.error('Erreur invoices : ' + invRes.error.message);
    setRows(accRes.data || []);
    setInvoices(invRes.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const s = { total: rows.length, pending: 0, active: 0, suspended: 0 };
    rows.forEach((r) => { if (s[r.status] !== undefined) s[r.status]++; });
    s.invoicesPending = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length;
    s.owed = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue')
      .reduce((sum, i) => sum + Number(i.amount_fcfa || 0), 0);
    return s;
  }, [rows, invoices]);

  const setStatus = async (id, status) => {
    const { data, error } = await supabase.rpc('admin_corporate_set_status', {
      p_id: id, p_status: status,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Statut mis a jour');
    load();
  };

  const markPaid = async (invId) => {
    const { data, error } = await supabase.rpc('admin_corporate_mark_invoice_paid', {
      p_invoice_id: invId,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Facture marquee payee');
    load();
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--y-n-900)' }}>
          Corporate B2B
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--y-n-600)', fontSize: 13 }}>
          Comptes entreprise (salons, spas, instituts) avec bulk pricing + ligne de credit.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Total comptes" value={stats.total} />
        <Kpi label="En attente" value={stats.pending} hi={stats.pending > 0} />
        <Kpi label="Actifs" value={stats.active} />
        <Kpi label="Factures en cours" value={stats.invoicesPending} />
        <Kpi label="Encours du" value={`${fmt(stats.owed)} FCFA`} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--y-n-200)', marginBottom: 16 }}>
        {['accounts', 'invoices'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent',
              borderBottom: tab === t ? '2px solid var(--y-brand)' : '2px solid transparent',
              color: tab === t ? 'var(--y-n-900)' : 'var(--y-n-600)',
              fontWeight: tab === t ? 800 : 500, cursor: 'pointer', fontSize: 14,
            }}
          >
            {t === 'accounts' ? `Comptes (${rows.length})` : `Factures (${invoices.length})`}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 20, color: 'var(--y-n-600)' }}>Chargement…</div>}

      {tab === 'accounts' && !loading && (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid var(--y-n-200)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--y-n-50)', textAlign: 'left' }}>
                <Th>Etablissement</Th>
                <Th>Type</Th>
                <Th>Contact</Th>
                <Th>Statut</Th>
                <Th>Credit</Th>
                <Th>Remise</Th>
                <Th>Terme</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.pending_approval;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--y-n-100)' }}>
                    <Td>
                      <div style={{ fontWeight: 700 }}>{r.legal_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--y-n-500)' }}>
                        {r.ninea || '—'} {r.rccm ? `· ${r.rccm}` : ''}
                      </div>
                    </Td>
                    <Td>{r.business_type || '—'}</Td>
                    <Td>
                      <div>{r.contact_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--y-n-500)' }}>{r.contact_phone}</div>
                      <div style={{ fontSize: 11, color: 'var(--y-n-500)' }}>{r.contact_email}</div>
                    </Td>
                    <Td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999,
                        fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
                        background: meta.bg, color: meta.color,
                      }}>{meta.label}</span>
                    </Td>
                    <Td>{fmt(r.credit_limit_fcfa)} FCFA</Td>
                    <Td>{r.discount_pct}%</Td>
                    <Td>{r.payment_terms_days}j</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {r.status === 'pending_approval' && (
                          <button className="btn-primary" style={btnPrim} onClick={() => setApproveModal(r)}>
                            Approuver
                          </button>
                        )}
                        {r.status === 'active' && (
                          <button style={btnGhost} onClick={() => setStatus(r.id, 'suspended')}>Suspendre</button>
                        )}
                        {r.status === 'suspended' && (
                          <button style={btnGhost} onClick={() => setStatus(r.id, 'active')}>Reactiver</button>
                        )}
                        <button style={btnGhost} onClick={() => setSelected(r)}>Details</button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--y-n-500)' }}>Aucun compte pour l instant</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'invoices' && !loading && (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid var(--y-n-200)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--y-n-50)', textAlign: 'left' }}>
                <Th>Numero</Th>
                <Th>Compte</Th>
                <Th>Date</Th>
                <Th>Echeance</Th>
                <Th>Montant</Th>
                <Th>Statut</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const acc = rows.find((r) => r.id === inv.corporate_id);
                const overdue = (inv.status === 'pending') && inv.due_date && new Date(inv.due_date) < new Date();
                const label = inv.status === 'paid' ? 'Payee'
                  : overdue ? 'En retard'
                  : inv.status === 'cancelled' ? 'Annulee'
                  : 'En attente';
                const bg = inv.status === 'paid' ? '#EAF7F0'
                  : overdue ? '#FDECEA'
                  : inv.status === 'cancelled' ? '#F3F4F6'
                  : '#FFF9E6';
                const col = inv.status === 'paid' ? '#1F8B4C'
                  : overdue ? '#D9342B'
                  : inv.status === 'cancelled' ? 'var(--y-n-600)'
                  : '#B78B00';
                return (
                  <tr key={inv.id} style={{ borderTop: '1px solid var(--y-n-100)' }}>
                    <Td><code style={{ fontSize: 12 }}>{inv.invoice_number}</code></Td>
                    <Td>{acc?.legal_name || '—'}</Td>
                    <Td>{new Date(inv.created_at).toLocaleDateString('fr-FR')}</Td>
                    <Td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '—'}</Td>
                    <Td style={{ fontWeight: 700 }}>{fmt(inv.amount_fcfa)} FCFA</Td>
                    <Td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999,
                        fontSize: 11, fontWeight: 800, background: bg, color: col,
                      }}>{label}</span>
                    </Td>
                    <Td>
                      {inv.status !== 'paid' && (
                        <button style={btnPrim} onClick={() => markPaid(inv.id)}>Marquer payee</button>
                      )}
                    </Td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--y-n-500)' }}>Aucune facture</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {approveModal && (
        <ApproveModal
          account={approveModal}
          onClose={() => setApproveModal(null)}
          onDone={() => { setApproveModal(null); load(); }}
        />
      )}

      {selected && (
        <DetailsModal account={selected} invoices={invoices.filter((i) => i.corporate_id === selected.id)} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function ApproveModal({ account, onClose, onDone }) {
  const [creditLimit, setCreditLimit] = useState(account.credit_limit_fcfa || 500000);
  const [discount, setDiscount] = useState(account.discount_pct || 15);
  const [terms, setTerms] = useState(account.payment_terms_days || 30);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc('admin_corporate_approve', {
      p_id: account.id,
      p_credit_limit: Number(creditLimit) || 0,
      p_discount_pct: Number(discount) || 15,
      p_payment_terms: Number(terms) || 30,
    });
    setSaving(false);
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Compte approuve');
    onDone();
  };

  return (
    <div style={overlay}>
      <div style={modalCard}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Approuver {account.legal_name}</h2>
        <p style={{ margin: '4px 0 16px', color: 'var(--y-n-600)', fontSize: 13 }}>
          Definis remise, ligne de credit et terme de paiement.
        </p>
        <FieldGroup label="Ligne de credit (FCFA)">
          <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} style={inputCss} />
        </FieldGroup>
        <FieldGroup label="Remise (%)">
          <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} style={inputCss} />
        </FieldGroup>
        <FieldGroup label="Terme paiement (jours)">
          <input type="number" value={terms} onChange={(e) => setTerms(e.target.value)} style={inputCss} />
        </FieldGroup>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button style={btnGhost} onClick={onClose}>Annuler</button>
          <button style={btnPrim} onClick={submit} disabled={saving}>{saving ? 'Enregistrement…' : 'Approuver'}</button>
        </div>
      </div>
    </div>
  );
}

function DetailsModal({ account, invoices, onClose }) {
  return (
    <div style={overlay}>
      <div style={{ ...modalCard, maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{account.legal_name}</h2>
            <p style={{ margin: '4px 0 12px', color: 'var(--y-n-600)', fontSize: 13 }}>
              {account.business_type || '—'} · {account.city || ''}
            </p>
          </div>
          <button onClick={onClose} style={btnGhost}>Fermer</button>
        </div>
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          <Row k="NINEA" v={account.ninea || '—'} />
          <Row k="RCCM" v={account.rccm || '—'} />
          <Row k="Contact" v={account.contact_name} />
          <Row k="Telephone" v={account.contact_phone} />
          <Row k="Email" v={account.contact_email} />
          <Row k="Adresse" v={JSON.stringify(account.address || {})} />
          <Row k="Message" v={account.message || '—'} />
          <Row k="Credit / remise / terme" v={`${fmt(account.credit_limit_fcfa)} FCFA · ${account.discount_pct}% · ${account.payment_terms_days}j`} />
          <Row k="Cree le" v={new Date(account.created_at).toLocaleString('fr-FR')} />
          <Row k="Approuve le" v={account.approved_at ? new Date(account.approved_at).toLocaleString('fr-FR') : '—'} />
        </div>
        <h3 style={{ margin: '20px 0 8px', fontSize: 14, fontWeight: 800 }}>Factures ({invoices.length})</h3>
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--y-n-200)', borderRadius: 8 }}>
          {invoices.length === 0 && <div style={{ padding: 12, color: 'var(--y-n-500)', fontSize: 12 }}>Aucune facture.</div>}
          {invoices.map((i) => (
            <div key={i.id} style={{ padding: '8px 12px', borderTop: '1px solid var(--y-n-100)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{i.invoice_number}</span>
              <span>{fmt(i.amount_fcfa)} FCFA</span>
              <span>{i.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--y-n-600)', marginBottom: 4, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ color: 'var(--y-n-500)', minWidth: 160, fontSize: 12 }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}
function Kpi({ label, value, hi }) {
  return (
    <div style={{
      padding: 16, background: hi ? '#FFF9E6' : '#fff',
      border: `1px solid ${hi ? '#FDE68A' : 'var(--y-n-200)'}`, borderRadius: 12,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--y-n-900)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--y-n-600)' }}>{label}</div>
    </div>
  );
}
const Th = ({ children }) => <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--y-n-500)', fontWeight: 700 }}>{children}</th>;
const Td = ({ children, style }) => <td style={{ padding: '10px 12px', ...(style || {}) }}>{children}</td>;

const btnPrim = {
  padding: '6px 14px', background: 'var(--y-n-900)', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
};
const btnGhost = {
  padding: '6px 14px', background: '#fff', color: 'var(--y-n-900)',
  border: '1px solid var(--y-n-300)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
};
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalCard = {
  background: '#fff', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto',
};
const inputCss = {
  width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--y-n-300)',
  fontSize: 14, boxSizing: 'border-box',
};
