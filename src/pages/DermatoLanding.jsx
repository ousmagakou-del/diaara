// ════════════════════════════════════════════════════════════════
// DermatoLanding — /dermato
// Hero + Comment ça marche + Liste dermatologues + FAQ
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNav } from '../App';
import { listActiveDermatologists, formatFcfaShort } from '../lib/dermato';
import './Dermato.css';

const STEPS = [
  { n: 1, title: 'Choisis ton dermato', desc: 'Parcours nos dermatologues certifiés à Dakar et sélectionne celui qui te correspond.' },
  { n: 2, title: 'Décris tes symptômes', desc: 'Envoie des photos et détaille tes préoccupations en toute confidentialité.' },
  { n: 3, title: 'Reçois ton diagnostic', desc: 'Consultation express ou visio — diagnostic + ordonnance signée en moins de 2h.' },
];

const FAQ = [
  { q: 'Combien coûte une consultation ?', a: '3 000 F CFA pour une consultation express (photos + description). Une visio dure 20 minutes et coûte 10 000 F CFA.' },
  { q: 'Mes photos sont-elles sécurisées ?', a: 'Oui, toutes tes photos et messages sont chiffrés. Seul le dermatologue que tu choisis y a accès. Aucun partage tiers.' },
  { q: 'Comment paie-t-on ?', a: 'Wave, Orange Money ou carte bancaire. Le paiement se fait avant la consultation.' },
  { q: 'Combien de temps pour recevoir une réponse ?', a: 'Moins de 2 heures pour une consultation express. La visio se déroule à l\'horaire réservé.' },
  { q: 'Puis-je avoir une ordonnance ?', a: 'Oui, si le dermato juge que c\'est nécessaire, tu reçois une ordonnance signée numériquement, valable en pharmacie.' },
];

export default function DermatoLanding() {
  const { navigate } = useNav();
  const [dermatos, setDermatos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await listActiveDermatologists();
        setDermatos(list);
      } catch (e) {
        console.warn('[DermatoLanding] load error', e?.message);
      }
      setLoading(false);
    })();
  }, []);

  const gotoDoctor = (slug) => navigate({ name: 'dermato_profile', params: { slug } });

  return (
    <div className="derm-page">
      {/* HERO */}
      <section className="derm-hero">
        <div className="derm-hero-inner">
          <div className="derm-hero-eyebrow">Nouveau · YARAM Dermato</div>
          <h1 className="derm-hero-title">
            Consultez un <span>dermatologue</span> en ligne
          </h1>
          <p className="derm-hero-sub">
            Dès 3 000 F CFA — réponse en moins de 2h ou visio 20 min avec un spécialiste certifié à Dakar.
            Photos, diagnostic, ordonnance numérique.
          </p>
          <button
            className="derm-hero-cta"
            onClick={() => {
              document.getElementById('derm-doctors')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Prendre RDV maintenant
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="derm-section" style={{ background: 'white' }}>
        <h2>Comment ça marche</h2>
        <p className="derm-section-sub">3 étapes simples pour un diagnostic professionnel</p>
        <div className="derm-steps">
          {STEPS.map(s => (
            <div key={s.n} className="derm-step">
              <div className="derm-step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NOS DERMATOLOGUES */}
      <section id="derm-doctors" className="derm-section">
        <h2>Nos dermatologues</h2>
        <p className="derm-section-sub">Spécialistes certifiés, Ordre des Médecins du Sénégal</p>

        {loading && <p style={{ textAlign: 'center', color: 'var(--y-n-600)' }}>Chargement…</p>}

        {!loading && dermatos.length === 0 && (
          <div className="derm-empty">
            <h3>Aucun dermatologue disponible pour le moment</h3>
            <p>Reviens dans quelques jours — nous ajoutons de nouveaux spécialistes chaque semaine.</p>
          </div>
        )}

        <div className="derm-doctors-grid">
          {dermatos.map(d => (
            <div
              key={d.id}
              className="derm-doc-card"
              onClick={() => gotoDoctor(d.slug || d.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && gotoDoctor(d.slug || d.id)}
            >
              {d.photo_url ? (
                <img src={d.photo_url} alt={d.full_name} className="derm-doc-photo" />
              ) : (
                <div className="derm-doc-photo-fallback">{(d.full_name || 'D').charAt(0)}</div>
              )}
              <div className="derm-doc-name">Dr {d.full_name}</div>
              <div className="derm-doc-spec">{d.speciality || 'Dermatologie'}</div>
              <div className="derm-doc-meta">
                {d.years_exp ? `${d.years_exp} ans d'expérience · ` : ''}
                {d.city || 'Dakar'}
              </div>
              <div className="derm-doc-prices">
                {d.price_async_fcfa != null && (
                  <span className="derm-doc-price">Chat {formatFcfaShort(d.price_async_fcfa)}</span>
                )}
                {d.price_video_fcfa != null && (
                  <span className="derm-doc-price">Visio {formatFcfaShort(d.price_video_fcfa)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="derm-section" style={{ background: 'white' }}>
        <h2>Questions fréquentes</h2>
        <p className="derm-section-sub">Tout ce que tu dois savoir avant de consulter</p>
        <div className="derm-faq">
          {FAQ.map((f, i) => (
            <details key={i} className="derm-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="derm-section" style={{ paddingTop: 20, paddingBottom: 60 }}>
        <div style={{ textAlign: 'center' }}>
          <button
            className="derm-hero-cta"
            style={{ background: 'linear-gradient(135deg, #1F8B4C, #0E5B33)', color: 'white' }}
            onClick={() => {
              document.getElementById('derm-doctors')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Voir tous les dermatologues
          </button>
        </div>
      </section>
    </div>
  );
}
