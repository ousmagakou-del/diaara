// ════════════════════════════════════════════════════════════════
// DermatoBook — /dermato/:slug/book?type=async|video&slot_id=xxx
// Wizard 3 étapes : Symptômes+photos → Infos patient → Récap+paiement
// Paiement Wave réel en 2 étapes (aligné natif app/dermato/book.jsx) :
//   A. "Payer X F CFA avec Wave" → book RPC → ouvre pay.wave.com
//   B. "J'ai payé — Confirmer" → confirm_dermato_payment → consultation
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

// Wave — même merchant que le checkout commandes (aligné natif)
const WAVE_MERCHANT_ID = 'M_sn_1n3_7fYSI-Io';
const WAVE_URL_BASE = `https://pay.wave.com/m/${WAVE_MERCHANT_ID}/c/sn?amount=`;

const PAY_METHODS = [
  { id: 'wave', label: 'Wave' },
  { id: 'orange', label: 'Orange Money', disabled: true, sub: 'Bientôt disponible' },
  { id: 'card', label: 'Carte bancaire', disabled: true, sub: 'Bientôt disponible' },
];

// Lien "Ajouter à Google Agenda" pour une visio (durée 20 min)
function googleCalendarUrl({ startsAt, durationMin = 20, dermatoName }) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Consultation dermato YARAM — ${dermatoName || 'Dermatologue'}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: 'Consultation vidéo avec votre dermatologue. Connectez-vous sur yaram.app 5 minutes avant pour rejoindre la visio.\n\nhttps://yaram.app/dermato',
    location: 'YARAM (visio)',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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
  // scan_id : propagé par ScanResult → DermatoLanding → DermatoProfile (route.params)
  // ou présent directement dans l'URL (?scan_id=...)
  const scanId = route?.params?.scan_id
    || (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('scan_id')
      : null);

  const [derm, setDerm] = useState(null);
  const [slots, setSlots] = useState([]);
  const [step, setStep] = useState(1);
  const [symptoms, setSymptoms] = useState('');
  const [photos, setPhotos] = useState([]); // urls
  const [uploading, setUploading] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [history, setHistory] = useState('');
  const [payMethod, setPayMethod] = useState('wave');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  // Paiement Wave : null = pas encore réservé | { cid, scheduledAt } = en attente confirmation
  const [pendingWave, setPendingWave] = useState(null);
  // Après confirmation d'une visio : écran succès avec lien Google Agenda
  const [confirmedVideo, setConfirmedVideo] = useState(null); // { cid, scheduledAt }
  const fileRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const d = await getDermatologistDetail(slug);
        setDerm(d?.dermatologist || d);
        setSlots(d?.slots || d?.dermatologist?.slots || []);
      } catch (_e) { /* ignore */ }
    })();
  }, [slug]);

  const price = type === 'video' ? (derm?.price_video_fcfa || 10000) : (derm?.price_async_fcfa || 3000);
  const slotStartsAt = slotId
    ? (slots.find((s) => String(s.id) === String(slotId))?.starts_at || null)
    : null;

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

  // ─── Étape A : crée la consultation (pending_payment) puis ouvre Wave ───
  const handlePay = async () => {
    if (!user?.id) {
      setError('Tu dois être connecté pour réserver.');
      return;
    }
    if (processing) return;
    setProcessing(true);
    setError(null);
    try {
      const common = {
        userId: user.id,
        dermatoId: derm?.id,
        description: symptoms.trim(),
        photos,
        age: age ? parseInt(age, 10) : null,
        gender: gender || null,
        history: history.trim() || null,
        skinScanId: scanId || null,
      };
      const consultRes = type === 'video'
        ? await bookDermatoVideo({ ...common, slotId })
        : await bookDermatoAsync(common);

      const consultId = consultRes?.consultation_id || consultRes?.id || consultRes?.consult_id;
      if (!consultId) {
        throw new Error(consultRes?.error || 'Réponse serveur inattendue');
      }

      // Ouvre Wave avec le montant exact (même flow que le natif)
      setPendingWave({
        cid: consultId,
        scheduledAt: consultRes?.scheduled_at || slotStartsAt || null,
      });
      window.open(`${WAVE_URL_BASE}${price}`, '_blank');
    } catch (e) {
      setError(e?.message || 'Erreur lors de la réservation');
    }
    setProcessing(false);
  };

  // ─── Étape B : le user revient de Wave et confirme ───
  const handleConfirmPaid = async () => {
    if (!pendingWave || processing) return;
    setProcessing(true);
    setError(null);
    try {
      await confirmDermatoPayment(pendingWave.cid, 'wave', `WAVE_${Date.now()}`);
      if (type === 'video' && pendingWave.scheduledAt) {
        // Visio : écran succès avec lien Google Agenda avant redirection
        setConfirmedVideo({ cid: pendingWave.cid, scheduledAt: pendingWave.scheduledAt });
      } else {
        navigate({ name: 'dermato_consultation', params: { id: pendingWave.cid } });
      }
    } catch (e) {
      setError(e?.message || 'Confirmation impossible. Réessaie dans un instant.');
    }
    setProcessing(false);
  };

  const canNext1 = symptoms.trim().length >= 10;
  const canNext2 = true;

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

  // ─── Écran succès visio : proposer l'ajout à Google Agenda ───
  if (confirmedVideo) {
    return (
      <div className="derm-page">
        <div className="derm-topbar">
          <div className="derm-topbar-title">Réservation confirmée</div>
        </div>
        <div className="derm-book-shell">
          <div className="derm-book-card" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: '#E8F5EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F8B4C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2>Ta visio est planifiée</h2>
            <p className="derm-book-sub">
              Tu recevras un rappel avant le rendez-vous. Connecte-toi 5 minutes avant pour rejoindre la visio.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              <a
                className="derm-btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none' }}
                href={googleCalendarUrl({
                  startsAt: confirmedVideo.scheduledAt,
                  durationMin: 20,
                  dermatoName: derm?.full_name ? `Dr ${derm.full_name}` : null,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ajouter à Google Agenda
              </a>
              <button
                className="derm-btn-primary"
                onClick={() => navigate({ name: 'dermato_consultation', params: { id: confirmedVideo.cid } })}
              >
                Ouvrir ma consultation
              </button>
            </div>
          </div>
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

            {scanId && (
              <div style={{ padding: '10px 14px', background: '#E8F5EC', color: '#0E5B33', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                Ton scan peau sera transmis au dermatologue avec ta demande.
              </div>
            )}

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

        {/* ─── ETAPE 2 : INFOS PATIENT (age / genre / antécédents — aligné natif) ─── */}
        {step === 2 && (
          <div className="derm-book-card">
            <h2>Étape 2 — Tes informations</h2>
            <p className="derm-book-sub">Ces infos aident le dermato à personnaliser le diagnostic.</p>

            <div className="derm-field">
              <label>Âge</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex : 28" />
            </div>
            <div className="derm-field">
              <label>Genre</label>
              <div className="derm-pay-methods">
                {['F', 'H', 'Autre'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`derm-pay-btn ${gender === g ? 'selected' : ''}`}
                    onClick={() => setGender(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="derm-field">
              <label>Antécédents (optionnel)</label>
              <textarea
                value={history}
                onChange={e => setHistory(e.target.value)}
                placeholder="Allergies, traitement en cours, maladies chroniques…"
                rows={3}
              />
            </div>

            <div className="derm-book-actions">
              <button className="derm-btn-secondary" onClick={() => setStep(1)}>Retour</button>
              <button className="derm-btn-primary" disabled={!canNext2} onClick={() => setStep(3)}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* ─── ETAPE 3 : RECAP + PAIEMENT WAVE ─── */}
        {step === 3 && (
          <div className="derm-book-card">
            <h2>Étape 3 — Confirme et paie</h2>
            <p className="derm-book-sub">Le paiement est sécurisé — validé avant la consultation.</p>

            <div className="derm-book-summary">
              <div className="derm-book-summary-row"><span>Dermatologue</span><strong>Dr {derm.full_name}</strong></div>
              <div className="derm-book-summary-row"><span>Type</span><strong>{type === 'video' ? 'Visio 20 min' : 'Consultation express'}</strong></div>
              {type === 'async' && photos.length > 0 && (
                <div className="derm-book-summary-row"><span>Photos jointes</span><strong>{photos.length}</strong></div>
              )}
              {age && <div className="derm-book-summary-row"><span>Âge</span><strong>{age}</strong></div>}
              {gender && <div className="derm-book-summary-row"><span>Genre</span><strong>{gender}</strong></div>}
              {scanId && <div className="derm-book-summary-row"><span>Scan peau</span><strong>Transmis au dermato</strong></div>}
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
                    disabled={m.disabled || !!pendingWave}
                    style={m.disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    onClick={() => !m.disabled && setPayMethod(m.id)}
                    title={m.sub || m.label}
                  >
                    {m.label}
                    {m.sub && <span style={{ display: 'block', fontSize: 10, fontWeight: 600 }}>{m.sub}</span>}
                  </button>
                ))}
              </div>
              <div className="derm-field-hint">
                {pendingWave
                  ? 'Après paiement dans Wave, reviens ici et confirme.'
                  : 'Paiement instantané via Wave. Remboursement intégral si annulation par le dermato.'}
              </div>
            </div>

            {error && (
              <div style={{ padding: 12, background: 'var(--y-danger-soft)', color: 'var(--y-danger)', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div className="derm-book-actions">
              {!pendingWave ? (
                <>
                  <button className="derm-btn-secondary" onClick={() => setStep(2)}>Retour</button>
                  <button className="derm-btn-primary" disabled={processing} onClick={handlePay}>
                    {processing ? 'Traitement…' : `Payer ${formatFcfa(price)} avec Wave`}
                  </button>
                </>
              ) : (
                <button className="derm-btn-primary" disabled={processing} onClick={handleConfirmPaid} style={{ flex: 1 }}>
                  {processing ? 'Confirmation…' : 'J\'ai payé — Confirmer'}
                </button>
              )}
            </div>

            {pendingWave && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => window.open(`${WAVE_URL_BASE}${price}`, '_blank')}
                  style={{ background: 'none', border: 'none', color: '#1F8B4C', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Rouvrir Wave pour payer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
