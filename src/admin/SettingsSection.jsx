import { useState, useEffect } from 'react';
import { getSiteSettings, updateSiteSettings } from '../lib/supabase';
import { toast, confirmDialog } from '../lib/toast';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration generale du site — persistee en DB (table site_settings).
//
// MIGRATION SQL A LANCER UNE FOIS dans Supabase Studio :
//
//   CREATE TABLE IF NOT EXISTS public.site_settings (
//     key         text PRIMARY KEY,
//     value       jsonb NOT NULL,
//     updated_at  timestamptz DEFAULT now()
//   );
//   ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
//   -- Lecture publique (l'app cliente peut lire les settings publics)
//   CREATE POLICY "settings_read_all" ON public.site_settings
//     FOR SELECT USING (true);
//   -- Ecriture : service_role uniquement (l'admin passe par RPC ou edge function)
//   -- Pour le MVP on autorise l'ecriture cote anon mais a securiser en prod !
//   CREATE POLICY "settings_write_anon_TEMP" ON public.site_settings
//     FOR ALL USING (true) WITH CHECK (true);
//
// Note : les VRAIES sources d'info de l'app (commission 8% dans supabase.js,
// frais livraison par ville dans utils.js, etc.) ne sont PAS encore branchees
// sur cette table. Pour le moment cette page persiste les valeurs en DB mais
// le code ne les lit pas. Prochaine etape : remplacer les constantes par des
// lectures de getSiteSettings() dans les helpers concernes.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  siteName: 'YARAM',
  commission: 8,
  deliveryFee: 1500,
  freeDeliveryFrom: 50000,
  whatsapp: '+221 77 438 87 66',
  email: 'contact@yaram.sn',
  primaryColor: '#1F8B4C',
  accentColor: '#FFD700',
};

export default function SettingsSection() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const remote = await getSiteSettings();
      // Merge DB sur defaults pour gerer le cas d'une table vide ou partielle
      setSettings({ ...DEFAULTS, ...remote });
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateSiteSettings(settings);
    setSaving(false);
    if (result.success) {
      toast.success('Paramètres enregistrés en base de données');
    } else {
      toast.error('Échec sauvegarde : ' + (result.error || 'erreur inconnue'));
    }
  };

  const handleReset = async () => {
    if (!(await confirmDialog('Réinitialiser aux valeurs par défaut ?', { confirmLabel: 'Réinitialiser', danger: true }))) return;
    setSettings(DEFAULTS);
    setSaving(true);
    const result = await updateSiteSettings(DEFAULTS);
    setSaving(false);
    if (result.success) toast.success('Paramètres réinitialisés');
    else toast.error('Échec : ' + (result.error || 'erreur inconnue'));
  };

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Paramètres</h1>
          <p>Configuration générale YARAM (persistée en DB)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="adm-btn-sec" onClick={handleReset} disabled={saving || loading}>↺ Réinitialiser</button>
          <button className="adm-btn-pri" onClick={handleSave} disabled={saving || loading}>
            {saving ? '💾 Sauvegarde…' : '💾 Enregistrer'}
          </button>
        </div>
      </header>

      {/* ────────── INFO sur quoi est branche / pas encore ────────── */}
      <div style={{
        background: '#E6F1FB',
        border: '1.5px solid #4285F4',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>ℹ️</span>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#185FA5' }}>
          <strong>Les valeurs sont sauvegardées en base</strong> (table <code>site_settings</code>).
          Toutefois certains modules de l'app (calcul de la commission dans <code>supabase.js</code>,
          frais de livraison par ville dans <code>utils.js</code>) utilisent encore des valeurs
          en dur dans le code. Modifier ici ne les affecte pas <em>encore</em> — la prochaine
          étape sera de les brancher sur <code>getSiteSettings()</code>.
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9B9B9B' }}>Chargement…</p>
      ) : (
        <div className="adm-form-grid">
          <div className="adm-form-section">
            <h3>🏢 Identité</h3>
            <label>Nom de la boutique<input value={settings.siteName} onChange={e => setSettings({ ...settings, siteName: e.target.value })} /></label>
            <label>Email contact<input value={settings.email} onChange={e => setSettings({ ...settings, email: e.target.value })} /></label>
            <label>WhatsApp<input value={settings.whatsapp} onChange={e => setSettings({ ...settings, whatsapp: e.target.value })} /></label>
          </div>

          <div className="adm-form-section">
            <h3>💰 Business <small style={{ color: '#9B9B9B', fontWeight: 500, fontSize: 11 }}>(à câbler côté code)</small></h3>
            <label>Commission YARAM (%)<input type="number" step="0.1" value={settings.commission} onChange={e => setSettings({ ...settings, commission: parseFloat(e.target.value) || 0 })} /></label>
            <label>Frais livraison Dakar (FCFA)<input type="number" value={settings.deliveryFee} onChange={e => setSettings({ ...settings, deliveryFee: parseInt(e.target.value) || 0 })} /></label>
            <label>Livraison gratuite dès (FCFA)<input type="number" value={settings.freeDeliveryFrom} onChange={e => setSettings({ ...settings, freeDeliveryFrom: parseInt(e.target.value) || 0 })} /></label>
          </div>

          <div className="adm-form-section">
            <h3>🎨 Couleurs <small style={{ color: '#9B9B9B', fontWeight: 500, fontSize: 11 }}>(à câbler côté CSS)</small></h3>
            <label>Couleur principale<input type="color" value={settings.primaryColor} onChange={e => setSettings({ ...settings, primaryColor: e.target.value })} style={{ height: 44 }} /></label>
            <label>Couleur accent<input type="color" value={settings.accentColor} onChange={e => setSettings({ ...settings, accentColor: e.target.value })} style={{ height: 44 }} /></label>
          </div>

          <div className="adm-form-section">
            <h3>ℹ️ À propos</h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#6B6B6B' }}>
              <strong>YARAM v0.1</strong><br />
              Marketplace beauté Sénégal 🇸🇳<br />
              Commission marketplace : {settings.commission}%<br />
              Livraison YARAM mutualisée
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
