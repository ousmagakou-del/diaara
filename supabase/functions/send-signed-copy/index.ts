// ════════════════════════════════════════════════════════════════════
// YARAM — Edge function : send-signed-copy
// ════════════════════════════════════════════════════════════════════
//
// Après qu'un contrat a été signé (via public_sign_contract),
// envoie une copie du contrat signé (HTML) :
//   - Au destinataire (pharmacien, livreur, etc.)
//   - À ousmane@yaram.app (copie interne)
//
// Body :
//   { token: string }  // sig_xxxx
//
// Secrets requis :
//   RESEND_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════

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

const FROM = Deno.env.get("RESEND_FROM") || "YARAM Contrats <contact@yaram.app>";
const OUSMANE_EMAIL = "ousmane@yaram.app";
const BRAND_GREEN = "#1F8B4C";
const BRAND_DARK = "#0A0A0A";
const APP_URL = "https://yaram.app";

function escapeHtml(s: string | undefined | null) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapEmail(opts: {
  recipient_name: string;
  template_name: string;
  signed_html: string;
  signed_at: string;
  is_internal_copy: boolean;
}) {
  const eyebrow = opts.is_internal_copy ? "COPIE INTERNE — CONTRAT SIGNÉ" : "VOTRE CONTRAT SIGNÉ";
  const heading = opts.is_internal_copy
    ? `${opts.recipient_name} a signé — ${opts.template_name}`
    : `Merci ${opts.recipient_name} ✓`;
  const intro = opts.is_internal_copy
    ? `Le contrat <strong>${escapeHtml(opts.template_name)}</strong> vient d'être signé électroniquement par <strong>${escapeHtml(opts.recipient_name)}</strong> le ${escapeHtml(opts.signed_at)}. Une copie identique a également été envoyée au destinataire. Le document ci-dessous a valeur d'original.`
    : `Voici votre exemplaire signé du contrat <strong>${escapeHtml(opts.template_name)}</strong>. Ce document a la même valeur qu'un original papier. Conservez-le précieusement — vous pouvez aussi l'imprimer directement depuis cet email.`;
  const subject = opts.is_internal_copy
    ? `✅ Signé — ${opts.template_name} — ${opts.recipient_name}`
    : `✅ Votre contrat YARAM signé — ${opts.template_name}`;

  const cssPatch = `
    <style>
      .sig-doc { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; line-height:1.6; color:#1A1A1A; }
      .sig-hero { text-align:center; padding:24px 0; border-bottom:2px solid #E5E4DC; margin-bottom:20px; }
      .sig-hero .sig-logo { font-size:36px; font-weight:900; color:#1F8B4C; letter-spacing:-1.5px; }
      .sig-hero .sig-logo span { color:#E94E1B; }
      .sig-hero .sig-sub { font-size:11px; color:#6B7280; letter-spacing:2px; text-transform:uppercase; margin:4px 0 16px; }
      .sig-hero h1 { font-size:20px; font-weight:900; letter-spacing:-0.3px; margin:0; }
      .sig-hero .sig-tag { font-size:12px; color:#6B7280; margin-top:8px; }
      .sig-section { margin-bottom:16px; }
      .sig-section h2 { font-size:14px; font-weight:900; color:#1F8B4C; margin:0 0 8px; }
      .sig-section p { margin:0 0 6px; }
      .sig-section ul { padding-left:20px; margin:0; }
      .sig-section li { margin-bottom:4px; }
      .sig-highlight { background:#F5FBF7; border-left:3px solid #1F8B4C; padding:14px; border-radius:10px; }
      .sig-final { margin-top:24px; padding:20px; background:#F5FBF7; border-radius:16px; }
      .sig-final h2 { font-size:14px; font-weight:900; color:#1F8B4C; margin:0 0 12px; }
      .sig-block-row { display:table; width:100%; margin-top:16px; }
      .sig-block { display:table-cell; width:50%; padding:16px; background:#fff; border-radius:10px; vertical-align:top; }
      .sig-block-label { font-size:10px; font-weight:800; letter-spacing:1px; color:#6B7280; text-transform:uppercase; }
      .sig-block-name { font-size:14px; font-weight:900; margin:4px 0; }
      .sig-block-role { font-size:11px; color:#6B7280; }
      .sig-meta { font-size:9px; color:#9CA3AF; margin-top:12px; text-align:center; }
    </style>`;

  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
${cssPatch}
</head>
<body style="margin:0;padding:0;background:#EEEDE8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND_DARK};">
<div style="display:none;font-size:1px;color:#EEEDE8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Contrat YARAM signé électroniquement — copie complète en pièce jointe visuelle.</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#EEEDE8;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="620" style="max-width:620px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.06);">
      <tr><td style="background:linear-gradient(135deg,${BRAND_GREEN} 0%,#166635 100%);padding:32px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
          <td style="vertical-align:middle;">
            <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:12px;line-height:48px;text-align:center;color:white;font-weight:900;font-size:24px;letter-spacing:-1px;">Y</div>
            <div style="display:inline-block;margin-left:12px;vertical-align:middle;">
              <div style="font-size:17px;font-weight:900;color:#fff;letter-spacing:-0.3px;line-height:1;">YARAM</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px;">Édité par KOMUNITY SENEGAL</div>
            </div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;padding:8px 14px;background:rgba(255,255,255,0.95);color:${BRAND_GREEN};border-radius:999px;font-size:11px;font-weight:900;letter-spacing:0.3px;">✅ SIGNÉ</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:36px 32px 20px;">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${BRAND_GREEN};margin-bottom:12px;">${eyebrow}</div>
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:${BRAND_DARK};letter-spacing:-0.6px;line-height:1.2;">${escapeHtml(heading)}</h1>
        <p style="margin:0;font-size:15px;color:#4B5563;line-height:1.6;">${intro}</p>
      </td></tr>
      <tr><td style="padding:0 32px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F5FBF7;border:1px solid #DFF0E6;border-radius:14px;padding:16px;">
          <tr><td style="font-size:12px;color:#0E5B33;line-height:1.6;">
            <strong style="color:${BRAND_GREEN};">📋 Résumé</strong><br>
            Contrat : <strong>${escapeHtml(opts.template_name)}</strong><br>
            Signataire : <strong>${escapeHtml(opts.recipient_name)}</strong><br>
            Date : <strong>${escapeHtml(opts.signed_at)}</strong>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 32px 32px;">
        <div style="border:1px solid #E5E4DC;border-radius:16px;padding:28px;background:#fff;">
          ${opts.signed_html}
        </div>
      </td></tr>
      <tr><td style="padding:0 32px 32px;">
        <div style="padding:16px;background:#FAFAF7;border-radius:14px;font-size:11px;color:#6B7280;line-height:1.6;">
          <strong style="color:${BRAND_DARK};">💡 Astuce :</strong> Vous pouvez imprimer ce contrat en faisant <strong>Cmd/Ctrl + P</strong> dans votre client email, puis "Enregistrer en PDF".
        </div>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;border-top:1px solid #F0F0EE;text-align:center;font-size:11px;color:#9CA3AF;line-height:1.6;">
        <strong style="color:#6B7280;">KOMUNITY SENEGAL</strong> · NINEA 008771116 · RCCM SN.DKR.2021.A.26292<br>
        Cité Léopold Sédar Senghor Villa n° 93, Dakar · <a href="${APP_URL}" style="color:${BRAND_GREEN};text-decoration:none;">yaram.app</a><br><br>
        Signature électronique conforme au droit sénégalais (loi 2008-08 sur les transactions électroniques). Ce document constitue l'original du contrat.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
  };
}

async function sendViaResend({ to, subject, html }: { to: string; subject: string; html: string }) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY_missing" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: OUSMANE_EMAIL }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: `resend_http_${res.status}`, detail: data };
    return { success: true, id: data?.id };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ success: false, error: "invalid_json" }, 400); }

  const { token } = body || {};
  if (!token) return json({ success: false, error: "missing_token" }, 400);

  // Fetch le contrat signé avec service role (bypass RLS)
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ success: false, error: "supabase_env_missing" }, 500);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: req_row, error: reqErr } = await admin
    .from("signature_requests")
    .select("id, token, recipient_name, recipient_email, template_id, signed_html, signed_at, status")
    .eq("token", token)
    .maybeSingle();

  if (reqErr || !req_row) {
    return json({ success: false, error: "request_not_found" }, 404);
  }
  if (req_row.status !== "signed" || !req_row.signed_html) {
    return json({ success: false, error: "not_signed_yet" }, 400);
  }

  // Fetch le nom du template
  const { data: tpl } = await admin
    .from("signature_templates")
    .select("name")
    .eq("id", req_row.template_id)
    .maybeSingle();
  const template_name = tpl?.name || "Contrat YARAM";

  const signed_at_fmt = new Date(req_row.signed_at).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // Envoie à la fois au destinataire ET à Ousmane (2 envois en parallèle)
  const [recipientResult, internalResult] = await Promise.all([
    (async () => {
      const mail = wrapEmail({
        recipient_name: req_row.recipient_name,
        template_name,
        signed_html: req_row.signed_html,
        signed_at: signed_at_fmt,
        is_internal_copy: false,
      });
      return sendViaResend({ to: req_row.recipient_email, subject: mail.subject, html: mail.html });
    })(),
    (async () => {
      const mail = wrapEmail({
        recipient_name: req_row.recipient_name,
        template_name,
        signed_html: req_row.signed_html,
        signed_at: signed_at_fmt,
        is_internal_copy: true,
      });
      return sendViaResend({ to: OUSMANE_EMAIL, subject: mail.subject, html: mail.html });
    })(),
  ]);

  console.log(`[send-signed-copy] token=${token.substring(0,12)} recipient_ok=${recipientResult.success} internal_ok=${internalResult.success}`);

  return json({
    success: recipientResult.success,
    recipient: recipientResult,
    internal: internalResult,
  });
});
