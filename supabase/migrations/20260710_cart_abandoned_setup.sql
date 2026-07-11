-- ═══════════════════════════════════════════════════════════════════
-- YARAM — Cart abandoned (24h) relance
-- ═══════════════════════════════════════════════════════════════════
-- Trou 5 de l audit Resend : aucun email de relance quand un cart est
-- abandonne >24h sans checkout. Ce fichier setup l infrastructure DB
-- (colonne de tracking + table de log). Le cron est trigger par une
-- edge function dediee (cart-abandoned-cron) planifiee via pg_cron.
--
-- Rollback :
--   ALTER TABLE public.user_carts DROP COLUMN IF EXISTS cart_abandon_email_sent_at;
--   DROP TABLE IF EXISTS public.cart_abandon_log;
--   SELECT cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'yaram-cart-abandoned'));
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Colonne de tracking sur user_carts ────────────────
-- user_carts PK = user_id (uuid). Pas de colonne id dediee.
ALTER TABLE public.user_carts
  ADD COLUMN IF NOT EXISTS cart_abandon_email_sent_at timestamptz;

COMMENT ON COLUMN public.user_carts.cart_abandon_email_sent_at IS
  'Timestamp du dernier email de relance envoye pour ce panier. Reinitialise a NULL des que le user checkout (via trigger applicatif ou script batch).';

-- ─── 2. Table de log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cart_abandon_log (
  cart_id uuid NOT NULL,      -- = user_carts.user_id
  sent_at timestamptz NOT NULL DEFAULT now(),
  ok      boolean NOT NULL,
  reason  text,
  PRIMARY KEY (cart_id, sent_at)
);

COMMENT ON TABLE public.cart_abandon_log IS
  'Journal des envois de relance cart abandoned. Une ligne par tentative (ok ou echec).';

ALTER TABLE public.cart_abandon_log ENABLE ROW LEVEL SECURITY;
-- Aucune policy client — seul service_role ecrit.

-- ─── 3. Extensions requises ───────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── 4. Job pg_cron (1x/jour a 11h UTC = 11h Dakar) ───────
-- Idempotent : kill l ancien job avant de replanifier.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'yaram-cart-abandoned';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END$$;

SELECT cron.schedule(
  'yaram-cart-abandoned',
  '0 11 * * *',
  $CRON$
    SELECT net.http_post(
      url := 'https://qxhhnrnworwrnwmqekmb.supabase.co/functions/v1/cart-abandoned-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
      ),
      body := '{}'::jsonb
    );
  $CRON$
);

-- ─── 5. Sanity check ──────────────────────────────────────
-- SELECT * FROM cron.job WHERE jobname = 'yaram-cart-abandoned';
-- SELECT * FROM public.cart_abandon_log ORDER BY sent_at DESC LIMIT 10;
