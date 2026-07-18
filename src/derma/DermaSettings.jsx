// ════════════════════════════════════════════════════════════════
// DermaSettings — infos du dermatologue (lecture seule, édit via admin)
// Fetch le profil COMPLET via derma_get_profile (le login ne renvoie
// que 5 champs — email/nom/photo/specialite).
// ════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatFcfa, getDermaToken } from '../lib/dermato';

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '10px 0',
      borderBottom: '1px solid var(--y-n-100)', gap: 12,
    }}>
      <span style={{ color: 'var(--y-n-600)', fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--y-n-900)', fontSize: 14, fontWeight: 700, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function DermaSettings({ dermato: sessionDermato = {} }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('derma_get_profile', {
          p_token: getDermaToken(),
        });
        if (!error && data?.success && mounted) setProfile(data.dermato);
      } catch { /* fallback session */ }
    })();
    return () => { mounted = false; };
  }, []);

  const dermato = profile || sessionDermato;

  return (
    <>
      <div className="drm-page-h">
        <div>
          <h1>Paramètres</h1>
          <p>Tes infos publiques et tarifs. Pour modifier, contacte l'équipe YARAM.</p>
        </div>
      </div>

      <div className="drm-card">
        <h2>Profil public</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          {dermato.photo_url ? (
            <img src={dermato.photo_url} alt={dermato.full_name} style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 16, background: 'linear-gradient(135deg, #1F8B4C, #0E5B33)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32 }}>
              {(dermato.full_name || 'D').charAt(0)}
            </div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{dermato.full_name || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--y-brand)', fontWeight: 700 }}>{dermato.speciality || 'Dermatologie'}</div>
          </div>
        </div>
        <Row label="Email" value={dermato.email} />
        <Row label="Téléphone" value={dermato.phone} />
        <Row label="WhatsApp" value={dermato.whatsapp} />
        <Row label="Bio" value={dermato.bio} />
      </div>

      <div className="drm-card">
        <h2>Cabinet</h2>
        <Row label="Nom cabinet" value={dermato.clinic_name} />
        <Row label="Adresse" value={dermato.clinic_address} />
        <Row label="Ville" value={dermato.city} />
        <Row label="Années d'expérience" value={dermato.years_exp} />
      </div>

      <div className="drm-card">
        <h2>Vérifications & légal</h2>
        <Row label="N° Ordre des Médecins" value={dermato.ordre_num} />
        <Row label="NINEA" value={dermato.ninea} />
        <Row label="Vérifié YARAM" value={dermato.is_verified ? 'Oui ✓' : 'En attente'} />
      </div>

      <div className="drm-card">
        <h2>Tarifs</h2>
        <Row label="Consultation express" value={formatFcfa(dermato.price_async_fcfa)} />
        <Row label="Visio" value={formatFcfa(dermato.price_video_fcfa)} />
        <Row label="Durée visio standard" value={dermato.video_duration_min ? `${dermato.video_duration_min} min` : '—'} />
        <Row label="Commission YARAM" value={dermato.commission_pct != null ? `${dermato.commission_pct} %` : '—'} />
      </div>

      <div className="drm-card" style={{ background: 'var(--y-brand-soft)', borderColor: 'transparent' }}>
        <h2 style={{ color: 'var(--y-brand-dark)' }}>Modifier ces infos</h2>
        <p className="sub" style={{ color: 'var(--y-brand-dark)', opacity: 0.9 }}>
          Pour toute modification de profil, prix ou disponibilité, contacte l'équipe YARAM par WhatsApp.
        </p>
      </div>
    </>
  );
}
