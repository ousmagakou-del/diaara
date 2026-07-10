-- ═══════════════════════════════════════════════════════════════
-- YARAM - site_settings hero video URLs (admin-editable)
-- Deploye en prod via MCP execute_sql le 2026-07-10
--
-- ROLLBACK:
--   DELETE FROM public.site_settings
--    WHERE key IN ('hero_video_url', 'hero_video_url_partner', 'hero_video_url_driver');
-- ═══════════════════════════════════════════════════════════════

-- Ces 3 cles permettent a l admin de coller un lien YouTube ou un lien
-- fichier direct mp4/webm/mov depuis SettingsSection.
-- Le composant HeroVideo detecte automatiquement le type d URL et rend
-- soit un iframe youtube-nocookie, soit un <video>.
-- Chaine vide -> fallback video statique historique (/hero-video.mp4).

INSERT INTO public.site_settings (key, value) VALUES
  ('hero_video_url',         '""'::jsonb),
  ('hero_video_url_partner', '""'::jsonb),
  ('hero_video_url_driver',  '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
