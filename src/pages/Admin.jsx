import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import { adminLogin, adminLogout, getAdminSession, changeAdminPin } from '../lib/adminAuth';
import { adminListOrders } from '../lib/adminApi';

// Lazy sections : chargement à la demande pour réduire le shell Admin
const DashboardSection           = lazy(() => import('../admin/DashboardSection'));
const OrdersSection              = lazy(() => import('../admin/OrdersSection'));
const FinancesSection            = lazy(() => import('../admin/FinancesSection'));
const PerformanceSection         = lazy(() => import('../admin/PerformanceSection'));
const SkinScansSection           = lazy(() => import('../admin/SkinScansSection'));
const AdminUsersSection          = lazy(() => import('../admin/AdminUsersSection'));
const AdminLogsSection           = lazy(() => import('../admin/AdminLogsSection'));
const PharmaciesSection          = lazy(() => import('../admin/PharmaciesSection'));
const ProductsSection            = lazy(() => import('../admin/ProductsSection'));
const BrandsSection              = lazy(() => import('../admin/BrandsSection'));
const StatsSection               = lazy(() => import('../admin/StatsSection'));
const PromosSection              = lazy(() => import('../admin/PromosSection'));
const MarketingSection           = lazy(() => import('../admin/MarketingSection'));
const ImportsSection             = lazy(() => import('../admin/ImportsSection'));
const PromosSplashSection        = lazy(() => import('../admin/PromosSplashSection'));
const ReviewsSection             = lazy(() => import('../admin/ReviewsSection'));
const UsersSection               = lazy(() => import('../admin/UsersSection'));
const DeliveriesSection          = lazy(() => import('../admin/DeliveriesSection'));
const StaffSection               = lazy(() => import('../admin/StaffSection'));
const HistorySection             = lazy(() => import('../admin/HistorySection'));
const SettingsSection            = lazy(() => import('../admin/SettingsSection'));
const ProductsValidationSection  = lazy(() => import('../admin/ProductsValidationSection'));
const CommissionsSection         = lazy(() => import('../admin/CommissionsSection'));
const BannersSection             = lazy(() => import('../admin/BannersSection'));
const StoriesSection             = lazy(() => import('../admin/StoriesSection'));
const CategoriesSection          = lazy(() => import('../admin/CategoriesSection'));
const LoyaltySection             = lazy(() => import('../admin/LoyaltySection'));
const NotificationsSection       = lazy(() => import('../admin/NotificationsSection'));
const PushBroadcastSection       = lazy(() => import('../admin/PushBroadcastSection'));
const NewsletterSection          = lazy(() => import('../admin/NewsletterSection'));
const IntlRequestsSection        = lazy(() => import('../admin/IntlRequestsSection'));
// ─── Nouvelles sections (juin 2026) ────────────────────────────────────────
const ArticlesSection            = lazy(() => import('../admin/ArticlesSection'));
const BlogSection                = lazy(() => import('../admin/BlogSection'));
const RoutinesSection            = lazy(() => import('../admin/RoutinesSection'));
const BundlesSection             = lazy(() => import('../admin/BundlesSection'));
const SubscriptionsSection       = lazy(() => import('../admin/SubscriptionsSection'));
const SupportSection             = lazy(() => import('../admin/SupportSection'));
const SupportChatSection         = lazy(() => import('../admin/SupportChatSection'));
const ProductReviewsSection      = lazy(() => import('../admin/ProductReviewsSection'));
const CounterfeitSection         = lazy(() => import('../admin/CounterfeitSection'));
const VerifyRequestsSection      = lazy(() => import('../admin/VerifyRequestsSection'));
const InventorySection           = lazy(() => import('../admin/InventorySection'));
const RestockAlertsSection       = lazy(() => import('../admin/RestockAlertsSection'));
const QAModerationSection        = lazy(() => import('../admin/QAModerationSection'));
const PharmacistSessionsSection  = lazy(() => import('../admin/PharmacistSessionsSection'));
const DistributorsSection        = lazy(() => import('../admin/DistributorsSection'));
const RgpdExportsSection         = lazy(() => import('../admin/RgpdExportsSection'));
const SignaturesSection          = lazy(() => import('../admin/SignaturesSection'));
const PartnerApplicationsSection = lazy(() => import('../admin/PartnerApplicationsSection'));
const DriverApplicationsSection  = lazy(() => import('../admin/DriverApplicationsSection'));
const OnboardingReviewSection    = lazy(() => import('../admin/OnboardingReviewSection'));
const CorporateSection           = lazy(() => import('../admin/CorporateSection'));
const TradeInSection             = lazy(() => import('../admin/TradeInSection'));

import './Admin.css';

function AdminSectionFallback() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 14 }}>
      Chargement…
    </div>
  );
}

// Rôles :
// - super_admin : tout accès
// - admin : tout sauf gestion des admins
// - commercial : signatures, pharmacies (prospect), users (CRM), skinscans, dashboard
// - moderator : reviews, counterfeit, support (à venir)
// Si `roles` non défini sur un item, seul super_admin voit.
const ROLES_ALL = ['super_admin', 'admin'];
const ROLES_ALL_PLUS_COMMERCIAL = ['super_admin', 'admin', 'commercial'];

const NAV = [
  { id: 'dashboard',   icon: '📊', label: "Vue d'ensemble", roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'orders',      icon: '📦', label: 'Commandes', badge: true, roles: ROLES_ALL },
  { id: 'stats',       icon: '📈', label: 'Statistiques', roles: ROLES_ALL },
  { id: 'pharmacies',  icon: '🏥', label: 'Pharmacies', roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'performance', icon: '📊', label: 'Performance', roles: ROLES_ALL },
  { id: 'skinscans',   icon: '🧠', label: 'Stats Scans IA', roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'commissions', icon: '💰', label: 'Commissions', roles: ROLES_ALL },
  { id: 'distributors', icon: '🏭', label: 'Distributeurs', roles: ROLES_ALL },
  { id: 'finances',    icon: '💸', label: 'Finances', roles: ROLES_ALL },
  { id: 'loyalty',     icon: '💚', label: 'Fidélité', roles: ROLES_ALL },
  { id: 'subscriptions', icon: '👑', label: 'Abonnements YARAM+', badge: true, roles: ROLES_ALL },
  { id: 'notifications', icon: '📲', label: 'Notifications WhatsApp', roles: ROLES_ALL },
  { id: 'push',          icon: '🔔', label: 'Push iOS', roles: ROLES_ALL },
  { id: 'newsletter',    icon: '📬', label: 'Newsletter', roles: ROLES_ALL },
  { id: 'intl_requests', icon: '🌍', label: 'Demandes Intl', roles: ROLES_ALL },
  { id: 'products',    icon: '🛍️', label: 'Produits', roles: ROLES_ALL },
  { id: 'validation',  icon: '✨', label: 'Validation produits', badge: true, roles: ROLES_ALL },
  { id: 'brands',      icon: '🏷️', label: 'Marques', roles: ROLES_ALL },
  { id: 'banners',     icon: '🎨', label: 'Bannières', roles: ROLES_ALL },
  { id: 'stories',     icon: '📸', label: 'Stories', roles: ROLES_ALL },
  { id: 'articles',    icon: '📝', label: 'Articles', roles: ROLES_ALL },
  { id: 'blog',        icon: '📰', label: 'Blog SEO', roles: ROLES_ALL },
  { id: 'routines',    icon: '🧴', label: 'Routines beauté', roles: ROLES_ALL },
  { id: 'bundles',     icon: '📦', label: 'Bundles / Kits', roles: ROLES_ALL },
  { id: 'categories',  icon: '📂', label: 'Catégories', roles: ROLES_ALL },
  { id: 'promos',      icon: '🎁', label: 'Codes promo', roles: ROLES_ALL },
  { id: 'marketing',   icon: '📣', label: 'Marketing', roles: ROLES_ALL },
  { id: 'imports',     icon: '✈️', label: 'Imports', roles: ROLES_ALL },
  { id: 'splash',      icon: '✨', label: 'Splash Promos', roles: ROLES_ALL },
  { id: 'reviews',     icon: '⭐', label: 'Modération avis', roles: ROLES_ALL },
  { id: 'product_reviews', icon: '⭐', label: 'Modération avis produits', roles: ROLES_ALL },
  { id: 'qa_moderation', icon: '❓', label: 'Modération Q&A', roles: ROLES_ALL },
  { id: 'counterfeit', icon: '🚨', label: 'Contrefaçons', badge: true, roles: ROLES_ALL },
  { id: 'users',       icon: '👥', label: 'Utilisatrices', roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'support',     icon: '🆘', label: 'Tickets support', badge: true, roles: ROLES_ALL },
  { id: 'support_chat',icon: '', label: 'Chat live in-app', badge: true, roles: ROLES_ALL },
  { id: 'verify',      icon: '🔍', label: 'Vérifications Tier 3', roles: ROLES_ALL },
  { id: 'rgpd',        icon: '📥', label: 'Demandes RGPD', badge: true, roles: ROLES_ALL },
  { id: 'deliveries',  icon: '🛵', label: 'Livraisons', roles: ROLES_ALL },
  { id: 'staff',       icon: '👷', label: 'Équipe', roles: ROLES_ALL },
  { id: 'pharmacist_sessions', icon: '🔐', label: 'Sessions pharmaciens', roles: ROLES_ALL },
  { id: 'inventory',   icon: '📦', label: 'Inventaire global', roles: ROLES_ALL },
  { id: 'restock',     icon: '⚠️', label: 'Alertes restock', badge: true, roles: ROLES_ALL },
  { id: 'history',     icon: '📜', label: 'Historique', roles: ROLES_ALL },
  { id: 'signatures',  icon: '', label: 'Signatures contrats', roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'partner_apps', icon: '', label: 'Candidatures partenaires', badge: true, roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'driver_apps',  icon: '', label: 'Candidatures livreurs',   badge: true, roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'merchant_onboarding', icon: '', label: 'Onboarding partenaires', badge: true, roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'corporate',           icon: '', label: 'Corporate B2B',           badge: true, roles: ROLES_ALL_PLUS_COMMERCIAL },
  { id: 'tradein',             icon: '', label: 'Trade-In cosmetiques',    badge: true, roles: ROLES_ALL },
  { id: 'settings',    icon: '⚙️', label: 'Paramètres', roles: ['super_admin'] },
  { id: 'adminusers',  icon: '👥', label: 'Gestion admins', roles: ['super_admin'] },
  { id: 'adminlogs',   icon: '📜', label: 'Logs activité', roles: ['super_admin'] },
];

// Helper : filtrer NAV selon le rôle courant
function filterNavByRole(role) {
  const r = role || 'admin';
  return NAV.filter(item => !item.roles || item.roles.includes(r));
}

export default function Admin() {
  const [session, setSession] = useState(() => getAdminSession());
  const [email, setEmail] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  // Persiste la section active : on revient pile où on était après un refresh
  const [section, setSectionRaw] = useState(() => {
    try { return localStorage.getItem('yaram-admin-section') || 'dashboard'; }
    catch { return 'dashboard'; }
  });
  const setSection = (s) => {
    setSectionRaw(s);
    try { localStorage.setItem('yaram-admin-section', s); } catch {}
  };
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [pendingValidationCount, setPendingValidationCount] = useState(0);
  const [newPartnerAppsCount, setNewPartnerAppsCount] = useState(0);
  const [newDriverAppsCount, setNewDriverAppsCount] = useState(0);

  const [pinModal, setPinModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinModalError, setPinModalError] = useState('');
  const [pinModalOk, setPinModalOk] = useState('');

  // ─── Sonnerie nouvelle commande admin (Web Audio, mute persistant) ───
  const [adminMuted, setAdminMutedState] = useState(() => {
    try { return localStorage.getItem('yaram-admin-mute') === '1'; } catch { return false; }
  });
  const setAdminMuted = (v) => {
    setAdminMutedState(v);
    try { localStorage.setItem('yaram-admin-mute', v ? '1' : '0'); } catch {}
  };
  const playAdminAlarm = () => {
    if (adminMuted) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume?.();
      [880, 1320, 1760].forEach((freq, i) => {
        const t0 = ctx.currentTime + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + (i === 2 ? 0.28 : 0.18));
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.32);
      });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
      // Notif système (best effort si permission accordée)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🛍️ Nouvelle commande YARAM', {
          body: 'Une nouvelle commande vient d\'arriver.',
          tag: 'yaram-admin-new-order',
          icon: '/icon-192.png',
        });
      }
      setTimeout(() => ctx.close().catch(() => {}), 1200);
    } catch { /* no-op */ }
  };

  useEffect(() => {
    if (!session) return;
    // PERF : 3 couches de détection nouvelle commande (du + rapide au + lent) :
    //   1. broadcast realtime (instant, déclenché par client)
    //   2. postgres_changes INSERT sur orders (instant, déclenché par DB)
    //   3. polling 120s safety net (au cas où realtime tombe)
    const onNewOrder = () => {
      setNewOrdersCount(c => c + 1);
      playAdminAlarm();
    };
    const channel = supabase
      .channel('yaram-new-orders')
      .on('broadcast', { event: 'new_order' }, onNewOrder)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        onNewOrder
      )
      .subscribe();

    // Polling 120s comme filet (rare, juste si realtime down)
    let lastSeen = null;
    let cancelled = false;
    const tick = async () => {
      try {
        const { data } = await adminListOrders({ limit: 1, offset: 0 });
        if (cancelled) return;
        const row = (data || [])[0];
        if (!row) return;
        if (lastSeen && row.created_at !== lastSeen && row.created_at > lastSeen) {
          setNewOrdersCount(c => c + 1);
          playAdminAlarm();
        }
        lastSeen = row.created_at;
      } catch { /* silencieux */ }
    };
    tick();
    const id = setInterval(tick, 120000);
    return () => {
      cancelled = true;
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const refresh = async () => {
      try {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setPendingValidationCount(count || 0);
      } catch (e) {}
    };
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [session]);

  useEffect(() => {
    if (section === 'orders') setNewOrdersCount(0);
  }, [section]);

  // Compteurs candidatures partenaires + livreurs (badges NAV)
  useEffect(() => {
    if (!session?.token) return;
    const refresh = async () => {
      try {
        const { data } = await supabase.rpc('admin_applications_counts', { p_admin_token: session.token });
        if (data?.success) {
          setNewPartnerAppsCount(data.partner_new || 0);
          setNewDriverAppsCount(data.driver_new || 0);
        }
      } catch (e) {}
    };
    refresh();
    const t = setInterval(refresh, 45000);
    return () => clearInterval(t);
  }, [session?.token]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const result = await adminLogin(email, pinInput);
    setLoginLoading(false);
    if (result.success) {
      setSession(result.admin);
      setPinInput('');
    } else {
      setLoginError(result.error);
      setPinInput('');
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setSession(null);
    setEmail('');
    setPinInput('');
  };

  const handleChangePin = async () => {
    setPinModalError('');
    setPinModalOk('');
    if (newPin !== confirmPin) {
      setPinModalError('Les deux PIN ne correspondent pas');
      return;
    }
    const result = await changeAdminPin(oldPin, newPin);
    if (result.success) {
      setPinModalOk('✓ PIN modifié avec succès');
      setOldPin(''); setNewPin(''); setConfirmPin('');
      setTimeout(() => { setPinModal(false); setPinModalOk(''); }, 1500);
    } else {
      setPinModalError(result.error);
    }
  };

  // ────────── LOGIN ──────────
  if (!session) {
    return (
      <div className="adm-login">
        <div className="adm-login-card">
          <div className="adm-login-logo">D</div>
          <h1>Admin YARAM</h1>
          <p>Connexion sécurisée</p>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              className="adm-pin-input"
              style={{ fontSize: 14, letterSpacing: 'normal', textAlign: 'left', marginBottom: 10 }}
              value={email}
              onChange={e => { setEmail(e.target.value); setLoginError(''); }}
              placeholder="ton@email.com"
              autoFocus
              autoComplete="username"
              required
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`adm-pin-input ${loginError ? 'error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setLoginError(''); }}
              placeholder="••••"
              maxLength={6}
              autoComplete="current-password"
              required
            />
            {loginError && <p className="adm-pin-error">{loginError}</p>}
            <button type="submit" className="adm-pin-btn" disabled={loginLoading}>
              {loginLoading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>
          <a href="/" className="adm-back-link">← Retour à l'app cliente</a>
        </div>
      </div>
    );
  }

  // ────────── ADMIN ──────────
  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="adm-side-head">
          <div className="adm-side-logo">D</div>
          <div>
            <div className="adm-side-brand">YARAM</div>
            <div className="adm-side-role">{session.name || 'Admin'}</div>
          </div>
        </div>
        {session.role && session.role !== 'super_admin' && (
          <div
            className="adm-role-badge"
            style={{
              background: session.role === 'commercial' ? 'var(--y-brand-soft)' : 'var(--y-n-100)',
              color: session.role === 'commercial' ? 'var(--y-brand-dark)' : 'var(--y-n-600)',
            }}
          >
            {session.role === 'commercial' ? '💼 COMMERCIAL' : session.role.toUpperCase()}
          </div>
        )}
        <nav className="adm-nav">
          {filterNavByRole(session.role).map(item => (
            <button
              key={item.id}
              className={`adm-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="adm-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'orders' && newOrdersCount > 0 && (
                <span className="adm-nav-badge">{newOrdersCount}</span>
              )}
              {item.id === 'validation' && pendingValidationCount > 0 && (
                <span className="adm-nav-badge">{pendingValidationCount}</span>
              )}
              {item.id === 'partner_apps' && newPartnerAppsCount > 0 && (
                <span className="adm-nav-badge">{newPartnerAppsCount}</span>
              )}
              {item.id === 'driver_apps' && newDriverAppsCount > 0 && (
                <span className="adm-nav-badge">{newDriverAppsCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="adm-side-foot">
          <button
            className="adm-app-link"
            onClick={() => setAdminMuted(!adminMuted)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            title="Active/désactive la sonnerie pour les nouvelles commandes"
          >
            {adminMuted ? '🔕 Sonnerie OFF' : '🔔 Sonnerie ON'}
          </button>
          <button
            className="adm-app-link"
            onClick={playAdminAlarm}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            title="Tester la sonnerie"
          >
            🎵 Test sonnerie
          </button>
          <button
            className="adm-app-link"
            onClick={() => setPinModal(true)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            🔑 Changer mon PIN
          </button>
          <a href="/" className="adm-app-link">👁️ Voir l'app cliente</a>
          <button className="adm-logout-btn" onClick={handleLogout}>🔒 Déconnecter</button>
        </div>
      </aside>

      <main className="adm-main">
        {/* Gate rôle : si la section n'est pas autorisée pour ce rôle, on affiche
            un message et on force le retour au dashboard. */}
        {(() => {
          const allowedIds = new Set(filterNavByRole(session.role).map(i => i.id));
          if (!allowedIds.has(section)) {
            return (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Accès restreint</h2>
                <p style={{ color: '#6B7280', margin: '6px 0 20px', fontSize: 14 }}>
                  Ton rôle <strong>{session.role || 'admin'}</strong> ne permet pas d'accéder à cette section.
                </p>
                <button
                  onClick={() => setSection('dashboard')}
                  style={{ padding: '12px 20px', background: '#1F8B4C', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 800, cursor: 'pointer' }}
                >
                  ← Retour Dashboard
                </button>
              </div>
            );
          }
          return null;
        })()}
        <Suspense fallback={<AdminSectionFallback />}>
          {(() => {
            const allowedIds = new Set(filterNavByRole(session.role).map(i => i.id));
            if (!allowedIds.has(section)) return null;
            return (
              <>
          {section === 'dashboard'     && <DashboardSection setSection={setSection} />}
          {section === 'orders'        && <OrdersSection />}
          {section === 'stats'         && <StatsSection />}
          {section === 'pharmacies'    && <PharmaciesSection />}
          {section === 'performance'   && <PerformanceSection />}
          {section === 'skinscans'     && <SkinScansSection />}
          {section === 'commissions'   && <CommissionsSection />}
          {section === 'finances'      && <FinancesSection />}
          {section === 'loyalty'       && <LoyaltySection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'push'          && <PushBroadcastSection />}
          {section === 'newsletter'    && <NewsletterSection />}
          {section === 'intl_requests' && <IntlRequestsSection />}
          {section === 'products'      && <ProductsSection />}
          {section === 'validation'    && <ProductsValidationSection />}
          {section === 'brands'        && <BrandsSection />}
          {section === 'banners'       && <BannersSection />}
          {section === 'stories'       && <StoriesSection />}
          {section === 'categories'    && <CategoriesSection />}
          {section === 'promos'        && <PromosSection />}
          {section === 'marketing'     && <MarketingSection />}
          {section === 'imports'       && <ImportsSection />}
          {section === 'splash'        && <PromosSplashSection />}
          {section === 'reviews'       && <ReviewsSection />}
          {section === 'users'         && <UsersSection />}
          {section === 'deliveries'    && <DeliveriesSection />}
          {section === 'staff'         && <StaffSection />}
          {section === 'history'       && <HistorySection />}
          {section === 'settings'      && <SettingsSection />}
          {section === 'adminusers'    && <AdminUsersSection />}
          {section === 'adminlogs'     && <AdminLogsSection />}
          {/* ─── Nouvelles sections (juin 2026) ─────────────────────────── */}
          {section === 'articles'             && <ArticlesSection />}
          {section === 'blog'                 && <BlogSection />}
          {section === 'routines'             && <RoutinesSection />}
          {section === 'bundles'              && <BundlesSection />}
          {section === 'subscriptions'        && <SubscriptionsSection />}
          {section === 'support'              && <SupportSection />}
          {section === 'support_chat'         && <SupportChatSection />}
          {section === 'product_reviews'      && <ProductReviewsSection />}
          {section === 'qa_moderation'        && <QAModerationSection />}
          {section === 'counterfeit'          && <CounterfeitSection />}
          {section === 'verify'               && <VerifyRequestsSection />}
          {section === 'inventory'            && <InventorySection />}
          {section === 'restock'              && <RestockAlertsSection />}
          {section === 'pharmacist_sessions'  && <PharmacistSessionsSection />}
          {section === 'distributors'         && <DistributorsSection />}
          {section === 'rgpd'                 && <RgpdExportsSection />}
          {section === 'signatures'           && <SignaturesSection />}
          {section === 'partner_apps'         && <PartnerApplicationsSection />}
          {section === 'driver_apps'          && <DriverApplicationsSection />}
          {section === 'merchant_onboarding'  && <OnboardingReviewSection />}
          {section === 'corporate'            && <CorporateSection />}
          {section === 'tradein'              && <TradeInSection />}
              </>
            );
          })()}
        </Suspense>
      </main>

      {pinModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 24,
            maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🔑 Changer mon PIN</h2>
            <p style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 16 }}>
              Choisis un nouveau code à 4-6 chiffres
            </p>
            <input
              type="password" inputMode="numeric" maxLength={6}
              placeholder="Ancien PIN" value={oldPin}
              onChange={e => { setOldPin(e.target.value.replace(/\D/g, '')); setPinModalError(''); }}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #DDD', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }}
              autoFocus
            />
            <input
              type="password" inputMode="numeric" maxLength={6}
              placeholder="Nouveau PIN" value={newPin}
              onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setPinModalError(''); }}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #DDD', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }}
            />
            <input
              type="password" inputMode="numeric" maxLength={6}
              placeholder="Confirme le nouveau PIN" value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinModalError(''); }}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #DDD', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }}
              onKeyDown={e => e.key === 'Enter' && handleChangePin()}
            />
            {pinModalError && (
              <div style={{ background: '#FCE9E7', color: '#D9342B', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                ⚠️ {pinModalError}
              </div>
            )}
            {pinModalOk && (
              <div style={{ background: '#E8F5EC', color: '#1F8B4C', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                {pinModalOk}
              </div>
            )}
            <button
              onClick={handleChangePin}
              style={{ width: '100%', padding: 12, background: '#1F8B4C', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Modifier mon PIN
            </button>
            <button
              onClick={() => { setPinModal(false); setOldPin(''); setNewPin(''); setConfirmPin(''); setPinModalError(''); }}
              style={{ width: '100%', padding: 10, marginTop: 8, background: '#F4F4F2', color: '#1A1A1A', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
