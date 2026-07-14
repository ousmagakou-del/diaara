// ══════════════════════════════════════════════════════════════════
//  BrandModerationSection — Queue de validation des produits
//  soumis par les marques via le dashboard self-service
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAdminToken } from '../lib/adminAuth';
import { adminLogAction } from '../lib/adminApi';
import { toast, confirmDialog } from '../lib/toast';

const BRAND_PURPLE = '#7C3AED';
const BRAND_PURPLE_DARK = '#5B21B6';
const BRAND_PURPLE_SOFT = '#F3E8FF';

export default function BrandModerationSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) {
      toast.error('Session admin expiree');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('admin_pending_brand_products', {
      p_token: token,
    });
    if (error) {
      toast.error('Erreur : ' + error.message);
      setLoading(false);
      return;
    }
    if (!data?.success) {
      toast.error('Echec : ' + (data?.error || 'inconnu'));
      setLoading(false);
      return;
    }
    setItems(Array.isArray(data.products) ? data.products : []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleApprove = async (item) => {
    setBusyId(item.product.id);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_moderate_product', {
      p_token: token,
      p_product_id: item.product.id,
      p_action: 'approve',
      p_notes: null,
    });
    setBusyId(null);
    if (error) { toast.error('Erreur : ' + error.message); return; }
    if (!data?.success) { toast.error('Echec : ' + (data?.error || 'inconnu')); return; }
    toast.success(`Produit "${item.product.name}" approuve et publie`);
    adminLogAction({
      action: 'moderate_product_approve',
      targetType: 'product',
      targetId: item.product.id,
      before: null,
      after: { brand_id: item.brand?.id, brand_name: item.brand?.name },
    });
    setSelected(null);
    refresh();
  };

  const handleReject = async (item, notes) => {
    setBusyId(item.product.id);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_moderate_product', {
      p_token: token,
      p_product_id: item.product.id,
      p_action: 'reject',
      p_notes: notes || 'Non conforme',
    });
    setBusyId(null);
    if (error) { toast.error('Erreur : ' + error.message); return; }
    if (!data?.success) { toast.error('Echec : ' + (data?.error || 'inconnu')); return; }
    toast.success('Produit rejete. La marque peut le corriger.');
    adminLogAction({
      action: 'moderate_product_reject',
      targetType: 'product',
      targetId: item.product.id,
      before: null,
      after: { notes, brand_id: item.brand?.id },
    });
    setSelected(null);
    setRejectReason('');
    refresh();
  };

  const handleFlag = async (item) => {
    const notes = window.prompt('Signaler ce produit — motif interne (visible admin uniquement) :', '');
    if (!notes) return;
    setBusyId(item.product.id);
    const token = getAdminToken();
    const { data, error } = await supabase.rpc('admin_moderate_product', {
      p_token: token,
      p_product_id: item.product.id,
      p_action: 'flag',
      p_notes: notes,
    });
    setBusyId(null);
    if (error) { toast.error('Erreur : ' + error.message); return; }
    if (!data?.success) { toast.error('Echec : ' + (data?.error || 'inconnu')); return; }
    toast.success('Signale. Reste dans la queue.');
    refresh();
  };

  const fmtPrice = (n) => {
    if (n == null) return '—';
    return `${Number(n).toLocaleString('fr-FR')} FCFA`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: BRAND_PURPLE_DARK }}>
            🚀 Modération produits marques
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B6B6B' }}>
            Produits soumis par les marques via leur dashboard self-service — à approuver avant publication
          </p>
        </div>
        <button
          onClick={refresh}
          className="adm-btn-sec"
          style={{ fontSize: 12 }}
        >
          🔄 Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="adm-empty">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="adm-empty" style={{ background: BRAND_PURPLE_SOFT, padding: 40, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
          <h3 style={{ margin: '0 0 8px', color: BRAND_PURPLE_DARK }}>Tout est modéré</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#6B6B6B' }}>
            Aucun produit en attente. Les nouvelles soumissions apparaîtront ici.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {items.map((item) => (
            <div
              key={item.product.id}
              style={{
                background: 'white',
                borderRadius: 14,
                border: `1px solid ${item.product.status === 'flagged' ? '#F59E0B' : '#E5E7EB'}`,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header : marque */}
              <div style={{
                padding: '10px 14px',
                background: BRAND_PURPLE_SOFT,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: `1px solid ${BRAND_PURPLE_SOFT}`,
              }}>
                {item.brand?.logo && (
                  <img
                    src={item.brand.logo}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', background: 'white', padding: 2 }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: BRAND_PURPLE_DARK }}>
                    {item.brand?.name || 'Marque inconnue'}
                  </div>
                  <div style={{ fontSize: 10, color: '#6B6B6B' }}>
                    Soumis {item.product.submitted_at ? new Date(item.product.submitted_at).toLocaleDateString('fr-FR') : '—'}
                  </div>
                </div>
                {item.product.status === 'flagged' && (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#F59E0B',
                    color: 'white',
                    fontWeight: 700,
                  }}>🚩 Flag</span>
                )}
              </div>

              {/* Photo */}
              <div style={{
                aspectRatio: '1',
                background: '#F4F4F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {item.product.image_url ? (
                  <img
                    src={item.product.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span style={{ fontSize: 40, opacity: 0.3 }}>📦</span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: 14, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F2224' }}>
                  {item.product.name}
                </div>
                {item.product.short_desc && (
                  <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 4, lineHeight: 1.4 }}>
                    {item.product.short_desc}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: BRAND_PURPLE_DARK }}>
                    {fmtPrice(item.product.price)}
                  </span>
                  {item.product.category && (
                    <span style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#F4F4F2',
                      color: '#6B6B6B',
                      fontWeight: 600,
                    }}>{item.product.category}</span>
                  )}
                </div>
                {item.product.long_desc && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ fontSize: 11, color: '#6B6B6B', cursor: 'pointer' }}>
                      Voir description complete
                    </summary>
                    <div style={{ fontSize: 12, color: '#4B5563', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {item.product.long_desc}
                    </div>
                  </details>
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: '10px 14px 14px', display: 'flex', gap: 6, borderTop: '1px solid #F4F4F2' }}>
                <button
                  onClick={() => handleApprove(item)}
                  disabled={busyId === item.product.id}
                  style={{
                    flex: 2,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#22C55E',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    opacity: busyId === item.product.id ? 0.6 : 1,
                  }}
                >
                  ✅ Approuver
                </button>
                <button
                  onClick={() => setSelected(item)}
                  disabled={busyId === item.product.id}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #EF4444',
                    background: 'white',
                    color: '#EF4444',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    opacity: busyId === item.product.id ? 0.6 : 1,
                  }}
                >
                  ❌ Rejeter
                </button>
                <button
                  onClick={() => handleFlag(item)}
                  disabled={busyId === item.product.id}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 8,
                    border: '1.5px solid #F59E0B',
                    background: 'white',
                    color: '#F59E0B',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    opacity: busyId === item.product.id ? 0.6 : 1,
                  }}
                  title="Signaler pour reflexion"
                >
                  🚩
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal rejet — demander la raison */}
      {selected && (
        <div
          onClick={() => { setSelected(null); setRejectReason(''); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 14,
              padding: 22,
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#EF4444' }}>
              ❌ Rejeter "{selected.product.name}"
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B6B6B' }}>
              Cette raison sera visible par la marque. Elle pourra corriger et resoumettre.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Ex: Photo trop floue, prix incoherent, description trop courte..."
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1.5px solid #E5E7EB',
                fontSize: 13,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setSelected(null); setRejectReason(''); }}
                className="adm-btn-sec"
              >Annuler</button>
              <button
                onClick={() => handleReject(selected, rejectReason.trim() || 'Non conforme')}
                disabled={busyId === selected.product.id || !rejectReason.trim()}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#EF4444',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: (busyId === selected.product.id || !rejectReason.trim()) ? 0.5 : 1,
                }}
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
