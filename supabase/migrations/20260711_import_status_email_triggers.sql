-- ═══════════════════════════════════════════════════════════════════
-- YARAM — Trigger auto-envoi emails intermediaires flow import
-- ═══════════════════════════════════════════════════════════════════
-- Quand l admin fait progresser une commande is_preorder=true dans le
-- flow import :
--   paid -> awaiting_supplier -> in_transit_intl -> arrived_local
--        -> awaiting_balance  -> shipped         -> delivered
-- ce trigger unique dispatche l email intermediaire correspondant vers
-- l edge function send-email. Idempotence via order_email_log (table
-- deja existante creee par 20260710_order_delivered_email_trigger.sql).
--
-- Rollback :
--   DROP TRIGGER IF EXISTS trg_order_import_status_email ON public.orders;
--   DROP FUNCTION IF EXISTS public.trigger_send_import_status_email();
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_send_import_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_edge_url text := 'https://qxhhnrnworwrnwmqekmb.supabase.co/functions/v1/send-email';
  v_secret   text;
  v_template text;
  v_already  boolean;
BEGIN
  -- Uniquement pour les precommandes / imports
  IF NEW.is_preorder IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Uniquement sur transition effective
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Map statut import -> template email
  v_template := CASE NEW.status
    WHEN 'awaiting_supplier' THEN 'importSupplierOrdered'
    WHEN 'in_transit_intl'   THEN 'importInTransit'
    WHEN 'arrived_local'     THEN 'importArrivedDakar'
    WHEN 'awaiting_balance'  THEN 'importBalanceReminder'
    ELSE NULL
  END;
  IF v_template IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotence : si l email pour ce statut a deja ete envoye
  -- (retour arriere admin puis re-progression, race condition, etc.),
  -- on skip.
  SELECT true INTO v_already
    FROM public.order_email_log
    WHERE order_id = NEW.id::text AND template = v_template
    LIMIT 1;
  IF v_already THEN
    RETURN NEW;
  END IF;

  -- Secret pour auth edge function (meme pattern que orderDelivered
  -- et referralUsed : internal_config.internal_push_secret).
  SELECT value INTO v_secret FROM public.internal_config WHERE key = 'internal_push_secret';

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
        'template', v_template
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trigger_send_import_status_email] net.http_post failed for template=% order=%: %', v_template, NEW.id, SQLERRM;
  END;

  INSERT INTO public.order_email_log (order_id, template)
  VALUES (NEW.id::text, v_template)
  ON CONFLICT (order_id, template) DO NOTHING;

  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.trigger_send_import_status_email() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.trigger_send_import_status_email() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_order_import_status_email ON public.orders;
CREATE TRIGGER trg_order_import_status_email
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_import_status_email();

-- Sanity check :
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_order_import_status_email';
-- SELECT * FROM public.order_email_log WHERE template LIKE 'import%' ORDER BY sent_at DESC LIMIT 10;
