// ════════════════════════════════════════════════════════════════
// YARAM — Landing "Devenir Chauffeur / Livreur"
// URL : /driver-application
// ════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import SiteLayout from '../components/SiteLayout';
import { toast } from '../lib/toast';
import './DriverApplication.css';

export default function DriverApplication() {
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', birth_date: '',
    cni: '', city: 'Dakar', neighborhood: '',
    vehicle_type: 'moto', vehicle_brand: '',
    license_number: '', hours_per_week: '',
    motivation: '', has_smartphone: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Estimation revenus (basé sur nb heures + rate moyen)
  const [hoursPreview, setHoursPreview] = useState(30);
  const revenueEstimate = useMemo(() => {
    // Hypothèse : 3 courses / heure × 1500 FCFA moyens = 4500 FCFA/h
    // × hoursPreview/semaine × 4 semaines/mois
    const perHour = 4500;
    return Math.round(perHour * hoursPreview * 4);
  }, [hoursPreview]);

  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim() || !form.city.trim()) {
      toast.error('Nom, téléphone et ville obligatoires');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('public_submit_driver_application', {
      p_full_name: form.full_name,
      p_phone: form.phone,
      p_city: form.city,
      p_vehicle_type: form.vehicle_type,
      p_email: form.email || null,
      p_birth_date: form.birth_date || null,
      p_cni: form.cni || null,
      p_neighborhood: form.neighborhood || null,
      p_vehicle_brand: form.vehicle_brand || null,
      p_license_number: form.license_number || null,
      p_hours_per_week: form.hours_per_week ? Number(form.hours_per_week) : null,
      p_motivation: form.motivation || null,
      p_has_smartphone: form.has_smartphone,
      p_user_agent: navigator.userAgent,
    });
    setSubmitting(false);
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message || 'inconnue'));
      return;
    }
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (submitted) {
    return (
      <SiteLayout>
        <div className="da-success">
          <div className="da-success-inner">
            <div className="da-success-icon" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M12 22.5l7 7L32 15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>Candidature envoyée</h1>
            <p>Notre équipe RH te contacte sous <strong>48h</strong> pour un entretien téléphonique.</p>
            <p className="da-success-sub">
              En attendant, garde ton téléphone chargé —{' '}
              <a href="https://wa.me/221774388766">WhatsApp +221 77 438 87 66</a>
            </p>
            <a href="/" className="da-btn-secondary">Retour à l'accueil</a>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="da-hero">
        <div className="da-hero-inner">
          <div className="da-hero-content">
            <div className="da-eyebrow">Rejoins la flotte YARAM</div>
            <h1>Roule quand tu veux. Gagne comme tu veux.</h1>
            <p className="da-lead">
              Deviens livreur YARAM à Dakar. <strong>Paiement chaque lundi</strong>, bonus heures creuses,
              zéro patron. Ton moto, ton horaire, tes gains.
            </p>
            <div className="da-hero-cta">
              <a href="#form" className="da-btn-primary">Postuler maintenant</a>
              <a href="https://wa.me/221774388766" className="da-btn-ghost">WhatsApp direct</a>
            </div>
            <div className="da-trust">
              <div className="da-trust-item"><strong>85 000+</strong><span>FCFA/mois moyen</span></div>
              <div className="da-trust-item"><strong>150+</strong><span>Livreurs actifs</span></div>
              <div className="da-trust-item"><strong>Lundi</strong><span>Paiement hebdo</span></div>
            </div>
          </div>

          <div className="da-hero-visual">
            <div className="da-hero-card">
              <div className="da-hero-card-header">
                <div className="da-hero-driver-avatar">M</div>
                <div className="da-hero-driver-meta">
                  <div className="da-hero-driver-name">Moussa · Livreur #087</div>
                  <div className="da-hero-driver-rating">4.9/5 · Dakar Sud</div>
                </div>
                <div className="da-hero-online">
                  <span className="da-hero-online-dot" />
                  Actif
                </div>
              </div>
              <div className="da-hero-week">
                <div className="da-hero-week-label">Cette semaine</div>
                <div className="da-hero-week-amount">27 800 <span>FCFA</span></div>
              </div>
              <div className="da-hero-week-details">
                <div className="da-hero-week-row">
                  <span>18 courses</span>
                  <span>1 400 FCFA</span>
                </div>
                <div className="da-hero-week-row">
                  <span>Bonus heures creuses</span>
                  <span>+ 2 600 FCFA</span>
                </div>
                <div className="da-hero-week-row da-hero-week-row--tips">
                  <span>Pourboires</span>
                  <span>+ 3 500 FCFA</span>
                </div>
              </div>
              <div className="da-hero-payout">
                Paiement lundi 8h · Wave / OM
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="da-values">
        <div className="da-values-inner">
          <div className="da-section-eyebrow">Pourquoi YARAM</div>
          <h2>Un vrai boulot. Sans un vrai patron.</h2>
          <div className="da-values-grid">
            <ValueCard num="01" title="Tes horaires, ta liberté" desc="Connecte-toi quand tu veux. Déconnecte quand tu veux. Pas de shift imposé, pas de pointage." />
            <ValueCard num="02" title="Paiement chaque lundi" desc="Wave / Orange Money / Free Money. Ton solde de la semaine tombe le lundi matin. Fin des attentes." />
            <ValueCard num="03" title="Bonus heures creuses" desc="+20% sur les courses entre 12h-14h et 20h-22h. Plus la demande monte, plus tu gagnes." />
            <ValueCard num="04" title="Assurance courses" desc="Chaque livraison est assurée jusqu'à 100 000 FCFA. Toi et le colis êtes couverts pendant la course." />
            <ValueCard num="05" title="App simple + intuitive" desc="Une seule app. Tu vois les courses proches, tu acceptes, tu livres. Le client paye automatiquement." />
            <ValueCard num="06" title="Démarrage rapide" desc="Candidature, entretien téléphonique, briefing 30 min, 1ère course. Le tout en 5 jours max." />
          </div>
        </div>
      </section>

      {/* REVENUE CALCULATOR */}
      <section className="da-calc">
        <div className="da-calc-inner">
          <div className="da-calc-card">
            <div className="da-section-eyebrow">Calculateur</div>
            <h2>Combien tu peux gagner ?</h2>
            <p>Estimation basée sur nos livreurs actifs à Dakar. Résultats réels — pas de blabla.</p>

            <label className="da-calc-label">Heures / semaine : <strong>{hoursPreview}h</strong></label>
            <input
              type="range" min="10" max="60" step="5"
              value={hoursPreview}
              onChange={(e) => setHoursPreview(Number(e.target.value))}
              className="da-calc-slider"
            />
            <div className="da-calc-marks">
              <span>10h</span><span>30h</span><span>60h</span>
            </div>

            <div className="da-calc-result">
              <div className="da-calc-result-label">Revenu moyen / mois</div>
              <div className="da-calc-result-amount">
                {revenueEstimate.toLocaleString('fr-FR')} <span>FCFA</span>
              </div>
              <div className="da-calc-result-note">
                Basé sur 3 courses/heure × 1 500 FCFA moyens. Bonus + pourboires non inclus.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section className="da-req">
        <div className="da-req-inner">
          <div className="da-section-eyebrow">Ce que tu dois avoir</div>
          <h2>Prérequis simples.</h2>
          <div className="da-req-grid">
            <ReqItem title="Un moyen de transport" desc="Moto (recommandé), scooter, vélo ou voiture. Le tien ou en location." />
            <ReqItem title="Un smartphone" desc="Android ou iPhone récent avec GPS et data. Pour l'app livreur." />
            <ReqItem title="Permis valide (si moto/voiture)" desc="Photocopie à fournir. Pas besoin de permis pour vélo/marche." />
            <ReqItem title="CNI valide" desc="Requise pour le contrat de prestation." />
            <ReqItem title="Compte Wave ou OM" desc="Pour recevoir ton paiement hebdo automatiquement." />
            <ReqItem title="18 ans minimum" desc="Aucun diplôme requis. On forme sur le tas." />
          </div>
        </div>
      </section>

      {/* FORM */}
      <section id="form" className="da-form">
        <div className="da-form-inner">
          <div className="da-form-side">
            <div className="da-section-eyebrow">Candidature</div>
            <h2>Prêt à rouler ?</h2>
            <p>Remplis ce formulaire en 3 minutes. On te rappelle sous 48h pour un entretien téléphonique.</p>
            <ul className="da-form-checklist">
              <li>Rappel sous 48h</li>
              <li>Entretien en wolof ou français</li>
              <li>Contrat signé en ligne</li>
              <li>1ère course dans les 5 jours</li>
            </ul>
            <div className="da-form-contact">
              <div className="da-form-contact-label">Une question ?</div>
              <a href="https://wa.me/221774388766" className="da-form-contact-link">WhatsApp · +221 77 438 87 66</a>
              <a href="mailto:livreurs@yaram.app" className="da-form-contact-link">Email · livreurs@yaram.app</a>
            </div>
          </div>

          <form className="da-form-card" onSubmit={handleSubmit}>
            <h3>Postuler en 3 minutes</h3>

            <div className="da-form-row">
              <Field label="Nom complet *" val={form.full_name} onChange={v => upd('full_name', v)} placeholder="Ex : Moussa Diop" />
              <Field label="Téléphone *" val={form.phone} onChange={v => upd('phone', v)} placeholder="+221 XX XXX XX XX" type="tel" />
            </div>

            <div className="da-form-row">
              <Field label="Email (facultatif)" val={form.email} onChange={v => upd('email', v)} placeholder="ton@email.sn" type="email" />
              <Field label="Date de naissance" val={form.birth_date} onChange={v => upd('birth_date', v)} type="date" />
            </div>

            <div className="da-form-row">
              <Field label="Ville *" val={form.city} onChange={v => upd('city', v)} placeholder="Dakar" />
              <Field label="Quartier" val={form.neighborhood} onChange={v => upd('neighborhood', v)} placeholder="Ex : Sacré-Cœur" />
            </div>

            <div className="da-form-field">
              <label>Ton véhicule *</label>
              <div className="da-vehicle-picker">
                {[
                  { id: 'moto', label: 'Moto' },
                  { id: 'scooter', label: 'Scooter' },
                  { id: 'velo', label: 'Vélo' },
                  { id: 'voiture', label: 'Voiture' },
                  { id: 'other', label: 'Autre' },
                ].map(v => (
                  <button
                    type="button"
                    key={v.id}
                    className={`da-vehicle-btn ${form.vehicle_type === v.id ? 'active' : ''}`}
                    onClick={() => upd('vehicle_type', v.id)}
                  >
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="da-form-row">
              <Field label="Marque / modèle (facultatif)" val={form.vehicle_brand} onChange={v => upd('vehicle_brand', v)} placeholder="Ex : Honda XL125" />
              <Field label="N° CNI (facultatif)" val={form.cni} onChange={v => upd('cni', v)} placeholder="1XXX XXXX XXXXX" />
            </div>

            <div className="da-form-row">
              <Field label="Heures / semaine dispo" val={form.hours_per_week} onChange={v => upd('hours_per_week', v)} type="number" placeholder="Ex : 30" />
              <Field label="N° permis (si applicable)" val={form.license_number} onChange={v => upd('license_number', v)} placeholder="Facultatif" />
            </div>

            <div className="da-form-field">
              <label>Pourquoi tu veux rejoindre YARAM ?</label>
              <textarea
                rows={3}
                value={form.motivation}
                onChange={e => upd('motivation', e.target.value)}
                placeholder="Ex : je cherche un complément de revenu, je connais bien Dakar…"
              />
            </div>

            <label className="da-form-checkbox">
              <input
                type="checkbox"
                checked={form.has_smartphone}
                onChange={e => upd('has_smartphone', e.target.checked)}
              />
              <span>J'ai un smartphone Android ou iPhone avec data</span>
            </label>

            <button type="submit" className="da-form-submit" disabled={submitting}>
              {submitting ? 'Envoi…' : 'Envoyer ma candidature'}
            </button>
            <p className="da-form-note">En cliquant, tu acceptes que YARAM t'appelle au numéro fourni.</p>
          </form>
        </div>
      </section>
    </SiteLayout>
  );
}

function ValueCard({ num, title, desc }) {
  return (
    <div className="da-value-card">
      <div className="da-value-num">{num}</div>
      <div className="da-value-title">{title}</div>
      <div className="da-value-desc">{desc}</div>
    </div>
  );
}

function ReqItem({ title, desc }) {
  return (
    <div className="da-req-item">
      <div className="da-req-check" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7l2.8 2.8L11 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div className="da-req-title">{title}</div>
        <div className="da-req-desc">{desc}</div>
      </div>
    </div>
  );
}

function Field({ label, val, onChange, placeholder, type = 'text' }) {
  return (
    <div className="da-form-field">
      <label>{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
