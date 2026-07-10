-- ════════════════════════════════════════════════════════════════
-- YARAM — Tables applications partenaires + livreurs
-- Déployé en prod via MCP execute_sql le 2026-07-10
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_name text NOT NULL,
  owner_name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text,
  address text,
  ninea text,
  monthly_orders_estimate int,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','onboarding','signed','refused','archived')),
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partner_apps_status ON public.partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_apps_created ON public.partner_applications(created_at DESC);

CREATE TABLE IF NOT EXISTS public.driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  birth_date date,
  cni text,
  city text NOT NULL,
  neighborhood text,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('moto','scooter','velo','voiture','other')),
  vehicle_brand text,
  license_number text,
  hours_per_week int,
  motivation text,
  has_smartphone boolean DEFAULT true,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','interview','trial','hired','refused','archived')),
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_driver_apps_status ON public.driver_applications(status);
CREATE INDEX IF NOT EXISTS idx_driver_apps_city ON public.driver_applications(city);
CREATE INDEX IF NOT EXISTS idx_driver_apps_created ON public.driver_applications(created_at DESC);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "block_all_partner_apps" ON public.partner_applications;
CREATE POLICY "block_all_partner_apps" ON public.partner_applications FOR ALL USING (false);
DROP POLICY IF EXISTS "block_all_driver_apps" ON public.driver_applications;
CREATE POLICY "block_all_driver_apps" ON public.driver_applications FOR ALL USING (false);

-- RPC public : soumission candidature partenaire
CREATE OR REPLACE FUNCTION public.public_submit_partner_application(
  p_pharmacy_name text, p_owner_name text, p_phone text,
  p_email text DEFAULT NULL, p_city text DEFAULT NULL, p_address text DEFAULT NULL,
  p_ninea text DEFAULT NULL, p_monthly_orders int DEFAULT NULL, p_message text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_pharmacy_name IS NULL OR length(trim(p_pharmacy_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pharmacy_name'); END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) < 7 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone'); END IF;

  INSERT INTO partner_applications (
    pharmacy_name, owner_name, phone, email, city, address, ninea, monthly_orders_estimate, message, user_agent
  ) VALUES (
    trim(p_pharmacy_name), trim(p_owner_name), trim(p_phone),
    lower(trim(p_email)), trim(p_city), trim(p_address), trim(p_ninea),
    p_monthly_orders, p_message, p_user_agent
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id,
    'message', 'Candidature reçue — on vous appelle dans les 48h');
END; $$;
GRANT EXECUTE ON FUNCTION public.public_submit_partner_application(text, text, text, text, text, text, text, int, text, text) TO anon, authenticated;

-- RPC public : soumission candidature chauffeur
CREATE OR REPLACE FUNCTION public.public_submit_driver_application(
  p_full_name text, p_phone text, p_city text, p_vehicle_type text,
  p_email text DEFAULT NULL, p_birth_date date DEFAULT NULL, p_cni text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL, p_vehicle_brand text DEFAULT NULL,
  p_license_number text DEFAULT NULL, p_hours_per_week int DEFAULT NULL,
  p_motivation text DEFAULT NULL, p_has_smartphone boolean DEFAULT true,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name'); END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) < 7 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone'); END IF;
  IF p_vehicle_type NOT IN ('moto','scooter','velo','voiture','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_vehicle'); END IF;

  INSERT INTO driver_applications (
    full_name, phone, email, birth_date, cni, city, neighborhood,
    vehicle_type, vehicle_brand, license_number, hours_per_week,
    motivation, has_smartphone, user_agent
  ) VALUES (
    trim(p_full_name), trim(p_phone), lower(trim(p_email)),
    p_birth_date, trim(p_cni), trim(p_city), trim(p_neighborhood),
    p_vehicle_type, trim(p_vehicle_brand), trim(p_license_number),
    p_hours_per_week, p_motivation, p_has_smartphone, p_user_agent
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id,
    'message', 'Candidature reçue — vous serez contacté sous 48h');
END; $$;
GRANT EXECUTE ON FUNCTION public.public_submit_driver_application(text, text, text, text, text, date, text, text, text, text, int, text, boolean, text) TO anon, authenticated;

-- RPCs admin : liste (accessible super_admin, admin, commercial)
CREATE OR REPLACE FUNCTION public.admin_list_partner_applications(p_admin_token text, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_role text; v_list jsonb;
BEGIN
  SELECT au.role INTO v_role FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() AND au.active = true LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('super_admin','admin','commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_list
  FROM (SELECT * FROM partner_applications WHERE p_status IS NULL OR status = p_status) t;
  RETURN jsonb_build_object('success', true, 'applications', v_list);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_partner_applications(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_driver_applications(p_admin_token text, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_role text; v_list jsonb;
BEGIN
  SELECT au.role INTO v_role FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_id
   WHERE s.token = p_admin_token AND s.expires_at > NOW() AND au.active = true LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('super_admin','admin','commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_list
  FROM (SELECT * FROM driver_applications WHERE p_status IS NULL OR status = p_status) t;
  RETURN jsonb_build_object('success', true, 'applications', v_list);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_driver_applications(text, text) TO anon, authenticated;
