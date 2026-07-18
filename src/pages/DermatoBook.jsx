// ════════════════════════════════════════════════════════════════
// DermatoBook — /dermato/:slug/book?type=async|video&slot_id=xxx
// Wizard 3 étapes : Symptômes+photos → Infos patient → Récap+paiement
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useNav, useUser } from '../App';
import {
  getDermatologistDetail,
  bookDermatoAsync,
  bookDermatoVideo,
  confirmDermatoPayment,
  formatFcfa,
} from '../lib/dermato';
import { supabase } from '../lib/supabase';
import './Dermato.css';

const PAY_METHODS = [
  { id: 'wave', label: 'Wave' },
  { id: 'orange', label: 'Orange Money' },
  { id: 'card', label: 'Carte bancaire' },
];

async function uploadDermPhoto(file) {
  // Best-effort : essaie 3 buckets connus
  const buckets = ['dermato-photos', 'skin-scans', 'product-images'];
  for (const b of buckets) {
    try {
      const name = `derm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from(b).upload(name, file, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(b).getPublicUrl(name);
      if (data?.publicUrl) return data.publicUrl;
    } catch (_e) { /* try next */ }
  }
  return null;
}

export default function DermatoBook() {
  const { navigate, goBack, route } = useNav();
  const { user } = useUser();
  const slug = route?.params?.slug;
  const type = route?.params?.type || 'async';
  const slotId = route?.params?.slot_id || null;

  const [derm, setDerm] = useState(null);
  const [step, setStep] = useState(1);
  const [symptoms, setSymptoms] = useState('');
  const [photos, setPhotos] = useState([]); // urls
  const [uploading, setUploading] = useState(false);
  const [patient, setPatient] = useState({
    first_name: user?.first_name || user?.name || '',
    last_name: user?.last_name || '',
    age: '',
    phone: user?.phone || '',
    skin_type: user?.skin_type || '',
  });
  const [payMethod, setPayMethod] = useState('wave');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const d = await getDermatologistDetail(slug);
        setDerm(d?.dermatologist || d);
      } catch (_e) { /* ignore */ }
    })();
  }, [slug]);

  const price = type === 'video' ? (derm?.price_video_fcfa || 10000) : (derm?.price_async_fcfa || 3000);

  const onPickFiles = async (files) => {
    const list = Array.from(files || []).slice(0, 6 - photos.length);
    if (list.length === 0) return;
    setUploading(true);
    const uploaded = [];
    for (const f of list) {
      const url = await uploadDermPhoto(f);
      if (url) uploaded.push(url);
    }
    setPhotos([...photos, ...uploaded]);
    setUploading(false);
  };

  const removePhoto = (idx) => setPhotos(photos.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!user?.id) {
      setError('Tu dois être connecté pour réserver.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      let consultRes;
      if (type === 'video') {
        consultRes = await bookDermatoVideo({
          dermatologistId: derm?.id,
          userId: user.id,
          slotId,
          symptoms,
          patientInfo: patient,
        });
      } else {
        consultRes = await bookDermatoAsync({
          dermatologistId: derm?.id,
          userId: user.id,
          symptoms,
          photos,
          patientInfo: patient,
        });
      }

      const consultId = consultRes?.consultation_id || consultRes?.id || consultRes?.consult_id;
      if (!consultId) {
        throw new Error(consultRes?.error || 'Réponse serveur inattendue');
      }

      // MOCK payment
      await confirmDermatoPayment(consultId, payMethod, `MOCK_${Date.now()}`);

      // Redirect
      navigate({ name: 'dermato_consultation', params: { id: consultId } });
    } catch (e) {
      setError(e?.message || 'Erreur lors de la réservation');
    }
    setProcessing(false);
  };

  const canNext1 = symptoms.trim().length >= 10;
  const canNext2 = patient.first_name && patient.phone;

  if (!derm) {
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

  return (
    <div className="derm-page">
      <div className="derm-topbar">
        <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="derm-topbar-title">Réservation Dr {derm.full_name}</div>
      </div>

      <div className="derm-book-shell">
        <div className="derm-book-steps">
          <div className={`derm-book-step-dot ${step >= 1 ? 'active' : ''}`} />
          <div className={`derm-book-step-dot ${step >= 2 ? 'active' : ''}`} />
          <div className={`derm-book-step-dot ${step >= 3 ? 'active' : ''}`} />
        </div>

        {/* ─── ETAPE 1 : SYMPTOMES + PHOTOS ─── */}
        {step === 1 && (
          <div className="derm-book-card">
            <h2>Étape 1 — Décris tes symptômes</h2>
            <p className="derm-book-sub">
              Sois précis pour aider le dermatologue à poser un diagnostic rapide.
            </p>

            <div className="derm-field">
              <label>Symptômes / préoccupations *</label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Ex : boutons sur le menton depuis 2 semaines, démangeaisons, sécheresse…"
              />
              <div className="derm-field-hint">Minimum 10 caractères — donne le maximum de détails.</div>
            </div>

            {type === 'async' && (
              <div className="derm-field">
                <label>Photos (jusqu'à 6)</label>
                <div className="derm-photos-upload" onClick={() => fileRef.current?.click()}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => onPickFiles(e.target.files)}
                  />
                  {uploading ? 'Upload en cours…' : '📸  Ajouter des photos'}
                </div>
                {photos.length > 0 && (
                  <div className="derm-photos-thumbs">
                    {photos.map((p, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={p} alt="" className="derm-photo-thumb" />
                        <button
                          onClick={() => removePhoto(i)}
                          style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--y-danger)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="derm-field-hint">Les photos sont chiffrées, visibles uniquement par le dermato.</div>
              </div>
            )}

            <div className="derm-book-actions">
              <button className="derm-btn-secondary" onClick={goBack}>Annuler</button>
              <button className="derm-btn-primary" disabled={!canNext1} onClick={() => setStep(2)}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* ─── ETAPE 2 : INFOS PATIENT ─── */}
        {step === 2 && (
          <div className="derm-book-card">
            <h2>Étape 2 — Tes informations</h2>
            <p className="derm-book-sub">Ces infos aident le dermato à personnaliser le diagnostic.</p>

            <div className="derm-field">
              <label>Prénom *</label>
              <input value={patient.first_name} onChange={e => setPatient({ ...patient, first_name: e.target.value })} />
            </div>
            <div className="derm-field">
              <label>Nom</label>
              <input value={patient.last_name} onChange={e => setPatient({ ...patient, last_name: e.target.value })} />
            </div>
            <div className="derm-field">
              <label>Âge</label>
              <input type="number" value={patient.age} onChange={e => setPatient({ ...patient, age: e.target.value })} placeholder="Ex : 28" />
            </div>
            <div className="derm-field">
              <label>Téléphone *</label>
              <input value={patient.phone} onChange={e => setPatient({ ...patient, phone: e.target.value })} placeholder="+221 77 000 00 00" />
            </div>
            <div className="derm-field">
              <label>Type de peau</label>
              <select value={patient.skin_type} onChange={e => setPatient({ ...patient, skin_type: e.target.value })}>
                <option value="">Je ne sais pas</option>
                <option value="normal">Normale</option>
                <option value="dry">Sèche</option>
                <option value="oily">Grasse</option>
                <option value="combination">Mixte</option>
                <option value="sensitive">Sensible</option>
              </select>
            </div>

            <div className="derm-book-actions">
              <button className="derm-btn-secondary" onClick={() => setStep(1)}>Retour</button>
              <button className="derm-btn-primary" disabled={!canNext2} onClick={() => setStep(3)}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* ─── ETAPE 3 : RECAP + PAIEMENT ─── */}
        {step === 3 && (
          <div className="derm-book-card">
            <h2>Étape 3 — Confirme et paie</h2>
            <p className="derm-book-sub">Le paiement est sécurisé — validé avant la consultation.</p>

            <div className="derm-book-summary">
              <div className="derm-book-summary-row"><span>Dermatologue</span><strong>Dr {derm.full_name}</strong></div>
              <div className="derm-book-summary-row"><span>Type</span><strong>{type === 'video' ? 'Visio 15 min' : 'Chat asynchrone'}</strong></div>
              {type === 'async' && photos.length > 0 && (
                <div className="derm-book-summary-row"><span>Photos jointes</span><strong>{photos.length}</strong></div>
              )}
              <div className="derm-book-summary-row"><span>Patient</span><strong>{patient.first_name} {patient.last_name}</strong></div>
              <div className="derm-book-summary-total derm-book-summary-row">
                <span>Total à payer</span>
                <span>{formatFcfa(price)}</span>
              </div>
            </div>

            <div className="derm-field">
              <label>Mode de paiement</label>
              <div className="derm-pay-methods">
                {PAY_METHODS.map(m => (
                  <button
                    key={m.id}
                    className={`derm-pay-btn ${payMethod === m.id ? 'selected' : ''}`}
                    onClick={() => setPayMethod(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="derm-field-hint">Mode test : paiement simulé instantanément.</div>
            </div>

            {error && (
              <div style={{ padding: 12, background: 'var(--y-danger-soft)', color: 'var(--y-danger)', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div className="derm-book-actions">
              <button className="derm-btn-secondary" onClick={() => setStep(2)}>Retour</button>
              <button className="derm-btn-primary" disabled={processing} onClick={submit}>
                {processing ? 'Traitement…' : `Payer ${formatFcfa(price)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
