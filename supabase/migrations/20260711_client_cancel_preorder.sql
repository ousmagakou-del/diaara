-- ═════════════════════════════════════════════════════════════════════
-- client_cancel_preorder(p_order_id text)
-- ─────────────────────────────────────────────────────────────────────
-- Permet au client d annuler sa propre commande import (is_preorder=true)
-- tant que l admin ne l a pas expediee. Statuts autorises pour annulation :
--   'paid', 'awaiting_supplier', 'in_transit_intl', 'arrived_local', 'awaiting_balance'
-- Passe le statut a 'cancelled' + cancelled_at = now().
-- Le remboursement de l acompte se fait offline (manuel Wave/OM/carte).
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_cancel_preorder(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid;
  v_order record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, user_id, status, is_preorder
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_your_order');
  END IF;

  IF v_order.is_preorder IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_preorder');
  END IF;

  IF v_order.status NOT IN ('paid', 'awaiting_supplier', 'in_transit_intl', 'arrived_local', 'awaiting_balance') THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_cancellable', 'status', v_order.status);
  END IF;

  PERFORM set_config('app.order_writer_ok', 'yes', true);
  UPDATE public.orders
     SET status = 'cancelled',
         cancelled_at = NOW(),
         updated_at = NOW()
   WHERE id = p_order_id AND user_id = v_user_id;
  PERFORM set_config('app.order_writer_ok', 'no', true);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.order_writer_ok', 'no', true);
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_cancel_preorder(text) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════
-- client_mark_balance_paid(p_order_id text)
-- ─────────────────────────────────────────────────────────────────────
-- Le client vient de payer le solde 50% (mode balance dans Payment.jsx).
-- On passe status : awaiting_balance -> awaiting_verification
-- L admin verifie le paiement puis marque la commande 'ready' (pret a expedier).
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_mark_balance_paid(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid;
  v_order record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, user_id, status, is_preorder
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_your_order');
  END IF;

  IF v_order.is_preorder IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_preorder');
  END IF;

  IF v_order.status <> 'awaiting_balance' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_awaiting_balance', 'current_status', v_order.status);
  END IF;

  PERFORM set_config('app.order_writer_ok', 'yes', true);
  UPDATE public.orders
     SET status = 'awaiting_verification',
         balance_paid_at = NOW(),
         updated_at = NOW()
   WHERE id = p_order_id AND user_id = v_user_id AND status = 'awaiting_balance';
  PERFORM set_config('app.order_writer_ok', 'no', true);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'awaiting_verification');

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.order_writer_ok', 'no', true);
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_mark_balance_paid(text) TO authenticated;

-- rollback:
-- DROP FUNCTION IF EXISTS public.client_cancel_preorder(text);
-- DROP FUNCTION IF EXISTS public.client_mark_balance_paid(text);
