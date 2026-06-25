// ════════════════════════════════════════════════════════════════════
// YARAM — Edge function : send-push-expo
// ════════════════════════════════════════════════════════════════════
// Envoie une push notification via Expo Push API.
// Expo s'occupe du relai vers APNs (iOS) et FCM (Android).
// API publique, pas d'auth nécessaire — juste le token ExponentPushToken[xxx].
//
// Body POST attendu :
//   { token: string,             // ExponentPushToken[xxx] ou apns token brut
//     title: string,
//     body: string,
//     data?: Record<string, unknown>,
//     sound?: 'default' | null,
//     badge?: number }
//
// Réponse : { ok, status, expo_response, ticket_id?, error? }
//
// REF : https://docs.expo.dev/push-notifications/sending-notifications/
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

const log = (...args: unknown[]) => console.log("[send-push-expo]", ...args);
const warn = (...args: unknown[]) => console.warn("[send-push-expo]", ...args);
const err = (...args: unknown[]) => console.error("[send-push-expo]", ...args);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const { token, title, body, data, sound, badge } = payload || {};
  if (!token || typeof token !== "string") {
    return json({ ok: false, error: "missing_token" }, 400);
  }

  // Expo Push payload
  const message = {
    to: token,
    title: title || "YARAM",
    body: body || "",
    sound: sound === null ? null : "default",
    data: data || {},
    priority: "high",
    channelId: "default",
    ...(badge !== undefined ? { badge } : {}),
  };

  log("sending push to", token.slice(0, 30) + "...", "title:", title);

  try {
    const r = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const txt = await r.text();
    let parsed: any;
    try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }

    if (!r.ok) {
      err("expo HTTP error", r.status, txt.slice(0, 300));
      return json({ ok: false, status: r.status, error: "expo_http_error", expo_response: parsed }, 200);
    }

    // parsed.data peut être { status: 'ok', id: 'xxx' } ou { status: 'error', message: '...' }
    const ticket = parsed?.data;
    if (ticket?.status === "error") {
      warn("expo ticket error:", ticket.message, ticket.details);
      return json({
        ok: false,
        status: 200,
        error: ticket.message || "expo_error",
        details: ticket.details,
        expo_response: parsed,
      });
    }

    log("✓ expo push sent, ticket:", ticket?.id);
    return json({
      ok: true,
      status: 200,
      ticket_id: ticket?.id,
      expo_response: parsed,
    });
  } catch (e) {
    err("fetch crash:", (e as Error)?.message);
    return json({ ok: false, error: "fetch_crash", detail: (e as Error)?.message }, 500);
  }
});
