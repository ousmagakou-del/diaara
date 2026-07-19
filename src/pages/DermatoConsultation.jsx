// ════════════════════════════════════════════════════════════════
// DermatoConsultation — /dermato/consult/:id
// Chat patient/dermato + statut + visio button + prescription
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNav, useUser } from '../App';
import {
  getDermatoConsultationDetail,
  patientSendDermatoMessage,
  patientGetDermatoRoom,
  createDailyRoom,
  formatDateTimeFr,
  formatFcfa,
  CONSULT_STATUS_LABEL,
} from '../lib/dermato';
import { supabase } from '../lib/supabase';
import { addToCart } from '../lib/cart';
import './Dermato.css';

function StatusBadge({ status }) {
  return (
    <span className={`derm-status-badge derm-status-${status}`}>
      {CONSULT_STATUS_LABEL[status] || status}
    </span>
  );
}

export default function DermatoConsultation() {
  const { navigate, goBack, route } = useNav();
  const { user } = useUser();
  const consultId = route?.params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [roomUrl, setRoomUrl] = useState(null);
  const [roomToken, setRoomToken] = useState(null);
  const [addingRx, setAddingRx] = useState(false);
  const [rxMessage, setRxMessage] = useState(null);
  const chatEndRef = useRef(null);

  const load = useCallback(async () => {
    if (!user?.id || !consultId) return;
    try {
      const d = await getDermatoConsultationDetail(user.id, consultId);
      setData(d);
    } catch (e) {
      setError(e?.message || 'Erreur');
    }
    setLoading(false);
  }, [user?.id, consultId]);

  useEffect(() => { load(); }, [load]);

  // Poll every 8s for new messages
  useEffect(() => {
    if (!user?.id || !consultId) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load, user?.id, consultId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages?.length]);

  const consult = data?.consultation || data?.consult || data;
  const dermato = data?.dermatologist || data?.dermato;
  const messages = data?.messages || [];
  const prescription = data?.prescription || null;

  const sendMessage = async () => {
    const body = msgInput.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await patientSendDermatoMessage(user.id, consultId, body);
      setMsgInput('');
      await load();
    } catch (e) {
      alert('Erreur envoi : ' + (e?.message || ''));
    }
    setSending(false);
  };

  const joinVideo = async () => {
    try {
      // 1. Fetch room
      let room = await patientGetDermatoRoom(user.id, consultId).catch(() => null);
      if (!room?.room_url) {
        // 2. Create room if missing
        const created = await createDailyRoom(consultId);
        if (created?.success) {
          room = await patientGetDermatoRoom(user.id, consultId).catch(() => null);
        }
      }
      if (!room?.room_url) {
        alert('Room visio non disponible pour l\'instant. Réessaie dans 30s.');
        return;
      }
      setRoomUrl(room.room_url);
      setRoomToken(room.patient_token || room.token || null);
      setVideoOpen(true);
    } catch (e) {
      alert('Erreur visio : ' + (e?.message || ''));
    }
  };

  // ─── Ordonnance → panier : ajoute les produits YARAM de la prescription ───
  const addPrescriptionToCart = async () => {
    if (addingRx) return;
    const items = Array.isArray(prescription?.items) ? prescription.items : [];
    const withProduct = items.filter((it) => it && it.yaram_product_id);
    if (withProduct.length === 0) {
      setRxMessage('Ces produits ne sont pas encore dans notre catalogue.');
      return;
    }
    setAddingRx(true);
    setRxMessage(null);
    try {
      const ids = withProduct.map((it) => it.yaram_product_id);
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, name, brand, price, img, image_url, is_imported, lead_time_days, origin_country')
        .in('id', ids)
        .eq('active', true);
      if (pErr) throw pErr;
      const found = products || [];
      if (found.length === 0) {
        setRxMessage('Ces produits ne sont pas encore dans notre catalogue.');
        setAddingRx(false);
        return;
      }
      // Meme fallback pharmacie que ProductPage.handleAddToCart
      const pharmacy = { id: 'default', name: 'YARAM' };
      let added = 0;
      for (const p of found) {
        const res = addToCart({
          product: {
            id: p.id,
            name: p.name,
            brand: p.brand || '',
            img: p.img || p.image_url || '',
            price: p.price,
            is_imported: !!p.is_imported,
            lead_time_days: p.lead_time_days || 1,
            origin_country: p.origin_country || 'SN',
          },
          pharmacy,
          qty: 1,
        });
        if (res?.success) added += 1;
      }
      if (added > 0) {
        navigate({ name: 'cart', params: {} });
      } else {
        setRxMessage('Impossible d\'ajouter ces produits au panier.');
      }
    } catch (e) {
      setRxMessage(e?.message || 'Erreur lors de l\'ajout au panier.');
    }
    setAddingRx(false);
  };

  const isVideo = consult?.type === 'video' || consult?.consult_type === 'video';
  const canJoinVideo = isVideo && ['scheduled', 'in_progress', 'paid'].includes(consult?.status);
  // T-5min : autorise à rejoindre 5min avant l'horaire prévu
  let videoBtnLabel = 'Rejoindre la visio';
  let videoBtnDisabled = false;
  if (consult?.scheduled_at) {
    const scheduled = new Date(consult.scheduled_at).getTime();
    const now = Date.now();
    if (now < scheduled - 5 * 60 * 1000) {
      videoBtnDisabled = true;
      videoBtnLabel = `Prévu ${formatDateTimeFr(consult.scheduled_at)}`;
    }
  }

  if (loading) {
    return (
      <div className="derm-page">
        <div className="derm-topbar">
          <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="derm-topbar-title">Chargement…</div>
        </div>
      </div>
    );
  }

  if (error || !consult) {
    return (
      <div className="derm-page">
        <div className="derm-topbar">
          <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="derm-topbar-title">Consultation introuvable</div>
        </div>
        <div className="derm-empty">
          <h3>Consultation introuvable</h3>
          <p>{error || 'Cette consultation n\'existe pas.'}</p>
          <button className="derm-btn-primary" style={{ maxWidth: 260, margin: '0 auto' }} onClick={() => navigate({ name: 'dermato_my' })}>
            Voir mes consultations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="derm-page">
      <div className="derm-topbar">
        <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="derm-topbar-title">Dr {dermato?.full_name || 'Dermato'}</div>
        <StatusBadge status={consult.status} />
      </div>

      <div className="derm-consult-shell">
        {/* Video CTA */}
        {canJoinVideo && (
          <div className="derm-video-cta">
            <div>
              <strong>Consultation vidéo</strong>
              <span>{videoBtnDisabled ? `Débute ${formatDateTimeFr(consult.scheduled_at)}` : 'La visio est prête, rejoins Dr ' + (dermato?.full_name || '')}</span>
            </div>
            <button disabled={videoBtnDisabled} onClick={joinVideo}>
              {videoBtnLabel}
            </button>
          </div>
        )}

        {/* Meta */}
        <div className="derm-consult-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ display: 'block', marginBottom: 4 }}>{isVideo ? 'Visio 20 min' : 'Consultation express'}</strong>
              <span style={{ fontSize: 13, color: 'var(--y-n-600)' }}>Créée le {formatDateTimeFr(consult.created_at)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: 18, color: 'var(--y-brand-dark)' }}>{formatFcfa(consult.price_fcfa || consult.amount_fcfa || 0)}</strong>
              <br />
              <span style={{ fontSize: 12, color: 'var(--y-n-600)' }}>{consult.payment_method || 'Payé'}</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="derm-consult-card">
          <h3 style={{ margin: 0, marginBottom: 12, fontSize: 15, fontWeight: 800 }}>Messages</h3>
          <div className="derm-chat">
            {messages.length === 0 ? (
              <div style={{ color: 'var(--y-n-600)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                Envoie un premier message au dermatologue.
              </div>
            ) : (
              messages.map(m => {
                const from = m.from || m.sender || m.author_type;
                const role = from === 'patient' ? 'patient' : from === 'dermatologist' || from === 'dermato' ? 'derma' : 'system';
                return (
                  <div key={m.id} className={`derm-msg derm-msg-${role}`}>
                    <div className="derm-msg-bubble">
                      {m.body || m.content || ''}
                      {m.photo_url && (
                        <img src={m.photo_url} alt="" className="derm-msg-photo" />
                      )}
                    </div>
                    <div className="derm-msg-time">{formatDateTimeFr(m.created_at || m.sent_at)}</div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {consult.status !== 'completed' && consult.status !== 'cancelled' && (
            <div className="derm-chat-input">
              <textarea
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                placeholder="Écris un message au dermatologue…"
                rows={2}
              />
              <button className="derm-chat-send" onClick={sendMessage} disabled={sending || !msgInput.trim()}>
                {sending ? '…' : 'Envoyer'}
              </button>
            </div>
          )}
        </div>

        {/* Prescription */}
        {prescription && prescription.signed_html && (
          <div className="derm-prescription">
            <h3>Ton ordonnance</h3>
            <div className="derm-prescription-html" dangerouslySetInnerHTML={{ __html: prescription.signed_html }} />

            {/* Ordonnance → panier */}
            <div style={{ marginTop: 16 }}>
              <button
                className="derm-btn-primary"
                style={{ width: '100%' }}
                disabled={addingRx}
                onClick={addPrescriptionToCart}
              >
                {addingRx ? 'Ajout en cours…' : 'Ajouter les produits au panier'}
              </button>
              {rxMessage && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--y-n-100, #F3F4F1)', color: 'var(--y-n-700, #4B4B45)', borderRadius: 10, fontSize: 13 }}>
                  {rxMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Video modal */}
      {videoOpen && roomUrl && (
        <div className="derm-video-modal">
          <div className="derm-video-modal-topbar">
            <strong>Visio · Dr {dermato?.full_name || ''}</strong>
            <button className="derm-video-modal-close" onClick={() => setVideoOpen(false)}>Fermer</button>
          </div>
          <iframe
            src={roomToken ? `${roomUrl}?t=${roomToken}` : roomUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            title="Consultation vidéo"
          />
        </div>
      )}
    </div>
  );
}
