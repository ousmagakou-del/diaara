// ═══════════════════════════════════════════════════════════════
// Admin — Candidatures Partenaires (Pharmacies)
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getAdminToken } from '../lib/adminAuth';
import { toast } from '../lib/toast';
import { adminLogAction } from '../lib/adminApi';

const STATUS = [
  { id: 'new',        label: 'Nouveau',         color: '#0066CC', bg: '#EAF3FE' },
  { id: 'contacted',  label: 'En discussion',   color: '#B78B00', bg: '#FFF9E6' },
  { id: 'onboarding', label: 'Contrat envoyé',  color: '#6D28D9', bg: '#F0EBFA' },
  { id: 'signed',     label: 'Signée',          color: '#1F8B4C', bg: '#EAF7F0' },
  { id: 'refused',    label: 'Refusée',         color: '#D9342B', bg: '#FDECEA' },
  { id: 'archived',   label: 'Archivée',        color: '#6B7280', bg: '#F3F4F6' },
];
const statusMeta = (id) => STATUS.find(s => s.id === id) || STATUS[0];

export default function PartnerApplicationsSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) { toast.error('Session admin expirée'); setLoading(false); return; }
    const { data, error } = await supabase.rpc('admin_list_partner_applications', {
      p_admin_token: token,
      p_status: filterStatus === 'all' ? null : filterStatus,
    });
    if (error) toast.error('Erreur : ' + error.message);
    setRows(data?.applications || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filterStatus]);

  const cities = useMemo(() => {
    const set = new Set(rows.map(r => r.city).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const dateThreshold = filterDate === '7d' ? now - 7 * 86400000
                       : filterDate === '30d' ? now - 30 * 86400000 : 0;
    return rows.filter(r => {
      if (filterCity !== 'all' && r.city !== filterCity) return false;
      if (dateThreshold && new Date(r.created_at).getTime() < dateThreshold) return false;
      if (q && !(
        (r.pharmacy_name || '').toLowerCase().includes(q) ||
        (r.owner_name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [rows, filterCity, filterDate, search]);

  const stats = useMemo(() => {
    const s = { total: rows.length, new: 0, contacted: 0, signed: 0 };
    rows.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [rows]);

  const updateStatus = async (row, newStatus) => {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_update_partner_application', {
      p_admin_token: token, p_application_id: row.id, p_status: newStatus,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Statut mis à jour');
    adminLogAction({
      action: 'partner_application_status_change',
      targetType: 'partner_application', targetId: row.id,
      before: { status: row.status }, after: { status: newStatus },
    }).catch(() => {});
    load();
    if (selected?.id === row.id) setSelected({ ...selected, status: newStatus });
  };

  const saveNotes = async (row, notes) => {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_update_partner_application', {
      p_admin_token: token, p_application_id: row.id, p_admin_notes: notes,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Notes enregistrées');
    adminLogAction({
      action: 'partner_application_notes_update',
      targetType: 'partner_application', targetId: row.id,
    }).catch(() => {});
    load();
  };

  const sendContract = async (row) => {
    if (!row.email) { toast.error("Pas d'email pour envoyer le contrat"); return; }
    setSending(true);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_create_signature_request', {
      p_admin_token: token,
      p_template_id: 'pharmacy_v1',
      p_recipient_name: row.pharmacy_name,
      p_recipient_email: row.email,
      p_recipient_phone: row.phone,
      p_prefilled_fields: {
        PHARMACY_NAME: row.pharmacy_name || '',
        PHARMACY_ADDRESS: row.address || row.city || '',
        PHARMACY_NINEA: row.ninea || '',
        PHARMACIST_NAME: row.owner_name || '',
      },
      p_admin_message: `Suite à votre candidature reçue le ${new Date(row.created_at).toLocaleDateString('fr-FR')}, voici le contrat de partenariat YARAM à signer. Contactez-nous pour toute question.`,
    });
    if (error || !data?.success) {
      setSending(false);
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    await supabase.functions.invoke('send-signature-email', {
      body: {
        token: data.token, sign_url: data.sign_url,
        recipient_name: row.pharmacy_name, recipient_email: row.email,
        template_name: 'Contrat partenariat Pharmacie',
        admin_message: `Suite à votre candidature du ${new Date(row.created_at).toLocaleDateString('fr-FR')}, voici le contrat.`,
      },
    }).catch(() => {});
    await supabase.rpc('admin_update_partner_application', {
      p_admin_token: token, p_application_id: row.id, p_status: 'onboarding',
    });
    adminLogAction({
      action: 'partner_contract_sent',
      targetType: 'partner_application', targetId: row.id,
      after: { signature_token: data.token },
    }).catch(() => {});
    setSending(false);
    toast.success('Contrat envoyé à ' + row.email);
    load();
    setSelected(null);
  };

  const exportCsv = () => {
    const headers = ['Date', 'Pharmacie', 'Gérant', 'Ville', 'Téléphone', 'Email', 'NINEA', 'Commandes/mois', 'Statut', 'Notes'];
    const csv = [headers.join(',')].concat(
      filtered.map(r => [
        new Date(r.created_at).toLocaleDateString('fr-FR'),
        r.pharmacy_name, r.owner_name, r.city, r.phone, r.email || '',
        r.ninea || '', r.monthly_orders_estimate || '',
        r.status, (r.admin_notes || '').replace(/[\r\n"]/g, ' '),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `candidatures_partenaires_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    adminLogAction({ action: 'partner_applications_export_csv', after: { rows: filtered.length } }).catch(() => {});
  };

  return (
    <div style={{ padding: '24px 28px 60px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
          Candidatures partenaires
        </h2>
        <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 14 }}>
          Pharmacies qui postulent pour rejoindre le réseau YARAM.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total" value={stats.total} color="#0A0A0A" />
        <StatCard label="Nouvelles" value={stats.new} color="#0066CC" />
        <StatCard label="En discussion" value={stats.contacted} color="#B78B00" />
        <StatCard label="Signées" value={stats.signed} color="#1F8B4C" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterStyle}>
          <option value="all">Tous statuts</option>
          {STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={filterStyle}>
          {cities.map(c => <option key={c} value={c}>{c === 'all' ? 'Toutes villes' : c}</option>)}
        </select>
        <select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={filterStyle}>
          <option value="all">Toute période</option>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
        </select>
        <input
          type="text" placeholder="Recherche (nom, gérant, phone, email)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: '9px 14px', border: '1px solid #E5E4DC', borderRadius: 10, fontSize: 13 }}
        />
        <button onClick={exportCsv} style={btnLight}>Exporter CSV</button>
        <button onClick={load} style={btnLight}>Rafraîchir</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E4DC', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Aucune candidature</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#FAFAF7' }}>
                <tr>
                  <Th>Date</Th><Th>Pharmacie</Th><Th>Gérant</Th><Th>Ville</Th>
                  <Th>NINEA</Th><Th>Cmdes/mois</Th><Th>Statut</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const meta = statusMeta(r.status);
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #F0F0EE', cursor: 'pointer' }}
                        onClick={() => setSelected(r)}>
                      <Td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</Td>
                      <Td>
                        <div style={{ fontWeight: 800 }}>{r.pharmacy_name}</div>
                        {r.email && <div style={{ fontSize: 11, color: '#6B7280' }}>{r.email}</div>}
                      </Td>
                      <Td>
                        <div>{r.owner_name}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{r.phone}</div>
                      </Td>
                      <Td>{r.city || '—'}</Td>
                      <Td>{r.ninea || '—'}</Td>
                      <Td>{r.monthly_orders_estimate || '—'}</Td>
                      <Td>
                        <select
                          value={r.status}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateStatus(r, e.target.value)}
                          style={{
                            padding: '4px 8px', border: 'none', borderRadius: 999,
                            background: meta.bg, color: meta.color, fontSize: 11,
                            fontWeight: 800, cursor: 'pointer',
                          }}
                        >
                          {STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </Td>
                      <Td>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(r); }}
                          style={btnLight}
                        >Détails</button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Drawer
          row={selected}
          onClose={() => setSelected(null)}
          onSaveNotes={notes => saveNotes(selected, notes)}
          onSendContract={() => sendContract(selected)}
          onStatusChange={newStatus => updateStatus(selected, newStatus)}
          sending={sending}
        />
      )}
    </div>
  );
}

function Drawer({ row, onClose, onSaveNotes, onSendContract, onStatusChange, sending }) {
  const [notes, setNotes] = useState(row.admin_notes || '');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 560, background: '#fff', height: '100%',
        overflowY: 'auto', padding: 32, boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
              Candidature partenaire
            </div>
            <h3 style={{ margin: '4px 0 6px', fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>
              {row.pharmacy_name}
            </h3>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              Reçue le {new Date(row.created_at).toLocaleString('fr-FR')}
            </div>
          </div>
          <button onClick={onClose} style={btnLight}>Fermer</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', marginBottom: 8, letterSpacing: 0.3, textTransform: 'uppercase' }}>Statut</div>
          <select value={row.status} onChange={e => onStatusChange(e.target.value)} style={{ ...filterStyle, width: '100%' }}>
            {STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        <DetailBlock label="Gérant" value={row.owner_name} />
        <DetailBlock label="Téléphone" value={row.phone} />
        <DetailBlock label="Email" value={row.email || '—'} />
        <DetailBlock label="Ville" value={row.city || '—'} />
        <DetailBlock label="Adresse" value={row.address || '—'} />
        <DetailBlock label="NINEA" value={row.ninea || '—'} />
        <DetailBlock label="Commandes/mois estimées" value={row.monthly_orders_estimate || '—'} />
        <DetailBlock label="Message du candidat" value={row.message || '—'} multi />

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', marginBottom: 8, letterSpacing: 0.3, textTransform: 'uppercase' }}>Notes internes</div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #E5E4DC', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            placeholder="Notes visibles uniquement en interne"
          />
          <button onClick={() => onSaveNotes(notes)} style={{ ...btnLight, marginTop: 8 }}>Enregistrer les notes</button>
        </div>

        <div style={{ marginTop: 28, padding: 20, background: '#FAFAF7', borderRadius: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Envoyer le contrat de partenariat</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            Génère un lien de signature électronique pré-rempli avec les informations de la candidature.
            Le statut passera automatiquement à "Contrat envoyé".
          </p>
          <button
            onClick={onSendContract}
            disabled={sending || !row.email}
            style={{
              width: '100%', padding: '12px 20px', background: row.email ? '#0A0A0A' : '#C0C0C0',
              color: '#fff', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 13,
              cursor: row.email && !sending ? 'pointer' : 'not-allowed',
            }}
          >
            {!row.email ? "Email manquant" : sending ? 'Envoi en cours…' : 'Envoyer le contrat à signer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ label, value, multi }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #F0F0EE' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#0A0A0A', whiteSpace: multi ? 'pre-wrap' : 'normal', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E4DC', borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 4, letterSpacing: '-1px' }}>{value}</div>
    </div>
  );
}

const Th = ({ children }) => <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 900, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{children}</th>;
const Td = ({ children }) => <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{children}</td>;
const filterStyle = { padding: '9px 12px', border: '1px solid #E5E4DC', borderRadius: 10, fontSize: 13, background: '#fff', fontFamily: 'inherit' };
const btnLight = { padding: '8px 14px', background: '#F4F4F2', border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#0A0A0A', whiteSpace: 'nowrap', fontFamily: 'inherit' };
