// ═══════════════════════════════════════════════════════════════
// Admin — Candidatures Livreurs
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getAdminToken } from '../lib/adminAuth';
import { toast } from '../lib/toast';
import { adminLogAction } from '../lib/adminApi';

const STATUS = [
  { id: 'new',       label: 'Nouveau',     color: '#0066CC', bg: '#EAF3FE' },
  { id: 'contacted', label: 'Contacté',    color: '#B78B00', bg: '#FFF9E6' },
  { id: 'interview', label: 'Entretien',   color: '#6D28D9', bg: '#F0EBFA' },
  { id: 'trial',     label: 'À l\'essai',  color: '#DD6B20', bg: '#FEEDD3' },
  { id: 'hired',     label: 'Recruté',     color: '#1F8B4C', bg: '#EAF7F0' },
  { id: 'refused',   label: 'Refusé',      color: '#D9342B', bg: '#FDECEA' },
  { id: 'archived',  label: 'Archivé',     color: '#6B7280', bg: '#F3F4F6' },
];
const VEHICLE_LABELS = { moto: 'Moto', scooter: 'Scooter', velo: 'Vélo', voiture: 'Voiture', other: 'Autre' };
const statusMeta = (id) => STATUS.find(s => s.id === id) || STATUS[0];

export default function DriverApplicationsSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVehicle, setFilterVehicle] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [onboarding, setOnboarding] = useState(false);

  const load = async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) { toast.error('Session admin expirée'); setLoading(false); return; }
    const { data, error } = await supabase.rpc('admin_list_driver_applications', {
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
    return rows.filter(r => {
      if (filterCity !== 'all' && r.city !== filterCity) return false;
      if (filterVehicle !== 'all' && r.vehicle_type !== filterVehicle) return false;
      if (q && !(
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [rows, filterCity, filterVehicle, search]);

  const stats = useMemo(() => {
    const s = { total: rows.length, new: 0, interview: 0, hired: 0 };
    rows.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [rows]);

  const updateStatus = async (row, newStatus) => {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_update_driver_application', {
      p_admin_token: token, p_application_id: row.id, p_status: newStatus,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Statut mis à jour');
    adminLogAction({
      action: 'driver_application_status_change',
      targetType: 'driver_application', targetId: row.id,
      before: { status: row.status }, after: { status: newStatus },
    }).catch(() => {});
    load();
    if (selected?.id === row.id) setSelected({ ...selected, status: newStatus });
  };

  const saveNotes = async (row, notes) => {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_update_driver_application', {
      p_admin_token: token, p_application_id: row.id, p_admin_notes: notes,
    });
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message));
      return;
    }
    toast.success('Notes enregistrées');
    adminLogAction({
      action: 'driver_application_notes_update',
      targetType: 'driver_application', targetId: row.id,
    }).catch(() => {});
    load();
  };

  // Onboarding : passe le status à 'hired' et envoie un email d'accueil
  const onboardDriver = async (row) => {
    if (!row.email && !row.phone) {
      toast.error("Ni email ni téléphone : impossible d'envoyer les instructions");
      return;
    }
    setOnboarding(true);
    const token = getAdminToken();

    await supabase.rpc('admin_update_driver_application', {
      p_admin_token: token, p_application_id: row.id, p_status: 'hired',
    });

    // Best-effort email — utilise le send-email edge function
    if (row.email) {
      const subject = 'YARAM Livreur — Bienvenue dans la flotte';
      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,'Inter',sans-serif;background:#EEEDE8;padding:32px 16px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#1F8B4C,#166635);padding:32px;color:#fff;">
    <div style="font-size:20px;font-weight:900;">YARAM Livreur</div>
    <div style="font-size:12px;opacity:0.8;margin-top:4px;">Édité par KOMUNITY SENEGAL</div>
  </div>
  <div style="padding:32px;">
    <h1 style="margin:0 0 12px;font-size:26px;color:#0A0A0A;letter-spacing:-0.5px;">Bienvenue ${row.full_name}</h1>
    <p style="font-size:15px;line-height:1.6;color:#4B5563;">
      Ta candidature est acceptée. Voici les prochaines étapes pour démarrer tes livraisons YARAM.
    </p>
    <div style="background:#FAFAF7;border-radius:14px;padding:20px;margin:20px 0;">
      <div style="font-size:12px;font-weight:800;color:#6B7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Étapes suivantes</div>
      <div style="font-size:14px;color:#0A0A0A;line-height:1.7;">
        <div>1. Contacte-nous au +221 77 438 87 66 pour convenir d'un rendez-vous d'onboarding.</div>
        <div>2. Apporte ta CNI, ton permis (si applicable) et un justificatif de véhicule.</div>
        <div>3. Nous te remettrons ton contrat de prestation à signer en ligne.</div>
        <div>4. Formation de 30 minutes sur l'application livreur.</div>
        <div>5. Premier créneau disponible sous 5 jours.</div>
      </div>
    </div>
    <p style="font-size:13px;color:#6B7280;line-height:1.6;">
      Une question ? Réponds à cet email ou écris-nous sur WhatsApp au +221 77 438 87 66.
    </p>
  </div>
  <div style="padding:20px 32px;border-top:1px solid #F0F0EE;font-size:11px;color:#9CA3AF;text-align:center;">
    KOMUNITY SENEGAL · NINEA 008771116 · RCCM SN.DKR.2021.A.26292
  </div>
</div>
</body></html>`;
      await supabase.functions.invoke('send-email', {
        body: { to: row.email, subject, html, replyTo: 'livreurs@yaram.app' },
      }).catch(() => {});
    }

    adminLogAction({
      action: 'driver_application_onboarded',
      targetType: 'driver_application', targetId: row.id,
      after: { email_sent: !!row.email },
    }).catch(() => {});

    setOnboarding(false);
    toast.success(row.email ? 'Livreur onboardé — email envoyé' : 'Livreur onboardé — pense à le contacter');
    load();
    setSelected(null);
  };

  const exportCsv = () => {
    const headers = ['Date', 'Nom', 'Téléphone', 'Email', 'Ville', 'Quartier', 'Véhicule', 'Marque', 'CNI', 'Heures/sem', 'Smartphone', 'Statut', 'Notes'];
    const csv = [headers.join(',')].concat(
      filtered.map(r => [
        new Date(r.created_at).toLocaleDateString('fr-FR'),
        r.full_name, r.phone, r.email || '', r.city, r.neighborhood || '',
        VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type,
        r.vehicle_brand || '', r.cni || '', r.hours_per_week || '',
        r.has_smartphone ? 'Oui' : 'Non', r.status,
        (r.admin_notes || '').replace(/[\r\n"]/g, ' '),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `candidatures_livreurs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    adminLogAction({ action: 'driver_applications_export_csv', after: { rows: filtered.length } }).catch(() => {});
  };

  return (
    <div style={{ padding: '24px 28px 60px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
          Candidatures livreurs
        </h2>
        <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 14 }}>
          Postulants pour rejoindre la flotte YARAM.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total" value={stats.total} color="#0A0A0A" />
        <StatCard label="Nouveaux" value={stats.new} color="#0066CC" />
        <StatCard label="En entretien" value={stats.interview} color="#6D28D9" />
        <StatCard label="Recrutés" value={stats.hired} color="#1F8B4C" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterStyle}>
          <option value="all">Tous statuts</option>
          {STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} style={filterStyle}>
          <option value="all">Tous véhicules</option>
          {Object.entries(VEHICLE_LABELS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
        </select>
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={filterStyle}>
          {cities.map(c => <option key={c} value={c}>{c === 'all' ? 'Toutes villes' : c}</option>)}
        </select>
        <input
          type="text" placeholder="Recherche (nom, phone, email, ville)"
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
                  <Th>Date</Th><Th>Nom</Th><Th>Téléphone</Th><Th>Véhicule</Th>
                  <Th>Ville</Th><Th>Heures/sem</Th><Th>Statut</Th><Th>Actions</Th>
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
                        <div style={{ fontWeight: 800 }}>{r.full_name}</div>
                        {r.email && <div style={{ fontSize: 11, color: '#6B7280' }}>{r.email}</div>}
                      </Td>
                      <Td>{r.phone}</Td>
                      <Td>{VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type}</Td>
                      <Td>
                        <div>{r.city || '—'}</div>
                        {r.neighborhood && <div style={{ fontSize: 11, color: '#6B7280' }}>{r.neighborhood}</div>}
                      </Td>
                      <Td>{r.hours_per_week || '—'}</Td>
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
          onOnboard={() => onboardDriver(selected)}
          onStatusChange={newStatus => updateStatus(selected, newStatus)}
          onboarding={onboarding}
        />
      )}
    </div>
  );
}

function Drawer({ row, onClose, onSaveNotes, onOnboard, onStatusChange, onboarding }) {
  const [notes, setNotes] = useState(row.admin_notes || '');
  const estimatedMonthly = row.hours_per_week ? (4500 * row.hours_per_week * 4) : null;

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
              Candidature livreur
            </div>
            <h3 style={{ margin: '4px 0 6px', fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>
              {row.full_name}
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

        <DetailBlock label="Téléphone" value={row.phone} />
        <DetailBlock label="Email" value={row.email || '—'} />
        <DetailBlock label="Ville" value={row.city} />
        <DetailBlock label="Quartier" value={row.neighborhood || '—'} />
        <DetailBlock label="Véhicule" value={`${VEHICLE_LABELS[row.vehicle_type] || row.vehicle_type}${row.vehicle_brand ? ' — ' + row.vehicle_brand : ''}`} />
        <DetailBlock label="CNI" value={row.cni || '—'} />
        <DetailBlock label="Permis" value={row.license_number || '—'} />
        <DetailBlock label="Date de naissance" value={row.birth_date || '—'} />
        <DetailBlock label="Disponibilité déclarée" value={row.hours_per_week ? `${row.hours_per_week}h / semaine` : '—'} />
        {estimatedMonthly && (
          <DetailBlock
            label="Revenu potentiel estimé"
            value={`${estimatedMonthly.toLocaleString('fr-FR')} FCFA / mois (base 3 courses/h × 1 500 FCFA)`}
          />
        )}
        <DetailBlock label="Smartphone" value={row.has_smartphone ? 'Oui' : 'Non'} />
        <DetailBlock label="Motivation" value={row.motivation || '—'} multi />

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
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Approuver et lancer l'onboarding</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            Passe le statut à "Recruté" et envoie un email d'accueil avec les étapes suivantes
            (rendez-vous, documents, contrat, formation).
          </p>
          <button
            onClick={onOnboard}
            disabled={onboarding}
            style={{
              width: '100%', padding: '12px 20px', background: '#0A0A0A',
              color: '#fff', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 13,
              cursor: onboarding ? 'not-allowed' : 'pointer', opacity: onboarding ? 0.6 : 1,
            }}
          >
            {onboarding ? 'Envoi en cours…' : 'Approuver et onboarder'}
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
