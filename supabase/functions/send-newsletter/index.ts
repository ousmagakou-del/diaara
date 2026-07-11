// ════════════════════════════════════════════════════════
// YARAM — Edge function : send-newsletter
// ════════════════════════════════════════════════════════
//
// Envoi de newsletter en masse via Resend, aux abonnes de
// public.newsletter_subscribers (filtres par preference).
//
// PAYLOAD (JSON) :
//   {
//     subject: string,
//     html: string,
//     text?: string,
//     audience?: 'all' | 'promos' | 'nouveautes' | 'conseils' | 'evenements',
//     test_to?: string,          // alias : test_email
//     test_email?: string
//   }
//
// AUTH :
//   - Header `x-admin-token: <session token>` (miroir des autres RPC admin).
//     Le token est valide via RPC `_check_admin_session` cote SQL qui
//     retourne l admin_id (uuid) ou raise si invalide.
//   - Le header Authorization Bearer <supabase_anon_jwt> est aussi accepte
//     par le Function Gateway (verify_jwt=false pour cette fonction car on
//     controle nous-memes l auth via x-admin-token).
//
// RATE LIMIT :
//   - Resend autorise 10 req/s en pratique. On envoie par batches
//     Promise.all de 8 emails, puis sleep(1100 ms) entre batches.
//
// LOG :
//   - RPC `admin_log_newsletter_send` insere dans public.newsletter_sends
//     et retourne l id (uuid) qu on utilise comme campaign_id.
//
// LIST-UNSUBSCRIBE :
//   - Header `List-Unsubscribe: <mailto:...>, <https://.../unsubscribe?...>`
//   - Header `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058)
//   - Footer HTML avec lien `https://yaram.app/unsubscribe?email=...`
//
// SECRETS Supabase requis :
//   - RESEND_API_KEY
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - RESEND_FROM (optionnel, default: "YARAM <contact@yaram.app>")
// ════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey, x-admin-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const APP_URL = "https://yaram.app";
const SUPPORT_EMAIL = "contact@yaram.app";
const FROM_DEFAULT =
  Deno.env.get("RESEND_FROM") || "YARAM <contact@yaram.app>";
const UNSUBSCRIBE_MAILTO = "unsubscribe@yaram.app";

type Audience = "all" | "promos" | "nouveautes" | "conseils" | "evenements";
type Subscriber = { email: string; preferences: Record<string, unknown> | null };

// ─── Helpers ────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unsubscribeUrl(email: string): string {
  return `${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}`;
}

function normalizeAudience(a: unknown): Audience {
  const v = String(a || "all").toLowerCase();
  if (v === "promos" || v === "nouveautes" || v === "conseils" || v === "evenements") {
    return v;
  }
  return "all";
}

function matchesAudience(prefs: Record<string, unknown> | null, aud: Audience): boolean {
  if (aud === "all") return true;
  if (!prefs) return false;
  // On accepte les 2 conventions : "promos/nouveautes/conseils/evenements" (schema stats)
  // ET "promos/nouveaux_produits/conseils_peau/articles" (schema legacy vu en prod).
  const truthy = (k: string) => {
    const v = prefs[k];
    return v === true || v === "true";
  };
  switch (aud) {
    case "promos":
      return truthy("promos");
    case "nouveautes":
      return truthy("nouveautes") || truthy("nouveaux_produits");
    case "conseils":
      return truthy("conseils") || truthy("conseils_peau");
    case "evenements":
      return truthy("evenements");
  }
}

function withFooter(html: string, email: string): string {
  const url = unsubscribeUrl(email);
  const safeEmail = escapeHtml(email);
  const footer = `
<div style="margin-top:32px;padding:20px 24px;border-top:1px solid #EFEFEF;font-size:12px;color:#888;text-align:center;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  Tu recois cet email parce que tu es abonne(e) a la newsletter YARAM (${safeEmail}).<br>
  <a href="${url}" style="color:#888;text-decoration:underline;">Se desabonner en un clic</a>
  &nbsp;&middot;&nbsp;
  <a href="${APP_URL}" style="color:#888;text-decoration:underline;">yaram.app</a>
  &nbsp;&middot;&nbsp;
  <a href="mailto:${SUPPORT_EMAIL}" style="color:#888;text-decoration:underline;">${SUPPORT_EMAIL}</a>
</div>`;
  // Si le HTML contient </body>, on insere avant. Sinon on colle a la fin.
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }
  return `${html}${footer}`;
}

// ─── Resend ─────────────────────────────────────────────────

type ResendOk = { success: true; id: string | undefined };
type ResendKo = { success: false; error: string };
type ResendResult = ResendOk | ResendKo;

async function resendSend(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers: Record<string, string>;
}): Promise<ResendResult> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY_missing" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_DEFAULT,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
        headers: params.headers,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: `resend_http_${res.status}:${(data && (data as any).message) || "unknown"}`,
      };
    }
    return { success: true, id: (data as any)?.id };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || String(e) };
  }
}

async function sendOne(
  email: string,
  subject: string,
  html: string,
  text: string | undefined,
): Promise<ResendResult> {
  const unsub = unsubscribeUrl(email);
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<mailto:${UNSUBSCRIBE_MAILTO}?subject=unsubscribe>, <${unsub}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const finalHtml = withFooter(html, email);
  return resendSend({ to: email, subject, html: finalHtml, text, headers });
}

// ─── Serve ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: "supabase_env_missing" }, 500);
  }

  const adminToken = req.headers.get("x-admin-token") || "";
  if (!adminToken || adminToken.length < 32) {
    return json({ ok: false, error: "no_admin_token" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const html = typeof body.html === "string" ? body.html : "";
  const text = typeof body.text === "string" ? body.text : undefined;
  const audience = normalizeAudience(body.audience);
  const testTo =
    (typeof body.test_to === "string" && body.test_to.trim()) ||
    (typeof body.test_email === "string" && body.test_email.trim()) ||
    "";

  if (!subject || !html) {
    return json({ ok: false, error: "subject_html_required" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    global: { headers: { "x-admin-token": adminToken } },
  });

  // ─── Validation admin ────────────────────────────────
  const { data: adminId, error: authErr } = await admin.rpc("_check_admin_session", {
    p_token: adminToken,
  });
  if (authErr || !adminId) {
    console.warn(`[send-newsletter] auth_failed: ${authErr?.message || "no_admin"}`);
    return json({ ok: false, error: "invalid_session" }, 401);
  }

  const sentAt = new Date().toISOString();
  const errors: Array<{ email: string; error: string }> = [];
  let okCount = 0;
  let koCount = 0;
  const MAX_ERRORS_PAYLOAD = 10;

  // ─── Mode TEST : une seule adresse ───────────────────
  if (testTo) {
    const res = await sendOne(testTo, subject, html, text);
    if (res.success) okCount = 1;
    else {
      koCount = 1;
      errors.push({ email: testTo, error: res.error });
    }
    let campaignId: string | null = null;
    try {
      const { data: cid } = await admin.rpc("admin_log_newsletter_send", {
        p_token: adminToken,
        p_subject: subject,
        p_audience: "test",
        p_recipients: 1,
        p_ok_count: okCount,
        p_err_count: koCount,
        p_body_html: html,
        p_body_text: text || null,
        p_error: errors[0]?.error || null,
      });
      campaignId = (cid as string) || null;
    } catch (e) {
      console.warn(`[send-newsletter] log_failed: ${(e as Error).message}`);
    }
    console.log(
      `[send-newsletter] test to=1 ok=${okCount} ko=${koCount} campaign=${campaignId}`,
    );
    return json({
      ok: okCount,
      ko: koCount,
      sent_at: sentAt,
      campaign_id: campaignId,
      errors: errors.slice(0, MAX_ERRORS_PAYLOAD),
    });
  }

  // ─── Mode BULK : filtre + batches ────────────────────
  const { data: subs, error: subsErr } = await admin
    .from("newsletter_subscribers")
    .select("email, preferences")
    .is("unsubscribed_at", null);

  if (subsErr) {
    return json({ ok: false, error: `subs_query_failed:${subsErr.message}` }, 500);
  }

  const filtered = (subs as Subscriber[])
    .filter((s) => s.email && matchesAudience(s.preferences, audience))
    // dedupe emails (safety net)
    .filter(
      (s, i, arr) => arr.findIndex((x) => x.email.toLowerCase() === s.email.toLowerCase()) === i,
    );

  const targetCount = filtered.length;
  const BATCH_SIZE = 8;
  const BATCH_DELAY_MS = 1100;

  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((s) => sendOne(s.email, subject, html, text)),
    );
    results.forEach((r, idx) => {
      if (r.success) {
        okCount += 1;
      } else {
        koCount += 1;
        if (errors.length < 100) {
          errors.push({ email: batch[idx].email, error: r.error });
        }
      }
    });
    if (i + BATCH_SIZE < filtered.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  let campaignId: string | null = null;
  try {
    const { data: cid } = await admin.rpc("admin_log_newsletter_send", {
      p_token: adminToken,
      p_subject: subject,
      p_audience: audience,
      p_recipients: targetCount,
      p_ok_count: okCount,
      p_err_count: koCount,
      p_body_html: html,
      p_body_text: text || null,
      p_error: null,
    });
    campaignId = (cid as string) || null;
  } catch (e) {
    console.warn(`[send-newsletter] log_failed: ${(e as Error).message}`);
  }

  console.log(
    `[send-newsletter] audience=${audience} target=${targetCount} ok=${okCount} ko=${koCount} campaign=${campaignId}`,
  );

  return json({
    ok: okCount,
    ko: koCount,
    sent_at: sentAt,
    campaign_id: campaignId,
    target_count: targetCount,
    errors: errors.slice(0, MAX_ERRORS_PAYLOAD),
  });
});
