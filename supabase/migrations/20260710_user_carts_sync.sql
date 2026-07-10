-- ═══════════════════════════════════════════════════════════════
-- Cart cross-device sync (Best Buy style)
-- Deploye en prod via MCP execute_sql le 2026-07-10
--
-- ROLLBACK:
--   DROP FUNCTION public.upsert_user_cart(jsonb, text, text);
--   DROP FUNCTION public.get_user_cart();
--   DROP TABLE public.user_carts;
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_carts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  promo_code text,
  gift_card text,
  last_device text CHECK (last_device IN ('web','ios','android','other')) DEFAULT 'other',
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.user_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_carts_owner_all ON public.user_carts;
CREATE POLICY user_carts_owner_all ON public.user_carts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upsert_user_cart(
  p_items jsonb,
  p_promo_code text DEFAULT NULL,
  p_device text DEFAULT 'web'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;

  INSERT INTO user_carts (user_id, items, promo_code, last_device, updated_at)
  VALUES (v_uid, COALESCE(p_items, '[]'::jsonb), p_promo_code, COALESCE(p_device, 'web'), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET items = EXCLUDED.items,
        promo_code = EXCLUDED.promo_code,
        last_device = EXCLUDED.last_device,
        updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'updated_at', NOW());
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_user_cart(jsonb, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_cart()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid; v_row record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;

  SELECT items, promo_code, last_device, updated_at INTO v_row
    FROM user_carts WHERE user_id = v_uid LIMIT 1;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', true, 'items', '[]'::jsonb, 'promo_code', NULL, 'last_device', NULL, 'updated_at', NULL);
  END IF;
  RETURN jsonb_build_object('success', true,
    'items', v_row.items,
    'promo_code', v_row.promo_code,
    'last_device', v_row.last_device,
    'updated_at', v_row.updated_at);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_user_cart() TO anon, authenticated;
