import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, confirmDialog } from '../../lib/toast';

const VEHICLES = [
  { v: 'moto',    label: 'Moto' },
  { v: 'voiture', label: 'Voiture' },
  { v: 'velo',    label: 'Vélo' },
];
const ZONES = ['Dakar', 'Banlieue', 'Plateau', 'Almadies', 'Médina', 'Parcelles', 'Pikine', 'Guédiawaye', 'Rufisque'];

export default function DriverProfile({ session, onLogout, onBack, onSessionUpdate }) {
  const [me, setMe] = useState(session);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.token) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('driver_me', { p_token: session.token });
        if (cancelled) return;
        if (error || !data?.success) {
          console.warn('[DriverProfile] me error:', error || data);
          return;
        }
        const d = data.driver || {};
        const merged = {
          ...session,
          full_name: d.full_name ?? session.full_name,
          phone:     d.phone     ?? session.phone,
          vehicle:   d.vehicle   ?? session.vehicle,
          zone:      d.zone      ?? session.zone,
          rating:    d.rating    ?? session.rating,
          total_deliveries: d.total_deliveries ?? session.total_deliveries,
          active:    d.active    ?? session.active,
        };
        setMe(merged);
        try { localStorage.setItem('yaram_driver_session', JSON.stringify(merged)); } catch {}
        onSessionUpdate?.(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const updateField = async (patch) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('driver_update_profile', {
        p_token: session.token,
        p_patch: patch,
      });
      if (error || !data?.success) {
        toast.error('Impossible de sauvegarder.');
        setSaving(false);
        return;
      }
      const merged = { ...me, ...patch };
      setMe(merged);
      try { localStorage.setItem('yaram_driver_session', JSON.stringify(merged)); } catch {}
      onSessionUpdate?.(merged);
      toast.success('Mis à jour');
    } catch (e) {
      toast.error('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const ok = await confirmDialog('Te déconnecter ? Tu devras saisir ton PIN à la prochaine connexion.');
    if (!ok) return;
    try {
      await supabase.rpc('driver_logout', { p_token: session.token });
    } catch {}
    try { localStorage.removeItem('yaram_driver_session'); } catch {}
    onLogout?.();
  };

  const initials = me?.full_name
    ? me.full_name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : 'L';

  return (
    <>
      <div className="dvr-backbar">
        <button
          className="dvr-header-action"
          onClick={onBack}
          aria-label="Retour"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2>Mon profil</h2>
      </div>

      <div className="dvr-page">
        <div className="dvr-profile-hero">
          <div className="dvr-profile-avatar">{initials}</div>
          <div className="dvr-profile-name">{me?.full_name || '—'}</div>
          <div className="dvr-profile-phone">{me?.phone || ''}</div>
        </div>

        <div className="dvr-profile-kpis">
          <div className="dvr-profile-kpi">
            <div className="dvr-profile-kpi-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="var(--y-warning)" stroke="var(--y-warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
            <div className="dvr-profile-kpi-val">{me?.rating ? Number(me.rating).toFixed(1) : '—'}</div>
            <div className="dvr-profile-kpi-label">Note</div>
          </div>
          <div className="dvr-profile-kpi">
            <div className="dvr-profile-kpi-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
            <div className="dvr-profile-kpi-val">{me?.total_deliveries ?? 0}</div>
            <div className="dvr-profile-kpi-label">Livraisons</div>
          </div>
          <div className="dvr-profile-kpi">
            <div className="dvr-profile-kpi-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18" cy="17.5" r="3.5"/><path d="M15 6h5l1 5v6.5"/><path d="M9 17.5V13a2 2 0 0 0-2-2H4"/></svg></div>
            <div className="dvr-profile-kpi-val" style={{ textTransform: 'capitalize', fontSize: 14, marginTop: 4 }}>
              {me?.vehicle || '—'}
            </div>
            <div className="dvr-profile-kpi-label">Véhicule</div>
          </div>
        </div>

        <div className="dvr-profile-row">
          <div className="dvr-profile-row-label">Mon véhicule</div>
          <div className="dvr-select-row">
            {VEHICLES.map((v) => (
              <button
                key={v.v}
                className={`dvr-chip ${me?.vehicle === v.v ? 'active' : ''}`}
                onClick={() => !saving && me?.vehicle !== v.v && updateField({ vehicle: v.v })}
                disabled={saving}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dvr-profile-row">
          <div className="dvr-profile-row-label">Ma zone</div>
          <div className="dvr-select-row">
            {ZONES.map((z) => (
              <button
                key={z}
                className={`dvr-chip ${me?.zone === z ? 'active' : ''}`}
                onClick={() => !saving && me?.zone !== z && updateField({ zone: z })}
                disabled={saving}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        <div className="dvr-profile-row">
          <div className="dvr-profile-row-label">Informations</div>
          <div style={{ fontSize: 13, color: 'var(--dvr-text-mid)', lineHeight: 1.7 }}>
            <div><strong style={{ color: 'var(--dvr-text)' }}>Numéro :</strong> {me?.phone}</div>
            <div><strong style={{ color: 'var(--dvr-text)' }}>Statut :</strong> {me?.active ? 'Actif' : 'Inactif'}</div>
            <div><strong style={{ color: 'var(--dvr-text)' }}>ID livreur :</strong> <code style={{ fontSize: 11 }}>{me?.driver_id?.slice(0, 8)}…</code></div>
          </div>
        </div>

        <button
          className="dvr-btn dvr-btn-danger dvr-btn-lg"
          onClick={handleLogout}
          style={{ marginTop: 24 }}
        >
          Se déconnecter
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--dvr-text-mute)', marginTop: 16 }}>
          YARAM Driver · v1.0 · Sénégal
        </div>
      </div>
    </>
  );
}
