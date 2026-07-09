-- ════════════════════════════════════════════════════════════════
-- YARAM — Système de rôles admin (commercial, admin, super_admin)
-- ════════════════════════════════════════════════════════════════
-- Déployé en prod via MCP execute_sql le 2026-07-09
-- Ce fichier synchronise l'historique migration/git.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- RPC 1 : super_admin crée un nouvel utilisateur (admin/commercial)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_admin_token text,
  p_email text,
  p_name text,
  p_pin text,
  p_role text DEFAULT 'commercial',
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_caller_role text;
  v_caller_id uuid;
  v_new_id uuid;
  v_pin_hash text;
BEGIN
  SELECT au.role, au.id INTO v_caller_role, v_caller_id
    FROM admin_sessions s
    JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW()
   LIMIT 1;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_role');
  END IF;

  IF p_role NOT IN ('super_admin', 'admin', 'commercial', 'moderator') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_role');
  END IF;

  IF p_pin !~ '^\d{4,8}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pin_format');
  END IF;

  IF EXISTS(SELECT 1 FROM admin_users WHERE lower(email) = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_already_exists');
  END IF;

  v_pin_hash := extensions.crypt(p_pin, extensions.gen_salt('bf', 10));

  INSERT INTO admin_users (email, name, pin_hash, role, created_by, notes, active)
  VALUES (lower(trim(p_email)), trim(p_name), v_pin_hash, p_role, v_caller_id, p_notes, true)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'email', lower(trim(p_email)),
    'role', p_role,
    'message', 'Compte créé — le PIN doit être communiqué manuellement'
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- RPC 2 : super_admin liste tous les admins
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_all_admins(p_admin_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_caller_role text; v_list jsonb;
BEGIN
  SELECT au.role INTO v_caller_role
    FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() LIMIT 1;
  IF v_caller_role IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  IF v_caller_role != 'super_admin' THEN RETURN jsonb_build_object('success', false, 'error', 'insufficient_role'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'email', email, 'name', name, 'role', role, 'active', active,
    'last_login_at', last_login_at, 'login_count', COALESCE(login_count, 0),
    'created_at', created_at, 'notes', notes
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_list
  FROM admin_users;

  RETURN jsonb_build_object('success', true, 'admins', v_list);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_all_admins(text) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- RPC 3 : super_admin active/désactive un admin (invalide sessions)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_admin_token text, p_user_id uuid, p_active boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_caller_role text; v_caller_id uuid;
BEGIN
  SELECT au.role, au.id INTO v_caller_role, v_caller_id
    FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() LIMIT 1;
  IF v_caller_role IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  IF v_caller_role != 'super_admin' THEN RETURN jsonb_build_object('success', false, 'error', 'insufficient_role'); END IF;
  IF v_caller_id = p_user_id THEN RETURN jsonb_build_object('success', false, 'error', 'cannot_disable_self'); END IF;

  UPDATE admin_users SET active = p_active WHERE id = p_user_id;
  IF p_active = false THEN DELETE FROM admin_sessions WHERE admin_id = p_user_id; END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(text, uuid, boolean) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- RPC 4 : Update admin_create_signature_request avec check rôle
-- (super_admin + admin + commercial peuvent créer des contrats,
--  moderator/dermato NON)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_signature_request(
  p_admin_token text,
  p_template_id text,
  p_recipient_name text,
  p_recipient_email text,
  p_recipient_phone text DEFAULT NULL,
  p_prefilled_fields jsonb DEFAULT '{}'::jsonb,
  p_admin_message text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_admin_id uuid; v_admin_role text; v_token text; v_id uuid;
BEGIN
  SELECT s.admin_id, au.role INTO v_admin_id, v_admin_role
    FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() AND au.active = true
   LIMIT 1;

  IF v_admin_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  IF v_admin_role NOT IN ('super_admin', 'admin', 'commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM signature_templates WHERE id = p_template_id AND active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'template_not_found');
  END IF;

  v_token := 'sig_' || replace(gen_random_uuid()::text, '-', '') || substring(md5(random()::text), 1, 8);

  INSERT INTO signature_requests (
    token, template_id, recipient_name, recipient_email, recipient_phone,
    prefilled_fields, created_by_admin, admin_message
  ) VALUES (
    v_token, p_template_id, p_recipient_name, p_recipient_email, p_recipient_phone,
    p_prefilled_fields, v_admin_id, p_admin_message
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'token', v_token,
    'sign_url', 'https://yaram.app/sign/' || v_token);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_signature_request(text, text, text, text, text, jsonb, text) TO anon, authenticated;
