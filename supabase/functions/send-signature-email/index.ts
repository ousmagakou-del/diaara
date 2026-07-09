// ════════════════════════════════════════════════════════════════════
// YARAM — Edge function : send-signature-email
// ════════════════════════════════════════════════════════════════════
//
// Envoie l'email de demande de signature au destinataire (pharmacien,
// livreur, distributeur, etc.) avec un CTA "Signer maintenant".
//
// Appelée par :
//   - Admin SignaturesSection après admin_create_signature_request
//   - "Renvoyer" depuis la table admin
//
// Body attendu :
//   {
//     token: string,                 // sig_xxxx (URL /sign/:token)
//     sign_url?: string,             // https://yaram.app/sign/:token (auto si absent)
//     recipient_name: string,
//     recipient_email: string,
//     template_name: string,         // "Contrat partenariat Pharmacie"
//     admin_message?: string,        // Message perso de l'admin
//     is_reminder?: boolean,         // true = "Rappel : ..."
//   }
//
// Secrets :
//   RESEND_API_KEY  (envoi email)
//   RESEND_FROM     (optionnel, default "YARAM <contact@yaram.app>")
// ════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

const FROM = Deno.env.get("RESEND_FROM") || "YARAM Contrats <contact@yaram.app>";
const BRAND_GREEN = "#1F8B4C";
const BRAND_DARK = "#0A0A0A";
const APP_URL = "https://yaram.app";

// ─────────────────────────────────────────────────────────────────────
// Template HTML — style DocuSign / Notion
// ─────────────────────────────────────────────────────────────────────
function buildEmail(p: {
  recipient_name: string;
  template_name: string;
  sign_url: string;
  admin_message?: string;
  is_reminder?: boolean;
}) {
  const eyebrow = p.is_reminder ? "RAPPEL — SIGNATURE EN ATTENTE" : "DOCUMENT À SIGNER";
  const heading = p.is_reminder
    ? `Petit rappel — merci de signer ${p.template_name}`
    : `${p.recipient_name}, un contrat vous attend`;
  const subject = p.is_reminder
    ? `Rappel — ${p.template_name} à signer`
    : `📝 Signature demandée — ${p.template_name}`;

  const messageBlock = p.admin_message
    ? `<tr><td style="padding:20px 32px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F5FBF7;border:1px solid #DFF0E6;border-radius:14px;padding:18px;">
          <tr><td style="padding-right:14px;vertical-align:top;width:44px;">
            <div style="width:40px;height:40px;border-radius:50%;background:${BRAND_GREEN};color:#fff;text-align:center;font-weight:900;font-size:16px;line-height:40px;">O</div>
          </td><td>
            <div style="font-size:11px;font-weight:800;color:${BRAND_GREEN};letter-spacing:0.3px;margin-bottom:3px;">MESSAGE D'OUSMANE</div>
            <div style="font-size:14px;color:${BRAND_DARK};line-height:1.5;">${escapeHtml(p.admin_message)}</div>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#EEEDE8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND_DARK};">

<div style="display:none;font-size:1px;color:#EEEDE8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Un contrat YARAM vous attend pour signature électronique. Ça prend 2 minutes.
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#EEEDE8;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.06);">

      <!-- HEADER -->
      <tr><td style="background:linear-gradient(135deg,${BRAND_GREEN} 0%,#166635 100%);padding:32px 32px 28px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:middle;">
              <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:12px;line-height:48px;text-align:center;color:white;font-weight:900;font-size:24px;letter-spacing:-1px;">Y</div>
              <div style="display:inline-block;margin-left:12px;vertical-align:middle;">
                <div style="font-size:17px;font-weight:900;color:#fff;letter-spacing:-0.3px;line-height:1;">YARAM</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px;">Édité par KOMUNITY SENEGAL</div>
              </div>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <span style="display:inline-block;padding:8px 14px;background:rgba(255,249,230,0.95);color:#B78B00;border-radius:999px;font-size:11px;font-weight:900;letter-spacing:0.3px;">📝 SIGNATURE ATTENDUE</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- HERO / INTRO -->
      <tr><td style="padding:36px 32px 20px;">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${BRAND_GREEN};margin-bottom:12px;">${eyebrow}</div>
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:${BRAND_DARK};letter-spacing:-0.6px;line-height:1.2;">${escapeHtml(heading)}</h1>
        <p style="margin:0;font-size:15px;color:#4B5563;line-height:1.6;">
          Bonjour <strong>${escapeHtml(p.recipient_name)}</strong>,<br>
          Voici votre contrat <strong>${escapeHtml(p.template_name)}</strong> à signer électroniquement.
          Ça prend <strong>2 minutes</strong> et c'est légalement valable.
        </p>
      </td></tr>

      ${messageBlock}

      <!-- CTA principal -->
      <tr><td style="padding:32px 32px 24px;text-align:center;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
          <tr><td style="background:${BRAND_DARK};border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,0.15);">
            <a href="${p.sign_url}" style="display:inline-block;padding:18px 40px;color:#fff;text-decoration:none;font-weight:900;font-size:16px;letter-spacing:-0.2px;">
              ✍️ Signer le contrat maintenant
            </a>
          </td></tr>
        </table>
        <div style="margin-top:14px;font-size:12px;color:#9CA3AF;">Lien valide 30 jours</div>
      </td></tr>

      <!-- Détails / Comment ça marche -->
      <tr><td style="padding:8px 32px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FAFAF7;border-radius:16px;padding:20px;">
          <tr><td style="font-size:12px;font-weight:900;letter-spacing:1px;color:#6B7280;text-transform:uppercase;padding-bottom:12px;">
            Comment ça marche
          </td></tr>
          <tr><td style="font-size:14px;color:${BRAND_DARK};line-height:1.7;">
            <div style="margin-bottom:8px;"><strong style="color:${BRAND_GREEN};">1.</strong> Cliquez sur le bouton ci-dessus</div>
            <div style="margin-bottom:8px;"><strong style="color:${BRAND_GREEN};">2.</strong> Relisez le contrat pré-rempli avec vos informations</div>
            <div style="margin-bottom:8px;"><strong style="color:${BRAND_GREEN};">3.</strong> Signez avec le doigt ou la souris dans le cadre</div>
            <div><strong style="color:${BRAND_GREEN};">4.</strong> Recevez une copie signée par email automatiquement</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- Fallback link -->
      <tr><td style="padding:0 32px 24px;">
        <div style="font-size:11px;color:#9CA3AF;line-height:1.5;">
          Le bouton ne marche pas ? Copiez-collez ce lien dans votre navigateur :<br>
          <a href="${p.sign_url}" style="color:${BRAND_GREEN};word-break:break-all;text-decoration:none;">${p.sign_url}</a>
        </div>
      </td></tr>

      <!-- Signature juridique -->
      <tr><td style="padding:24px 32px 32px;border-top:1px solid #F0F0EE;text-align:center;font-size:11px;color:#9CA3AF;line-height:1.6;">
        <strong style="color:#6B7280;">KOMUNITY SENEGAL</strong> · NINEA 008771116 · RCCM SN.DKR.2021.A.26292<br>
        Cité Léopold Sédar Senghor Villa n° 93, Dakar · <a href="${APP_URL}" style="color:${BRAND_GREEN};text-decoration:none;">yaram.app</a><br>
        <br>
        Signature électronique conforme au droit sénégalais (loi 2008-08 sur les transactions électroniques). Une copie sera envoyée automatiquement aux deux parties après signature.
      </td></tr>

    </table>
  </td></tr>
</table>

</body>
</html>`;

  return { subject, html };
}

function escapeHtml(s: string | undefined | null) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─────────────────────────────────────────────────────────────────────
// Resend
// ─────────────────────────────────────────────────────────────────────
async function sendViaResend({
  to,
  subject,
  html,
}: { to: string; subject: string; html: string }) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY_missing" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        reply_to: "ousmane@yaram.app",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: `resend_http_${res.status}`, detail: data };
    }
    return { success: true, id: data?.id };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// SERVE
// ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ success: false, error: "invalid_json" }, 400); }

  const {
    token,
    sign_url,
    recipient_name,
    recipient_email,
    template_name,
    admin_message,
    is_reminder,
  } = body || {};

  if (!token || !recipient_email || !recipient_name || !template_name) {
    return json({ success: false, error: "missing_fields" }, 400);
  }

  const url = sign_url || `${APP_URL}/sign/${token}`;

  const { subject, html } = buildEmail({
    recipient_name,
    template_name,
    sign_url: url,
    admin_message,
    is_reminder,
  });

  const result = await sendViaResend({ to: recipient_email, subject, html });
  console.log(`[send-signature-email] to=${maskEmail(recipient_email)} token=${token.substring(0,12)}… success=${result.success}`);

  return json(result);
});

function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u?.substring(0,2) || ""}***@${d || ""}`;
}
