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
  const [platforms, setPlatforms] = useState([]);
  const [togglingSlug, setTogglingSlug] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.token) return;
      setLoading(true);
      try {
        // driver_me — infos profil
        const meRes = await supabase
          .rpc('driver_me', { p_token: session.token })
          .then((r) => r)
          .catch((e) => ({ error: e, data: null }));

        // driver_get_info — infos + platforms Pedalel
        const infoRes = await supabase
          .rpc('driver_get_info', { p_token: session.token })
          .then((r) => r)
          .catch(() => ({ error: null, data: null }));

        if (cancelled) return;

        // Profil
        if (!meRes.error && meRes.data?.success) {
          const d = meRes.data.driver || {};
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
        }

        // Plateformes (avec fallback YARAM par defaut si absent)
        const rawPlatforms = infoRes.data?.platforms || [];
        if (rawPlatforms.length > 0) {
          setPlatforms(rawPlatforms);
        } else {
          setPlatforms([
            { slug: 'yaram', name: 'YARAM', tagline: 'Livraison pharmacie & lifestyle', active: true, available: true },
            { slug: 'harmat', name: 'Harmat', tagline: 'Bientôt disponible', active: false, available: false },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const handleTogglePlatform = async (slug, nextActive, available) => {
    if (!available) return;
    setTogglingSlug(slug);
    // Optimistic update
    setPlatforms((prev) => prev.map((p) => (p.slug === slug ? { ...p, active: nextActive } : p)));
    try {
      const { data, error } = await supabase.rpc('driver_toggle_platform', {
        p_token: session.token,
        p_platform_slug: slug,
        p_active: nextActive,
      });
      if (error || (data && data.success === false)) {
        console.warn('[Platforms] toggle error:', error || data);
        toast.error('Impossible de mettre à jour la plateforme.');
        // Rollback
        setPlatforms((prev) => prev.map((p) => (p.slug === slug ? { ...p, active: !nextActive } : p)));
      } else {
        toast.success(nextActive ? 'Plateforme activée' : 'Plateforme désactivée');
      }
    } catch (e) {
      toast.error('Erreur réseau.');
      setPlatforms((prev) => prev.map((p) => (p.slug === slug ? { ...p, active: !nextActive } : p)));
    } finally {
      setTogglingSlug(null);
    }
  };

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

        {/* ─── Mes plateformes ─── */}
        <div className="ped-platforms">
          <div className="ped-platforms-header">
            <div>
              <div className="ped-platforms-title">Mes plateformes</div>
              <div className="ped-platforms-sub">
                Choisis les sources de courses que tu veux accepter.
              </div>
            </div>
          </div>

          {platforms.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--dvr-text-mute)', padding: '18px 0', textAlign: 'center' }}>
              Aucune plateforme disponible pour le moment.
            </div>
          ) : (
            <div className="ped-platforms-list">
              {platforms.map((p) => {
                const available = p.available !== false;
                const active = !!p.active;
                const isTogglingThis = togglingSlug === p.slug;
                return (
                  <div
                    key={p.slug}
                    className={`ped-platform ${available ? '' : 'disabled'} ${active ? 'is-active' : ''}`}
                  >
                    <div className="ped-platform-logo" aria-hidden="true">
                      {p.logo_url ? (
                        <img src={p.logo_url} alt={p.name} />
                      ) : (
                        <span>{(p.name || '?').slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="ped-platform-body">
                      <div className="ped-platform-name">
                        {p.name}
                        {!available && <span className="ped-platform-badge">Bientôt disponible</span>}
                      </div>
                      <div className="ped-platform-sub">
                        {p.tagline || (active ? 'Tu reçois des courses de cette plateforme.' : 'Désactivée')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`dvr-switch ${active ? 'on' : ''}`}
                      onClick={() => available && !isTogglingThis && handleTogglePlatform(p.slug, !active, available)}
                      disabled={!available || isTogglingThis}
                      aria-label={`${active ? 'Désactiver' : 'Activer'} ${p.name}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          className="dvr-btn dvr-btn-danger dvr-btn-lg"
          onClick={handleLogout}
          style={{ marginTop: 24 }}
        >
          Se déconnecter
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--dvr-text-mute)', marginTop: 16 }}>
          Pedalel · v1.0 · Sénégal
        </div>
      </div>
    </>
  );
}
