-- ═══════════════════════════════════════════════════════════════════
-- YARAM — RPC client_mark_order_paid (safety net)
-- ═══════════════════════════════════════════════════════════════════
-- Symptôme : bouton "J'ai payé" reste bloqué sur "Confirmation..."
--
-- Cause possible : la RPC client_mark_order_paid utilisée par Payment.jsx
--                  n'existe pas (ou plus) sur Supabase prod, donc la RPC
--                  retourne une erreur silencieuse et le hang ou navigate
--                  cassée se produit.
--
-- Cette migration crée/remplace la RPC avec les bonnes vérifications de
-- sécurité (un client ne peut marquer payé QUE sa propre commande).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_mark_order_paid(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_order record;
BEGIN
  -- 1. Récupère l'utilisateur courant (NULL si anon — refusé)
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Vérifie que l'order existe ET appartient à ce user ET est dans le bon état
  SELECT id, user_id, status
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_your_order');
  END IF;

  -- 3. Status valide pour passer en paid (évite double-confirmation)
  IF v_order.status NOT IN ('pending_payment', 'pending') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'order_not_pending',
      'current_status', v_order.status
    );
  END IF;

  -- 4. UPDATE
  UPDATE public.orders
     SET status = 'paid',
         payment_confirmed_at = NOW()
   WHERE id = p_order_id
     AND user_id = v_uid
     AND status IN ('pending_payment', 'pending');

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ─── Donner accès à anon + authenticated (la fonction check elle-même auth.uid) ───
GRANT EXECUTE ON FUNCTION public.client_mark_order_paid(text) TO anon, authenticated;

-- ─── Vérification ───
-- Pour confirmer que la fonction existe et est appelable :
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  r.rolname AS owner
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname = 'client_mark_order_paid';

-- Test manuel (remplace 'TON-ORDER-ID' par un vrai ID en pending_payment) :
-- SELECT client_mark_order_paid('DIA-MPW3NY48');
