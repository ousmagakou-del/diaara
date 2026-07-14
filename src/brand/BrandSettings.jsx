// ════════════════════════════════════════════════════════════════
// BrandSettings — Profil marque + changer PIN + support + logout
// ────────────────────────────────────────────────────────────────
// - Infos brand (nom, telephone readonly, email)
// - Changer PIN (via brand_change_pin si dispo, sinon toast info)
// - Contact WhatsApp + email admin
// - Deconnexion
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { getBrandToken } from '../pages/Brand';
import { getWhatsAppNumber } from '../lib/utils';
import BrandInstallCard from './BrandInstallCard';

const BANNED_PINS = [
  '000000','111111','222222','333333','444444','555555','666666','777777','888888','999999',
  '123456','654321','012345','543210','111222','121212','123123','112233',
];

const ADMIN_EMAIL = 'ousmane@yaram.app';

const Icon = ({ name, ...p }) => {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p };
  switch (name) {
    case 'user': return (<svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
    case 'lock': return (<svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
    case 'phone': return (<svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);
    case 'mail': return (<svg {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>);
    case 'help': return (<svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
    case 'logout': return (<svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
    case 'wa': return (<svg {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>);
    default: return null;
  }
};

export default function BrandSettings({ brand, onUpdate, onLogout }) {
  const [pinView, setPinView] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinOk, setPinOk] = useState('');
  const [email, setEmail] = useState(brand?.email || brand?.contact_email || '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setEmail(brand?.email || brand?.contact_email || '');
  }, [brand?.email, brand?.contact_email]);

  const openWhatsApp = () => {
    const msg = `Bonjour Ousmane, ${brand?.name} ici — j'ai besoin d'aide sur mon dashboard.`;
    window.open(`https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleChangePin = async () => {
    setPinError(''); setPinOk('');
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) return setPinError('Le nouveau PIN doit faire 6 chiffres');
    if (BANNED_PINS.includes(newPin)) return setPinError('PIN trop évident, choisis-en un autre');
    if (newPin === oldPin) return setPinError("Le nouveau PIN doit être différent de l'ancien");
    if (newPin !== confirmPin) return setPinError('Les deux PIN ne correspondent pas');

    // On tente d'appeler brand_change_pin si la RPC existe, sinon on renvoie sur WhatsApp
    const { data, error } = await supabase.rpc('brand_change_pin', {
      p_brand_id: brand?.id,
      p_old_pin: oldPin,
      p_new_pin: newPin,
    });
    if (error) {
      // Si RPC introuvable → on propose WhatsApp comme fallback
      if (/does not exist|not found|no function/i.test(error.message)) {
        setPinError("Changement automatique bientôt disponible. Contacte Ousmane pour l'instant.");
        return;
      }
      return setPinError('Erreur serveur : ' + error.message);
    }
    if (!data?.success) return setPinError(data?.error || 'Échec changement PIN');

    setPinOk('PIN modifié avec succès');
    setOldPin(''); setNewPin(''); setConfirmPin('');
    if (onUpdate) onUpdate({ ...brand, pin_set_at: new Date().toISOString() });
    setTimeout(() => { setPinView(false); setPinOk(''); }, 2000);
  };

  const handleSaveEmail = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Email invalide");
      return;
    }
    setSaving(true);
    setSavedMsg('');
    const token = getBrandToken();
    // On tente une RPC brand_update_settings ; si absente on fallback update direct
    let ok = false;
    try {
      const { data, error } = await supabase.rpc('brand_update_settings', {
        p_token: token,
        p_payload: { email, contact_email: email },
      });
      if (!error && data?.success !== false) ok = true;
    } catch { /* rpc absente */ }
    if (!ok) {
      // Best-effort update via table (peut echouer selon RLS)
      const { error: upErr } = await supabase
        .from('brands')
        .update({ email, contact_email: email })
        .eq('id', brand?.id);
      if (!upErr) ok = true;
    }
    setSaving(false);
    if (ok) {
      setSavedMsg('Email enregistré');
      if (onUpdate) onUpdate({ ...brand, email, contact_email: email });
      setTimeout(() => setSavedMsg(''), 2500);
    } else {
      toast.error("Impossible d'enregistrer pour l'instant. Réessaie plus tard.");
    }
  };

  if (pinView) {
    return (
      <div className="brnd-section">
        <div className="brnd-header">
          <div>
            <h1>Modifier mon PIN</h1>
            <p>Choisis un nouveau PIN à 6 chiffres.</p>
          </div>
        </div>

        <div className="brnd-card" style={{ maxWidth: 520 }}>
          <div className="brnd-field">
            <label className="brnd-label">Ancien PIN</label>
            <input
              className="brnd-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={oldPin}
              onChange={e => { setOldPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="••••••"
              autoFocus
            />
          </div>
          <div className="brnd-field">
            <label className="brnd-label">Nouveau PIN (6 chiffres)</label>
            <input
              className="brnd-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="••••••"
            />
            <p className="brnd-hint">Évite 123456, 000000, 111111 et autres PIN évidents.</p>
          </div>
          <div className="brnd-field">
            <label className="brnd-label">Confirmer le nouveau PIN</label>
            <input
              className="brnd-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="••••••"
              onKeyDown={e => e.key === 'Enter' && handleChangePin()}
            />
          </div>
          {pinError && <div className="brnd-save-error">{pinError}</div>}
          {pinOk && <div className="brnd-save-ok">{pinOk}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexDirection: 'column' }}>
            <button onClick={handleChangePin} className="brnd-btn-primary">
              Enregistrer le nouveau PIN
            </button>
            <button
              onClick={() => { setPinView(false); setPinError(''); setPinOk(''); setOldPin(''); setNewPin(''); setConfirmPin(''); }}
              className="brnd-btn-sec"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="brnd-section">
      <div className="brnd-header">
        <div>
          <h1>Paramètres</h1>
          <p>Ton profil marque, ton PIN et le support.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>

        {/* PWA INSTALL */}
        <BrandInstallCard brandId={brand?.id} />

        {/* PROFIL MARQUE */}
        <div className="brnd-card">
          <div className="brnd-card-title">
            <Icon name="user" width={18} height={18} />
            Ton compte
          </div>
          <div className="brnd-field">
            <label className="brnd-label">Nom de la marque</label>
            <input
              className="brnd-input"
              value={brand?.name || ''}
              readOnly
              style={{ background: 'var(--y-n-50)', color: 'var(--y-n-700)' }}
            />
            <p className="brnd-hint">Contacte Ousmane pour renommer ta marque.</p>
          </div>
          <div className="brnd-field">
            <label className="brnd-label">Téléphone (identifiant de connexion)</label>
            <input
              className="brnd-input"
              value={brand?.phone || ''}
              readOnly
              style={{ background: 'var(--y-n-50)', color: 'var(--y-n-700)' }}
            />
          </div>
          <div className="brnd-field">
            <label className="brnd-label">Email de contact</label>
            <input
              className="brnd-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contact@mamarque.sn"
            />
            <p className="brnd-hint">Utilisé pour les notifications importantes (validations, rapports).</p>
          </div>
          <button
            onClick={handleSaveEmail}
            className="brnd-btn-primary"
            disabled={saving}
            style={{ marginTop: 4 }}
          >
            {saving ? 'Enregistrement…' : "Enregistrer l'email"}
          </button>
          {savedMsg && <div className="brnd-save-ok">{savedMsg}</div>}
        </div>

        {/* SÉCURITÉ */}
        <div className="brnd-card">
          <div className="brnd-card-title">
            <Icon name="lock" width={18} height={18} />
            Sécurité
          </div>
          <p style={{ fontSize: 13, color: 'var(--y-n-600)', margin: '0 0 14px' }}>
            Ton PIN sécurise l'accès à ton dashboard. Change-le régulièrement.
          </p>
          <button className="brnd-btn-outline" onClick={() => setPinView(true)}>
            Changer mon PIN
          </button>
        </div>

        {/* SUPPORT */}
        <div className="brnd-card">
          <div className="brnd-card-title">
            <Icon name="help" width={18} height={18} />
            Contact & support
          </div>
          <p style={{ fontSize: 13, color: 'var(--y-n-600)', margin: '0 0 14px' }}>
            Une question, un bug, une demande spéciale ? On te répond en direct.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={openWhatsApp}
              className="brnd-btn-primary"
              style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', boxShadow: '0 4px 14px rgba(37,211,102,0.28)' }}
            >
              <Icon name="wa" width={16} height={16} />
              WhatsApp Ousmane
            </button>
            <a
              href={`mailto:${ADMIN_EMAIL}?subject=YARAM Marque - ${encodeURIComponent(brand?.name || '')}`}
              className="brnd-btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
            >
              <Icon name="mail" width={16} height={16} />
              {ADMIN_EMAIL}
            </a>
          </div>
        </div>

        {/* LOGOUT */}
        <div className="brnd-card" style={{ borderColor: 'var(--y-danger-soft)' }}>
          <div className="brnd-card-title" style={{ color: 'var(--y-danger)' }}>
            <Icon name="logout" width={18} height={18} />
            Déconnexion
          </div>
          <p style={{ fontSize: 13, color: 'var(--y-n-600)', margin: '0 0 14px' }}>
            Tu devras re-saisir ton PIN pour te reconnecter.
          </p>
          <button className="brnd-btn-danger" onClick={onLogout}>
            <Icon name="logout" width={16} height={16} />
            {' '}Se déconnecter
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--y-n-500)', margin: '10px 0 0' }}>
          YARAM · Dashboard Marque partenaire
        </p>
      </div>
    </div>
  );
}
