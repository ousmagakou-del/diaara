-- ═══════════════════════════════════════════════════════════════════
-- YARAM — Trigger auto-envoi email referralUsed
-- ═══════════════════════════════════════════════════════════════════
-- Trou 4 de l audit Resend : quand un user cree sa 1re commande alors
-- que users_profile.referred_by est set, aucun email n etait envoye au
-- parrain. Le trigger ci-dessous appelle l edge function send-email en
-- mode template_raw des la 1re commande.
--
-- Idempotence : ecriture dans order_email_log sous cle "referralUsed".
--
-- Rollback :
--   DROP TRIGGER IF EXISTS trg_order_referral_email ON public.orders;
--   DROP FUNCTION IF EXISTS public.trigger_send_referral_used_email();
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_send_referral_used_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_edge_url          text := 'https://qxhhnrnworwrnwmqekmb.supabase.co/functions/v1/send-email';
  v_secret            text;
  v_referrer_id       uuid;
  v_referrer_email    text;
  v_referee_firstname text;
  v_order_count       int;
  v_already           boolean;
BEGIN
  -- Cherche le parrain sur le profil du client
  SELECT referred_by, first_name
    INTO v_referrer_id, v_referee_firstname
    FROM public.users_profile
    WHERE id = NEW.user_id;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verifie que c est bien la 1re commande de ce user
  SELECT count(*) INTO v_order_count
    FROM public.orders
    WHERE user_id = NEW.user_id;

  IF v_order_count > 1 THEN
    RETURN NEW;
  END IF;

  -- Idempotence : si deja envoye pour cette commande, on skip
  SELECT true INTO v_already
    FROM public.order_email_log
    WHERE order_id = NEW.id::text AND template = 'referralUsed'
    LIMIT 1;
  IF v_already THEN
    RETURN NEW;
  END IF;

  -- Recupere l email du parrain
  SELECT email INTO v_referrer_email
    FROM public.users_profile
    WHERE id = v_referrer_id;

  IF v_referrer_email IS NULL OR v_referrer_email = '' THEN
    RETURN NEW;
  END IF;

  -- Secret pour auth edge function
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
        'to', v_referrer_email,
        'template_raw', 'referralUsed',
        'params', jsonb_build_object(
          'firstName', COALESCE(v_referee_firstname, 'ton filleul'),
          'points',    500,
          'orderId',   NEW.id::text
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trigger_send_referral_used_email] net.http_post failed: %', SQLERRM;
  END;

  INSERT INTO public.order_email_log (order_id, template)
  VALUES (NEW.id::text, 'referralUsed')
  ON CONFLICT (order_id, template) DO NOTHING;

  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.trigger_send_referral_used_email() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.trigger_send_referral_used_email() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_order_referral_email ON public.orders;
CREATE TRIGGER trg_order_referral_email
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_referral_used_email();

-- Sanity check :
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_order_referral_email';
