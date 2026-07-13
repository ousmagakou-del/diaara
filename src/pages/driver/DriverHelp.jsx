const FAQ = [
  {
    q: 'Comment marquer une commande comme livrée ?',
    a: 'Une fois arrivé chez la cliente : prends une preuve (photo, signature ou PIN à 4 chiffres), puis tape sur "Confirmer la livraison". La cliente reçoit un WhatsApp pour confirmer la réception.',
  },
  {
    q: 'Comment scanner les produits à la pharmacie ?',
    a: 'Ouvre la livraison, descends à l\'étape "Vérifier les produits", tape "Scanner un code-barres". Autorise la caméra, vise le code-barres, le scan se fait automatiquement.',
  },
  {
    q: 'Un produit est en rupture, que faire ?',
    a: 'Dans la section sourcing, tape sur l\'article concerné puis choisis "Indisponible" ou "Substituer" si tu peux proposer une alternative. La cliente sera notifiée automatiquement.',
  },
  {
    q: 'Je n\'arrive pas à scanner le code-barres',
    a: 'Tape "Skip" sur l\'étape de scan : ça permet de passer outre quand le code-barres est manquant ou abîmé. Tu pourras quand même livrer normalement.',
  },
  {
    q: 'Comment encaisser le cash ?',
    a: 'Pour les commandes "CASH à la livraison" : à l\'arrivée chez la cliente, tape sur "Encaisser X FCFA" pour confirmer la réception du cash. Puis prends la preuve de livraison.',
  },
  {
    q: 'Mon GPS ne fonctionne pas',
    a: 'Vérifie que tu as autorisé la localisation pour Pedalel dans les réglages de ton téléphone. Sur iPhone : Réglages → Confidentialité → Service de localisation → Pedalel.',
  },
  {
    q: 'Comment changer ma zone ou mon véhicule ?',
    a: 'Va dans Profil → Mon véhicule / Ma zone, tape sur l\'option voulue. La modification est instantanée.',
  },
  {
    q: 'Mes gains ne correspondent pas',
    a: 'Les gains affichés sont une estimation indicative (1000 FCFA de base + 200 FCFA par article, plafonné à 3000 FCFA). Le montant exact est confirmé chaque semaine par l\'admin.',
  },
  {
    q: 'Je veux arrêter de recevoir des courses',
    a: 'Sur le dashboard, désactive le toggle "Disponible pour les courses" en haut. Tu ne recevras plus de nouvelles assignations jusqu\'à ce que tu le réactives.',
  },
];

const SUPPORT_PHONE = '221777608983';

export default function DriverHelp() {
  const waUrl = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('Bonjour Pedalel, je suis livreur et j\'ai besoin d\'aide :')}`;
  const telUrl = `tel:+${SUPPORT_PHONE}`;

  return (
    <>
      <header className="dvr-header">
        <div className="dvr-header-card">
          <div className="dvr-avatar" style={{ background: 'linear-gradient(135deg, var(--pedalel-brand-tint), var(--pedalel-brand-dark))' }} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="dvr-header-text">
            <div className="dvr-header-name">Aide & support</div>
            <div className="dvr-header-sub">Questions fréquentes + contact direct</div>
          </div>
        </div>
      </header>

      <div className="dvr-page">
        <div className="dvr-section">
          <div className="dvr-section-label">Questions fréquentes</div>
          {FAQ.map((item, i) => (
            <details className="dvr-faq" key={i}>
              <summary>
                {item.q}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="dvr-faq-body">{item.a}</div>
            </details>
          ))}
        </div>

        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="dvr-help-cta">
          <div className="dvr-help-cta-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.93 7.93 0 0 0-6.94 11.83L4 20l4.27-1.11a7.94 7.94 0 0 0 3.78.96h.01a7.93 7.93 0 0 0 7.93-7.93 7.88 7.88 0 0 0-2.39-5.6Zm-5.55 12.2h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.53.66.68-2.47-.16-.25a6.6 6.6 0 1 1 5.62 3.12Zm3.62-4.94c-.2-.1-1.18-.58-1.36-.65-.18-.07-.32-.1-.45.1-.13.2-.51.65-.63.78-.12.13-.23.15-.43.05-.2-.1-.85-.31-1.62-1-.6-.53-1-1.18-1.12-1.38-.12-.2-.01-.31.09-.41.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.34-.45-.34-.12 0-.25-.02-.39-.02-.13 0-.35.05-.54.25-.18.2-.7.68-.7 1.66 0 .98.72 1.92.82 2.05.1.13 1.43 2.18 3.46 3.05.49.21.87.34 1.16.43.49.16.93.13 1.28.08.39-.06 1.18-.48 1.35-.95.17-.46.17-.86.12-.95-.05-.08-.18-.13-.38-.23Z" />
            </svg>
          </div>
          <div className="dvr-help-cta-text">
            WhatsApp Pedalel Support
            <div className="dvr-help-cta-sub">77 760 89 83 · réponse en moins de 15 min</div>
          </div>
        </a>

        <a href={telUrl} className="dvr-help-cta" style={{ background: 'linear-gradient(140deg, var(--y-info), #0064CC)', marginTop: 10 }}>
          <div className="dvr-help-cta-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
            </svg>
          </div>
          <div className="dvr-help-cta-text">
            Appeler le support
            <div className="dvr-help-cta-sub">Pour les urgences uniquement</div>
          </div>
        </a>

        <div className="dvr-section">
          <div className="dvr-section-label">Astuces</div>
          <div className="dvr-card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Astuce : maximise tes gains</div>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: 'var(--dvr-text-mid)', lineHeight: 1.8 }}>
              <li>Active la disponibilité pendant les heures de pointe (12h-14h, 18h-21h)</li>
              <li>Réponds vite aux nouvelles courses : les premiers servis</li>
              <li>Soigne ta livraison : une note &gt; 4.8 te donne priorité sur les courses bonus</li>
              <li>Photo + signature à chaque livraison = aucune dispute possible</li>
            </ul>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--dvr-text-mute)', marginTop: 16 }}>
          Pedalel · v1.0 · Sénégal
        </div>
      </div>
    </>
  );
}
