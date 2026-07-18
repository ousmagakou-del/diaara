// ════════════════════════════════════════════════════════════════
// DermaConsultDetail — vue détaillée d'une consultation
//   Chat + photos symptômes + form ordonnance + visio
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  dermaGetConsultationDetail,
  dermaSendMessage,
  dermaSendPrescription,
  dermaGetRoom,
  createDailyRoom,
  formatDateTimeFr,
  formatFcfa,
  CONSULT_STATUS_LABEL,
} from '../lib/dermato';

// ─── Ordonnance signable (canvas) ─────────────────
function SignatureCanvas({ onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * 2;
    c.height = rect.height * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.strokeStyle = '#0E5B33';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const t = e.touches?.[0];
    return {
      x: (t ? t.clientX : e.clientX) - rect.left,
      y: (t ? t.clientY : e.clientY) - rect.top,
    };
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try { onChange?.(canvasRef.current.toDataURL('image/png')); } catch {}
  };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    onChange?.('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="drm-signature-canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--y-n-600)' }}>Signe dans le cadre ci-dessus</span>
        <button type="button" onClick={clear} style={{ background: 'transparent', border: 'none', color: 'var(--y-danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Effacer</button>
      </div>
    </div>
  );
}

// ─── Génère HTML ordonnance ────────────────────────
function buildSignedHtml({ dermato, patient, items, diagnosis, advice, precautions, signatureData, followUpDate }) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;color:#0A0A0A;max-width:700px;margin:0 auto;padding:24px;background:white;">
  <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1F8B4C;padding-bottom:14px;margin-bottom:20px;">
    <div>
      <div style="font-size:18px;font-weight:900;color:#1F8B4C;">YARAM Dermato · Ordonnance</div>
      <div style="font-size:12px;color:#6B7280;margin-top:4px;">Consultation en téléconsultation</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#6B7280;">
      <div>${date}</div>
    </div>
  </div>
  <div style="margin-bottom:16px;">
    <strong style="display:block;font-size:14px;">Patient — ${patient?.first_name || ''} ${patient?.last_name || ''}</strong>
    <span style="font-size:12px;color:#6B7280;">${patient?.age ? patient.age + ' ans · ' : ''}${patient?.phone || ''}</span>
  </div>
  ${diagnosis ? `<div style="background:#EAF7F0;padding:14px;border-radius:10px;margin-bottom:16px;">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#0E5B33;letter-spacing:0.05em;margin-bottom:4px;">Diagnostic</div>
    <div style="font-size:14px;">${diagnosis}</div>
  </div>` : ''}
  ${items && items.length ? `<div style="margin-bottom:16px;">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#6B7280;letter-spacing:0.05em;margin-bottom:8px;">Prescription</div>
    ${items.map((it, i) => `
      <div style="border:1px solid #EEEDE8;border-radius:10px;padding:12px;margin-bottom:8px;">
        <div style="font-weight:800;font-size:14px;">${i + 1}. ${it.name || ''} ${it.dosage ? '· ' + it.dosage : ''}</div>
        <div style="font-size:12px;color:#4B5563;margin-top:2px;">${it.frequency || ''} ${it.duration ? ' · ' + it.duration : ''} ${it.form ? ' · ' + it.form : ''}</div>
        ${it.notes ? `<div style="font-size:12px;color:#6B7280;margin-top:4px;font-style:italic;">${it.notes}</div>` : ''}
      </div>
    `).join('')}
  </div>` : ''}
  ${advice ? `<div style="margin-bottom:12px;">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#6B7280;letter-spacing:0.05em;margin-bottom:4px;">Conseils</div>
    <div style="font-size:13px;line-height:1.5;">${advice}</div>
  </div>` : ''}
  ${precautions ? `<div style="margin-bottom:12px;">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#B78B00;letter-spacing:0.05em;margin-bottom:4px;">Précautions</div>
    <div style="font-size:13px;line-height:1.5;background:#FFF9E6;padding:10px;border-radius:8px;">${precautions}</div>
  </div>` : ''}
  ${followUpDate ? `<div style="margin-bottom:16px;font-size:13px;color:#0066CC;">
    <strong>Suivi recommandé :</strong> ${new Date(followUpDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
  </div>` : ''}
  <div style="border-top:1px solid #EEEDE8;padding-top:16px;margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:12px;color:#6B7280;">
      <div>Dr ${dermato?.full_name || ''}</div>
      <div>${dermato?.speciality || 'Dermatologue'}</div>
      ${dermato?.ordre_num ? `<div>Ordre des Médecins : ${dermato.ordre_num}</div>` : ''}
    </div>
    ${signatureData ? `<img src="${signatureData}" alt="Signature" style="height:60px;object-fit:contain;" />` : '<div style="color:#C0C0B8;font-size:11px;">Signé numériquement</div>'}
  </div>
</div>`;
}

export default function DermaConsultDetail({ consultId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showRx, setShowRx] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [roomUrl, setRoomUrl] = useState(null);
  const [roomToken, setRoomToken] = useState(null);
  const chatEndRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await dermaGetConsultationDetail(consultId);
      setData(d);
    } catch (e) {
      setError(e?.message || 'Erreur');
    }
    setLoading(false);
  }, [consultId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages?.length]);

  const consult = data?.consultation || data?.consult || data;
  const patient = data?.patient || {};
  const dermato = data?.dermato || data?.dermatologist || {};
  const messages = data?.messages || [];
  const prescription = data?.prescription || null;
  const photos = consult?.symptom_photos || consult?.photos || [];

  const sendMsg = async () => {
    const body = msgInput.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await dermaSendMessage(consultId, body);
      setMsgInput('');
      await load();
    } catch (e) {
      alert('Erreur : ' + (e?.message || ''));
    }
    setSending(false);
  };

  const startVideo = async () => {
    try {
      let room = await dermaGetRoom(consultId).catch(() => null);
      if (!room?.room_url) {
        const created = await createDailyRoom(consultId);
        if (created?.success) room = await dermaGetRoom(consultId).catch(() => null);
      }
      if (!room?.room_url) { alert('Impossible de créer la salle vidéo'); return; }
      setRoomUrl(room.room_url);
      setRoomToken(room.dermato_token || room.owner_token || room.token || null);
      setVideoOpen(true);
    } catch (e) {
      alert('Erreur visio : ' + (e?.message || ''));
    }
  };

  if (loading) return <p style={{ color: 'var(--y-n-600)' }}>Chargement…</p>;
  if (error || !consult) {
    return (
      <div>
        <button className="drm-btn drm-btn-secondary" onClick={onBack}>← Retour</button>
        <p style={{ color: 'var(--y-danger)', marginTop: 20 }}>{error || 'Consultation introuvable'}</p>
      </div>
    );
  }

  const isVideo = consult.type === 'video' || consult.consult_type === 'video';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="drm-btn drm-btn-ghost" onClick={onBack}>← Retour</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>
            {patient.first_name || 'Patient'} {patient.last_name || ''}
            <span className={`drm-badge drm-badge-${consult.status}`} style={{ marginLeft: 10, verticalAlign: 'middle' }}>
              {CONSULT_STATUS_LABEL[consult.status] || consult.status}
            </span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--y-n-600)' }}>
            {isVideo ? 'Visio 20 min' : 'Consultation express'} · {formatDateTimeFr(isVideo && consult.scheduled_at ? consult.scheduled_at : consult.created_at)}
          </p>
        </div>
      </div>

      {/* PATIENT INFO */}
      <div className="drm-card">
        <h2>Informations patient</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div><strong>Âge</strong><br /><span style={{ color: 'var(--y-n-600)' }}>{patient.age || '—'}</span></div>
          <div><strong>Téléphone</strong><br /><span style={{ color: 'var(--y-n-600)' }}>{patient.phone || '—'}</span></div>
          <div><strong>Type de peau</strong><br /><span style={{ color: 'var(--y-n-600)' }}>{patient.skin_type || 'Non précisé'}</span></div>
          <div><strong>Prix payé</strong><br /><span style={{ color: 'var(--y-brand-dark)', fontWeight: 800 }}>{formatFcfa(consult.price_fcfa || consult.amount_fcfa || 0)}</span></div>
        </div>
        {consult.symptoms && (
          <div style={{ marginTop: 14, padding: 12, background: 'var(--y-n-50)', borderRadius: 10 }}>
            <strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Symptômes rapportés</strong>
            <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{consult.symptoms}</p>
          </div>
        )}
      </div>

      {/* SYMPTOM PHOTOS */}
      {photos.length > 0 && (
        <div className="drm-card">
          <h2>Photos symptômes ({photos.length})</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((p, i) => (
              <a key={i} href={p} target="_blank" rel="noreferrer">
                <img src={p} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--y-n-200)' }} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* VIDEO */}
      {isVideo && ['scheduled', 'in_progress', 'paid'].includes(consult.status) && (
        <div className="drm-card" style={{ background: 'linear-gradient(135deg, #1F8B4C, #0E5B33)', color: 'white', borderColor: 'transparent' }}>
          <h2 style={{ color: 'white' }}>Consultation vidéo</h2>
          <p style={{ opacity: 0.9, fontSize: 13, marginBottom: 12 }}>
            {consult.scheduled_at ? `Prévue ${formatDateTimeFr(consult.scheduled_at)}` : 'À démarrer'}
          </p>
          <button className="drm-btn" style={{ background: 'white', color: '#0E5B33' }} onClick={startVideo}>
            Démarrer la visio
          </button>
        </div>
      )}

      {/* CHAT */}
      <div className="drm-card">
        <h2>Chat</h2>
        <div className="drm-chat">
          {messages.length === 0 ? (
            <div style={{ color: 'var(--y-n-600)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              Aucun message pour l'instant.
            </div>
          ) : (
            messages.map((m) => {
              const from = m.from || m.sender || m.author_type;
              const role = from === 'patient' ? 'patient' : from === 'dermatologist' || from === 'dermato' ? 'derma' : 'system';
              return (
                <div key={m.id} className={`drm-msg drm-msg-${role}`}>
                  <div className="drm-msg-bubble">
                    {m.body || m.content || ''}
                    {m.photo_url && <img src={m.photo_url} alt="" className="drm-msg-photo" />}
                  </div>
                  <div className="drm-msg-time">{formatDateTimeFr(m.created_at || m.sent_at)}</div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>
        {consult.status !== 'completed' && consult.status !== 'cancelled' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <textarea
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              placeholder="Message au patient…"
              style={{ flex: 1, padding: 10, border: '1.5px solid var(--y-n-300)', borderRadius: 10, resize: 'none', minHeight: 44 }}
              rows={2}
            />
            <button className="drm-btn drm-btn-primary" onClick={sendMsg} disabled={!msgInput.trim() || sending}>
              {sending ? '…' : 'Envoyer'}
            </button>
          </div>
        )}
      </div>

      {/* PRESCRIPTION */}
      {prescription ? (
        <div className="drm-card">
          <h2>Ordonnance envoyée</h2>
          <p className="sub">Envoyée le {formatDateTimeFr(prescription.created_at || prescription.sent_at)}</p>
          <div style={{ padding: 12, background: 'var(--y-n-50)', borderRadius: 10 }} dangerouslySetInnerHTML={{ __html: prescription.signed_html || '<i>Ordonnance signée</i>' }} />
        </div>
      ) : consult.status !== 'completed' && consult.status !== 'cancelled' ? (
        <div className="drm-card">
          {!showRx ? (
            <div style={{ textAlign: 'center' }}>
              <h2>Rédiger l'ordonnance</h2>
              <p className="sub">Une fois signée, le patient reçoit l'ordonnance immédiatement.</p>
              <button className="drm-btn drm-btn-primary" onClick={() => setShowRx(true)}>
                Rédiger et signer une ordonnance
              </button>
            </div>
          ) : (
            <PrescriptionForm
              dermato={dermato}
              patient={patient}
              consultId={consultId}
              onCancel={() => setShowRx(false)}
              onSaved={() => { setShowRx(false); load(); }}
            />
          )}
        </div>
      ) : null}

      {/* VIDEO MODAL */}
      {videoOpen && roomUrl && (
        <div className="drm-video-modal">
          <div className="drm-video-modal-topbar">
            <strong style={{ color: 'white' }}>Visio · {patient.first_name || 'Patient'}</strong>
            <button onClick={() => setVideoOpen(false)}>Terminer</button>
          </div>
          <iframe
            src={roomToken ? `${roomUrl}?t=${roomToken}` : roomUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            title="Visio dermato"
          />
        </div>
      )}
    </>
  );
}

function PrescriptionForm({ dermato, patient, consultId, onCancel, onSaved }) {
  const [items, setItems] = useState([{ name: '', form: '', dosage: '', frequency: '', duration: '', notes: '' }]);
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [precautions, setPrecautions] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateItem = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const addItem = () => setItems([...items, { name: '', form: '', dosage: '', frequency: '', duration: '', notes: '' }]);

  const submit = async () => {
    if (!diagnosis.trim()) { setError('Diagnostic requis'); return; }
    if (items.filter((it) => it.name.trim()).length === 0) { setError('Au moins un médicament requis'); return; }
    if (!signatureData) { setError('Signature requise'); return; }
    setSaving(true);
    setError('');
    const cleanItems = items.filter((it) => it.name.trim());
    const signedHtml = buildSignedHtml({
      dermato, patient, items: cleanItems, diagnosis, advice, precautions, signatureData,
      followUpDate: followUpNeeded ? followUpDate : null,
    });
    try {
      await dermaSendPrescription(consultId, {
        items: cleanItems,
        diagnosis,
        advice,
        precautions,
        signature_data: signatureData,
        signed_html: signedHtml,
        notes,
        follow_up_needed: followUpNeeded,
        follow_up_date: followUpNeeded ? followUpDate : null,
      });
      onSaved?.();
    } catch (e) {
      setError('Erreur : ' + (e?.message || ''));
    }
    setSaving(false);
  };

  return (
    <div>
      <h2>Ordonnance</h2>

      <div className="drm-field">
        <label>Diagnostic *</label>
        <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Ex : Acné inflammatoire modérée du visage" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Médicaments prescrits</label>
        {items.map((it, i) => (
          <div key={i} className="drm-rx-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Médicament #{i + 1}</strong>
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(i)} style={{ background: 'transparent', border: 'none', color: 'var(--y-danger)', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Supprimer</button>
              )}
            </div>
            <div className="drm-rx-item-grid">
              <div className="drm-field" style={{ marginBottom: 8 }}>
                <label>Nom (DCI ou marque)</label>
                <input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="Ex : Doxycycline" />
              </div>
              <div className="drm-field" style={{ marginBottom: 8 }}>
                <label>Forme</label>
                <input value={it.form} onChange={(e) => updateItem(i, { form: e.target.value })} placeholder="Comprimé, crème, gel…" />
              </div>
              <div className="drm-field" style={{ marginBottom: 8 }}>
                <label>Dosage</label>
                <input value={it.dosage} onChange={(e) => updateItem(i, { dosage: e.target.value })} placeholder="100 mg" />
              </div>
              <div className="drm-field" style={{ marginBottom: 8 }}>
                <label>Fréquence</label>
                <input value={it.frequency} onChange={(e) => updateItem(i, { frequency: e.target.value })} placeholder="1 fois / jour" />
              </div>
              <div className="drm-field" style={{ marginBottom: 8 }}>
                <label>Durée</label>
                <input value={it.duration} onChange={(e) => updateItem(i, { duration: e.target.value })} placeholder="3 mois" />
              </div>
              <div className="drm-field" style={{ marginBottom: 8 }}>
                <label>Notes</label>
                <input value={it.notes} onChange={(e) => updateItem(i, { notes: e.target.value })} placeholder="À prendre le soir…" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addItem} className="drm-rx-add">
          + Ajouter un médicament
        </button>
      </div>

      <div className="drm-field">
        <label>Conseils au patient</label>
        <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="Ex : Nettoyage doux 2×/j, éviter le soleil, hydratation…" />
      </div>

      <div className="drm-field">
        <label>Précautions</label>
        <textarea value={precautions} onChange={(e) => setPrecautions(e.target.value)} placeholder="Ex : Éviter grossesse, contre-indications, effets secondaires…" />
      </div>

      <div className="drm-field">
        <label>
          <input type="checkbox" checked={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />
          Prévoir une consultation de suivi
        </label>
        {followUpNeeded && (
          <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        )}
      </div>

      <div className="drm-field">
        <label>Notes internes (non visibles patient)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="drm-field">
        <label>Signature</label>
        <SignatureCanvas onChange={setSignatureData} />
      </div>

      {error && (
        <div style={{ padding: 10, background: 'var(--y-danger-soft)', color: 'var(--y-danger)', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="drm-btn drm-btn-secondary" onClick={onCancel}>Annuler</button>
        <button className="drm-btn drm-btn-primary" onClick={submit} disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Envoi…' : 'Signer et envoyer'}
        </button>
      </div>
    </div>
  );
}
