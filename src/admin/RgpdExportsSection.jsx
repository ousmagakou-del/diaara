// ════════════════════════════════════════════════════════════════════
// YARAM Admin — Section RGPD : demandes d'export de données utilisateur
// ════════════════════════════════════════════════════════════════════
// Liste les demandes faites depuis l'app (Profil > Télécharger mes données).
// Permet à l'admin de marquer les demandes en cours / envoyées / échouées.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

const STATUS_LABELS = {
  pending: { label: 'En attente', color: '#F59E0B', bg: '#FEF3C7' },
  processing: { label: 'En cours', color: '#3B82F6', bg: '#DBEAFE' },
  sent: { label: 'Envoyé', color: '#10B981', bg: '#D1FAE5' },
  failed: { label: 'Échec', color: '#EF4444', bg: '#FEE2E2' },
};

function getAdminToken() {
  try {
    const raw = localStorage.getItem('yaram-admin-session') ||
                sessionStorage.getItem('yaram-admin-session');
    return raw ? JSON.parse(raw)?.token : null;
  } catch { return null; }
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(min / 60);
  const days = Math.floor(h / 24);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${days} j`;
}

export default function RgpdExportsSection() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) {
      toast.error('Session admin expirée');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('admin_list_data_exports', {
      p_admin_token: token,
      p_status: filter === 'all' ? null : filter,
    });
    if (error || !data?.success) {
      toast.error('Erreur chargement : ' + (error?.message || data?.error || 'inconnue'));
      setLoading(false);
      return;
    }
    setRequests(data.requests || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (req, newStatus) => {
    const token = getAdminToken();
    if (!token) {
      toast.error('Session admin expirée');
      return;
    }
    setUpdating(req.id);
    const { data, error } = await supabase.rpc('admin_update_data_export_status', {
      p_admin_token: token,
      p_request_id: req.id,
      p_status: newStatus,
      p_notes: null,
    });
    setUpdating(null);
    if (error || !data?.success) {
      toast.error('Erreur : ' + (error?.message || data?.error || 'inconnue'));
      return;
    }
    toast.success(`Statut → ${STATUS_LABELS[newStatus]?.label}`);
    load();
  };

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    processing: requests.filter(r => r.status === 'processing').length,
    sent: requests.filter(r => r.status === 'sent').length,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', marginBottom: 6 }}>
          📥 Demandes RGPD
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          Utilisatrices qui demandent l'export de toutes leurs données depuis l'app YARAM.
        </p>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'pending', label: 'En attente', n: filter === 'pending' ? requests.length : counts.pending },
          { id: 'processing', label: 'En cours', n: filter === 'processing' ? requests.length : counts.processing },
          { id: 'sent', label: 'Envoyées', n: filter === 'sent' ? requests.length : counts.sent },
          { id: 'all', label: 'Toutes', n: filter === 'all' ? requests.length : '' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: filter === f.id ? '#1F8B4C' : '#F4F4F2',
              color: filter === f.id ? '#fff' : '#1A1A1A',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {f.label}
            {f.n !== '' && f.n !== undefined && (
              <span style={{
                background: filter === f.id ? 'rgba(255,255,255,0.25)' : '#E5E5E5',
                padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800,
              }}>{f.n}</span>
            )}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          style={{
            marginLeft: 'auto', padding: '8px 14px', borderRadius: 999, border: 'none',
            background: '#F4F4F2', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          🔄 Actualiser
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
          Chargement…
        </div>
      ) : requests.length === 0 ? (
        <div style={{
          padding: 60, textAlign: 'center', background: '#FAFAFA',
          borderRadius: 16, border: '2px dashed #E5E5E5',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A' }}>
            Aucune demande {filter !== 'all' && STATUS_LABELS[filter]?.label.toLowerCase()}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
            Les demandes apparaitront ici dès qu'une utilisatrice cliquera sur "Télécharger mes données" dans l'app.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((r) => {
            const status = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
            return (
              <div
                key={r.id}
                style={{
                  background: '#fff', borderRadius: 14, padding: 18,
                  border: '1px solid #F0F0EE',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 22,
                  background: '#F0FDF4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>📥</div>

                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A' }}>
                      {r.user_email || 'Email inconnu'}
                    </span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999,
                      background: status.bg, color: status.color,
                      fontSize: 11, fontWeight: 800,
                    }}>{status.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    Demandé : {formatDate(r.requested_at)} · {relativeTime(r.requested_at)}
                  </div>
                  {r.fulfilled_at && (
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      Traité : {formatDate(r.fulfilled_at)}
                    </div>
                  )}
                  {r.notes && (
                    <div style={{ fontSize: 12, color: '#1A1A1A', marginTop: 6, fontStyle: 'italic' }}>
                      📝 {r.notes}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.status !== 'processing' && r.status !== 'sent' && (
                    <button
                      onClick={() => updateStatus(r, 'processing')}
                      disabled={updating === r.id}
                      style={{
                        padding: '8px 14px', borderRadius: 999, border: 'none',
                        background: '#DBEAFE', color: '#3B82F6', cursor: 'pointer',
                        fontSize: 12, fontWeight: 800,
                      }}
                    >🔄 En cours</button>
                  )}
                  {r.status !== 'sent' && (
                    <button
                      onClick={() => updateStatus(r, 'sent')}
                      disabled={updating === r.id}
                      style={{
                        padding: '8px 14px', borderRadius: 999, border: 'none',
                        background: '#1F8B4C', color: '#fff', cursor: 'pointer',
                        fontSize: 12, fontWeight: 800,
                      }}
                    >✅ Marquer envoyé</button>
                  )}
                  {r.user_email && (
                    <a
                      href={`mailto:${r.user_email}?subject=Export%20de%20tes%20donn%C3%A9es%20YARAM&body=Bonjour,%0A%0AVoici%20l'export%20complet%20de%20tes%20donn%C3%A9es%20comme%20demand%C3%A9.%0A%0A...`}
                      style={{
                        padding: '8px 14px', borderRadius: 999, textDecoration: 'none',
                        background: '#F4F4F2', color: '#1A1A1A',
                        fontSize: 12, fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >📧 Email</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
