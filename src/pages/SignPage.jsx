// ════════════════════════════════════════════════════════════════════
// YARAM — Page publique de signature électronique
// URL : /sign/:token
// ════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import './SignPage.css';

export default function SignPage() {
  const token = (window.location.pathname.split('/sign/')[1] || '').split('?')[0];
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const hasSignature = useRef(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    (async () => {
      const { data: res, error: err } = await supabase.rpc('public_get_signature_request', { p_token: token });
      if (err || !res?.success) {
        if (res?.error === 'expired') setState('expired');
        else if (res?.error === 'not_found') setState('not_found');
        else setState('error');
        setError(res?.error || err?.message || 'inconnue');
        return;
      }
      setData(res);
      setFields(res.prefilled_fields || {});
      setState(res.already_signed ? 'signed' : 'ready');
    })();
  }, [token]);

  // ─── Canvas signature drawing ──────────────────────────
  useEffect(() => {
    if (state !== 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0A0A0A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Set canvas to actual size for crispness
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
    };
    resize();

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches?.[0];
      return { x: (t?.clientX ?? e.clientX) - rect.left, y: (t?.clientY ?? e.clientY) - rect.top };
    };
    const start = (e) => { e.preventDefault(); isDrawing.current = true; const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e) => { if (!isDrawing.current) return; e.preventDefault(); const { x, y } = getPos(e); ctx.lineTo(x, y); ctx.stroke(); hasSignature.current = true; };
    const end = () => { isDrawing.current = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [state]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature.current = false;
  };

  const setField = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));

  const handleSign = async () => {
    if (!hasSignature.current) { alert('Merci de tracer ta signature dans le cadre.'); return; }
    if (!accepted) { alert("Merci d'accepter les termes du contrat."); return; }

    const canvas = canvasRef.current;
    const sigData = canvas.toDataURL('image/png');

    // Vérif champs obligatoires
    const schema = data.fields_schema || [];
    for (const f of schema) {
      if (f.required && !fields[f.key]?.trim()) {
        alert(`Le champ « ${f.label} » est obligatoire.`);
        return;
      }
    }

    setSubmitting(true);
    const { data: res, error: err } = await supabase.rpc('public_sign_contract', {
      p_token: token,
      p_signature_data: sigData,
      p_final_fields: fields,
      p_ip: null,
      p_user_agent: navigator.userAgent,
    });
    setSubmitting(false);

    if (err || !res?.success) {
      alert('Erreur : ' + (res?.error || err?.message || 'inconnue'));
      return;
    }

    setState('success');

    // ─── Auto-envoi des copies signées (destinataire + Ousmane) ───
    // Non-bloquant : si l'edge function échoue, la signature reste valide,
    // Ousmane peut renvoyer manuellement depuis l'admin.
    supabase.functions.invoke('send-signed-copy', { body: { token } })
      .catch((e) => console.warn('[sign] send-signed-copy failed:', e));
  };

  // ═══ RENDERS ═══
  if (state === 'loading') return <div className="sign-full"><div className="sign-spinner" />Chargement…</div>;

  if (state === 'invalid' || state === 'not_found') {
    return <div className="sign-full sign-error">
      <div className="sign-error-icon">⚠️</div>
      <h1>Lien invalide</h1>
      <p>Ce lien de signature n'existe pas ou a été retiré. Contactez l'expéditeur.</p>
    </div>;
  }

  if (state === 'expired') {
    return <div className="sign-full sign-error">
      <div className="sign-error-icon">⏰</div>
      <h1>Lien expiré</h1>
      <p>Ce lien a expiré. Demandez à l'expéditeur d'en envoyer un nouveau.</p>
    </div>;
  }

  if (state === 'error') {
    return <div className="sign-full sign-error">
      <div className="sign-error-icon">✕</div>
      <h1>Une erreur est survenue</h1>
      <p>{error}</p>
    </div>;
  }

  if (state === 'signed') {
    return <div className="sign-page">
      <div className="sign-container">
        <div className="sign-success">
          <div className="sign-success-icon">✓</div>
          <h1>Contrat déjà signé</h1>
          <p>Ce contrat a déjà été signé le {new Date(data.signed_at).toLocaleString('fr-FR')}.</p>
        </div>
        <div className="sign-doc-wrapper" dangerouslySetInnerHTML={{ __html: data.signed_html || '' }} />
      </div>
    </div>;
  }

  if (state === 'success') {
    return <div className="sign-page">
      <div className="sign-container">
        <div className="sign-success">
          <div className="sign-success-icon">🎉</div>
          <h1>Contrat signé avec succès</h1>
          <p>Merci ! Une copie sera envoyée à ton email dans quelques instants.</p>
          <p className="sign-success-sub">Tu peux fermer cette fenêtre.</p>
        </div>
      </div>
    </div>;
  }

  // ─── Ready state : afficher le contrat + zone signature ───
  const schema = data.fields_schema || [];
  const hasFields = schema.length > 0;

  return (
    <div className="sign-page">
      <div className="sign-container">
        <header className="sign-header">
          <div className="sign-brand">
            <div className="sign-brand-mark">Y</div>
            <div>
              <div className="sign-brand-name">YARAM</div>
              <div className="sign-brand-sub">Édité par KOMUNITY SENEGAL</div>
            </div>
          </div>
          <div className="sign-badge">📝 Signature en attente</div>
        </header>

        <div className="sign-intro">
          <div className="sign-intro-eyebrow">DOCUMENT À SIGNER</div>
          <h1>{data.template_name}</h1>
          <p className="sign-intro-sub">
            Bonjour <strong>{data.recipient_name}</strong>, un contrat vous a été envoyé pour signature.
          </p>
          {data.admin_message && (
            <div className="sign-admin-message">
              <div className="sign-msg-avatar">O</div>
              <div>
                <div className="sign-msg-name">Message d'Ousmane :</div>
                <div className="sign-msg-body">{data.admin_message}</div>
              </div>
            </div>
          )}
        </div>

        <div className="sign-doc-wrapper" dangerouslySetInnerHTML={{ __html: data.html }} />

        {hasFields && (
          <div className="sign-fields">
            <div className="sign-fields-title">Vérifie ou complète tes informations</div>
            {schema.map((f) => (
              <div key={f.key} className="sign-field">
                <label>{f.label} {f.required && <span className="sign-req">*</span>}</label>
                <input
                  type="text"
                  value={fields[f.key] || ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.label}
                />
              </div>
            ))}
          </div>
        )}

        <div className="sign-signature-box">
          <div className="sign-signature-title">Ta signature</div>
          <div className="sign-signature-sub">Trace ta signature avec le doigt ou la souris dans le cadre ci-dessous.</div>
          <canvas ref={canvasRef} className="sign-canvas" />
          <button className="sign-clear-btn" onClick={clearSignature}>Effacer</button>
        </div>

        <label className="sign-checkbox">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>J'ai lu et j'accepte les termes de ce contrat. Ma signature électronique a la même valeur qu'une signature manuscrite.</span>
        </label>

        <button
          className="sign-submit-btn"
          onClick={handleSign}
          disabled={submitting}
        >
          {submitting ? 'Signature en cours…' : '✓ Signer et envoyer'}
        </button>

        <div className="sign-footer">
          <div>KOMUNITY SENEGAL · NINEA 008771116 · RCCM SN.DKR.2021.A.26292</div>
          <div>Cité Léopold Sédar Senghor Villa n° 93, Dakar · yaram.app</div>
        </div>
      </div>
    </div>
  );
}
