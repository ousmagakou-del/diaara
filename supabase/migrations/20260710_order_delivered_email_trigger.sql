-- ═══════════════════════════════════════════════════════════════════
-- YARAM — Trigger auto-envoi email orderDelivered
-- ═══════════════════════════════════════════════════════════════════
-- Trou 3 de l audit Resend : quand un livreur (RN ou driver web) marque
-- orders.status = 'delivered', aucun email n etait envoye. Le trigger
-- ci-dessous appelle l edge function send-email des la transition et
-- ecrit un log (public.order_email_log) pour l idempotence partagee
-- entre le trigger et les appels manuels admin (DeliveriesSection).
--
-- Rollback :
--   DROP TRIGGER IF EXISTS trg_order_delivered_email ON public.orders;
--   DROP FUNCTION IF EXISTS public.trigger_send_order_delivered_email();
--   DROP TABLE IF EXISTS public.order_email_log;
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Extensions requises ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── 2. Table de log idempotence ───────────────────────────
-- orders.id est TEXT (pas UUID) → on utilise TEXT ici pour matcher.
CREATE TABLE IF NOT EXISTS public.order_email_log (
  order_id text NOT NULL,
  template text NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, template)
);

COMMENT ON TABLE public.order_email_log IS
  'Journal des emails envoyes par commande (idempotence trigger + client). Cle canonique : orderDelivered pour tout email de delivered-family.';

-- FK optionnelle vers orders (ON DELETE CASCADE). On la met en NOT VALID
-- puis on la valide si possible : evite un fail si des orders orphelins
-- existent deja.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_email_log_order_id_fkey'
      AND conrelid = 'public.order_email_log'::regclass
  ) THEN
    ALTER TABLE public.order_email_log
      ADD CONSTRAINT order_email_log_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END$$;

ALTER TABLE public.order_email_log ENABLE ROW LEVEL SECURITY;
-- Aucune policy client — seul service_role / SECURITY DEFINER ecrit dedans.

-- ─── 3. Fonction trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_send_order_delivered_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_edge_url    text := 'https://qxhhnrnworwrnwmqekmb.supabase.co/functions/v1/send-email';
  v_secret      text;
  v_already     boolean;
BEGIN
  -- Ne se declenche que sur transition -> delivered
  IF NEW.status IS DISTINCT FROM 'delivered' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Idempotence : ne rien faire si un email delivered-family a deja ete
  -- envoye (soit par ce trigger, soit par un envoi manuel via send-email
  -- qui logue orderStatusUpdate+delivered sous la cle canonique).
  SELECT true INTO v_already
    FROM public.order_email_log
    WHERE order_id = NEW.id::text AND template = 'orderDelivered'
    LIMIT 1;
  IF v_already THEN
    RETURN NEW;
  END IF;

  -- Recuperation du secret pour authentifier l appel edge function.
  -- Pattern miroir de _push_on_order_status_change (internal_config).
  SELECT value INTO v_secret FROM public.internal_config WHERE key = 'internal_push_secret';

  -- Fire-and-forget vers send-email. verify_jwt=true sur send-email :
  -- on passe le secret via Bearer (accepte cote plateforme comme un JWT
  -- opaque). Si l appel echoue on ne bloque pas la transition d etat.
  BEGIN
    PERFORM net.http_post(
      url     := v_edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_secret, ''),
        'x-internal-secret', COALESCE(v_secret, '')
      ),
      body    := jsonb_build_object(
        'order_id', NEW.id::text,
        'template', 'orderDelivered'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trigger_send_order_delivered_email] net.http_post failed: %', SQLERRM;
  END;

  -- Marque immediatement l entree log (idempotence future).
  INSERT INTO public.order_email_log (order_id, template)
  VALUES (NEW.id::text, 'orderDelivered')
  ON CONFLICT (order_id, template) DO NOTHING;

  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.trigger_send_order_delivered_email() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.trigger_send_order_delivered_email() TO authenticated, service_role;

-- ─── 4. Trigger sur orders.status ──────────────────────────
DROP TRIGGER IF EXISTS trg_order_delivered_email ON public.orders;
CREATE TRIGGER trg_order_delivered_email
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_order_delivered_email();

-- ─── 5. Sanity check ───────────────────────────────────────
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_order_delivered_email';
-- SELECT * FROM public.order_email_log ORDER BY sent_at DESC LIMIT 10;
