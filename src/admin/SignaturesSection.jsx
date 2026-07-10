// ═══════════════════════════════════════════════════════════════
// Admin — Signatures (DocuSign-lite pour YARAM)
// ═══════════════════════════════════════════════════════════════
//
// Permet à l'admin de :
//   - Voir les templates disponibles (contrat pharmacie, livreur, etc.)
//   - Créer une demande de signature (destinataire + prefill + message)
//   - Suivre le statut : pending → viewed → signed
//   - Copier le lien / renvoyer l'email
//   - Consulter le contrat signé (HTML final)
//
// RPCs (SECURITY DEFINER, token requis) :
//   admin_list_signature_templates(p_admin_token)
//   admin_list_signature_requests(p_admin_token, p_status)
//   admin_create_signature_request(p_admin_token, p_template_id,
//     p_recipient_name, p_recipient_email, p_recipient_phone,
//     p_prefilled_fields, p_admin_message)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getAdminToken } from '../lib/adminAuth';
import { toast, confirmDialog } from '../lib/toast';

const STATUS_META = {
  pending:   { label: '📤 En attente',   color: '#F4B53A', bg: '#FFF9E6' },
  viewed:    { label: '👀 Vu',           color: '#0066CC', bg: '#EAF3FE' },
  signed:    { label: '✅ Signé',        color: '#1F8B4C', bg: '#EAF7F0' },
  expired:   { label: '⏰ Expiré',       color: '#6B7280', bg: '#F3F4F6' },
  declined:  { label: '❌ Refusé',       color: '#D9342B', bg: '#FDECEA' },
  cancelled: { label: '🚫 Annulé',       color: '#6B7280', bg: '#F3F4F6' },
};

export default function SignaturesSection() {
  const [templates, setTemplates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewSigned, setViewSigned] = useState(null);

  // Nouveau formulaire
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [recipient, setRecipient] = useState({ name: '', email: '', phone: '' });
  const [prefill, setPrefill] = useState({});
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);

  const load = async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) {
      toast.error('Session admin requise');
      setLoading(false);
      return;
    }

    const [tplRes, reqRes] = await Promise.all([
      supabase.rpc('admin_list_signature_templates', { p_admin_token: token }),
      supabase.rpc('admin_list_signature_requests', {
        p_admin_token: token,
        p_status: filter === 'all' ? null : filter,
      }),
    ]);

    if (tplRes.error) toast.error('Erreur templates : ' + tplRes.error.message);
    else if (tplRes.data?.templates) setTemplates(tplRes.data.templates);

    if (reqRes.error) toast.error('Erreur demandes : ' + reqRes.error.message);
    else if (reqRes.data?.requests) setRequests(reqRes.data.requests);

    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(r =>
      (r.recipient_name || '').toLowerCase().includes(q) ||
      (r.recipient_email || '').toLowerCase().includes(q) ||
      (r.template_name || '').toLowerCase().includes(q)
    );
  }, [requests, search]);

  const stats = useMemo(() => {
    const s = { total: requests.length, pending: 0, viewed: 0, signed: 0 };
    requests.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [requests]);

  const openCreate = (tpl) => {
    setSelectedTemplate(tpl);
    setRecipient({ name: '', email: '', phone: '' });
    // Init prefill avec les clés du schema
    const initPrefill = {};
    (tpl.fields_schema || []).forEach(f => { initPrefill[f.key] = ''; });
    setPrefill(initPrefill);
    setMessage('');
    setCreatedLink(null);
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    if (!recipient.name.trim() || !recipient.email.trim()) {
      toast.error('Nom et email obligatoires');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(recipient.email)) {
      toast.error('Email invalide');
      return;
    }

    setCreating(true);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_create_signature_request', {
      p_admin_token: token,
      p_template_id: selectedTemplate.id,
      p_recipient_name: recipient.name.trim(),
      p_recipient_email: recipient.email.trim().toLowerCase(),
      p_recipient_phone: recipient.phone.trim() || null,
      p_prefilled_fields: prefill,
      p_admin_message: message.trim() || null,
    });
    setCreating(false);

    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message || 'inconnue'));
      return;
    }

    setCreatedLink(data.sign_url);
    toast.success('Demande créée ✓ Email envoyé au destinataire');
    load();

    // Déclenche l'envoi de l'email via edge function
    try {
      await supabase.functions.invoke('send-signature-email', {
        body: {
          request_id: data.id,
          token: data.token,
          sign_url: data.sign_url,
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          template_name: selectedTemplate.name,
          admin_message: message,
        },
      });
    } catch (fnErr) {
      console.warn('[signatures] send-signature-email failed (non-blocking):', fnErr);
      toast.info('Lien créé — envoi email peut être manuel');
    }
  };

  const copyLink = (url) => {
    navigator.clipboard?.writeText(url);
    toast.success('Lien copié ✓');
  };

  const resendEmail = async (r) => {
    const ok = await confirmDialog({
      title: 'Renvoyer l\'email ?',
      body: `Renvoyer le lien de signature à ${r.recipient_email} ?`,
      okLabel: 'Renvoyer',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.functions.invoke('send-signature-email', {
        body: {
          request_id: r.id,
          token: r.token,
          sign_url: `https://yaram.app/sign/${r.token}`,
          recipient_name: r.recipient_name,
          recipient_email: r.recipient_email,
          template_name: r.template_name,
          admin_message: r.admin_message,
          is_reminder: true,
        },
      });
      if (error) throw error;
      toast.success('Email renvoyé ✓');
    } catch (e) {
      toast.error('Envoi impossible : ' + (e.message || 'inconnu'));
    }
  };

  // ═════════════════════════════════════════════════════════════
  // Render : viewSigned (contrat signé fullscreen)
  // ═════════════════════════════════════════════════════════════
  if (viewSigned) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>{viewSigned.template_name}</h2>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
              Signé par <strong>{viewSigned.recipient_name}</strong> · {new Date(viewSigned.signed_at).toLocaleString('fr-FR')}
            </div>
          </div>
          <button
            onClick={() => setViewSigned(null)}
            style={{ padding: '10px 18px', background: '#F4F4F2', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 700 }}
          >
            ← Retour
          </button>
        </div>
        <div
          style={{ background: '#fff', border: '1px solid #E5E4DC', borderRadius: 16, padding: 32, boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}
          dangerouslySetInnerHTML={{ __html: viewSigned.signed_html || '<p>Pas de contenu signé.</p>' }}
        />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // Render principal
  // ═════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '24px 28px 60px' }}>
      {/* Header + stats */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
          ✍️ Signatures électroniques
        </h2>
        <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 14 }}>
          Envoie des contrats à signer en ligne (pharmacies, livreurs, distributeurs). Style DocuSign.
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total envoyés" value={stats.total} color="#0A0A0A" />
        <StatCard label="En attente" value={stats.pending} color="#F4B53A" />
        <StatCard label="Vus" value={stats.viewed} color="#0066CC" />
        <StatCard label="✅ Signés" value={stats.signed} color="#1F8B4C" />
      </div>

      {/* Templates disponibles */}
      <div style={{ background: '#fff', border: '1px solid #E5E4DC', borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: '#6B7280', marginBottom: 12 }}>
          📄 CONTRATS DISPONIBLES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {templates.length === 0 && !loading && (
            <div style={{ padding: 20, color: '#9CA3AF', fontStyle: 'italic' }}>
              Aucun template actif. Ajoute-en via SQL (table signature_templates).
            </div>
          )}
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              style={{
                padding: 16, background: '#FAFAF7', border: '1px solid #E5E4DC',
                borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1F8B4C'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E4DC'; e.currentTarget.style.transform = 'translateY(0)'; }}
              onClick={() => openCreate(tpl)}
            >
              <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>{tpl.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                {tpl.category}
              </div>
              <button
                style={{
                  width: '100%', padding: '10px 14px', background: '#1F8B4C', color: '#fff',
                  border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                }}
              >
                + Envoyer à signer
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filtres + Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {['all', 'pending', 'viewed', 'signed', 'expired'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: filter === s ? '#0A0A0A' : '#F4F4F2',
              color: filter === s ? '#fff' : '#0A0A0A',
              fontWeight: 800, fontSize: 12,
            }}
          >
            {s === 'all' ? 'Tous' : STATUS_META[s]?.label || s}
          </button>
        ))}
        <input
          type="text"
          placeholder="Rechercher (nom, email, contrat)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '10px 14px', border: '1px solid #E5E4DC',
            borderRadius: 10, fontSize: 13, background: '#fff',
          }}
        />
      </div>

      {/* Table demandes */}
      <div style={{ background: '#fff', border: '1px solid #E5E4DC', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
            Aucune demande {filter !== 'all' && `(${STATUS_META[filter]?.label})`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#FAFAF7', position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <Th>Destinataire</Th>
                  <Th>Contrat</Th>
                  <Th>Statut</Th>
                  <Th>Envoyé</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status] || STATUS_META.pending;
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #F0F0EE' }}>
                      <Td>
                        <div style={{ fontWeight: 800 }}>{r.recipient_name}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{r.recipient_email}</div>
                      </Td>
                      <Td>{r.template_name}</Td>
                      <Td>
                        <span style={{
                          padding: '4px 10px', background: meta.bg, color: meta.color,
                          borderRadius: 999, fontSize: 11, fontWeight: 800,
                        }}>
                          {meta.label}
                        </span>
                        {r.signed_at && (
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                            {new Date(r.signed_at).toLocaleString('fr-FR')}
                          </div>
                        )}
                      </Td>
                      <Td style={{ color: '#6B7280', fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {r.status === 'signed' ? (
                            <button
                              onClick={() => setViewSigned(r)}
                              style={btnStyle('#1F8B4C', '#fff')}
                            >
                              👁 Voir signé
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => copyLink(`https://yaram.app/sign/${r.token}`)}
                                style={btnStyle('#F4F4F2', '#0A0A0A')}
                              >
                                📋 Copier lien
                              </button>
                              <button
                                onClick={() => resendEmail(r)}
                                style={btnStyle('#1F8B4C', '#fff')}
                              >
                                ✉️ Renvoyer
                              </button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ Modal création ═══ */}
      {showCreate && selectedTemplate && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 20, maxWidth: 560, width: '100%',
              maxHeight: '90vh', overflowY: 'auto', padding: 32, boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {createdLink ? (
              // ═ Succès : lien créé ═
              <div>
                <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>✅</div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, textAlign: 'center', marginBottom: 8 }}>
                  Demande envoyée !
                </h2>
                <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>
                  L'email a été envoyé à <strong>{recipient.email}</strong>.
                  Voici aussi le lien direct :
                </p>
                <div style={{
                  padding: 14, background: '#F5FBF7', border: '1px solid #DFF0E6',
                  borderRadius: 12, fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace',
                  marginBottom: 16,
                }}>
                  {createdLink}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => copyLink(createdLink)}
                    style={{ flex: 1, padding: '14px 20px', background: '#F4F4F2', border: 'none', borderRadius: 999, fontWeight: 800, cursor: 'pointer' }}
                  >
                    📋 Copier
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setCreatedLink(null); }}
                    style={{ flex: 1, padding: '14px 20px', background: '#0A0A0A', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              // ═ Formulaire ═
              <form onSubmit={handleCreate}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
                  Nouvelle demande
                </h2>
                <p style={{ margin: 0, color: '#6B7280', fontSize: 13, marginBottom: 20 }}>
                  Contrat : <strong>{selectedTemplate.name}</strong>
                </p>

                <FieldGroup label="Nom du destinataire *">
                  <input
                    type="text"
                    required
                    value={recipient.name}
                    onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                    placeholder="Ex : Pharmacie du Sacré-Cœur"
                    style={inputStyle}
                  />
                </FieldGroup>

                <FieldGroup label="Email *">
                  <input
                    type="email"
                    required
                    value={recipient.email}
                    onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                    placeholder="contact@pharmacie.sn"
                    style={inputStyle}
                  />
                </FieldGroup>

                <FieldGroup label="Téléphone (optionnel)">
                  <input
                    type="tel"
                    value={recipient.phone}
                    onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                    placeholder="+221 XX XXX XX XX"
                    style={inputStyle}
                  />
                </FieldGroup>

                {(selectedTemplate.fields_schema || []).length > 0 && (
                  <div style={{
                    padding: 16, background: '#FAFAF7', borderRadius: 12,
                    marginBottom: 14, marginTop: 4,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: '#6B7280', marginBottom: 10 }}>
                      🖊️ CHAMPS PRÉ-REMPLIS
                    </div>
                    {selectedTemplate.fields_schema.map((f) => (
                      <FieldGroup key={f.key} label={f.label}>
                        <input
                          type="text"
                          value={prefill[f.key] || ''}
                          onChange={(e) => setPrefill({ ...prefill, [f.key]: e.target.value })}
                          placeholder={f.label}
                          style={inputStyle}
                        />
                      </FieldGroup>
                    ))}
                  </div>
                )}

                <FieldGroup label="Message perso (optionnel)">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Salut ! Voici le contrat de partenariat YARAM à signer…"
                    style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </FieldGroup>

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    disabled={creating}
                    style={{ flex: 1, padding: '14px 20px', background: '#F4F4F2', border: 'none', borderRadius: 999, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{ flex: 2, padding: '14px 20px', background: '#1F8B4C', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 800, cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.6 : 1 }}
                  >
                    {creating ? 'Envoi…' : '📤 Envoyer à signer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Helpers ═══
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E4DC', borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 4, letterSpacing: '-1px' }}>{value}</div>
    </div>
  );
}
function Th({ children }) {
  return (
    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 900, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true">
          <path d="M4 0l3 3H1z" fill="currentColor" opacity="0.35"/>
          <path d="M4 10L1 7h6z" fill="currentColor" opacity="0.35"/>
        </svg>
      </span>
    </th>
  );
}
function Td({ children, style }) {
  return <td style={{ padding: '14px 16px', verticalAlign: 'top', ...style }}>{children}</td>;
}
function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#0A0A0A', marginBottom: 6, letterSpacing: 0.2 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1px solid #E5E4DC',
  borderRadius: 10, fontSize: 14, background: '#fff', boxSizing: 'border-box',
  fontFamily: 'inherit',
};
function btnStyle(bg, color) {
  return {
    padding: '6px 12px', background: bg, color, border: 'none',
    borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
