// ════════════════════════════════════════════════════════════════════
// YARAM — Edge function : reminder-consumable-cron
// ════════════════════════════════════════════════════════════════════
//
// Envoie un push "Ton {product_name} arrive a la fin ? Recommande maintenant"
// pour chaque item d'une commande delivered dont :
//   - delivered_at est entre now()-90d et now()-45d
//   - item.usage_duration_days > 0
//
// Idempotence :
//   Verifie qu'aucune notification type='consumable_reminder' avec
//   data->>'product_id' identique n'a ete envoyee dans les 30 derniers
//   jours pour ce user.
//
// AUTH : header Authorization: Bearer ${REMINDER_CRON_TOKEN}
//
// CRON : declenche par Supabase Cron ou GitHub Actions toutes les 24h.
//
// SECRETS Supabase requis :
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - REMINDER_CRON_TOKEN
//   - INTERNAL_PUSH_SECRET   (utilise par send-push)
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

const log = (...a: unknown[]) => console.log("[reminder-consumable-cron]", ...a);
const warn = (...a: unknown[]) => console.warn("[reminder-consumable-cron]", ...a);
const err = (...a: unknown[]) => console.error("[reminder-consumable-cron]", ...a);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  // ─── Auth ────────────────────────────────────────────────
  const expected = Deno.env.get("REMINDER_CRON_TOKEN");
  const provided = req.headers.get("authorization") || "";
  const token = provided.replace(/^Bearer\s+/i, "").trim();
  if (!expected || token !== expected) {
    return json({ success: false, error: "unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const INTERNAL_SECRET = Deno.env.get("INTERNAL_PUSH_SECRET") || "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ success: false, error: "supabase_env_missing" }, 500);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ─── Query orders delivered dans fenetre 45-90j ──────────
  // orders n'expose pas de colonne `delivered_at` — on utilise
  // COALESCE(rated_at, updated_at) comme proxy delivery timestamp.
  // usage_duration_days peut vivre sur item (order snapshot) ou sur
  // products.usage_duration_days.
  const nowMs = Date.now();
  const lowerMs = nowMs - 90 * 24 * 3600 * 1000;
  const upperMs = nowMs - 45 * 24 * 3600 * 1000;
  const lowerIso = new Date(lowerMs).toISOString();
  const upperIso = new Date(upperMs).toISOString();

  const { data: orders, error: ordErr } = await admin
    .from("orders")
    .select("id, user_id, items, updated_at, rated_at, status")
    .eq("status", "delivered")
    .gt("updated_at", lowerIso)
    .lt("updated_at", upperIso)
    .not("user_id", "is", null)
    .limit(1000);

  if (ordErr) {
    err("query_failed", ordErr.message);
    return json({ success: false, error: "query_failed", detail: ordErr.message }, 500);
  }

  // Collect (user_id, product_id) uniques
  type Candidate = {
    user_id: string;
    product_id: string;
    product_name: string;
    usage_duration_days: number;
  };
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const productIds = new Set<string>();

  for (const o of orders || []) {
    const items = Array.isArray((o as any).items) ? (o as any).items : [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const pid = String(item.id || item.product_id || "").trim();
      if (!pid) continue;
      const key = `${o.user_id}|${pid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      productIds.add(pid);
      candidates.push({
        user_id: String(o.user_id),
        product_id: pid,
        product_name: String(item.name || "ton produit"),
        usage_duration_days: Number(item.usage_duration_days || 0),
      });
    }
  }

  // Enrich manquants depuis products.usage_duration_days
  const missingUdd = candidates
    .filter((c) => !Number.isFinite(c.usage_duration_days) || c.usage_duration_days <= 0)
    .map((c) => c.product_id);
  const uniqueMissing = Array.from(new Set(missingUdd));

  if (uniqueMissing.length > 0) {
    const { data: prods } = await admin
      .from("products")
      .select("id, name, usage_duration_days")
      .in("id", uniqueMissing);
    const byId = new Map<string, { name: string | null; usage_duration_days: number | null }>();
    for (const p of prods || []) byId.set(String((p as any).id), p as any);
    for (const c of candidates) {
      const enrich = byId.get(c.product_id);
      if (!c.usage_duration_days || c.usage_duration_days <= 0) {
        c.usage_duration_days = Number(enrich?.usage_duration_days || 0);
      }
      if (!c.product_name || c.product_name === "ton produit") {
        c.product_name = String(enrich?.name || c.product_name);
      }
    }
  }

  const eligible = candidates.filter((c) => c.usage_duration_days > 0);
  log(`eligible=${eligible.length} of ${candidates.length} candidates`);

  let sent = 0, skipped = 0, failed = 0;
  const nowIso = new Date().toISOString();
  const cooldownIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  for (const c of eligible) {
    const targetUrl = `https://yaram.app/product/${c.product_id}`;

    // Idempotence : deja envoye consumable_reminder pour ce product_id
    // dans les 30 derniers jours ? On matche par url qui embarque le
    // product_id (notifications n'a pas de colonne jsonb data en schema
    // public — on encode product_id dans l'url).
    const { data: recentUrl } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", c.user_id)
      .eq("type", "consumable_reminder")
      .gt("sent_at", cooldownIso)
      .like("url", `%${c.product_id}%`)
      .limit(1);
    if ((recentUrl || []).length > 0) {
      skipped++;
      continue;
    }

    // Envoi push via send-push (dispatcher unifie)
    const title = "Rappel produit";
    const body = `Ton ${c.product_name} arrive a la fin ? Recommande maintenant`;
    const dataPayload = {
      product_id: c.product_id,
      url: targetUrl,
      product_name: c.product_name,
    };

    let ok = false;
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          user_id: c.user_id,
          title,
          body,
          type: "consumable_reminder",
          data: dataPayload,
        }),
      });
      ok = resp.ok;
      if (!ok) {
        const txt = await resp.text().catch(() => "");
        warn("send-push failed", resp.status, txt.slice(0, 200));
      }
    } catch (e) {
      err("send-push threw", (e as Error).message);
    }

    // Ecrit une trace notifications (in-app) — send-push ne le fait pas.
    await admin.from("notifications").insert({
      user_id: c.user_id,
      title,
      body,
      url: targetUrl,
      type: "consumable_reminder",
      read: false,
      sent_at: nowIso,
    });

    if (ok) sent++;
    else failed++;

    await sleep(120); // throttle doux
  }

  return json({
    success: true,
    at: nowIso,
    candidates: candidates.length,
    eligible: eligible.length,
    sent,
    skipped,
    failed,
  });
});
