import { useState, useEffect, useMemo } from 'react';
import { useNav, useUser } from '../App';
import { supabase, signOut, updateProfile } from '../lib/supabase';
import { usePersistedData, invalidatePersisted } from '../lib/usePersistedData';
import { toggleTheme, getTheme } from '../lib/theme';
import { getWhatsAppNumber, getWhatsAppDisplay, safeFormatDate, safeNumber } from '../lib/utils';
import { isIOSApp } from '../lib/platform';
import { getMyAddresses } from '../lib/supabase';
import { toast, confirmDialog, promptDialog } from '../lib/toast';
import { useMyOrders } from '../lib/queries';
import SiteLayout from '../components/SiteLayout';
import './Profile.css';

export default function Profile() {
  const { navigate } = useNav();
  const { user, refreshUser } = useUser();

  // FIX juin 2026 : usePersistedData regroupe stats + defaultAddr
  // → hydrate depuis cache au remount, plus de skeleton 1-3s.
  const statsNamespace = `profile-stats-${user?.id || 'anon'}`;
  const { data: statsBundle, refresh: refreshStats } = usePersistedData(
    statsNamespace,
    async () => {
      // FIX juin 2026 : purge brute force tout cache 'my_orders_*' (toutes versions LS)
      try {
        const toDel = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /^yaram_cache_v\d+_my_orders_/.test(k)) toDel.push(k);
        }
        toDel.forEach(k => localStorage.removeItem(k));
      } catch {}

      let authUserId = user.id;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) authUserId = session.user.id;
      } catch { /* silent */ }

      // 1. Dernier scan IA
      const { data: scans } = await supabase
        .from('skin_scans')
        .select('id, skin_type, skin_score, diagnosis, created_at')
        .eq('user_id', authUserId)
        .order('created_at', { ascending: false })
        .limit(1);
      const lastScan = scans && scans[0] ? scans[0] : null;
      const diag = lastScan?.diagnosis || {};
      const skinScore = lastScan?.skin_score ?? diag.skin_score ?? null;
      const concernsCount = Array.isArray(diag.concerns) ? diag.concerns.length : null;

      // 2. Count favoris
      const { count: favCount } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUserId);

      // 3. Count commandes
      let ordersCount = 0;
      try {
        const { count, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', authUserId);
        if (error) console.warn('[Profile] orders count error:', error.message);
        if (typeof count === 'number') {
          ordersCount = count;
        } else {
          const { data: rows } = await supabase
            .from('orders').select('id').eq('user_id', authUserId);
          ordersCount = (rows || []).length;
        }
      } catch (e) {
        console.warn('[Profile] orders count threw:', e?.message);
      }
      return {
        skinScore,
        concernsCount,
        favoritesCount: favCount ?? 0,
        ordersCount,
        savings: null,
        lastScan,
      };
    },
    { ttl: 5 * 60 * 1000, enabled: !!user?.id }
  );
  // stats.loading reste basé sur l'absence de bundle pour matcher l'API d'origine
  const stats = statsBundle
    ? { ...statsBundle, loading: false }
    : { skinScore: null, concernsCount: null, favoritesCount: null,
        ordersCount: null, savings: null, lastScan: null, loading: true };

  // Adresse par défaut
  const addrNamespace = `profile-default-addr-${user?.id || 'anon'}`;
  const { data: defaultAddr, setData: setDefaultAddr } = usePersistedData(
    addrNamespace,
    async () => {
      const list = await getMyAddresses();
      return (list || []).find(a => a.is_default) || list?.[0] || null;
    },
    { ttl: 5 * 60 * 1000, enabled: !!user?.id }
  );

  // Listeners route-back + app-resumed → refresh stats
  useEffect(() => {
    if (!user?.id) return;
    const handleRouteBack = (e) => {
      const target = e?.detail?.to?.name;
      if (target && target !== 'profile') return;
      refreshStats();
    };
    const handleAppResumed = () => refreshStats();
    window.addEventListener('yaram-route-back', handleRouteBack);
    window.addEventListener('yaram-app-resumed', handleAppResumed);
    return () => {
      window.removeEventListener('yaram-route-back', handleRouteBack);
      window.removeEventListener('yaram-app-resumed', handleAppResumed);
    };
  }, [user?.id, refreshStats]);

  const handleLogout = async () => {
    if (!(await confirmDialog('Te déconnecter ?', { confirmLabel: 'Déconnexion', danger: true }))) {
      return;
    }
    // Chaque étape en try/catch séparé : même si une échoue, on continue.
    // Objectif : que l'user revienne TOUJOURS sur Home déconnectée.
    try { await signOut(); } catch (e) {
      console.warn('[handleLogout] signOut error (non-fatal):', e?.message);
    }
    try { await refreshUser(null); } catch (e) {
      console.warn('[handleLogout] refreshUser error (non-fatal):', e?.message);
    }
    try { navigate({ name: 'home', params: {} }); } catch (e) {
      // Fallback navigation hard reload si le router est cassé
      console.warn('[handleLogout] navigate error, fallback reload:', e?.message);
      try { window.location.href = '/'; } catch {}
    }
  };

  const handleShare = () => {
    const code = 'AICHA-YARAM';
    const msg = `Salut ! J'utilise YARAM, l'app beauté validée pour notre peau africaine. Avec mon code ${code} tu as 3000 FCFA offerts sur ta 1ère commande. https://yaram.app`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleEditPhone = async () => {
    const current = user?.phone || '';
    const value = await promptDialog(
      'Numéro WhatsApp pour recevoir tes notifications de commande',
      {
        placeholder: '+221 77 123 45 67',
        initialValue: current,
        confirmLabel: 'Enregistrer',
        validate: (v) => {
          const t = (v || '').trim();
          if (!t) return false;
          const cleaned = t.replace(/[\s.-]/g, '');
          return /^(\+?221)?7\d{8}$/.test(cleaned);
        },
      }
    );
    if (value == null) return;
    const cleaned = value.replace(/[\s.-]/g, '');
    const intl = cleaned.startsWith('+221')
      ? cleaned
      : cleaned.startsWith('221') ? `+${cleaned}` : `+221${cleaned}`;
    try {
      const { error } = await updateProfile({ phone: intl });
      if (error) {
        toast.error('Erreur : ' + (error.message || 'sauvegarde impossible'));
        return;
      }
      toast.success('Numéro enregistré ✓');
      await refreshUser();
    } catch (e) {
      toast.error('Erreur : ' + (e?.message || 'sauvegarde impossible'));
    }
  };

  const handleExportData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Reconnecte-toi'); return; }
      toast.info('Préparation de ton export…');
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://qxhhnrnworwrnwmqekmb.supabase.co'}/functions/v1/export-my-data`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!resp.ok) { toast.error('Erreur export'); return; }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yaram-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Téléchargement lancé ✓');
    } catch (e) {
      toast.error('Erreur : ' + (e?.message || ''));
    }
  };

  const handleEditFirstName = async () => {
    const current = user?.first_name || '';
    const value = await promptDialog(
      'Ton prénom',
      { initialValue: current, confirmLabel: 'Enregistrer' }
    );
    if (value == null) return;
    const t = value.trim();
    if (!t) return;
    try {
      const { error } = await updateProfile({ first_name: t });
      if (error) {
        toast.error('Erreur : ' + (error.message || 'sauvegarde impossible'));
        return;
      }
      toast.success('Prénom enregistré ✓');
      await refreshUser();
    } catch (e) {
      toast.error('Erreur : ' + (e?.message || 'sauvegarde impossible'));
    }
  };

  const handleEditLastName = async () => {
    const current = user?.last_name || '';
    const value = await promptDialog(
      'Ton nom de famille',
      { initialValue: current, confirmLabel: 'Enregistrer' }
    );
    if (value == null) return;
    const t = value.trim();
    if (!t) return;
    try {
      const { error } = await updateProfile({ last_name: t });
      if (error) {
        toast.error('Erreur : ' + (error.message || 'sauvegarde impossible'));
        return;
      }
      toast.success('Nom enregistre');
      await refreshUser();
    } catch (e) {
      toast.error('Erreur : ' + (e?.message || 'sauvegarde impossible'));
    }
  };

  // Upload photo profil (Supabase Storage bucket 'avatars' si dispo,
  // sinon on route vers un helper existant). Fallback : toast informatif.
  const handleUploadPhoto = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        toast.error('Photo trop lourde (max 4 Mo)');
        return;
      }
      try {
        const path = `${user.id}/avatar-${Date.now()}.${(file.name.split('.').pop() || 'jpg')}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, file, { upsert: true, cacheControl: '3600' });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        const url = pub?.publicUrl;
        if (url) {
          const { error } = await updateProfile({ avatar: url });
          if (error) throw error;
          toast.success('Photo mise a jour');
          await refreshUser();
        }
      } catch (e) {
        console.warn('[Profile] avatar upload failed:', e?.message);
        toast.error('Upload impossible : ' + (e?.message || 'reessaie'));
      }
    };
    input.click();
  };

  // Preview 3 dernieres commandes (visible desktop, permet clic direct)
  const { data: recentOrders = [] } = useMyOrders(user?.id);
  const previewOrders = useMemo(
    () => (Array.isArray(recentOrders) ? recentOrders.slice(0, 3) : []),
    [recentOrders]
  );

  const firstName = user?.first_name || 'Toi';
  const initial = (firstName.trim().charAt(0) || 'Y').toUpperCase();
  const hasPhoto = !!user?.avatar;
  const avatar = user?.avatar;
  const city = defaultAddr?.city || user?.city || null;
  const neighborhood = defaultAddr?.neighborhood || user?.neighborhood || null;

  const loyaltyPoints = user?.loyalty_points || 0;
  const hasScan = !!stats.lastScan;

  // "Membre depuis" — depuis user.created_at si dispo
  const memberSince = (() => {
    const raw = user?.created_at || user?.createdAt;
    if (!raw) return null;
    try {
      const d = new Date(raw);
      const m = d.toLocaleDateString('fr-FR', { month: 'long' });
      const y = d.getFullYear();
      return `${m.charAt(0).toUpperCase() + m.slice(1)} ${y}`;
    } catch { return null; }
  })();

  // Pull-to-refresh : refetch stats user + adresse + scan
  const handlePullRefresh = async () => {
    try {
      if (user?.id) {
        await refreshUser();
        const { invalidateCache } = await import('../lib/supabase');
        invalidateCache(`my_addresses_${user.id}`);
        // Invalide les caches usePersistedData et relance les fetchs
        invalidatePersisted(statsNamespace);
        invalidatePersisted(addrNamespace);
        await refreshStats();
        const list = await getMyAddresses();
        const def = (list || []).find(a => a.is_default) || list?.[0] || null;
        setDefaultAddr(def);
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn('[Profile] pull refresh failed:', e?.message);
    }
  };

  // Helper render — item de menu premium
  const MenuItem = ({ icon, tint, label, sub, onClick, href, danger, trailing }) => {
    const inner = (
      <>
        <div className="prof2-row-icon" style={{ background: tint || 'rgba(31,139,76,0.10)' }}>
          <span aria-hidden>{icon}</span>
        </div>
        <div className="prof2-row-text">
          <strong style={danger ? { color: '#D9342B' } : undefined}>{label}</strong>
          {sub ? <span>{sub}</span> : null}
        </div>
        <div className="prof2-row-trailing">
          {trailing || <span className="prof2-row-arrow" aria-hidden>›</span>}
        </div>
      </>
    );
    if (href) {
      return (
        <a className="prof2-row" href={href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      );
    }
    return (
      <button className="prof2-row" onClick={onClick} type="button">
        {inner}
      </button>
    );
  };

  return (
    <SiteLayout>

      {/* ══════════════════════════════════════════════
          HERO BANNER — identité utilisateur full-width
          ══════════════════════════════════════════════ */}
      <div className="acct-hero">
        <div className="acct-hero-inner">
          {/* Avatar + nom */}
          <div className="acct-hero-profile">
            <div className="acct-avatar-wrap">
              {hasPhoto
                ? <img src={avatar} alt={firstName} className="acct-avatar" loading="lazy" decoding="async" />
                : <div className="acct-avatar acct-avatar-fallback">{initial}</div>
              }
            </div>
            <div className="acct-hero-info">
              <h1 className="acct-hero-name">{firstName}</h1>
              <p className="acct-hero-sub">{user?.phone || user?.email || 'Bienvenue sur YARAM'}</p>
              <div className="acct-hero-badge">
                <span className="acct-hero-badge-dot" />
                {memberSince ? `Membre depuis ${memberSince}` : 'Membre YARAM'}
              </div>
            </div>
          </div>

          {/* Stats inline */}
          <div className="acct-hero-stats">
            <div className="acct-hero-stat">
              <strong>{stats.loading ? '—' : (stats.ordersCount ?? 0)}</strong>
              <span>Commandes</span>
            </div>
            <div className="acct-hero-stat-sep" />
            <div className="acct-hero-stat">
              <strong>{loyaltyPoints.toLocaleString('fr-FR')}</strong>
              <span>Points fidélité</span>
            </div>
            <div className="acct-hero-stat-sep" />
            <div className="acct-hero-stat">
              <strong>{stats.loading ? '—' : (stats.savings ?? loyaltyPoints * 10).toLocaleString('fr-FR')}</strong>
              <span>FCFA économisés</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SCAN CTA — bande verte sous le hero
          ══════════════════════════════════════════════ */}
      <div className="acct-scan-strip">
        <div className="acct-scan-strip-inner">
          <button
            className="acct-scan-btn"
            onClick={() => navigate({ name: 'scan', params: {} })}
            type="button"
          >
            <span className="acct-scan-icon" aria-hidden></span>
            <div className="acct-scan-text">
              <strong>{hasScan ? 'Mettre à jour mon diagnostic peau' : 'Faire mon 1er scan peau'}</strong>
              <span>Photo + quiz · 2 min</span>
            </div>
            <span className="acct-scan-arrow" aria-hidden>›</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          BODY : sidebar nav + contenu principal
          ══════════════════════════════════════════════ */}
      <div className="acct-body">
        <div className="acct-body-inner">

          {/* ── Sidebar navigation ── (ordre calque strict natif : COMPTE / PROFIL PEAU / FONCTIONNALITÉS / PRÉFÉRENCES / SUPPORT) */}
          <aside className="acct-sidebar">
            <nav className="acct-nav">
              <a href="#compte"     className="acct-nav-link">Compte</a>
              <a href="#commandes"  className="acct-nav-link">Historique commandes</a>
              <a href="#peau"       className="acct-nav-link">Mon profil peau</a>
              <a href="#fonctions"  className="acct-nav-link">Fonctionnalités</a>
              <a href="#prefs"      className="acct-nav-link">Préférences</a>
              <a href="#giftcards"  className="acct-nav-link">Cartes cadeaux MySargal</a>
              <a href="#reglages"   className="acct-nav-link">Réglages compte</a>
              <a href="#support"    className="acct-nav-link">Support</a>
            </nav>
            <div className="acct-sidebar-sep" />
            <button className="acct-logout-btn" onClick={handleLogout} type="button">
              Se déconnecter
            </button>
          </aside>

          {/* ── Contenu principal ── */}
          <main className="acct-main">

            {/* COMPTE — calque strict natif : rows dans le meme ordre / meme copy */}
            <section id="compte" className="acct-section">
              <h2 className="acct-section-title">Compte</h2>
              <div className="prof2-card">
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>} tint="rgba(220,38,38,0.10)" label="Mes adresses"
                  sub={city ? `${neighborhood ? neighborhood + ', ' : ''}${city}` : 'Ajouter une adresse'}
                  onClick={() => navigate({ name: 'addresses', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4L7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>} tint="rgba(31,139,76,0.10)" label="Mes commandes"
                  sub={stats.ordersCount > 0 ? `${stats.ordersCount} commande${stats.ordersCount > 1 ? 's' : ''}` : "Voir l'historique"}
                  onClick={() => navigate('/orders')} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} tint="rgba(244,181,58,0.16)" label="Moyens de paiement"
                  sub="Wave · OM · Cash · Carte"
                  onClick={() => navigate({ name: 'payments', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>} tint="rgba(220,38,38,0.10)" label="Favoris"
                  sub={stats.favoritesCount > 0 ? `${stats.favoritesCount} produit${stats.favoritesCount > 1 ? 's' : ''}` : 'Tes coups de cœur'}
                  onClick={() => navigate({ name: 'favorites', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>} tint="rgba(220,38,38,0.10)" label="Alertes prix"
                  sub="Baisse de prix sur tes favoris"
                  onClick={() => navigate({ name: 'price_alerts', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>} tint="rgba(31,139,76,0.10)" label="Rappels produits"
                  sub="Bientôt fini · Recommander"
                  onClick={() => navigate({ name: 'reminders', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>} tint="rgba(244,181,58,0.18)" label="Programme fidélité"
                  sub={`${loyaltyPoints.toLocaleString('fr-FR')} points · Voir mes récompenses`}
                  onClick={() => navigate({ name: 'loyalty', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>} tint="rgba(232,119,34,0.12)" label="Parrainage"
                  sub="+3 000 FCFA offerts"
                  onClick={() => navigate({ name: 'referral', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>} tint="rgba(232,56,92,0.10)" label="Bons plans"
                  sub="Promos & codes actifs"
                  onClick={() => navigate({ name: 'promos', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} tint="rgba(244,181,58,0.14)" label="Newsletter"
                  sub="Promos exclusives & conseils beauté"
                  onClick={() => navigate({ name: 'newsletter', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>} tint="rgba(99,102,241,0.10)" label="Magazine YARAM"
                  sub="Articles & guides beauté"
                  onClick={() => navigate({ name: 'articles', params: {} })} />
              </div>
            </section>

            {/* HISTORIQUE COMMANDES — preview 3 dernieres */}
            <section id="commandes" className="acct-section">
              <div className="acct-section-head">
                <h2 className="acct-section-title">Historique commandes</h2>
                <button
                  type="button"
                  className="acct-section-link"
                  onClick={() => navigate('/orders')}
                >Tout voir</button>
              </div>
              <div className="prof2-card">
                {previewOrders.length === 0 ? (
                  <div className="acct-empty-row">
                    <div className="acct-empty-row-icon">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 3h2l3.6 12h10l3-8H6" />
                        <circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>
                      </svg>
                    </div>
                    <div>
                      <strong>Aucune commande pour l'instant</strong>
                      <span>Tes commandes recentes apparaitront ici.</span>
                    </div>
                  </div>
                ) : (
                  previewOrders.map((o, idx) => (
                    <div key={o.id}>
                      {idx > 0 && <div className="prof2-sep" />}
                      <button
                        type="button"
                        className="prof2-row"
                        onClick={() => navigate({ name: 'order_tracking', params: { orderId: o.id } })}
                      >
                        <div
                          className="prof2-row-icon"
                          style={{ background: 'var(--y-brand-soft)', color: 'var(--y-brand)' }}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                            <line x1="12" y1="22.08" x2="12" y2="12"/>
                          </svg>
                        </div>
                        <div className="prof2-row-text">
                          <strong>Commande {String(o.id).slice(-6).toUpperCase()}</strong>
                          <span>
                            {safeFormatDate(o.created_at, { type: 'datetime' })} ·{' '}
                            {safeNumber(o.total).toLocaleString('fr-FR')} FCFA · {o.status}
                          </span>
                        </div>
                        <div className="prof2-row-trailing">
                          <span className="prof2-row-arrow" aria-hidden>&rsaquo;</span>
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* MON PROFIL PEAU — calque strict natif (yaram-native/app/(tabs)/profile.jsx) */}
            <section id="peau" className="acct-section">
              <h2 className="acct-section-title">Mon profil peau</h2>
              <div className="prof2-card">
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18 9l-4.1 1.4L12 15l-1.9-4.6L6 9l4.1-1.4z"/><path d="M19 2l0.5 1.5L21 4l-1.5 0.5L19 6l-0.5-1.5L17 4l1.5-0.5z"/></svg>} tint="rgba(31,139,76,0.10)" label="Mon diagnostic peau"
                  sub={hasScan ? `Dernier scan : ${safeFormatDate(stats.lastScan?.created_at)}` : 'Diagnostic en 30 sec'}
                  onClick={() => navigate({ name: 'scan', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>} tint="rgba(168,85,247,0.10)" label="Scanner ingrédients"
                  sub="Analyse INCI · IA"
                  onClick={() => navigate({ name: 'ingredient_scan', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>} tint="rgba(20,184,166,0.10)" label="Journal peau"
                  sub="Photo + évolution quotidienne"
                  onClick={() => navigate({ name: 'diary', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} tint="rgba(244,181,58,0.14)" label="Routines beauté"
                  sub="6 routines prêtes à l'emploi"
                  onClick={() => navigate({ name: 'routines', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>} tint="rgba(220,38,38,0.10)" label="Mon profil santé"
                  sub="Grossesse, allergies, conditions"
                  onClick={() => navigate({ name: 'health_profile', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} tint="rgba(107,91,149,0.12)" label="Quiz peau"
                  sub="Sans photo · 8 questions"
                  onClick={() => navigate({ name: 'skin_quiz', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} tint="rgba(34,197,94,0.10)" label="Mon évolution"
                  sub="Avant/Après mensuel"
                  onClick={() => navigate({ name: 'evolution', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} tint="rgba(100,116,139,0.10)" label="Historique des scans"
                  sub="Tous tes diagnostics"
                  onClick={() => navigate({ name: 'scan_history', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="14 2 18 6 7 17 3 17 3 13 14 2"/><line x1="3" y1="22" x2="21" y2="22"/></svg>} tint="rgba(124,58,237,0.12)" label="Modifier mes infos"
                  sub="Prénom, nom, téléphone, ville"
                  onClick={handleEditFirstName} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>} tint="rgba(37,211,102,0.14)" label="Mon WhatsApp"
                  sub={user?.phone || 'Non renseigné'}
                  onClick={handleEditPhone} />
              </div>
            </section>

            {/* FONCTIONNALITÉS — nouvelle section calque strict natif */}
            <section id="fonctions" className="acct-section">
              <h2 className="acct-section-title">Fonctionnalités</h2>
              <div className="prof2-card">
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>} tint="rgba(0,0,0,0.06)" label="Scanner un produit"
                  sub="Code-barres"
                  onClick={() => navigate({ name: 'scan', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} tint="rgba(10,24,56,0.10)" label="Boutique internationale"
                  sub="Sephora, La Roche-Posay…"
                  onClick={() => navigate({ name: 'international', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} tint="rgba(0,100,176,0.10)" label="Pharmacies partenaires"
                  onClick={() => navigate({ name: 'pharmacies', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>} tint="rgba(245,158,11,0.12)" label="Notifications"
                  sub="Mes alertes & préférences"
                  onClick={() => navigate({ name: 'notifications', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} tint="rgba(100,116,139,0.10)" label="Paramètres notifications"
                  sub="Commandes, promos, rappels"
                  onClick={() => navigate({ name: 'notif_settings', params: {} })} />
              </div>
            </section>

            {/* PRÉFÉRENCES — calque strict natif : uniquement Langue + Apparence */}
            <section id="prefs" className="acct-section">
              <h2 className="acct-section-title">Préférences</h2>
              <div className="prof2-card">
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} tint="rgba(14,165,233,0.10)" label="Langue"
                  sub="Français"
                  onClick={() => toast.info('Bientôt : Wolof + Anglais')} />
                <div className="prof2-sep" />
                <MenuItem
                  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
                  tint="rgba(0,0,0,0.06)"
                  label="Apparence"
                  sub={getTheme() === 'dark' ? 'Sombre' : 'Clair'}
                  onClick={() => toggleTheme()}
                  trailing={
                    <span className={`prof2-toggle ${getTheme() === 'dark' ? 'is-on' : ''}`} aria-hidden>
                      <span className="prof2-toggle-knob" />
                    </span>
                  }
                />
              </div>
            </section>

            {/* CARTES CADEAUX MYSARGAL */}
            <section id="giftcards" className="acct-section">
              <h2 className="acct-section-title">Cartes cadeaux MySargal</h2>
              <div className="prof2-card">
                <div className="acct-gift-placeholder">
                  <div className="acct-gift-illu" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 12 20 22 4 22 4 12"/>
                      <rect x="2" y="7" width="20" height="5"/>
                      <line x1="12" y1="22" x2="12" y2="7"/>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                    </svg>
                  </div>
                  <div>
                    <strong>Bientot disponible</strong>
                    <span>Retrouve ici tes cartes cadeaux MySargal, leur solde et leur expiration.</span>
                  </div>
                </div>
              </div>
            </section>

            {/* REGLAGES COMPTE */}
            <section id="reglages" className="acct-section">
              <h2 className="acct-section-title">Reglages compte</h2>
              <div className="prof2-card">
                <MenuItem
                  icon="Ph" tint="var(--y-brand-soft)"
                  label="Photo de profil"
                  sub={hasPhoto ? 'Remplacer ma photo' : 'Ajouter une photo'}
                  onClick={handleUploadPhoto}
                />
                <div className="prof2-sep" />
                <MenuItem
                  icon="Pr" tint="var(--y-brand-soft)"
                  label="Prenom"
                  sub={user?.first_name || 'A renseigner'}
                  onClick={handleEditFirstName}
                />
                <div className="prof2-sep" />
                <MenuItem
                  icon="No" tint="var(--y-brand-soft)"
                  label="Nom de famille"
                  sub={user?.last_name || 'A renseigner'}
                  onClick={handleEditLastName}
                />
                <div className="prof2-sep" />
                <MenuItem
                  icon="Wa" tint="var(--y-brand-soft)"
                  label="Numero WhatsApp"
                  sub={user?.phone || 'Requis pour les notifs commande'}
                  onClick={handleEditPhone}
                />
                <div className="prof2-sep" />
                <MenuItem
                  icon="Mp" tint="var(--y-n-200)"
                  label="Mot de passe"
                  sub="Modifier via lien magique par email"
                  onClick={async () => {
                    if (!user?.email) { toast.error('Email manquant'); return; }
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
                      if (error) throw error;
                      toast.success('Lien envoye par email');
                    } catch (e) {
                      toast.error('Erreur : ' + (e?.message || ''));
                    }
                  }}
                />
                <div className="prof2-sep" />
                <MenuItem
                  icon="Em" tint="var(--y-n-200)"
                  label="Email"
                  sub={user?.email || 'Non renseigne'}
                />
              </div>
            </section>

            {/* SUPPORT */}
            <section id="support" className="acct-section">
              <h2 className="acct-section-title">Support</h2>
              <div className="prof2-card">
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>} tint="rgba(37,211,102,0.12)" label="WhatsApp YARAM"
                  sub={getWhatsAppDisplay()} href={`https://wa.me/${getWhatsAppNumber()}`} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} tint="rgba(31,139,76,0.10)" label="Aide & FAQ"
                  sub="Réponses aux questions courantes"
                  onClick={() => navigate({ name: 'help', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} tint="rgba(0,0,0,0.06)" label="Télécharger mes données"
                  sub="Export RGPD (JSON)" onClick={handleExportData} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} tint="rgba(0,0,0,0.06)" label="Mentions légales"
                  sub="Éditeur, hébergeur, contact"
                  onClick={() => navigate({ name: 'mentions', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} tint="rgba(0,0,0,0.06)" label="Politique de confidentialité"
                  sub="Comment on protège tes données"
                  onClick={() => navigate({ name: 'privacy', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} tint="rgba(0,0,0,0.06)" label="Conditions générales"
                  sub="CGV / CGU YARAM"
                  onClick={() => navigate({ name: 'terms', params: {} })} />
                <div className="prof2-sep" />
                <MenuItem icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D9342B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>} tint="rgba(217,52,43,0.10)" label="Supprimer mon compte"
                  sub="Action irréversible" danger
                  onClick={() => navigate({ name: 'delete_account', params: {} })} />
              </div>
            </section>

          </main>
        </div>
      </div>

    </SiteLayout>
  );
}
