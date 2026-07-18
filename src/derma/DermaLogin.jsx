// ════════════════════════════════════════════════════════════════
// DermaLogin — écran login PIN dermato
// ════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { dermaLogin, saveDermaSession } from '../lib/dermato';
import './Derma.css';

export default function DermaLogin({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!email || !pin || pin.length < 4) {
      setError('Email + PIN 4-6 chiffres requis');
      return;
    }
    setError('');
    setLoading(true);
    const res = await dermaLogin(email.trim().toLowerCase(), pin);
    setLoading(false);
    if (res.success) {
      saveDermaSession(res.token, res.dermato);
      onSuccess?.(res.dermato);
    } else {
      setError(res.error || 'PIN ou email incorrect');
      setPin('');
    }
  };

  return (
    <div className="drm-login">
      <div className="drm-login-card">
        <div className="drm-login-logo">Y</div>
        <h1>YARAM Dermato</h1>
        <p>Connexion à ton espace dermatologue</p>
        <form onSubmit={submit}>
          <input
            type="email"
            className="drm-login-input email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="ton@email.com"
            autoComplete="username"
            required
            autoFocus
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            className={`drm-login-input ${error ? 'error' : ''}`}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="••••••"
            maxLength={6}
            autoComplete="current-password"
            required
          />
          {error && <div className="drm-login-error">{error}</div>}
          <button type="submit" className="drm-login-btn" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <a className="drm-login-back" href="/">Retour à YARAM</a>
      </div>
    </div>
  );
}
