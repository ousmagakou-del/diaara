-- ═══════════════════════════════════════════════════════════════
-- Phase 0 (Chantier 1) — RPCs admin update + counts pour candidatures
-- Deploye en prod via MCP execute_sql le 2026-07-10
--
-- ROLLBACK :
--   DROP FUNCTION public.admin_update_partner_application(text, uuid, text, text);
--   DROP FUNCTION public.admin_update_driver_application(text, uuid, text, text);
--   DROP FUNCTION public.admin_applications_counts(text);
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_update_partner_application(
  p_admin_token text, p_application_id uuid, p_status text DEFAULT NULL, p_admin_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_role text; v_admin_id uuid;
BEGIN
  SELECT au.role, au.id INTO v_role, v_admin_id
    FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() AND au.active = true LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('super_admin','admin','commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('new','contacted','onboarding','signed','refused','archived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status'); END IF;

  UPDATE partner_applications
     SET status = COALESCE(p_status, status),
         admin_notes = COALESCE(p_admin_notes, admin_notes),
         processed_by = v_admin_id,
         processed_at = NOW()
   WHERE id = p_application_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_partner_application(text, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_driver_application(
  p_admin_token text, p_application_id uuid, p_status text DEFAULT NULL, p_admin_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_role text; v_admin_id uuid;
BEGIN
  SELECT au.role, au.id INTO v_role, v_admin_id
    FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() AND au.active = true LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('super_admin','admin','commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('new','contacted','interview','trial','hired','refused','archived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status'); END IF;

  UPDATE driver_applications
     SET status = COALESCE(p_status, status),
         admin_notes = COALESCE(p_admin_notes, admin_notes),
         processed_by = v_admin_id,
         processed_at = NOW()
   WHERE id = p_application_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_driver_application(text, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_applications_counts(p_admin_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_role text; v_partner_new int; v_driver_new int;
BEGIN
  SELECT au.role INTO v_role FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() AND au.active = true LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('super_admin','admin','commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  SELECT count(*)::int INTO v_partner_new FROM partner_applications WHERE status = 'new';
  SELECT count(*)::int INTO v_driver_new FROM driver_applications WHERE status = 'new';
  RETURN jsonb_build_object('success', true, 'partner_new', v_partner_new, 'driver_new', v_driver_new);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_applications_counts(text) TO anon, authenticated;
