// functions/google-feed.xml.js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function : /google-feed.xml
//
// Génère le flux produits au format Google Shopping (RSS 2.0 + namespace g:).
// Google Merchant Center fetch cette URL chaque jour pour mettre à jour
// les produits dans Google Shopping → tes produits apparaissent GRATUITEMENT
// dans les résultats Google Shopping (onglet Shopping + "Free listings").
//
// FORMAT : RSS 2.0 avec namespace http://base.google.com/ns/1.0
// SPEC   : https://support.google.com/merchants/answer/7052112
//
// CACHE  : 1h côté edge + côté Google (le crawler refait quand même un fetch
//          régulier mais ça économise des appels Supabase entre temps).
//
// LIMITE : 5000 produits par feed (suffisant pour YARAM v1 — au-delà
//          il faudra paginer en plusieurs feeds).
// ─────────────────────────────────────────────────────────────────────────────

import { sbFetch, escapeXml } from './_lib.js';

// Catégorie Google Shopping → mapping depuis tes slugs catégorie YARAM.
// Liste complète : https://support.google.com/merchants/answer/6324436
// (on garde simple : tout sous "Health & Beauty > Personal Care")
const GOOGLE_CATEGORY_MAP = {
  visage:      'Health & Beauty > Personal Care > Cosmetics > Skin Care',
  serum:       'Health & Beauty > Personal Care > Cosmetics > Skin Care',
  solaire:     'Health & Beauty > Personal Care > Cosmetics > Skin Care > Sunscreen',
  nettoyant:   'Health & Beauty > Personal Care > Cosmetics > Skin Care > Face Cleansers',
  hydratant:   'Health & Beauty > Personal Care > Cosmetics > Skin Care > Moisturizers',
  masque:      'Health & Beauty > Personal Care > Cosmetics > Skin Care > Face Masks',
  corps:       'Health & Beauty > Personal Care > Cosmetics > Skin Care > Body Care',
  levres:      'Health & Beauty > Personal Care > Cosmetics > Makeup > Lip Makeup',
  maquillage:  'Health & Beauty > Personal Care > Cosmetics > Makeup',
  cheveux:     'Health & Beauty > Personal Care > Hair Care',
  huile:       'Health & Beauty > Personal Care > Cosmetics > Skin Care > Body Oils',
  hygiene:     'Health & Beauty > Personal Care',
  bebe:        'Baby & Toddler > Baby Bathing > Baby Bathing & Skin Care',
  bouche:      'Health & Beauty > Personal Care > Oral Care',
  complement:  'Health & Beauty > Health Care > Nutrition > Dietary Supplements',
  parfum:      'Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne',
  pieds_mains: 'Health & Beauty > Personal Care > Cosmetics > Skin Care',
  intime:      'Health & Beauty > Personal Care > Feminine Sanitary Supplies',
  deodorants:  'Health & Beauty > Personal Care > Deodorants & Anti-Perspirants',
};

const DEFAULT_CATEGORY = 'Health & Beauty > Personal Care > Cosmetics';
const FALLBACK_IMAGE = 'https://yaram.app/icon-512.png';

// Frais de livraison par défaut Sénégal (depuis settings YARAM)
const DEFAULT_SHIPPING_XOF = 1500;

export async function onRequest({ env }) {
  try {
    // Sélectionne les colonnes nécessaires + filtre actif + approved
    // ⚠️ products n'a pas updated_at (seulement created_at)
    const products = await sbFetch(
      env,
      'products?select=id,name,brand,category,price,short_desc,long_desc,img,score,review_count,rating,active,status,created_at&status=eq.approved&active=eq.true&order=created_at.desc&limit=5000'
    );

    if (!products || products.length === 0) {
      return emptyFeed('Aucun produit actif et approuvé.');
    }

    const items = products.map(p => buildItem(p)).filter(Boolean).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>YARAM — Beauté validée pour peaux africaines</title>
    <link>https://yaram.app</link>
    <description>Marketplace beauté Sénégal · ${products.length} produits sélectionnés par des dermatologues</description>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // Cache 1h côté edge + côté Google (le crawler récupère quand même)
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (e) {
    return emptyFeed(`Error: ${e.message}`);
  }
}

function buildItem(p) {
  // Champs requis : si manquants → on skip ce produit
  if (!p.id || !p.name || !p.price || !p.img) {
    return null;
  }

  const productUrl = `https://yaram.app/product/${p.id}`;
  const imageUrl = p.img || FALLBACK_IMAGE;

  // Description : préfère long_desc, fallback short_desc, fallback enrichi
  // Le fallback enrichi est plus descriptif que "Catégorie · Marque" pour aider
  // au CTR Google Shopping. Idéal : remplir long_desc dans l'admin produit.
  const fallbackDesc = [
    `${p.brand || 'YARAM'} ${p.name}`,
    p.category ? `Catégorie : ${p.category}` : '',
    p.score ? `Note YARAM : ${p.score}/100` : '',
    p.rating ? `Avis clients : ${p.rating}/5` : '',
    'Produit sélectionné par des dermatologues pour la peau africaine.',
    'Livraison rapide à Dakar et au Sénégal.',
    'Paiement Wave, Orange Money ou à la livraison.',
  ].filter(Boolean).join(' · ');

  const description = (p.long_desc || p.short_desc || fallbackDesc).slice(0, 5000);

  // Title : max 150 chars (Google tronque au-delà)
  const fullTitle = (p.brand ? `${p.brand} — ${p.name}` : p.name).slice(0, 150);

  // Catégorie Google Shopping
  const googleCategory = GOOGLE_CATEGORY_MAP[p.category] || DEFAULT_CATEGORY;

  // identifier_exists : "no" car on n'a pas de GTIN/MPN pour la plupart des produits
  // (sinon Google exige les barcodes officiels)
  const hasIdentifier = false; // changer en true si on rajoute GTIN un jour

  return `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(fullTitle)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(productUrl)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${Math.round(p.price)} XOF</g:price>
      <g:brand>${escapeXml(p.brand || 'YARAM')}</g:brand>
      <g:condition>new</g:condition>
      <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>
      <g:identifier_exists>${hasIdentifier ? 'yes' : 'no'}</g:identifier_exists>
      <g:shipping>
        <g:country>SN</g:country>
        <g:service>Standard</g:service>
        <g:price>${DEFAULT_SHIPPING_XOF} XOF</g:price>
      </g:shipping>
      <g:custom_label_0>${escapeXml(p.category || 'autre')}</g:custom_label_0>
      <g:custom_label_1>score-${Math.floor((p.score || 0) / 10) * 10}</g:custom_label_1>
    </item>`;
}

function emptyFeed(reason) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>YARAM — Feed produits</title>
    <link>https://yaram.app</link>
    <description>${escapeXml(reason)}</description>
  </channel>
</rss>`;
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
