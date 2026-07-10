// ════════════════════════════════════════════════════════════════
// YARAM — Landing "Devenir Partenaire" (pharmacies)
// URL : /partner-application
// ════════════════════════════════════════════════════════════════
//
// Page de recrutement pharmacies partenaires. Style premium DoorDash-like.
// Hero + value props + how it works + form → RPC public_submit_partner_application.
// ════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import SiteLayout from '../components/SiteLayout';
import { toast } from '../lib/toast';
import './PartnerApplication.css';

export default function PartnerApplication() {
  const [form, setForm] = useState({
    pharmacy_name: '', owner_name: '', phone: '',
    email: '', city: 'Dakar', address: '', ninea: '',
    monthly_orders_estimate: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pharmacy_name.trim() || !form.owner_name.trim() || !form.phone.trim()) {
      toast.error('Nom pharmacie, gérant et téléphone obligatoires');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('public_submit_partner_application', {
      p_pharmacy_name: form.pharmacy_name,
      p_owner_name: form.owner_name,
      p_phone: form.phone,
      p_email: form.email || null,
      p_city: form.city || null,
      p_address: form.address || null,
      p_ninea: form.ninea || null,
      p_monthly_orders: form.monthly_orders_estimate ? Number(form.monthly_orders_estimate) : null,
      p_message: form.message || null,
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
        <div className="pa-success">
          <div className="pa-success-inner">
            <div className="pa-success-icon">✓</div>
            <h1>Candidature envoyée !</h1>
            <p>Notre équipe commerciale vous contacte sous <strong>48h ouvrées</strong>.</p>
            <p className="pa-success-sub">
              En attendant, on peut discuter directement :{' '}
              <a href="https://wa.me/221774388766">📞 WhatsApp +221 77 438 87 66</a>
            </p>
            <a href="/" className="pa-btn-secondary">Retour à l'accueil</a>
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
            <div className="pa-eyebrow">💼 PROGRAMME PARTENAIRES YARAM</div>
            <h1>Vends plus. Sans embaucher un livreur.</h1>
            <p className="pa-lead">
              Rejoins le réseau de pharmacies YARAM et touche <strong>+45 000 clients actifs</strong> à Dakar.
              Zéro frais d'inscription. Zéro équipe à recruter. On gère tout — commandes, paiement, livraison.
            </p>
            <div className="pa-hero-cta">
              <a href="#form" className="pa-btn-primary">Devenir partenaire →</a>
              <a href="https://wa.me/221774388766" className="pa-btn-ghost">Parler à un commercial</a>
            </div>
            <div className="pa-trust">
              <div className="pa-trust-item"><strong>25+</strong><span>Pharmacies actives</span></div>
              <div className="pa-trust-item"><strong>45k</strong><span>Clientes YARAM</span></div>
              <div className="pa-trust-item"><strong>4.9★</strong><span>Note moyenne</span></div>
            </div>
          </div>
          <div className="pa-hero-visual">
            <div className="pa-hero-card">
              <div className="pa-hero-card-header">
                <div className="pa-hero-card-icon">📊</div>
                <div>
                  <div className="pa-hero-card-title">Dashboard temps réel</div>
                  <div className="pa-hero-card-sub">Aujourd'hui · Pharmacie Sacré-Cœur</div>
                </div>
              </div>
              <div className="pa-hero-stats">
                <div className="pa-hero-stat">
                  <div className="pa-hero-stat-value">37</div>
                  <div className="pa-hero-stat-label">Commandes</div>
                </div>
                <div className="pa-hero-stat pa-hero-stat--green">
                  <div className="pa-hero-stat-value">128 500</div>
                  <div className="pa-hero-stat-label">FCFA CA</div>
                </div>
                <div className="pa-hero-stat">
                  <div className="pa-hero-stat-value">15 min</div>
                  <div className="pa-hero-stat-label">Prépa moy.</div>
                </div>
              </div>
              <div className="pa-hero-card-footer">
                <div className="pa-hero-live">
                  <span className="pa-hero-live-dot" />
                  <span>3 commandes en cours de préparation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="pa-values">
        <div className="pa-values-inner">
          <div className="pa-section-eyebrow">POURQUOI YARAM</div>
          <h2>Un vrai canal de vente. Sans les tracas.</h2>
          <div className="pa-values-grid">
            <ValueCard icon="🎯" title="Seulement 5% de commission" desc="Le taux le plus bas du marché. Aucun frais fixe, aucun abonnement, aucune franchise cachée." />
            <ValueCard icon="🛵" title="Livreurs YARAM inclus" desc="Notre flotte gère la livraison. Toi tu prépares, on récupère, on livre. Le client paye tout via l'app." />
            <ValueCard icon="💰" title="Paiement chaque vendredi" desc="Virement Wave / Orange Money / bancaire. Fin de suspens : tu sais exactement combien tu reçois." />
            <ValueCard icon="📊" title="Dashboard temps réel" desc="Suis commandes, ventes, top produits, feedbacks clientes — depuis ton téléphone." />
            <ValueCard icon="🚀" title="Setup en 24h" desc="Signature en ligne, catalogue importé, formation du staff, tu es live le lendemain." />
            <ValueCard icon="🎁" title="Zéro frais cachés" desc="Pas de setup fee. Pas de matériel à acheter. Tu résilies en 30 jours si tu veux — sans pénalité." />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="pa-how">
        <div className="pa-how-inner">
          <div className="pa-section-eyebrow">COMMENT ÇA MARCHE</div>
          <h2>Trois étapes. Quinze minutes chacune.</h2>
          <div className="pa-how-grid">
            <HowStep num="1" title="On s'appelle" desc="15 min au téléphone. On comprend ton activité, tes horaires, tes produits phares. On répond à tes questions." />
            <HowStep num="2" title="On signe en ligne" desc="Contrat électronique envoyé par email — signature en 2 minutes depuis ton téléphone. Rien à imprimer." />
            <HowStep num="3" title="Tu es live" desc="On importe ton catalogue, on forme ton staff (30 min), la 1ère commande arrive dans les 48h." />
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="pa-testimonial">
        <div className="pa-testimonial-inner">
          <div className="pa-testimonial-avatar">D</div>
          <blockquote>
            "En 3 mois, YARAM représente 22% de mon chiffre d'affaires. Zéro effort de mon côté — les livreurs sont pros, les paiements arrivent chaque vendredi. Franchement, je regrette juste de pas avoir signé plus tôt."
          </blockquote>
          <div className="pa-testimonial-author">
            <strong>Dr Diallo</strong>
            <span>Pharmacie du Point E, Dakar · Partenaire depuis mars 2026</span>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section id="form" className="pa-form">
        <div className="pa-form-inner">
          <div className="pa-form-side">
            <div className="pa-section-eyebrow">CANDIDATURE</div>
            <h2>Prêt à démarrer ?</h2>
            <p>Remplis ce formulaire. Un commercial YARAM t'appelle dans les 48h avec une offre concrète et un contrat pré-rempli.</p>
            <ul className="pa-form-checklist">
              <li>✓ Réponse sous 48h ouvrées</li>
              <li>✓ Aucun engagement à ce stade</li>
              <li>✓ Contrat signable en ligne</li>
              <li>✓ Support français / wolof</li>
            </ul>
            <div className="pa-form-contact">
              <div className="pa-form-contact-label">Ou contacte-nous directement</div>
              <a href="https://wa.me/221774388766" className="pa-form-contact-link">📱 +221 77 438 87 66</a>
              <a href="mailto:partenaires@yaram.app" className="pa-form-contact-link">✉ partenaires@yaram.app</a>
            </div>
          </div>

          <form className="pa-form-card" onSubmit={handleSubmit}>
            <h3>Postuler en 2 minutes</h3>

            <div className="pa-form-row">
              <Field label="Nom de la pharmacie *" val={form.pharmacy_name} onChange={v => upd('pharmacy_name', v)} placeholder="Pharmacie du Point E" />
              <Field label="Ville *" val={form.city} onChange={v => upd('city', v)} placeholder="Dakar" />
            </div>

            <div className="pa-form-row">
              <Field label="Nom du gérant *" val={form.owner_name} onChange={v => upd('owner_name', v)} placeholder="Dr Diallo" />
              <Field label="Téléphone *" val={form.phone} onChange={v => upd('phone', v)} placeholder="+221 XX XXX XX XX" type="tel" />
            </div>

            <div className="pa-form-row">
              <Field label="Email" val={form.email} onChange={v => upd('email', v)} placeholder="contact@pharmacie.sn" type="email" />
              <Field label="NINEA" val={form.ninea} onChange={v => upd('ninea', v)} placeholder="00XXXXXX" />
            </div>

            <Field label="Adresse complète" val={form.address} onChange={v => upd('address', v)} placeholder="Rue X × Y, Quartier, Dakar" />

            <Field label="Estimation commandes / mois (facultatif)" val={form.monthly_orders_estimate} onChange={v => upd('monthly_orders_estimate', v)} placeholder="Ex : 200" type="number" />

            <div className="pa-form-field">
              <label>Un mot pour nous ?</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={e => upd('message', e.target.value)}
                placeholder="Ex : je suis intéressé, disponible pour un rdv la semaine prochaine…"
              />
            </div>

            <button type="submit" className="pa-form-submit" disabled={submitting}>
              {submitting ? 'Envoi…' : 'Envoyer ma candidature →'}
            </button>
            <p className="pa-form-note">En cliquant, vous acceptez que YARAM vous recontacte au numéro fourni.</p>
          </form>
        </div>
      </section>
    </SiteLayout>
  );
}

function ValueCard({ icon, title, desc }) {
  return (
    <div className="pa-value-card">
      <div className="pa-value-icon">{icon}</div>
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
