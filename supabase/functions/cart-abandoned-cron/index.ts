// ════════════════════════════════════════════════════════
// YARAM — Edge function : cart-abandoned-cron
// ════════════════════════════════════════════════════════
//
// Trou 5 audit Resend : envoie une relance cartAbandoned pour tous les
// paniers non vides updated_at entre now()-7d et now()-24h qui n ont
// pas encore recu de relance.
//
// Envoi delegue a l edge function send-email (mode template_raw).
// Rate limit Resend 8/s : on batch avec un throttle 150ms/envoi.
//
// AUTH : header Authorization: Bearer ${CART_ABANDONED_TOKEN}
//        Fallback ONBOARDING_DRIP_TOKEN (memes secret possible en dev).
//
// CRON : declenche par pg_cron 1x/jour a 11h UTC.
//
// SECRETS Supabase requis :
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - CART_ABANDONED_TOKEN   (ou ONBOARDING_DRIP_TOKEN en fallback)
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  // ─── Auth ────────────────────────────────────────────────
  const expected = Deno.env.get("CART_ABANDONED_TOKEN") || Deno.env.get("ONBOARDING_DRIP_TOKEN");
  const provided = req.headers.get("authorization") || "";
  const token = provided.replace(/^Bearer\s+/i, "").trim();
  if (!expected || token !== expected) {
    return json({ success: false, error: "unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ success: false, error: "supabase_env_missing" }, 500);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ─── Query eligible carts ────────────────────────────────
  // Fenetre : updated_at entre now()-7d et now()-24h.
  // Non vide (items != '[]').
  // Jamais envoye (cart_abandon_email_sent_at IS NULL).
  const nowIso = new Date().toISOString();
  const cutoffOld = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();  // borne basse
  const cutoffNew = new Date(Date.now() - 24 * 3600 * 1000).toISOString();      // borne haute

  const { data: carts, error: cartsErr } = await admin
    .from("user_carts")
    .select("user_id, items, updated_at, cart_abandon_email_sent_at")
    .is("cart_abandon_email_sent_at", null)
    .gt("updated_at", cutoffOld)
    .lt("updated_at", cutoffNew)
    .neq("items", "[]")
    .limit(100);

  if (cartsErr) {
    console.error("[cart-abandoned-cron] query_failed", cartsErr.message);
    return json({ success: false, error: "query_failed", detail: cartsErr.message }, 500);
  }

  const eligible = (carts || []).filter((c: any) => Array.isArray(c.items) && c.items.length > 0);
  console.log(`[cart-abandoned-cron] eligible=${eligible.length} at=${nowIso}`);

  let sent = 0, skipped = 0, failed = 0;

  for (const cart of eligible) {
    const userId = cart.user_id as string;

    // Recupere email + first_name
    const { data: profile } = await admin
      .from("users_profile")
      .select("email, first_name, onboarding_drip_disabled")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.email) {
      skipped++;
      await admin.from("cart_abandon_log").insert({ cart_id: userId, ok: false, reason: "no_email" });
      continue;
    }
    if ((profile as any).onboarding_drip_disabled === true) {
      // Reuse opt-out marketing switch
      skipped++;
      await admin.from("cart_abandon_log").insert({ cart_id: userId, ok: false, reason: "opt_out" });
      continue;
    }

    // Total estime
    const items = (cart.items as Array<{ name?: string; qty?: number; price?: number }>) || [];
    const totalEstime = items.reduce((s, it) => s + (Number(it?.qty || 1) * Number(it?.price || 0)), 0);

    // Invoke send-email (template_raw)
    let ok = false;
    let reason: string | null = null;
    try {
      const { data, error } = await admin.functions.invoke("send-email", {
        body: {
          to: profile.email,
          template_raw: "cartAbandoned",
          params: {
            firstName: profile.first_name || "toi",
            items: items.slice(0, 5).map((it: any) => ({
              name: it?.name || "Produit",
              qty: Number(it?.qty || 1),
              price: Number(it?.price || 0),
            })),
            totalEstime,
          },
        },
      });
      ok = !error && (data as any)?.success !== false;
      reason = error ? error.message : ((data as any)?.error || null);
    } catch (e) {
      reason = (e as Error)?.message || String(e);
    }

    // Log
    await admin.from("cart_abandon_log").insert({ cart_id: userId, ok, reason });

    if (ok) {
      sent++;
      await admin
        .from("user_carts")
        .update({ cart_abandon_email_sent_at: new Date().toISOString() })
        .eq("user_id", userId);
    } else {
      failed++;
    }

    // Throttle 150ms/envoi ~ 6-7/s (rate limit Resend 8/s)
    await sleep(150);
  }

  console.log(`[cart-abandoned-cron] done sent=${sent} skipped=${skipped} failed=${failed}`);
  return json({ success: true, eligible: eligible.length, sent, skipped, failed });
});
