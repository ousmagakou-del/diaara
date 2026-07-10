import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

// ─── LOGO YARAM Driver (réutilisé du Livreur premium) ───
function YaramDriverLogo({ size = 80 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dvr-y-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22B564" />
          <stop offset="100%" stopColor="#0E6A38" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1024" height="1024" rx="240" fill="url(#dvr-y-grad)" />
      <g transform="translate(-251.23 -174.85) scale(6)">
        <path
          fill="#fff"
          d="M153.9,64.45l-20.93,30.57-21.02-30.57h-24.32l28.48,41.39v58.66h23.8v-60.88l26.87-39.16h-12.87Z"
        />
      </g>
      <circle fill="#F4B53A" cx="780" cy="780" r="64" />
    </svg>
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
        <YaramDriverLogo size={88} />
        <div className="dvr-login-brand">YARAM Driver</div>
        <div className="dvr-login-tag">L'app du livreur</div>
      </div>

      <form id="dvr-login-form" className="dvr-login-card" onSubmit={handleSubmit}>
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
          PIN oublié ? Contacte le support YARAM au <strong>77 760 89 83</strong>
        </div>
      </form>

      <div className="dvr-login-foot">
        YARAM Driver · Sénégal · v1.0
      </div>
    </div>
  );
}
