-- ════════════════════════════════════════════════════════════════
-- YARAM — Système de signature en ligne (DocuSign-lite)
-- ════════════════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor Supabase
-- ════════════════════════════════════════════════════════════════

-- 1. Templates de contrats disponibles à signer
CREATE TABLE IF NOT EXISTS public.signature_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text CHECK (category IN ('pharmacy','driver','distributor','partner','other')),
  html_body text NOT NULL,
  fields_schema jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- 2. Demandes de signature envoyées
CREATE TABLE IF NOT EXISTS public.signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  template_id text REFERENCES public.signature_templates(id),
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  recipient_phone text,
  prefilled_fields jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','viewed','signed','expired','declined','cancelled')),
  signature_data text,
  signed_html text,
  viewed_at timestamptz,
  signed_at timestamptz,
  ip_address text,
  user_agent text,
  created_by_admin uuid,
  admin_message text,
  created_at timestamptz DEFAULT NOW(),
  expires_at timestamptz DEFAULT (NOW() + INTERVAL '30 days'),
  reminded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_signature_requests_token ON public.signature_requests(token);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON public.signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_requests_email ON public.signature_requests(recipient_email);
CREATE INDEX IF NOT EXISTS idx_signature_requests_created_at ON public.signature_requests(created_at DESC);

-- 3. RLS : tout bloqué, seuls les RPC SECURITY DEFINER passent
ALTER TABLE public.signature_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_all" ON public.signature_templates;
CREATE POLICY "block_all" ON public.signature_templates FOR ALL USING (false);

DROP POLICY IF EXISTS "block_all_requests" ON public.signature_requests;
CREATE POLICY "block_all_requests" ON public.signature_requests FOR ALL USING (false);

-- ════════════════════════════════════════════════════════════════
-- RPC 1 : admin liste les templates
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_list_signature_templates(p_admin_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_admin_ok boolean; v_list jsonb;
BEGIN
  SELECT EXISTS(SELECT 1 FROM admin_sessions WHERE token = p_admin_token AND expires_at > NOW()) INTO v_admin_ok;
  IF NOT v_admin_ok THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'category', category, 'fields_schema', fields_schema, 'active', active
  )), '[]'::jsonb) INTO v_list
  FROM signature_templates WHERE active = true ORDER BY name;

  RETURN jsonb_build_object('success', true, 'templates', v_list);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_signature_templates(text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC 2 : admin crée une demande de signature
-- ════════════════════════════════════════════════════════════════
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
DECLARE v_admin_id uuid; v_token text; v_id uuid;
BEGIN
  SELECT admin_id INTO v_admin_id FROM admin_sessions
   WHERE token = p_admin_token AND expires_at > NOW() LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  IF NOT EXISTS (SELECT 1 FROM signature_templates WHERE id = p_template_id AND active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'template_not_found');
  END IF;

  -- Token unique 32 chars
  v_token := 'sig_' || replace(gen_random_uuid()::text, '-', '') || substring(md5(random()::text), 1, 8);

  INSERT INTO signature_requests (
    token, template_id, recipient_name, recipient_email, recipient_phone,
    prefilled_fields, created_by_admin, admin_message
  ) VALUES (
    v_token, p_template_id, p_recipient_name, p_recipient_email, p_recipient_phone,
    p_prefilled_fields, v_admin_id, p_admin_message
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'token', v_token,
    'sign_url', 'https://yaram.app/sign/' || v_token
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_signature_request(text, text, text, text, text, jsonb, text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC 3 : admin liste les demandes envoyées
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_list_signature_requests(p_admin_token text, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_admin_ok boolean; v_list jsonb;
BEGIN
  SELECT EXISTS(SELECT 1 FROM admin_sessions WHERE token = p_admin_token AND expires_at > NOW()) INTO v_admin_ok;
  IF NOT v_admin_ok THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'token', r.token,
    'template_id', r.template_id,
    'template_name', t.name,
    'recipient_name', r.recipient_name,
    'recipient_email', r.recipient_email,
    'recipient_phone', r.recipient_phone,
    'status', r.status,
    'created_at', r.created_at,
    'viewed_at', r.viewed_at,
    'signed_at', r.signed_at,
    'expires_at', r.expires_at,
    'sign_url', 'https://yaram.app/sign/' || r.token
  ) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_list
  FROM signature_requests r
  LEFT JOIN signature_templates t ON t.id = r.template_id
  WHERE (p_status IS NULL OR r.status = p_status);

  RETURN jsonb_build_object('success', true, 'requests', v_list);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_signature_requests(text, text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC 4 : PUBLIC — fetch une demande via son token (pour la page /sign/:token)
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.public_get_signature_request(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_r record; v_t record; v_html text;
BEGIN
  SELECT * INTO v_r FROM signature_requests WHERE token = p_token LIMIT 1;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;

  IF v_r.expires_at < NOW() AND v_r.status = 'pending' THEN
    UPDATE signature_requests SET status = 'expired' WHERE id = v_r.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF v_r.status = 'signed' THEN
    RETURN jsonb_build_object('success', true, 'already_signed', true,
      'recipient_name', v_r.recipient_name,
      'signed_at', v_r.signed_at,
      'signed_html', v_r.signed_html);
  END IF;

  SELECT * INTO v_t FROM signature_templates WHERE id = v_r.template_id;

  -- Marque comme "viewed" si première visite
  IF v_r.viewed_at IS NULL THEN
    UPDATE signature_requests SET viewed_at = NOW(), status = 'viewed' WHERE id = v_r.id AND status = 'pending';
  END IF;

  -- Injection des placeholders
  v_html := v_t.html_body;
  DECLARE k text; v text;
  BEGIN
    FOR k, v IN SELECT * FROM jsonb_each_text(v_r.prefilled_fields) LOOP
      v_html := replace(v_html, '{{' || k || '}}', COALESCE(v, ''));
    END LOOP;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'already_signed', false,
    'recipient_name', v_r.recipient_name,
    'recipient_email', v_r.recipient_email,
    'template_name', v_t.name,
    'template_category', v_t.category,
    'fields_schema', v_t.fields_schema,
    'prefilled_fields', v_r.prefilled_fields,
    'html', v_html,
    'admin_message', v_r.admin_message,
    'expires_at', v_r.expires_at
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.public_get_signature_request(text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC 5 : PUBLIC — la personne signe le contrat
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.public_sign_contract(
  p_token text,
  p_signature_data text,
  p_final_fields jsonb DEFAULT '{}'::jsonb,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_r record; v_t record; v_html text; v_final_html text;
DECLARE k text; v text;
BEGIN
  SELECT * INTO v_r FROM signature_requests WHERE token = p_token LIMIT 1;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_r.status = 'signed' THEN RETURN jsonb_build_object('success', false, 'error', 'already_signed'); END IF;
  IF v_r.expires_at < NOW() THEN RETURN jsonb_build_object('success', false, 'error', 'expired'); END IF;
  IF p_signature_data IS NULL OR length(p_signature_data) < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'signature_too_short');
  END IF;

  SELECT * INTO v_t FROM signature_templates WHERE id = v_r.template_id;
  v_html := v_t.html_body;

  -- Injection des final fields (fusion prefilled + user-provided)
  FOR k, v IN SELECT * FROM jsonb_each_text(COALESCE(p_final_fields, v_r.prefilled_fields)) LOOP
    v_html := replace(v_html, '{{' || k || '}}', COALESCE(v, ''));
  END LOOP;

  -- Ajoute le bloc signature à la fin
  v_final_html := v_html || '
    <div class="sig-final">
      <h2>Signatures</h2>
      <div class="sig-block-row">
        <div class="sig-block">
          <div class="sig-block-label">Pour KOMUNITY SENEGAL</div>
          <div class="sig-block-name">Ousmane GAKOU</div>
          <div class="sig-block-role">Fondateur & Gérant</div>
          <div class="sig-block-sig" style="font-family: cursive; font-size: 28px; color: #1F8B4C; margin-top: 8px;">Ousmane Gakou</div>
        </div>
        <div class="sig-block">
          <div class="sig-block-label">Pour ' || v_r.recipient_name || '</div>
          <div class="sig-block-name">' || v_r.recipient_name || '</div>
          <div class="sig-block-role">Le ' || to_char(NOW(), 'DD/MM/YYYY à HH24:MI') || '</div>
          <img src="' || p_signature_data || '" style="max-height: 100px; margin-top: 8px;" alt="Signature" />
        </div>
      </div>
      <p class="sig-meta">Signé électroniquement le ' || to_char(NOW(), 'DD/MM/YYYY à HH24:MI:SS') ||
      ' — IP : ' || COALESCE(p_ip, 'non renseignée') || ' — Token : ' || p_token || '</p>
    </div>';

  UPDATE signature_requests
     SET status = 'signed',
         signature_data = p_signature_data,
         signed_html = v_final_html,
         signed_at = NOW(),
         ip_address = p_ip,
         user_agent = p_user_agent
   WHERE id = v_r.id;

  RETURN jsonb_build_object('success', true, 'signed_at', NOW(), 'recipient_email', v_r.recipient_email);
END; $$;
GRANT EXECUTE ON FUNCTION public.public_sign_contract(text, text, jsonb, text, text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- Seed des 2 templates (Pharmacie + Livreur)
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.signature_templates (id, name, category, html_body, fields_schema) VALUES
('pharmacy_v1', 'Contrat partenariat Pharmacie', 'pharmacy',
'<div class="sig-doc"><div class="sig-hero"><div class="sig-logo">YARAM<span>.</span></div><div class="sig-sub">Édité par KOMUNITY SENEGAL</div><h1>Contrat de partenariat commercial</h1><p class="sig-tag">Référencement d''une pharmacie sur la plateforme YARAM</p></div><div class="sig-section"><h2>Entre les soussignés</h2><p><strong>Monsieur Ousmane GAKOU</strong>, né le 04 octobre 1997 à Boulome, exerçant en entreprise individuelle sous l''enseigne commerciale <strong>« KOMUNITY SENEGAL »</strong>, RCCM SN.DKR.2021.A.26292, NINEA 008771116, sise à la Cité Léopold Sédar Senghor Villa n° 93, Dakar, éditrice de la plateforme YARAM,</p><p>Ci-après <strong>« KOMUNITY SENEGAL »</strong>, d''une part,</p><p><strong>ET :</strong></p><p>La Pharmacie <strong>{{PHARMACY_NAME}}</strong>, située à <strong>{{PHARMACY_ADDRESS}}</strong>, NINEA n° <strong>{{PHARMACY_NINEA}}</strong>, représentée par <strong>{{PHARMACIST_NAME}}</strong>, Pharmacien titulaire,</p><p>Ci-après <strong>« la Pharmacie »</strong>, d''autre part.</p></div><div class="sig-section"><h2>Article 1 — Objet</h2><p>KOMUNITY SENEGAL référence les produits de la Pharmacie sur la plateforme YARAM, assure la mise en relation avec les clients, le traitement des commandes, le paiement et la livraison.</p></div><div class="sig-section"><h2>Article 2 — Obligations de KOMUNITY SENEGAL</h2><ul><li>Développer et maintenir la plateforme YARAM ;</li><li>Traiter les commandes, encaisser les paiements, gérer la relation client ;</li><li>Mandater et rémunérer les livreurs YARAM ;</li><li>Reverser à la Pharmacie le produit net des ventes ;</li><li>Fournir un tableau de bord de suivi en temps réel.</li></ul></div><div class="sig-section"><h2>Article 3 — Obligations de la Pharmacie</h2><ul><li>Fournir la liste des produits et prix ;</li><li>Garantir l''authenticité des produits ;</li><li>Préparer les commandes dans un délai maximum de 20 minutes ;</li><li>Remettre les commandes au livreur sur présentation du code de retrait ;</li><li>Respecter les prix communiqués sur la plateforme.</li></ul></div><div class="sig-section sig-highlight"><h2>Article 4 — Commission</h2><p>La Pharmacie verse à KOMUNITY SENEGAL une commission de <strong>cinq pour cent (5 %) hors taxes</strong> sur chaque vente réalisée via la plateforme. Aucun frais d''inscription.</p></div><div class="sig-section"><h2>Article 5 — Paiement</h2><p>Reversement <strong>hebdomadaire</strong> chaque vendredi, par virement bancaire, Wave ou Orange Money.</p></div><div class="sig-section"><h2>Article 6 — Durée</h2><p>Durée indéterminée. Préavis de résiliation de <strong>trente (30) jours calendaires</strong>.</p></div><div class="sig-section"><h2>Article 7 — Loi applicable</h2><p>Loi sénégalaise. Tribunal de Commerce de Dakar en cas de litige.</p></div></div>',
'[{"key":"PHARMACY_NAME","label":"Nom de la pharmacie","type":"text","required":true},{"key":"PHARMACY_ADDRESS","label":"Adresse complète","type":"text","required":true},{"key":"PHARMACY_NINEA","label":"NINEA de la pharmacie","type":"text","required":false},{"key":"PHARMACIST_NAME","label":"Nom du pharmacien titulaire","type":"text","required":true}]'::jsonb
),
('driver_v1', 'Contrat prestation Livreur', 'driver',
'<div class="sig-doc"><div class="sig-hero"><div class="sig-logo">YARAM<span>.</span></div><div class="sig-sub">Édité par KOMUNITY SENEGAL</div><h1>Contrat de prestation de livraison</h1><p class="sig-tag">Livreur indépendant sur la plateforme YARAM</p></div><div class="sig-section"><h2>Entre les soussignés</h2><p><strong>Monsieur Ousmane GAKOU</strong>, exerçant en entreprise individuelle sous l''enseigne <strong>« KOMUNITY SENEGAL »</strong>, RCCM SN.DKR.2021.A.26292, NINEA 008771116, éditrice de la plateforme YARAM,</p><p>Ci-après <strong>« KOMUNITY SENEGAL »</strong>, d''une part,</p><p><strong>ET :</strong></p><p><strong>{{DRIVER_NAME}}</strong>, né(e) le <strong>{{DRIVER_BIRTHDATE}}</strong>, CNI n° <strong>{{DRIVER_CNI}}</strong>, demeurant à <strong>{{DRIVER_ADDRESS}}</strong>, tél <strong>{{DRIVER_PHONE}}</strong>, véhicule : <strong>{{DRIVER_VEHICLE}}</strong>,</p><p>Ci-après <strong>« le Livreur »</strong>, d''autre part.</p></div><div class="sig-section"><h2>Article 1 — Statut</h2><p>Le Livreur exerce en qualité de <strong>prestataire indépendant</strong>, sans lien de subordination. Le présent contrat ne constitue pas un contrat de travail.</p></div><div class="sig-section"><h2>Article 2 — Obligations du Livreur</h2><ul><li>Disposer d''un véhicule en bon état, permis valide, smartphone ;</li><li>Souscrire une assurance responsabilité civile ;</li><li>Se présenter en tenue soignée et respecter les clients ;</li><li>Respecter délais et code de la route ;</li><li>Ne pas ouvrir les commandes.</li></ul></div><div class="sig-section sig-highlight"><h2>Article 3 — Rémunération</h2><ul><li>Course courte (0-3 km) : 1 000 FCFA</li><li>Course moyenne (3-6 km) : 1 500 FCFA</li><li>Course longue (&gt; 6 km) : 2 000 FCFA + 200 FCFA / km</li><li>Bonus heures creuses : + 20 %</li><li>Pourboires intégralement au Livreur</li></ul><p>Paiement <strong>hebdomadaire</strong>, chaque lundi, par Wave ou Orange Money.</p></div><div class="sig-section"><h2>Article 4 — Durée</h2><p>Durée indéterminée. Préavis de <strong>sept (7) jours</strong> de part et d''autre.</p></div><div class="sig-section"><h2>Article 5 — Responsabilité</h2><p>Le Livreur est seul responsable des dommages causés à lui-même, au véhicule, aux tiers ou aux commandes. Assurance à sa charge.</p></div><div class="sig-section"><h2>Article 6 — Loi applicable</h2><p>Loi sénégalaise. Tribunal de Commerce de Dakar.</p></div></div>',
'[{"key":"DRIVER_NAME","label":"Nom complet","type":"text","required":true},{"key":"DRIVER_BIRTHDATE","label":"Date de naissance","type":"text","required":true},{"key":"DRIVER_CNI","label":"N° CNI","type":"text","required":true},{"key":"DRIVER_ADDRESS","label":"Adresse","type":"text","required":true},{"key":"DRIVER_PHONE","label":"Téléphone","type":"text","required":true},{"key":"DRIVER_VEHICLE","label":"Type de véhicule","type":"text","required":true}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET html_body = EXCLUDED.html_body, fields_schema = EXCLUDED.fields_schema, updated_at = NOW();
