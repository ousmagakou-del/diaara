import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { PEDALEL_LOGO_URL, PEDALEL_META } from './pedalel-brand';

// ─── LOGO Pedalel (SVG servi depuis /public) ───
function PedalelLogo({ size = 88 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 22px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <img
        src={PEDALEL_LOGO_URL}
        alt="Pedalel"
        width={Math.round(size * 0.78)}
        height={Math.round(size * 0.78)}
        style={{ display: 'block' }}
      />
    </div>
  );
}

export default function DriverLogin({ onLogin }) {
  const [phone, setPhone] = useState('+221 ');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pinRef = useRef(null);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!phone.trim() || !pin.trim()) {
      setErr('Renseigne ton numéro et ton PIN.');
      return;
    }
    if (pin.length < 4) {
      setErr('PIN à 4 chiffres minimum.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const { data, error } = await supabase.rpc('driver_login', {
        p_phone: phone.trim(),
        p_pin: pin.trim(),
        p_user_agent: navigator.userAgent?.slice(0, 200) || null,
      });
      if (error) {
        console.error('[Driver] login RPC error:', error);
        setErr('Erreur réseau. Réessaie dans un instant.');
        setBusy(false);
        return;
      }
      if (!data?.success) {
        const code = data?.error || 'invalid_credentials';
        if (code === 'invalid_credentials') {
          setErr('Numéro ou PIN incorrect.');
        } else if (code === 'invalid_phone') {
          setErr('Numéro invalide.');
        } else {
          setErr('Connexion impossible. Contacte le support.');
        }
        setBusy(false);
        // Petit haptic d'erreur sur mobile
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        return;
      }

      // Persiste la session
      const session = {
        token: data.token,
        driver_id: data.driver.id,
        full_name: data.driver.full_name,
        phone: data.driver.phone,
        vehicle: data.driver.vehicle,
        zone: data.driver.zone,
        rating: data.driver.rating,
        total_deliveries: data.driver.total_deliveries,
        active: data.driver.active,
        pin_verified_at: Date.now(),
        expires_at: data.expires_at ? Date.parse(data.expires_at) : (Date.now() + 30 * 24 * 3600 * 1000),
      };
      try {
        localStorage.setItem('yaram_driver_session', JSON.stringify(session));
      } catch {}

      toast.success(`Bienvenue ${data.driver.full_name.split(' ')[0]} !`);
      if (navigator.vibrate) navigator.vibrate(40);
      onLogin?.(session);
    } catch (e) {
      console.error('[Driver] login fatal:', e);
      setErr('Erreur de connexion.');
      setBusy(false);
    }
  };

  useEffect(() => {
    // Auto-focus phone si vide
    const t = setTimeout(() => {
      const el = document.getElementById('dvr-phone-input');
      el?.focus();
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const handlePhoneChange = (v) => {
    // Permet uniquement chiffres / espaces / + au début
    let cleaned = v.replace(/[^\d+\s]/g, '');
    if (!cleaned.startsWith('+221') && !cleaned.startsWith('+')) {
      cleaned = '+221 ' + cleaned.replace(/^\+?221?/, '').trim();
    }
    setPhone(cleaned);
    setErr('');
  };

  const handlePinChange = (v) => {
    const cleaned = v.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setErr('');
    if (cleaned.length === 4) {
      // auto-submit après 4 chiffres
      setTimeout(() => {
        const form = document.getElementById('dvr-login-form');
        if (form && !busy) form.requestSubmit?.();
      }, 120);
    }
  };

  return (
    <div className="dvr-login">
      <div className="dvr-login-logo">
        <PedalelLogo size={88} />
        <div className="dvr-login-brand">{PEDALEL_META.name}</div>
        <div className="dvr-login-tag">{PEDALEL_META.tagline}</div>
      </div>

      <form id="dvr-login-form" className="dvr-login-card" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <img
            src={PEDALEL_LOGO_URL}
            alt=""
            width={56}
            height={56}
            style={{ display: 'block' }}
            aria-hidden="true"
          />
        </div>
        <div className="dvr-login-welcome">Bienvenue</div>
        <div className="dvr-login-sub">Connecte-toi avec ton numéro et ton PIN.</div>

        {err && <div className="dvr-login-err">{err}</div>}

        <div className="dvr-field">
          <label htmlFor="dvr-phone-input">Numéro de téléphone</label>
          <input
            id="dvr-phone-input"
            className="dvr-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+221 77 100 00 01"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="dvr-field">
          <label htmlFor="dvr-pin-input">PIN (4 chiffres)</label>
          <input
            id="dvr-pin-input"
            ref={pinRef}
            className="dvr-input dvr-pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            disabled={busy}
            maxLength={6}
          />
        </div>

        <button type="submit" className="dvr-btn dvr-btn-lg" disabled={busy}>
          {busy ? (
            <>
              <span className="dvr-spin" /> Connexion…
            </>
          ) : (
            'Se connecter'
          )}
        </button>

        <div className="dvr-login-help">
          PIN oublié ? Contacte le support Pedalel au <strong>77 760 89 83</strong>
        </div>
      </form>

      <div className="dvr-login-foot">
        Pedalel · Livre pour plusieurs plateformes · v1.0
      </div>
    </div>
  );
}
