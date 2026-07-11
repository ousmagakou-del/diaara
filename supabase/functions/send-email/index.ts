// ════════════════════════════════════════════════════════
// YARAM — Edge function : send-email (Resend wrapper)
// ════════════════════════════════════════════════════════
//
// 3 modes d'appel :
//
// 1. RAW : body = { to, subject, html, replyTo? }
//    → envoie directement via Resend, sans rendre de template.
//    Utilisé par src/lib/emails.js#sendEmail (le HTML est déjà rendu côté client).
//
// 2. ORDER : body = { order_id, template, params? }
//    → résout le destinataire côté serveur (users_profile.email pour la cliente,
//      pharmacies.notification_email pour pharmacyNewOrder), rend le template
//      avec les données de la commande, puis envoie via Resend.
//    Après envoi réussi, écrit dans public.order_email_log pour idempotence
//    (partagée entre les triggers Postgres et les appels directs admin/RN).
//
// 3. TEMPLATE_RAW : body = { to, template_raw, params }
//    → rend un template serveur qui n'est pas lié à une order (ex: referralUsed,
//      cartAbandoned) avec les params fournis puis envoie via Resend.
//
// Templates ORDER : welcome | orderConfirmed | orderShipped | orderDelivered
//                  | pharmacyNewOrder | paymentVerified | orderStatusUpdate
//                  | importSupplierOrdered | importInTransit
//                  | importArrivedDakar | importBalanceReminder
// Templates RAW   : referralUsed | cartAbandoned | qaAnswerReceived
//
// SECRETS Supabase requis :
//   - RESEND_API_KEY
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Logs : pas de PII (pas d'email complet, pas de nom). On loggue juste
//        success/fail + template + ID Resend.
// ════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const FROM_DEFAULT = Deno.env.get("RESEND_FROM") || "YARAM <contact@yaram.app>";

// ─────────────────────────────────────────────────────────────────────
// CONSTANTES BRAND (miroir de src/lib/emails.js)
// ─────────────────────────────────────────────────────────────────────
const APP_URL = "https://yaram.app";
const BRAND_GREEN = "#1F8B4C";
const BRAND_ORANGE = "#E94E1B";
const SUPPORT_EMAIL = "contact@yaram.app";
const SUPPORT_WA = "+221 77 438 87 66";

function layout({ title, preheader, body }: { title: string; preheader?: string; body: string }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F5F6F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A1A1A;">
<div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader || ""}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F5F6F8;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <tr><td style="background:linear-gradient(135deg,${BRAND_GREEN} 0%,#166635 100%);padding:32px 24px;text-align:center;">
        <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.12);border-radius:14px;line-height:56px;text-align:center;color:white;font-weight:800;font-size:28px;letter-spacing:-1px;">Y</div>
        <div style="margin-top:12px;color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:0.3em;text-transform:uppercase;">YARAM · Beauté Sénégal</div>
      </td></tr>
      <tr><td style="padding:32px 32px 16px;">${body}</td></tr>
      <tr><td style="padding:24px 32px 32px;border-top:1px solid #EFEFEF;font-size:12px;color:#888;text-align:center;">
        Besoin d'aide&nbsp;? Réponds à cet email ou écris-nous sur WhatsApp <a href="https://wa.me/221774388766" style="color:${BRAND_GREEN};text-decoration:none;font-weight:600;">${SUPPORT_WA}</a><br>
        <a href="${APP_URL}" style="color:${BRAND_GREEN};text-decoration:none;font-weight:600;">${APP_URL}</a>
        &nbsp;·&nbsp;
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_GREEN};text-decoration:none;">${SUPPORT_EMAIL}</a>
        <div style="margin-top:12px;color:#BBB;">© ${new Date().getFullYear()} YARAM</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(label: string, href: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:${BRAND_GREEN};border-radius:10px;">
  <a href="${href}" style="display:inline-block;padding:14px 28px;color:white;font-weight:700;font-size:15px;text-decoration:none;">${label}</a>
</td></tr></table>`;
}

function fcfa(n: number | string | null | undefined) {
  return (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";
}

// ─────────────────────────────────────────────────────────────────────
// TEMPLATES SERVEUR (utilisés seulement en mode ORDER)
// Pour le mode RAW le HTML est déjà rendu côté client.
// ─────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  total: number;
  payment_method?: string;
  is_preorder?: boolean;
  lead_time_days?: number;
  deposit_amount?: number;
  balance_amount?: number;
};

const Templates: Record<
  string,
  (p: { firstName?: string; pharmacyName?: string; order?: OrderRow; statusLabel?: string; newStatus?: string; params?: Record<string, unknown> }) => { subject: string; html: string }
> = {
  welcome: ({ firstName }) => ({
    subject: `Bienvenue sur YARAM, ${firstName} 💚`,
    html: layout({
      title: "Bienvenue sur YARAM",
      preheader: "Profite de -10% sur ta 1ère commande avec BIENVENUE10",
      body: `
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${BRAND_GREEN};">Bienvenue, ${firstName} 💚</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Merci de rejoindre YARAM, la marketplace beauté validée pour ta peau africaine.</p>
        <div style="background:#FFF5E6;border-left:3px solid ${BRAND_ORANGE};padding:16px;border-radius:8px;margin:20px 0;">
          <div style="font-size:11px;font-weight:700;color:${BRAND_ORANGE};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">CODE PROMO BIENVENUE</div>
          <div style="font-size:22px;font-weight:800;color:#1A1A1A;letter-spacing:1px;">BIENVENUE10</div>
          <div style="font-size:12px;color:#6B6B6B;margin-top:4px;">-10% sur ta 1ère commande dès 25 000 FCFA</div>
        </div>
        <div style="margin:28px 0;">${btn("Découvrir le catalogue", APP_URL)}</div>
      `,
    }),
  }),

  orderConfirmed: ({ firstName, order }) => {
    const o = order!;
    const isPre = o.is_preorder === true;
    const leadDays = o.lead_time_days || 15;
    const paymentBlock = isPre
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F0F7FF;border-left:3px solid #0066CC;border-radius:10px;padding:16px;margin:16px 0;">
          <tr><td style="font-size:13px;color:#0066CC;font-weight:700;padding-bottom:8px;">💳 Acompte payé (50%)</td></tr>
          <tr><td style="font-size:22px;font-weight:800;color:#0066CC;">${fcfa(o.deposit_amount || o.total / 2)}</td></tr>
          <tr><td style="font-size:13px;color:#6B6B6B;padding:12px 0 6px;">Solde à la livraison (50%) : <strong>${fcfa(o.balance_amount || o.total / 2)}</strong></td></tr>
        </table>`
      : `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F9FAFB;border-radius:10px;padding:16px;margin:16px 0;">
          <tr><td style="font-size:13px;color:#6B6B6B;padding-bottom:8px;">Montant total</td></tr>
          <tr><td style="font-size:24px;font-weight:800;color:${BRAND_GREEN};">${fcfa(o.total)}</td></tr>
          <tr><td style="font-size:12px;color:#888;padding-top:4px;">Paiement : ${(o.payment_method || "").toUpperCase()}</td></tr>
        </table>`;
    return {
      subject: isPre ? `✈️ Précommande ${o.id} confirmée — livraison sous ${leadDays}j` : `Commande ${o.id} confirmée ✓`,
      html: layout({
        title: isPre ? "Précommande confirmée" : "Commande confirmée",
        body: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">Merci ${firstName} 🎉</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444;">Ta commande <strong>${o.id}</strong> est confirmée.</p>
          ${paymentBlock}
          <div style="margin:24px 0;">${btn(isPre ? "Suivre ma précommande" : "Suivre ma commande", `${APP_URL}/order/${o.id}`)}</div>
        `,
      }),
    };
  },

  orderShipped: ({ firstName, order }) => ({
    subject: `🛵 Commande ${order!.id} en route`,
    html: layout({
      title: "Commande en route",
      body: `
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">${firstName}, le livreur arrive 🛵</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Ta commande <strong>${order!.id}</strong> vient de partir.</p>
        <p style="margin:16px 0;font-size:14px;color:#444;">💵 Paiement à la livraison : <strong>${fcfa(order!.total)}</strong></p>
        <div style="margin:24px 0;">${btn("Suivre en temps réel", `${APP_URL}/order/${order!.id}`)}</div>
      `,
    }),
  }),

  orderDelivered: ({ firstName, order }) => ({
    subject: `Commande ${order!.id} livrée 💚`,
    html: layout({
      title: "Livrée !",
      body: `
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">Bien reçu, ${firstName} 💚</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Ta commande <strong>${order!.id}</strong> a été livrée.</p>
        <div style="margin:24px 0;">${btn("Noter ma livraison", `${APP_URL}/order/${order!.id}`)}</div>
      `,
    }),
  }),

  // ─── Flow import (precommande internationale) ─────────────
  // Etapes intermediaires envoyees automatiquement quand l admin
  // fait progresser une commande is_preorder=true :
  //   awaiting_supplier -> importSupplierOrdered
  //   in_transit_intl   -> importInTransit
  //   arrived_local     -> importArrivedDakar
  //   awaiting_balance  -> importBalanceReminder
  // Le trigger Postgres ne passe que { order_id, template }. Les
  // params (expectedArrivalDate, balanceAmount) sont derives de la
  // row orders quand possible, sinon fallback texte generique.

  importSupplierOrdered: ({ firstName, order, params }) => {
    const o = order!;
    const eta = (params?.expectedArrivalDate as string | undefined) || "10 a 15 jours";
    return {
      subject: `Ta commande YARAM est lancee chez le fournisseur`,
      html: layout({
        title: "Commande lancee chez le fournisseur",
        preheader: `Precommande #${o.id} — on vient de la passer chez notre fournisseur international.`,
        body: `
          <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Precommande #${o.id}</div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">Bonne nouvelle ${firstName}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">On vient de passer commande de tes produits chez notre fournisseur international.</p>
          <div style="background:#EBF7EF;border-left:3px solid ${BRAND_GREEN};padding:16px;border-radius:8px;margin:20px 0;">
            <div style="font-size:11px;font-weight:700;color:${BRAND_GREEN};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Delai d arrivee estime a Dakar</div>
            <div style="font-size:20px;font-weight:800;color:#1A1A1A;">${eta}</div>
          </div>
          <p style="margin:16px 0;font-size:14px;color:#444;">On te tient au courant a chaque etape.</p>
          <div style="margin:24px 0;">${btn("Suivre ma precommande", `${APP_URL}/order/${o.id}`)}</div>
        `,
      }),
    };
  },

  importInTransit: ({ firstName, order, params }) => {
    const o = order!;
    const eta = (params?.expectedArrivalDate as string | undefined) || "sous ~10 jours";
    return {
      subject: `Ton colis YARAM est en route vers Dakar`,
      html: layout({
        title: "Colis en transit vers Dakar",
        preheader: `Precommande #${o.id} — en route vers nos entrepots Dakar.`,
        body: `
          <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Precommande #${o.id}</div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">${firstName}, ton colis est en route</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Ton colis a quitte le fournisseur et est en transit international.</p>
          <div style="background:#EBF7EF;border-left:3px solid ${BRAND_GREEN};padding:16px;border-radius:8px;margin:20px 0;">
            <div style="font-size:11px;font-weight:700;color:${BRAND_GREEN};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Arrivee estimee a Dakar</div>
            <div style="font-size:20px;font-weight:800;color:#1A1A1A;">${eta}</div>
          </div>
          <p style="margin:16px 0;font-size:14px;color:#444;">Prochaine etape : reception dans nos entrepots Dakar.</p>
          <div style="margin:24px 0;">${btn("Suivre ma precommande", `${APP_URL}/order/${o.id}`)}</div>
        `,
      }),
    };
  },

  importArrivedDakar: ({ firstName, order }) => {
    const o = order!;
    const balance = o.balance_amount || o.total / 2;
    return {
      subject: `Ton colis YARAM est arrive a Dakar`,
      html: layout({
        title: "Colis arrive a Dakar",
        preheader: `Precommande #${o.id} — arrivee dans nos entrepots Dakar.`,
        body: `
          <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Precommande #${o.id}</div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">Excellente nouvelle ${firstName}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Ton colis vient d arriver a Dakar. On prepare tout pour la livraison finale.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFF5E6;border-left:3px solid ${BRAND_ORANGE};border-radius:10px;padding:16px;margin:18px 0;">
            <tr><td style="font-size:11px;font-weight:700;color:${BRAND_ORANGE};letter-spacing:0.1em;text-transform:uppercase;padding-bottom:6px;">Solde a regler (50%)</td></tr>
            <tr><td style="font-size:22px;font-weight:800;color:#1A1A1A;">${fcfa(balance)}</td></tr>
            <tr><td style="font-size:13px;color:#6B6B6B;padding-top:6px;">Tu recevras dans quelques minutes un email pour regler le solde avant l envoi chez toi.</td></tr>
          </table>
          <div style="margin:24px 0;">${btn("Suivre ma precommande", `${APP_URL}/order/${o.id}`)}</div>
        `,
      }),
    };
  },

  importBalanceReminder: ({ firstName, order }) => {
    const o = order!;
    const balance = o.balance_amount || o.total / 2;
    return {
      subject: `Solde a regler pour ton colis YARAM (dernier pas)`,
      html: layout({
        title: "Solde a regler",
        preheader: `Precommande #${o.id} — il ne reste que le solde et on livre sous 24h.`,
        body: `
          <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Precommande #${o.id}</div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">${firstName}, ton colis est pret</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Il ne reste qu a regler le solde (50% restant) et on l envoie chez toi sous 24h.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFF5E6;border-left:3px solid ${BRAND_ORANGE};border-radius:10px;padding:16px;margin:18px 0;">
            <tr><td style="font-size:11px;font-weight:700;color:${BRAND_ORANGE};letter-spacing:0.1em;text-transform:uppercase;padding-bottom:6px;">Solde a regler</td></tr>
            <tr><td style="font-size:24px;font-weight:800;color:${BRAND_ORANGE};">${fcfa(balance)}</td></tr>
          </table>
          <div style="margin:28px 0;">${btn("Payer le solde", `${APP_URL}/payment/${o.id}?mode=balance`)}</div>
          <p style="margin:16px 0 0;font-size:12px;color:#888;">Paiement securise Wave, Orange Money, Free Money, PayTech ou carte bancaire.</p>
        `,
      }),
    };
  },

  paymentVerified: ({ firstName, order }) => {
    const o = order!;
    const methodMap: Record<string, string> = {
      wave: "Wave", om: "Orange Money", orange_money: "Orange Money",
      free_money: "Free Money", paytech: "PayTech", cb: "Carte bancaire", cod: "À la livraison",
    };
    const method = methodMap[(o.payment_method || "").toLowerCase()] || (o.payment_method || "mobile money");
    const amount = o.is_preorder ? (o.deposit_amount || o.total) : o.total;
    return {
      subject: `Paiement validé · YARAM #${o.id}`,
      html: layout({
        title: "Paiement validé",
        preheader: `Ton paiement ${method} est validé — commande #${o.id} en préparation.`,
        body: `
          <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Commande #${o.id}</div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">Paiement validé ✅</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Bonjour ${firstName}, on confirme la bonne réception de ton paiement ${method}. Ta commande passe maintenant en <strong>préparation</strong>.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F9FAFB;border-radius:12px;padding:18px;margin:8px 0 18px;">
            <tr><td style="font-size:13px;color:#6B6B6B;padding:4px 0;">Montant validé</td><td style="font-size:18px;color:${BRAND_GREEN};padding:4px 0;text-align:right;font-weight:800;">${fcfa(amount)}</td></tr>
            <tr><td style="font-size:13px;color:#6B6B6B;padding:4px 0;">Méthode</td><td style="font-size:13px;color:#1A1A1A;padding:4px 0;text-align:right;font-weight:600;">${method}</td></tr>
          </table>
          <div style="margin:24px 0 8px;">${btn("Suivre ma commande", `${APP_URL}/order/${o.id}`)}</div>
        `,
      }),
    };
  },

  orderStatusUpdate: ({ firstName, order, statusLabel, newStatus }: any) => {
    const o = order!;
    const STATUS: Record<string, { label: string; emoji: string; title: string; body: string; cta: string }> = {
      paid: { label: "Paiement reçu", emoji: "💚", title: "Paiement confirmé", body: "Ta commande passe en préparation. On t'écrit dès qu'elle part.", cta: "Suivre ma commande" },
      preparing: { label: "En préparation", emoji: "🧴", title: "On prépare ta commande", body: "Notre partenaire prépare tes produits avec soin.", cta: "Voir le suivi" },
      shipped: { label: "En route", emoji: "🛵", title: "Le livreur arrive !", body: "Ta commande vient de partir. Reste joignable au numéro communiqué.", cta: "Suivre en temps réel" },
      in_delivery: { label: "En route", emoji: "🛵", title: "Le livreur arrive !", body: "Ta commande vient de partir. Reste joignable au numéro communiqué.", cta: "Suivre en temps réel" },
      delivered: { label: "Livrée", emoji: "✅", title: "Commande livrée 💚", body: "On espère que tu vas adorer tes produits.", cta: "Noter ma livraison" },
      awaiting_balance: { label: "Solde à payer", emoji: "💳", title: "Ta précommande est arrivée à Dakar", body: "Pour finaliser la livraison, il reste à régler le solde.", cta: "Payer le solde" },
      awaiting_confirm: { label: "À confirmer", emoji: "⏳", title: "Confirme la réception", body: "Confirme la bonne réception pour clôturer la transaction.", cta: "Confirmer la réception" },
      cancelled: { label: "Annulée", emoji: "⚠️", title: "Commande annulée", body: "Si tu as déjà payé, le remboursement est traité sous 48h.", cta: "Voir le détail" },
    };
    const meta = STATUS[newStatus] || { label: statusLabel || "Mise à jour", emoji: "📦", title: "Mise à jour de ta commande", body: "Ta commande vient d'être mise à jour.", cta: "Voir ma commande" };
    const label = statusLabel || meta.label;
    return {
      subject: `Update commande #${o.id} · ${label}`,
      html: layout({
        title: `Commande #${o.id} — ${label}`,
        preheader: meta.title,
        body: `
          <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Commande #${o.id}</div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">${meta.emoji} ${meta.title}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Bonjour ${firstName}, ${meta.body}</p>
          <div style="background:#EBF7EF;border-radius:10px;padding:12px 16px;margin:18px 0;font-size:14px;color:#1A1A1A;"><strong style="color:${BRAND_GREEN};">Nouveau statut :</strong> ${label}</div>
          <div style="margin:24px 0 8px;">${btn(meta.cta, `${APP_URL}/order/${o.id}`)}</div>
        `,
      }),
    };
  },

  referralUsed: ({ firstName, params }: any) => {
    const points = Number(params?.points || 500);
    const orderId = String(params?.orderId || "");
    return {
      subject: `Ton filleul vient de commander sur YARAM`,
      html: layout({
        title: "Ton filleul a commande",
        preheader: `Ton filleul ${firstName} vient de passer sa premiere commande.`,
        body: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">Bonne nouvelle</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Ton filleul <strong>${firstName}</strong> vient de passer sa premiere commande sur YARAM.</p>
          <div style="background:#EBF7EF;border-left:3px solid ${BRAND_GREEN};padding:16px;border-radius:8px;margin:20px 0;">
            <div style="font-size:11px;font-weight:700;color:${BRAND_GREEN};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Recompense de parrainage</div>
            <div style="font-size:24px;font-weight:800;color:#1A1A1A;">+ ${points} points</div>
            <div style="font-size:12px;color:#6B6B6B;margin-top:4px;">Credites sur ton compte fidelite YARAM.</div>
          </div>
          ${orderId ? `<p style="margin:0 0 16px;font-size:12px;color:#888;">Reference commande : ${orderId}</p>` : ""}
          <div style="margin:24px 0;">${btn("Voir mes points", `${APP_URL}/loyalty`)}</div>
        `,
      }),
    };
  },

  cartAbandoned: ({ firstName, params }: any) => {
    const items: Array<{ name?: string; qty?: number; price?: number }> = Array.isArray(params?.items) ? params.items : [];
    const totalEstime = params?.totalEstime;
    const list = items.slice(0, 5).map((it) => {
      const name = (it?.name || "Produit").toString();
      const qty = Number(it?.qty || 1);
      const price = Number(it?.price || 0);
      return `<tr>
        <td style="padding:8px 0;font-size:14px;color:#1A1A1A;">${name} <span style="color:#888;">x${qty}</span></td>
        <td style="padding:8px 0;font-size:14px;color:#444;text-align:right;">${fcfa(price * qty)}</td>
      </tr>`;
    }).join("");
    return {
      subject: `Ton panier YARAM t attend`,
      html: layout({
        title: "Ton panier YARAM t attend",
        preheader: "Termine ta commande en 1 clic",
        body: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">${firstName}, ton panier t attend</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Tu as laisse quelques produits dans ton panier. On les garde au chaud pour toi.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F9FAFB;border-radius:10px;padding:8px 16px;margin:16px 0;">
            ${list || `<tr><td style="padding:8px 0;font-size:14px;color:#666;">Tes produits selectionnes</td></tr>`}
            ${totalEstime != null ? `<tr><td colspan="2" style="border-top:1px solid #E5E7EB;padding-top:10px;margin-top:8px;font-size:14px;color:#1A1A1A;font-weight:700;">Total estime : <span style="color:${BRAND_GREEN};">${fcfa(totalEstime)}</span></td></tr>` : ""}
          </table>
          <div style="margin:24px 0;">${btn("Reprendre mon panier", `${APP_URL}/cart`)}</div>
          <p style="margin:16px 0 0;font-size:12px;color:#888;">Livraison rapide partout a Dakar. Paiement securise Wave, Orange Money, PayTech ou a la livraison.</p>
        `,
      }),
    };
  },

  qaAnswerReceived: ({ firstName, params }: any) => {
    const productName = String(params?.productName || "un produit");
    const productId = String(params?.productId || "");
    const answerAuthor = String(params?.answerAuthor || "Un membre de la communaute");
    const badge = params?.isPharmacist ? "Pharmacien" : (params?.isYaramTeam ? "Equipe YARAM" : "");
    const questionExcerpt = String(params?.questionExcerpt || "");
    const answerExcerpt = String(params?.answerExcerpt || "");
    const badgeHtml = badge
      ? `<div style="display:inline-block;background:${params?.isPharmacist ? "#EBF7EF" : "#EFF6FF"};color:${params?.isPharmacist ? BRAND_GREEN : "#1D4ED8"};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:8px;">${badge}</div>`
      : "";
    const productUrl = productId ? `${APP_URL}/product/${productId}` : APP_URL;
    return {
      subject: `Nouvelle reponse a ta question sur ${productName}`,
      html: layout({
        title: "Reponse recue",
        preheader: `${answerAuthor} a repondu a ta question sur ${productName}.`,
        body: `
          <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Questions et reponses</div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND_GREEN};">${firstName}, quelqu un a repondu</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;"><strong>${answerAuthor}</strong> vient de repondre a ta question sur <strong>${productName}</strong>.</p>
          ${questionExcerpt ? `<div style="background:#F9FAFB;border-left:3px solid #D1D5DB;padding:14px 16px;border-radius:8px;margin:16px 0;">
            <div style="font-size:11px;font-weight:700;color:#6B7280;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Ta question</div>
            <div style="font-size:14px;color:#1A1A1A;line-height:1.5;">${questionExcerpt}</div>
          </div>` : ""}
          ${answerExcerpt ? `<div style="background:#EBF7EF;border-left:3px solid ${BRAND_GREEN};padding:14px 16px;border-radius:8px;margin:16px 0;">
            ${badgeHtml}
            <div style="font-size:11px;font-weight:700;color:${BRAND_GREEN};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">La reponse</div>
            <div style="font-size:14px;color:#1A1A1A;line-height:1.5;">${answerExcerpt}</div>
          </div>` : ""}
          <div style="margin:24px 0;">${btn("Voir la reponse", productUrl)}</div>
          <p style="margin:16px 0 0;font-size:12px;color:#888;">Tu peux voter utile / pas utile pour aider la communaute a trouver les meilleures reponses.</p>
        `,
      }),
    };
  },

  pharmacyNewOrder: ({ pharmacyName, order }) => ({
    subject: `Nouvelle commande YARAM #${order!.id}`,
    html: layout({
      title: "Nouvelle commande",
      body: `
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:${BRAND_GREEN};">${pharmacyName}, nouvelle commande 📦</h1>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F9FAFB;border-radius:10px;padding:16px;margin:16px 0;">
          <tr><td style="font-size:13px;color:#6B6B6B;padding-bottom:4px;">Commande</td></tr>
          <tr><td style="font-size:18px;font-weight:700;">#${order!.id}</td></tr>
          <tr><td style="font-size:13px;color:#6B6B6B;padding-top:12px;">Montant</td></tr>
          <tr><td style="font-size:18px;font-weight:700;color:${BRAND_GREEN};">${fcfa(order!.total)}</td></tr>
        </table>
        <div style="margin:24px 0;">${btn("Ouvrir mon dashboard", `${APP_URL}/pharma`)}</div>
      `,
    }),
  }),
};

// ─────────────────────────────────────────────────────────────────────
// RESEND
// ─────────────────────────────────────────────────────────────────────

async function resendSend({
  to,
  subject,
  html,
  replyTo,
}: { to: string; subject: string; html: string; replyTo?: string | null }) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY_missing" } as const;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_DEFAULT,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: `resend_http_${res.status}`, detail: data } as const;
    }
    return { success: true, id: data?.id } as const;
  } catch (e) {
    return { success: false, error: (e as Error)?.message || String(e) } as const;
  }
}

// ─────────────────────────────────────────────────────────────────────
// SERVE
// ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  // ─── Mode 3 : TEMPLATE_RAW (rendu serveur sans order) ───
  if (typeof body.to === "string" && typeof body.template_raw === "string") {
    const template = body.template_raw as string;
    const builder = Templates[template];
    if (!builder) return json({ success: false, error: `unknown_template_raw:${template}` }, 400);
    const params = (body.params && typeof body.params === "object") ? body.params as Record<string, unknown> : {};
    const firstName = typeof params.firstName === "string" ? (params.firstName as string) : "toi";
    const { subject, html } = builder({ firstName, params });
    const result = await resendSend({ to: body.to as string, subject, html });
    console.log(`[send-email] template_raw=${template} success=${result.success}`);
    return json(result);
  }

  // ─── Mode 2 : ORDER (résolution destinataire côté serveur) ───
  if (typeof body.order_id === "string" && typeof body.template === "string") {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ success: false, error: "supabase_env_missing" }, 500);
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const template = body.template as string;
    const builder = Templates[template];
    if (!builder) return json({ success: false, error: `unknown_template:${template}` }, 400);

    // Canonical idempotency key : orderStatusUpdate+delivered = orderDelivered
    const extraParams0 = (body.params && typeof body.params === "object") ? body.params as Record<string, unknown> : {};
    const canonicalKey = (template === "orderStatusUpdate" && extraParams0.newStatus === "delivered")
      ? "orderDelivered"
      : template;

    // Idempotence : si un envoi delivered (trigger Postgres OU admin manual)
    // a deja logue, on ne renvoie pas.
    if (canonicalKey === "orderDelivered") {
      const { data: existing } = await admin
        .from("order_email_log")
        .select("order_id")
        .eq("order_id", body.order_id)
        .eq("template", "orderDelivered")
        .maybeSingle();
      if (existing) {
        console.log(`[send-email] skip duplicate orderDelivered order=${body.order_id}`);
        return json({ success: true, skipped: true });
      }
    }

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, total, payment_method, is_preorder, lead_time_days, deposit_amount, balance_amount, user_id, pharmacy_id, address")
      .eq("id", body.order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return json({ success: false, error: "order_not_found" }, 404);
    }

    let to: string | null = null;
    let firstName = "toi";
    let pharmacyName = "";

    if (template === "pharmacyNewOrder") {
      const { data: pharma } = await admin
        .from("pharmacies")
        .select("name, notification_email")
        .eq("id", order.pharmacy_id)
        .maybeSingle();
      to = pharma?.notification_email || null;
      pharmacyName = pharma?.name || "Partenaire";
    } else {
      const { data: profile } = await admin
        .from("users_profile")
        .select("email, first_name")
        .eq("id", order.user_id)
        .maybeSingle();
      to = profile?.email || null;
      firstName = profile?.first_name || (order.address?.name?.split?.(" ")?.[0]) || "toi";
    }

    if (!to) {
      console.warn(`[send-email] no recipient resolved for template=${template} order=${order.id}`);
      return json({ success: false, error: "no_recipient" }, 200);
    }

    const extraParams = extraParams0;
    const { subject, html } = builder({
      firstName,
      pharmacyName,
      order: order as OrderRow,
      statusLabel: typeof extraParams.statusLabel === "string" ? extraParams.statusLabel : undefined,
      newStatus: typeof extraParams.newStatus === "string" ? extraParams.newStatus : undefined,
      params: extraParams,
    });
    const result = await resendSend({ to, subject, html });
    console.log(`[send-email] template=${template} order=${order.id} success=${result.success}`);

    // Auto-log dans order_email_log (idempotence delivered-family)
    if (result.success && canonicalKey === "orderDelivered") {
      try {
        await admin
          .from("order_email_log")
          .upsert({ order_id: order.id, template: "orderDelivered" }, { onConflict: "order_id,template" });
      } catch (e) {
        console.warn(`[send-email] order_email_log upsert failed: ${(e as Error)?.message}`);
      }
    }
    return json(result);
  }

  // ─── Mode 1 : RAW (HTML déjà rendu) ───
  const { to, subject, html, replyTo } = body as { to?: string; subject?: string; html?: string; replyTo?: string };
  if (!to || !subject || !html) {
    return json({ success: false, error: "to_subject_html_required" }, 400);
  }
  const result = await resendSend({ to, subject, html, replyTo: replyTo || null });
  console.log(`[send-email] raw subject_len=${subject.length} success=${result.success}`);
  return json(result);
});
