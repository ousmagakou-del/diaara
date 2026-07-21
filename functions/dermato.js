// functions/dermato.js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function : /dermato
// Sert aux bots (Googlebot, FB, WhatsApp…) un HTML enrichi pour la requête
// "dermatologue en ligne Sénégal" : meta dédiés + JSON-LD MedicalWebPage +
// FAQPage + contenu crawlable. Les humains reçoivent le SPA normal.
// ─────────────────────────────────────────────────────────────────────────────

import { isBotUA, buildMetaTags, injectMetaTags, injectBotContent } from './_lib.js';

async function serveSpa(request, env) {
  const indexResponse = await env.ASSETS.fetch(new URL('/', request.url));
  const html = await indexResponse.text();
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const userAgent = request.headers.get('user-agent') || '';

  if (!isBotUA(userAgent)) return serveSpa(request, env);

  try {
    const url = 'https://yaram.app/dermato';
    const title = 'Dermatologue en ligne au Sénégal — dès 3 000 F CFA | YARAM';
    const description =
      "Consulte un dermatologue certifié depuis ton téléphone : photos + description dès 3 000 F CFA (réponse en moins de 2h) ou visio 20 min à 10 000 F CFA. Ordonnance signée, produits livrés en 1h30 à Dakar.";

    const indexResponse = await env.ASSETS.fetch(new URL('/', request.url));
    let html = await indexResponse.text();

    const metaHtml = buildMetaTags({
      title, description, url,
      image: 'https://yaram.app/icon-512.png',
      type: 'website',
    });

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'MedicalWebPage',
          name: 'Consultation dermatologue en ligne au Sénégal',
          url,
          description,
          provider: { '@type': 'Organization', name: 'YARAM (Komunity SN)', url: 'https://yaram.app' },
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Combien coûte une consultation dermatologue en ligne au Sénégal ?',
              acceptedAnswer: { '@type': 'Answer', text: "Sur YARAM, la consultation express par photos coûte 3 000 F CFA avec une réponse en moins de 2h. La téléconsultation vidéo de 20 minutes coûte 10 000 F CFA. En cabinet à Dakar, une consultation coûte généralement 15 000 à 25 000 F CFA avec plusieurs semaines d'attente." },
            },
            {
              '@type': 'Question',
              name: 'Comment consulter un dermatologue depuis mon téléphone ?',
              acceptedAnswer: { '@type': 'Answer', text: "Télécharge l'app YARAM ou va sur yaram.app/dermato : envoie 1 à 3 photos de ton problème de peau avec une description, paye par Wave, et un dermatologue certifié inscrit à l'Ordre des Médecins du Sénégal te répond avec un diagnostic et une ordonnance signée." },
            },
            {
              '@type': 'Question',
              name: 'Les produits prescrits sont-ils livrés ?',
              acceptedAnswer: { '@type': 'Answer', text: "Oui. Les produits de ton ordonnance disponibles dans les pharmacies partenaires YARAM sont livrés en 1h30 à Dakar." },
            },
          ],
        },
      ],
    });

    html = injectMetaTags(html, metaHtml + `\n<script type="application/ld+json">${jsonLd}</script>`);

    const botBody = `
      <h1>Dermatologue en ligne au Sénégal — consultation dès 3 000 F CFA</h1>
      <p>YARAM te connecte à un <strong>dermatologue certifié</strong>, inscrit à l'Ordre des Médecins du Sénégal, directement depuis ton téléphone. Fini les semaines d'attente pour un rendez-vous en cabinet à Dakar.</p>
      <h2>Deux formules</h2>
      <p><strong>Consultation express — 3 000 F CFA</strong> : envoie 1 à 3 photos de ton problème de peau (acné, boutons, taches, eczéma, mycose…) avec une description. Réponse du dermatologue en moins de 2h, avec diagnostic et ordonnance signée.</p>
      <p><strong>Téléconsultation vidéo — 10 000 F CFA</strong> : 20 minutes en face-à-face avec le spécialiste, au créneau de ton choix.</p>
      <h2>Produits livrés en 1h30</h2>
      <p>Les produits prescrits sur ton ordonnance sont disponibles dans les pharmacies partenaires YARAM et livrés en 1h30 à Dakar. Ton scan de peau IA gratuit est transmis au médecin pour un avis encore plus précis.</p>
      <p>Paiement sécurisé par Wave. Service opéré par Komunity SN.</p>
      <p><a href="https://yaram.app/shop">Parapharmacie en ligne YARAM</a> · <a href="https://yaram.app/blog">Conseils peau africaine</a></p>`;
    html = injectBotContent(html, botBody);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (e) {
    console.error('[og-dermato] error:', e.message);
    return serveSpa(request, env);
  }
}
