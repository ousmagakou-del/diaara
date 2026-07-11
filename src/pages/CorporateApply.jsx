// ════════════════════════════════════════════════════════════════
// YARAM — Landing "Corporate B2B" (salons, spas, instituts, cliniques)
// URL : /corporate
// ════════════════════════════════════════════════════════════════
//
// Landing premium destinee aux professionnels (salon de beaute, spa,
// institut, clinique). Explique le programme YARAM Pro :
//   - bulk pricing (remise 15% par defaut)
//   - ligne de credit 30 jours
//   - dashboard centralise + team members
//   - livraison groupee
// Form -> RPC corporate_apply.
// ════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import SiteLayout from '../components/SiteLayout';
import { toast } from '../lib/toast';
import './PartnerApplication.css';

export default function CorporateApply() {
  const [form, setForm] = useState({
    legal_name: '',
    ninea: '',
    rccm: '',
    business_type: 'salon',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    street: '',
    city: 'Dakar',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.legal_name.trim() || !form.contact_name.trim() || !form.contact_phone.trim()) {
      toast.error('Raison sociale, contact et telephone obligatoires');
      return;
    }
    setSubmitting(true);
    const address = {
      street: form.street || null,
      city: form.city || null,
      country: 'SN',
    };
    const { data, error } = await supabase.rpc('corporate_apply', {
      p_legal_name: form.legal_name,
      p_ninea: form.ninea || null,
      p_rccm: form.rccm || null,
      p_business_type: form.business_type,
      p_contact_name: form.contact_name,
      p_contact_email: form.contact_email,
      p_contact_phone: form.contact_phone,
      p_address: address,
      p_message: form.message || null,
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
        <div className="pa-success">
          <div className="pa-success-inner">
            <div className="pa-success-icon" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M12 22.5l7 7L32 15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>Candidature envoyee</h1>
            <p>Notre equipe commerciale vous contacte sous <strong>48h ouvrees</strong>.</p>
            <p className="pa-success-sub">
              En attendant, on peut discuter directement :{' '}
              <a href="https://wa.me/221774388766">WhatsApp +221 77 438 87 66</a>
            </p>
            <a href="/" className="pa-btn-secondary">Retour a l accueil</a>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="pa-hero">
        <div className="pa-hero-inner">
          <div className="pa-hero-content">
            <div className="pa-eyebrow">Programme corporate YARAM Pro</div>
            <h1>Salons, spas, instituts : YARAM Pro.</h1>
            <p className="pa-lead">
              Un compte entreprise dedie a votre etablissement de beaute.
              Remises volume, paiement 30 jours, dashboard centralise,
              livraisons groupees hebdomadaires. Zero paperasse.
            </p>
            <div className="pa-hero-cta">
              <a href="#form" className="pa-btn-primary">Ouvrir un compte pro</a>
              <a href="https://wa.me/221774388766" className="pa-btn-ghost">Parler a un commercial</a>
            </div>
            <div className="pa-trust">
              <div className="pa-trust-item"><strong>15%</strong><span>Remise volume defaut</span></div>
              <div className="pa-trust-item"><strong>30j</strong><span>Paiement differe</span></div>
              <div className="pa-trust-item"><strong>1x/sem</strong><span>Livraison groupee</span></div>
            </div>
          </div>
          <div className="pa-hero-visual">
            <div className="pa-hero-card">
              <div className="pa-hero-card-header">
                <div>
                  <div className="pa-hero-card-title">Dashboard entreprise</div>
                  <div className="pa-hero-card-sub">Institut Belle Rive</div>
                </div>
                <div className="pa-hero-badge">
                  <span className="pa-hero-badge-dot" />
                  Actif
                </div>
              </div>
              <div className="pa-hero-stats">
                <div className="pa-hero-stat">
                  <div className="pa-hero-stat-value">28</div>
                  <div className="pa-hero-stat-label">Commandes / mois</div>
                </div>
                <div className="pa-hero-stat pa-hero-stat--brand">
                  <div className="pa-hero-stat-value">1.2M</div>
                  <div className="pa-hero-stat-label">FCFA / trim.</div>
                </div>
                <div className="pa-hero-stat">
                  <div className="pa-hero-stat-value">4</div>
                  <div className="pa-hero-stat-label">Acheteurs</div>
                </div>
              </div>
              <div className="pa-hero-card-footer">
                Credit disponible : 800 000 FCFA sur 1 500 000
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="pa-values">
        <div className="pa-values-inner">
          <div className="pa-section-eyebrow">Pourquoi YARAM Pro</div>
          <h2>Un vrai compte fournisseur. Pense pour votre etablissement.</h2>
          <div className="pa-values-grid">
            <ValueCard num="01" title="Remise volume 15%" desc="Prix bulk applique automatiquement au checkout. Negociable jusqu a 25% selon volume et engagement." />
            <ValueCard num="02" title="Ligne de credit 30 jours" desc="Facturation mensuelle. Vous commandez quand il faut, vous payez a J+30. On garde la tresorerie fluide." />
            <ValueCard num="03" title="Dashboard entreprise" desc="Consommation par acheteur, factures en cours, credit disponible, historique. Tout en un endroit." />
            <ValueCard num="04" title="Team members" desc="Ajoutez vos assistantes, esthetiticiennes, gerants. Chacun commande sous le compte pro, vous validez." />
            <ValueCard num="05" title="Livraison groupee" desc="Une livraison / semaine planifiee sur votre etablissement. Fini les 10 livreurs qui frappent chaque jour." />
            <ValueCard num="06" title="Catalogue pro" desc="Acces a des references reservees aux professionnels : marques exclusives, formats professionnels." />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="pa-how">
        <div className="pa-how-inner">
          <div className="pa-section-eyebrow">Comment ca marche</div>
          <h2>Trois etapes. Setup en 48h.</h2>
          <div className="pa-how-grid">
            <HowStep num="1" title="Vous candidatez" desc="Formulaire ci-dessous. NINEA, RCCM, contact du gerant. On verifie et on vous rappelle sous 48h." />
            <HowStep num="2" title="On negocie" desc="Rendez-vous 30 min. On aligne remise volume, ligne de credit, jour de livraison. Contrat signable en ligne." />
            <HowStep num="3" title="Vous commandez" desc="Compte pro active. Vos acheteurs commandent, la remise et le credit s appliquent automatiquement." />
          </div>
        </div>
      </section>

      {/* FORM */}
      <section id="form" className="pa-form">
        <div className="pa-form-inner">
          <div className="pa-form-side">
            <div className="pa-section-eyebrow">Candidature entreprise</div>
            <h2>Ouvrir un compte YARAM Pro</h2>
            <p>Remplis ces informations. Un commercial YARAM te rappelle sous 48h avec une proposition de contrat pre-remplie (remise, credit, terme).</p>
            <ul className="pa-form-checklist">
              <li>Reponse sous 48h ouvrees</li>
              <li>Aucun engagement a ce stade</li>
              <li>Contrat pro signable en ligne</li>
              <li>Support commercial dedie</li>
            </ul>
            <div className="pa-form-contact">
              <div className="pa-form-contact-label">Ou contacte-nous directement</div>
              <a href="https://wa.me/221774388766" className="pa-form-contact-link">WhatsApp · +221 77 438 87 66</a>
              <a href="mailto:pro@yaram.app" className="pa-form-contact-link">Email · pro@yaram.app</a>
            </div>
          </div>

          <form className="pa-form-card" onSubmit={handleSubmit}>
            <h3>Ouvrir un compte pro</h3>

            <div className="pa-form-row">
              <Field label="Raison sociale *" val={form.legal_name} onChange={v => upd('legal_name', v)} placeholder="Institut Belle Rive SARL" />
              <SelectField
                label="Type d etablissement *"
                val={form.business_type}
                onChange={v => upd('business_type', v)}
                options={[
                  { v: 'salon', l: 'Salon de beaute' },
                  { v: 'spa', l: 'Spa' },
                  { v: 'institut', l: 'Institut' },
                  { v: 'clinic', l: 'Clinique / cabinet' },
                  { v: 'other', l: 'Autre' },
                ]}
              />
            </div>

            <div className="pa-form-row">
              <Field label="NINEA" val={form.ninea} onChange={v => upd('ninea', v)} placeholder="00XXXXXX" />
              <Field label="RCCM" val={form.rccm} onChange={v => upd('rccm', v)} placeholder="SN-DKR-XXXX" />
            </div>

            <div className="pa-form-row">
              <Field label="Contact gerant *" val={form.contact_name} onChange={v => upd('contact_name', v)} placeholder="Awa Ndiaye" />
              <Field label="Telephone *" val={form.contact_phone} onChange={v => upd('contact_phone', v)} placeholder="+221 XX XXX XX XX" type="tel" />
            </div>

            <div className="pa-form-row">
              <Field label="Email pro" val={form.contact_email} onChange={v => upd('contact_email', v)} placeholder="contact@institut.sn" type="email" />
              <Field label="Ville" val={form.city} onChange={v => upd('city', v)} placeholder="Dakar" />
            </div>

            <Field label="Adresse etablissement" val={form.street} onChange={v => upd('street', v)} placeholder="Rue X × Y, quartier" />

            <div className="pa-form-field">
              <label>Un mot pour nous ?</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={e => upd('message', e.target.value)}
                placeholder="Ex : nous consommons ~250 000 FCFA/mois en soins visage, disponibles pour rdv…"
              />
            </div>

            <button type="submit" className="pa-form-submit" disabled={submitting}>
              {submitting ? 'Envoi…' : 'Envoyer ma candidature'}
            </button>
            <p className="pa-form-note">En cliquant, vous acceptez que YARAM vous recontacte au numero fourni.</p>
          </form>
        </div>
      </section>
    </SiteLayout>
  );
}

function ValueCard({ num, title, desc }) {
  return (
    <div className="pa-value-card">
      <div className="pa-value-num">{num}</div>
      <div className="pa-value-title">{title}</div>
      <div className="pa-value-desc">{desc}</div>
    </div>
  );
}

function HowStep({ num, title, desc }) {
  return (
    <div className="pa-how-step">
      <div className="pa-how-num">{num}</div>
      <div className="pa-how-title">{title}</div>
      <div className="pa-how-desc">{desc}</div>
    </div>
  );
}

function Field({ label, val, onChange, placeholder, type = 'text' }) {
  return (
    <div className="pa-form-field">
      <label>{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function SelectField({ label, val, onChange, options }) {
  return (
    <div className="pa-form-field">
      <label>{label}</label>
      <select value={val} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
