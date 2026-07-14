import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, confirmDialog } from '../../lib/toast';

// ══════════════════════════════════════════════════════════════════
//  PEDALEL — DriverProfile (Premium UX)
//  Hero avatar + status + 4 KPIs + Multi-zone + Plateformes cards
//  Actions bottom : Aide, Paramètres, Déconnexion
// ══════════════════════════════════════════════════════════════════

const ONLINE_STATUS_KEY = 'pedalel-online-status';
const ZONES_KEY = 'pedalel_driver_zones';
const SESSION_KEY = 'yaram_driver_session';

const readOnlineStatus = () => {
  try {
    const raw = localStorage.getItem(ONLINE_STATUS_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch { return true; }
};

const readSavedZones = () => {
  try {
    const raw = localStorage.getItem(ZONES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const writeSavedZones = (arr) => {
  try { localStorage.setItem(ZONES_KEY, JSON.stringify(arr)); } catch {}
};

// ─── Icons ───
const IconStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--y-warning)" stroke="var(--y-warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconBox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);
const IconGrid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const IconTruck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IconMoto = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18" cy="17.5" r="3.5" />
    <path d="M15 6h5l1 5v6.5" />
    <path d="M9 17.5V13a2 2 0 0 0-2-2H4" />
  </svg>
);
const IconBike = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconVerified = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--pedalel-brand)" stroke="none" aria-hidden="true">
    <path d="M9.5 16.6 5 12.1l1.4-1.4 3.1 3.1 8.1-8.1L19 7.1z" fill="#FFFFFF" />
    <path d="M23 12l-2.5-3 .3-3.9-3.8-.9-2-3.4L11 2.4 7.9.9 5.9 4.2l-3.8.8.3 4L0 12l2.5 3-.3 3.9 3.8.9 2 3.4L11 21.6l3.1 1.5 2-3.4 3.8-.8-.3-3.9L23 12z" />
    <path d="M9.5 16.6 5 12.1l1.4-1.4 3.1 3.1 8.1-8.1L19 7.1z" fill="#FFFFFF" />
  </svg>
);
const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconCamera = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const VEHICLES = [
  { v: 'moto',    label: 'Moto',    Icon: IconMoto },
  { v: 'voiture', label: 'Voiture', Icon: IconTruck },
  { v: 'velo',    label: 'Vélo',    Icon: IconBike },
];
const ZONES = ['Dakar', 'Banlieue', 'Plateau', 'Almadies', 'Médina', 'Parcelles', 'Pikine', 'Guédiawaye', 'Rufisque'];

// haptic feedback helper
const haptic = (ms = 12) => {
  try { if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate(ms); } catch {}
};

const formatJoinedAt = (val) => {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch { return null; }
};

export default function DriverProfile({ session, onLogout, onBack, onSessionUpdate }) {
  const [me, setMe] = useState(session);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [platforms, setPlatforms] = useState([]);
  const [togglingSlug, setTogglingSlug] = useState(null);
  const [selectedZones, setSelectedZones] = useState(() => readSavedZones());
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(session?.avatar_url || '');
  const [isOnline] = useState(() => readOnlineStatus());
  const fileInputRef = useRef(null);

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
            avatar_url: d.avatar_url ?? session.avatar_url ?? '',
            joined_at: d.created_at ?? d.joined_at ?? session.joined_at ?? null,
            verified: d.verified ?? d.is_verified ?? false,
          };
          setMe(merged);
          if (merged.avatar_url) setAvatarUrl(merged.avatar_url);
          try { localStorage.setItem(SESSION_KEY, JSON.stringify(merged)); } catch {}
          onSessionUpdate?.(merged);
        }

        // ─── Zones : merge server single-zone + local multi-zones ───
        setSelectedZones((prev) => {
          const local = readSavedZones();
          const svrZone = (meRes.data?.driver?.zone || session.zone || '').trim();
          const merged = new Set([...local, ...prev]);
          if (svrZone) merged.add(svrZone);
          return Array.from(merged);
        });

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

  const activePlatformCount = useMemo(
    () => platforms.filter((p) => p.active && p.available !== false).length,
    [platforms]
  );

  const handleTogglePlatform = async (slug, nextActive, available) => {
    if (!available) return;
    setTogglingSlug(slug);
    haptic(10);
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
        return false;
      }
      const merged = { ...me, ...patch };
      setMe(merged);
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(merged)); } catch {}
      onSessionUpdate?.(merged);
      return true;
    } catch (e) {
      toast.error('Erreur réseau.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleVehicleChange = async (v) => {
    if (saving || me?.vehicle === v) return;
    haptic(12);
    const ok = await updateField({ vehicle: v });
    if (ok) toast.success('Véhicule mis à jour');
  };

  const handleZoneToggle = async (z) => {
    if (saving) return;
    haptic(8);
    const isSelected = selectedZones.includes(z);
    const next = isSelected
      ? selectedZones.filter((x) => x !== z)
      : [...selectedZones, z];
    setSelectedZones(next);
    writeSavedZones(next);

    // Try to sync primary zone (first selected) to server
    const primary = next[0] || '';
    if (primary && me?.zone !== primary) {
      // Fire & forget — don't block UI
      supabase.rpc('driver_update_profile', {
        p_token: session.token,
        p_patch: { zone: primary },
      }).then(({ data, error }) => {
        if (!error && data?.success) {
          const merged = { ...me, zone: primary };
          setMe(merged);
          try { localStorage.setItem(SESSION_KEY, JSON.stringify(merged)); } catch {}
          onSessionUpdate?.(merged);
        }
      }).catch(() => {});
    }
  };

  const handleAvatarPick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Sélectionne une image.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error('Image trop lourde (max 6 Mo).');
      return;
    }
    setUploading(true);
    haptic(10);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${session.driver_id || 'driver'}-${Date.now()}.${ext}`;
      // Bucket driver-docs, fallback to driver-avatars if it exists
      const { data: up, error: upErr } = await supabase.storage
        .from('driver-docs')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) {
        console.warn('[Avatar] upload err:', upErr);
        toast.error('Upload impossible.');
        return;
      }
      const { data: pub } = supabase.storage.from('driver-docs').getPublicUrl(up.path);
      const url = pub?.publicUrl || '';
      if (!url) {
        toast.error('URL introuvable.');
        return;
      }
      setAvatarUrl(url);
      // Try to save on server — ignore silently if column missing
      supabase.rpc('driver_update_profile', {
        p_token: session.token,
        p_patch: { avatar_url: url },
      }).then(({ error }) => {
        if (error) console.warn('[Avatar] save silent skip:', error?.message);
      }).catch(() => {});
      const merged = { ...me, avatar_url: url };
      setMe(merged);
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(merged)); } catch {}
      onSessionUpdate?.(merged);
      toast.success('Photo mise à jour');
    } catch (err) {
      console.error('[Avatar] fatal:', err);
      toast.error('Erreur upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    const ok = await confirmDialog('Te déconnecter ? Tu devras saisir ton PIN à la prochaine connexion.');
    if (!ok) return;
    try {
      await supabase.rpc('driver_logout', { p_token: session.token });
    } catch {}
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    onLogout?.();
  };

  const handleHelp = () => {
    haptic(10);
    try { window.history.pushState({}, '', '/driver/help'); } catch {}
    // trigger popstate so DriverApp re-reads URL
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSettings = () => {
    haptic(10);
    toast.info('Paramètres bientôt disponibles');
  };

  const initials = me?.full_name
    ? me.full_name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : 'L';

  const joinedLabel = formatJoinedAt(me?.joined_at || me?.created_at);

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
        {/* ─── HERO ─── */}
        <div className="ped-profile-hero">
          <div className="ped-profile-avatar-wrap">
            <div className="ped-profile-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={me?.full_name || 'Photo'} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <button
              type="button"
              className="ped-profile-avatar-edit"
              onClick={handleAvatarPick}
              disabled={uploading}
              aria-label="Changer la photo"
            >
              <IconCamera />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFile}
              style={{ display: 'none' }}
            />
          </div>

          <div className="ped-profile-name-row">
            <div className="ped-profile-name">{me?.full_name || '—'}</div>
            {me?.verified && (
              <span className="ped-profile-verified" title="Compte vérifié">
                <IconVerified />
              </span>
            )}
          </div>
          <div className="ped-profile-phone">{me?.phone || ''}</div>

          <div className={`ped-profile-status ${isOnline ? 'online' : 'offline'}`}>
            <span className="ped-profile-status-dot" />
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </div>

          <button
            type="button"
            className="ped-profile-avatar-change"
            onClick={handleAvatarPick}
            disabled={uploading}
          >
            {uploading ? 'Envoi…' : 'Changer la photo'}
          </button>
        </div>

        {/* ─── 4 KPI CARDS ─── */}
        <div className="ped-profile-kpi-grid">
          <div className="ped-profile-kpi-card">
            <div className="ped-profile-kpi-icon ped-profile-kpi-icon-star" aria-hidden="true">
              <IconStar />
            </div>
            <div className="ped-profile-kpi-val">
              {me?.rating ? Number(me.rating).toFixed(1) : '—'}
            </div>
            <div className="ped-profile-kpi-label">Note</div>
          </div>
          <div className="ped-profile-kpi-card">
            <div className="ped-profile-kpi-icon" aria-hidden="true">
              <IconBox />
            </div>
            <div className="ped-profile-kpi-val">{me?.total_deliveries ?? 0}</div>
            <div className="ped-profile-kpi-label">Livraisons</div>
          </div>
          <div className="ped-profile-kpi-card">
            <div className="ped-profile-kpi-icon" aria-hidden="true">
              <IconTruck />
            </div>
            <div className="ped-profile-kpi-val ped-profile-kpi-val-sm">
              {me?.vehicle ? me.vehicle.charAt(0).toUpperCase() + me.vehicle.slice(1) : '—'}
            </div>
            <div className="ped-profile-kpi-label">Véhicule</div>
          </div>
          <div className="ped-profile-kpi-card">
            <div className="ped-profile-kpi-icon" aria-hidden="true">
              <IconGrid />
            </div>
            <div className="ped-profile-kpi-val">{activePlatformCount}</div>
            <div className="ped-profile-kpi-label">Plateformes</div>
          </div>
        </div>

        {/* ─── Mon véhicule ─── */}
        <div className="dvr-profile-row">
          <div className="dvr-profile-row-label">Mon véhicule</div>
          <div className="ped-vehicle-chips">
            {VEHICLES.map((v) => {
              const Ic = v.Icon;
              const active = me?.vehicle === v.v;
              return (
                <button
                  key={v.v}
                  className={`ped-profile-vehicle-chip ${active ? 'active' : ''}`}
                  onClick={() => handleVehicleChange(v.v)}
                  disabled={saving}
                  aria-pressed={active}
                >
                  <span className="ped-profile-vehicle-icon"><Ic /></span>
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Ma zone (multi-select) ─── */}
        <div className="dvr-profile-row">
          <div className="dvr-profile-row-label">Mes zones de livraison</div>
          <div className="ped-profile-zone-hint">
            Choisis les zones où tu veux livrer — plusieurs zones = plus de courses.
          </div>
          <div className="ped-zone-chips">
            {ZONES.map((z) => {
              const active = selectedZones.includes(z);
              return (
                <button
                  key={z}
                  className={`ped-profile-zone-chip ${active ? 'active' : ''}`}
                  onClick={() => handleZoneToggle(z)}
                  disabled={saving}
                  aria-pressed={active}
                >
                  {active && <span className="ped-profile-zone-check"><IconCheck /></span>}
                  <span>{z}</span>
                </button>
              );
            })}
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
                    className={`ped-profile-platform-card ${available ? '' : 'disabled'} ${active ? 'is-active' : ''}`}
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

        {/* ─── Informations ─── */}
        <div className="dvr-profile-row">
          <div className="dvr-profile-row-label">Informations</div>
          <div className="ped-profile-info">
            <div className="ped-profile-info-row">
              <span>Numéro</span>
              <strong>{me?.phone || '—'}</strong>
            </div>
            <div className="ped-profile-info-row">
              <span>Statut</span>
              <strong className={me?.active ? 'ok' : 'muted'}>
                {me?.active ? 'Actif' : 'Inactif'}
              </strong>
            </div>
            <div className="ped-profile-info-row">
              <span>ID livreur</span>
              <code>{me?.driver_id?.slice(0, 8) || '—'}…</code>
            </div>
            {joinedLabel && (
              <div className="ped-profile-info-row">
                <span>Membre depuis</span>
                <strong style={{ textTransform: 'capitalize' }}>{joinedLabel}</strong>
              </div>
            )}
          </div>
        </div>

        {/* ─── ACTIONS ─── */}
        <div className="ped-profile-actions">
          <button className="ped-profile-action" onClick={handleHelp}>
            <span className="ped-profile-action-icon"><IconHelp /></span>
            <span className="ped-profile-action-label">Aide et support</span>
            <span className="ped-profile-action-arrow"><IconChevronRight /></span>
          </button>
          <button className="ped-profile-action" onClick={handleSettings}>
            <span className="ped-profile-action-icon"><IconSettings /></span>
            <span className="ped-profile-action-label">Paramètres</span>
            <span className="ped-profile-action-arrow"><IconChevronRight /></span>
          </button>
          <button className="ped-profile-action danger" onClick={handleLogout}>
            <span className="ped-profile-action-icon"><IconLogout /></span>
            <span className="ped-profile-action-label">Se déconnecter</span>
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--dvr-text-mute)', marginTop: 16 }}>
          Pedalel · v1.0 · Sénégal
        </div>
      </div>
    </>
  );
}
