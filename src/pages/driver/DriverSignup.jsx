import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

// ══════════════════════════════════════════════════════════════════
//  PEDALEL — Signup wizard livreur (self-onboarding)
//  4 etapes : Toi → Vehicule → Documents → Zone
//  Palette teal Pedalel, mobile-first (max 480px)
// ══════════════════════════════════════════════════════════════════

const VEHICLE_TYPES = [
  {
    v: 'velo',
    label: 'Vélo',
    sub: 'Livraisons courtes',
    Icon: () => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18" cy="17.5" r="3.5" />
        <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
      </svg>
    ),
  },
  {
    v: 'moto',
    label: 'Moto',
    sub: 'Rapide, longue distance',
    Icon: () => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M9 17.5h6l3-6h-4L12 8H8" />
      </svg>
    ),
  },
  {
    v: 'scooter',
    label: 'Scooter',
    sub: 'Économique, souple',
    Icon: () => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="18" r="3" />
        <path d="M9 18h5l1-6h-4l-3-5h-4" />
      </svg>
    ),
  },
  {
    v: 'voiture',
    label: 'Voiture',
    sub: 'Gros paniers, familles',
    Icon: () => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5H3v-5z" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="17" cy="18" r="1.5" />
      </svg>
    ),
  },
];

const CITIES = ['Dakar', 'Rufisque', 'Thiès', 'Saint-Louis', 'Mbour', 'Ziguinchor', 'Touba', 'Kaolack'];

// Icones utilitaires
const IconBack = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconUpload = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconSpark = () => (
  <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Logo Pedalel small
function PedalelHeaderLogo() {
  return (
    <div className="ped-signup-brand">
      <img src="/pedalel-logo.png" alt="Pedalel" width="46" height="46" />
      <div>
        <div className="ped-signup-brand-name">Pedalel</div>
        <div className="ped-signup-brand-tag">Deviens livreur multi-plateforme</div>
      </div>
    </div>
  );
}

// Convertit un File en base64 data URL (fallback)
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Upload vers bucket driver-docs. Retourne { publicUrl }
async function uploadDriverDoc(file, kind) {
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('driver-docs')
    .upload(filename, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('driver-docs').getPublicUrl(filename);
  return data?.publicUrl || null;
}

export default function DriverSignup({ onBack, onDone }) {
  const [step, setStep] = useState(1); // 1..4, 5 = success
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Form state
  const [form, setForm] = useState({
    full_name: '',
    phone: '+221 ',
    email: '',
    vehicle_type: '',
    vehicle_details: '',
    license_plate: '',
    cni_photo_url: '',
    permit_photo_url: '',
    cni_preview: '',
    permit_preview: '',
    city: 'Dakar',
    neighborhood: '',
  });

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ─── Validation par étape ───
  const canNext = useMemo(() => {
    if (step === 1) {
      return form.full_name.trim().length >= 3 && form.phone.replace(/\D/g, '').length >= 9;
    }
    if (step === 2) {
      return !!form.vehicle_type && form.vehicle_details.trim().length >= 2;
    }
    if (step === 3) {
      return !!form.cni_photo_url && !!form.permit_photo_url;
    }
    if (step === 4) {
      return !!form.city && form.neighborhood.trim().length >= 2;
    }
    return false;
  }, [step, form]);

  const handleNext = () => {
    setErr('');
    if (!canNext) {
      setErr('Merci de remplir tous les champs.');
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      return;
    }
    if (step < 4) setStep(step + 1);
    else handleSubmit();
  };

  const handlePrev = () => {
    setErr('');
    if (step > 1) setStep(step - 1);
    else onBack?.();
  };

  // ─── Upload documents ───
  const handleUpload = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limite basique
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Fichier trop lourd (8 Mo max)');
      return;
    }
    setBusy(true);
    try {
      const preview = await fileToDataUrl(file);
      let url;
      try {
        url = await uploadDriverDoc(file, kind);
      } catch (upErr) {
        console.warn('[Pedalel Signup] storage upload failed, using base64 fallback', upErr);
        url = preview; // fallback : envoie base64 direct
      }
      if (kind === 'cni') {
        setField('cni_photo_url', url);
        setField('cni_preview', preview);
      } else {
        setField('permit_photo_url', url);
        setField('permit_preview', preview);
      }
      toast.success('Photo ajoutée');
    } catch (er) {
      toast.error('Impossible de lire le fichier.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    setBusy(true);
    setErr('');
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        vehicle_type: form.vehicle_type,
        vehicle_details: form.vehicle_details.trim(),
        cni_photo_url: form.cni_photo_url,
        permit_photo_url: form.permit_photo_url,
        license_plate: form.license_plate.trim() || null,
        city: form.city,
        neighborhood: form.neighborhood.trim(),
      };
      const { data, error } = await supabase.rpc('pedalel_submit_application', {
        p_full_name: payload.full_name,
        p_phone: payload.phone,
        p_email: payload.email,
        p_vehicle_type: payload.vehicle_type,
        p_vehicle_details: payload.vehicle_details,
        p_cni_photo_url: payload.cni_photo_url,
        p_permit_photo_url: payload.permit_photo_url,
        p_license_plate: payload.license_plate,
        p_city: payload.city,
        p_neighborhood: payload.neighborhood,
      });

      if (error || (data && data.success === false)) {
        console.warn('[Pedalel Signup] submit error:', error || data);
        setErr('Impossible d\'envoyer ta candidature. Réessaie dans un instant.');
        setBusy(false);
        return;
      }
      setStep(5);
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (e) {
      console.error('[Pedalel Signup] fatal:', e);
      setErr('Erreur réseau. Vérifie ta connexion.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Progress bar ───
  const progress = Math.min(100, Math.round(((step - 1) / 4) * 100));

  // ─── STEP 5 : SUCCESS ─────────────────────────────────────
  if (step === 5) {
    return (
      <div className="ped-signup-page ped-signup-success">
        <div className="ped-signup-success-inner">
          <div className="ped-signup-success-check">
            <IconSpark />
          </div>
          <h1>Candidature envoyée !</h1>
          <p>
            Merci <strong>{form.full_name.split(' ')[0]}</strong>. Notre équipe vérifie tes documents. Tu recevras un appel WhatsApp au <strong>{form.phone}</strong> sous 24h pour activer ton compte.
          </p>
          <div className="ped-signup-success-steps">
            <div className="ped-signup-success-step">
              <div className="ped-signup-success-step-num">1</div>
              <div>Vérification des documents (moins de 24h)</div>
            </div>
            <div className="ped-signup-success-step">
              <div className="ped-signup-success-step-num">2</div>
              <div>Appel WhatsApp pour confirmer</div>
            </div>
            <div className="ped-signup-success-step">
              <div className="ped-signup-success-step-num">3</div>
              <div>Réception de ton PIN et 1ères courses</div>
            </div>
          </div>
          <button className="ped-signup-btn ped-signup-btn-primary" onClick={() => onDone?.()}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // ─── STEPS 1..4 ─────────────────────────────────────
  return (
    <div className="ped-signup-page">
      {/* HEADER */}
      <header className="ped-signup-header">
        <button className="ped-signup-back" onClick={handlePrev} aria-label="Retour" disabled={busy}>
          <IconBack />
        </button>
        <PedalelHeaderLogo />
      </header>

      {/* PROGRESS */}
      <div className="ped-signup-progress-wrap">
        <div className="ped-signup-progress-track">
          <div className="ped-signup-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="ped-signup-progress-meta">
          <span>Étape {step} sur 4</span>
          <span>{['Toi', 'Ton véhicule', 'Documents', 'Ta zone'][step - 1]}</span>
        </div>
      </div>

      {/* STEP CONTENT */}
      <main className="ped-signup-body">
        {step === 1 && (
          <section className="ped-signup-step">
            <h2 className="ped-signup-title">Parle-nous de toi</h2>
            <p className="ped-signup-sub">Ces infos serviront à te contacter et créer ton compte.</p>

            <div className="ped-signup-field">
              <label>Nom complet</label>
              <input
                className="ped-signup-input"
                type="text"
                placeholder="Ex : Moussa Diallo"
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="ped-signup-field">
              <label>Numéro de téléphone</label>
              <input
                className="ped-signup-input"
                type="tel"
                inputMode="tel"
                placeholder="+221 77 000 00 00"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                autoComplete="tel"
              />
              <div className="ped-signup-hint">Utilisé pour te joindre par WhatsApp.</div>
            </div>

            <div className="ped-signup-field">
              <label>
                Email <span className="ped-signup-optional">(optionnel)</span>
              </label>
              <input
                className="ped-signup-input"
                type="email"
                inputMode="email"
                placeholder="moussa@email.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                autoComplete="email"
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="ped-signup-step">
            <h2 className="ped-signup-title">Ton véhicule</h2>
            <p className="ped-signup-sub">Choisis ce que tu utilises pour livrer.</p>

            <div className="ped-signup-vehicles">
              {VEHICLE_TYPES.map((vt) => {
                const selected = form.vehicle_type === vt.v;
                return (
                  <button
                    key={vt.v}
                    type="button"
                    className={`ped-signup-vehicle ${selected ? 'selected' : ''}`}
                    onClick={() => setField('vehicle_type', vt.v)}
                  >
                    <div className="ped-signup-vehicle-icon">
                      <vt.Icon />
                    </div>
                    <div className="ped-signup-vehicle-label">{vt.label}</div>
                    <div className="ped-signup-vehicle-sub">{vt.sub}</div>
                    {selected && (
                      <div className="ped-signup-vehicle-check">
                        <IconCheck />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ped-signup-field">
              <label>Marque et modèle</label>
              <input
                className="ped-signup-input"
                type="text"
                placeholder="Ex : Yamaha DT 125"
                value={form.vehicle_details}
                onChange={(e) => setField('vehicle_details', e.target.value)}
              />
            </div>

            {form.vehicle_type !== 'velo' && (
              <div className="ped-signup-field">
                <label>
                  Plaque d'immatriculation <span className="ped-signup-optional">(optionnel)</span>
                </label>
                <input
                  className="ped-signup-input"
                  type="text"
                  placeholder="DK 1234 AA"
                  value={form.license_plate}
                  onChange={(e) => setField('license_plate', e.target.value.toUpperCase())}
                />
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="ped-signup-step">
            <h2 className="ped-signup-title">Tes documents</h2>
            <p className="ped-signup-sub">
              Photos claires, lisibles, sans reflet. Elles sont chiffrées et vues uniquement par notre équipe.
            </p>

            <div className="ped-signup-uploads">
              <label className={`ped-signup-upload ${form.cni_photo_url ? 'done' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => handleUpload(e, 'cni')}
                  disabled={busy}
                />
                {form.cni_preview ? (
                  <div className="ped-signup-upload-preview">
                    <img src={form.cni_preview} alt="CNI" />
                    <div className="ped-signup-upload-badge">
                      <IconCheck />
                    </div>
                  </div>
                ) : (
                  <div className="ped-signup-upload-empty">
                    <IconUpload />
                  </div>
                )}
                <div className="ped-signup-upload-meta">
                  <div className="ped-signup-upload-title">Carte d'identité</div>
                  <div className="ped-signup-upload-sub">
                    {form.cni_photo_url ? 'Photo ajoutée' : 'Recto ou verso, format JPG/PNG'}
                  </div>
                </div>
              </label>

              <label className={`ped-signup-upload ${form.permit_photo_url ? 'done' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => handleUpload(e, 'permit')}
                  disabled={busy}
                />
                {form.permit_preview ? (
                  <div className="ped-signup-upload-preview">
                    <img src={form.permit_preview} alt="Permis" />
                    <div className="ped-signup-upload-badge">
                      <IconCheck />
                    </div>
                  </div>
                ) : (
                  <div className="ped-signup-upload-empty">
                    <IconUpload />
                  </div>
                )}
                <div className="ped-signup-upload-meta">
                  <div className="ped-signup-upload-title">Permis de conduire</div>
                  <div className="ped-signup-upload-sub">
                    {form.permit_photo_url
                      ? 'Photo ajoutée'
                      : form.vehicle_type === 'velo'
                      ? 'Optionnel pour un vélo — mets ta CNI en 2nd si besoin'
                      : 'Valide et en cours'}
                  </div>
                </div>
              </label>
            </div>

            <div className="ped-signup-info">
              Astuce : pose ta pièce sur une table sombre, sans reflet, et cadre juste la carte.
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="ped-signup-step">
            <h2 className="ped-signup-title">Ta zone</h2>
            <p className="ped-signup-sub">On te propose les courses proches de chez toi en priorité.</p>

            <div className="ped-signup-field">
              <label>Ville</label>
              <div className="ped-signup-city-grid">
                {CITIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`ped-signup-city ${form.city === c ? 'active' : ''}`}
                    onClick={() => setField('city', c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="ped-signup-field">
              <label>Quartier</label>
              <input
                className="ped-signup-input"
                type="text"
                placeholder="Ex : Sacré-Cœur, Ouakam, Grand Yoff…"
                value={form.neighborhood}
                onChange={(e) => setField('neighborhood', e.target.value)}
              />
              <div className="ped-signup-hint">Sois le plus précis possible.</div>
            </div>

            <div className="ped-signup-recap">
              <div className="ped-signup-recap-title">Récapitulatif</div>
              <div className="ped-signup-recap-row">
                <span>Nom</span>
                <strong>{form.full_name || '—'}</strong>
              </div>
              <div className="ped-signup-recap-row">
                <span>Téléphone</span>
                <strong>{form.phone}</strong>
              </div>
              <div className="ped-signup-recap-row">
                <span>Véhicule</span>
                <strong style={{ textTransform: 'capitalize' }}>{form.vehicle_type || '—'} · {form.vehicle_details || '—'}</strong>
              </div>
              <div className="ped-signup-recap-row">
                <span>Zone</span>
                <strong>{form.city} · {form.neighborhood || '—'}</strong>
              </div>
            </div>
          </section>
        )}

        {err && <div className="ped-signup-err">{err}</div>}
      </main>

      {/* FOOTER ACTIONS */}
      <footer className="ped-signup-actions">
        <button
          type="button"
          className="ped-signup-btn ped-signup-btn-ghost"
          onClick={handlePrev}
          disabled={busy}
        >
          {step === 1 ? 'Annuler' : 'Précédent'}
        </button>
        <button
          type="button"
          className="ped-signup-btn ped-signup-btn-primary"
          onClick={handleNext}
          disabled={busy || !canNext}
        >
          {busy ? (
            <span className="ped-signup-spin" />
          ) : step === 4 ? (
            'Envoyer ma candidature'
          ) : (
            'Suivant'
          )}
        </button>
      </footer>
    </div>
  );
}
