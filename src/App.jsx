import { useState, createContext, useContext, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase, getCurrentUser, getAllProducts, getAllBrands, getProductCategorySlugs } from './lib/supabase';
import { maybeSendWelcomeEmail } from './lib/emails';
import { checkAndNotifyCartAbandon, notifyWelcome } from './lib/notifications';
import { initPush, setupPushForUser } from './lib/push';
import { syncCartOnLogin, attachCartSyncListener, disableCartSync } from './lib/cartSync';
import SplashScreen from './components/SplashScreen';
import Onboarding from './pages/Onboarding';
// ─── Perf : SEUL Landing reste eager (entry point marketing yaram.app) ───
// Tout le reste est lazy pour tomber le bundle initial de 620KB à ~200KB.
// Le SW précache les chunks JS/CSS, donc le 2e clic est instantané.
import Landing from './pages/Landing';
import InstallPrompt from './components/InstallPrompt';
import OpenInAppBanner from './components/OpenInAppBanner';
// FAB WhatsApp retiré (juin 2026) — le contact WhatsApp est accessible
// depuis Profile → Support → "WhatsApp YARAM" et page Help.
// import WhatsAppButton from './components/WhatsAppButton';
import Toaster from './components/Toaster';
import InterstitialPromo from './components/InterstitialPromo';
const SupportChatWidget = lazy(() => import('./components/SupportChatWidget'));
import { getNextPromo, computeUserStats } from './lib/promos';
import NetworkStatus from './components/NetworkStatus';
import ErrorBoundary from './components/ErrorBoundary';
import { initAnalytics, identifyUser, resetAnalytics, trackEvent, trackPageview } from './lib/analytics';

// ─── Lazy-load : TOUTES les pages sauf Landing (entry point) ───
// Chaque route ne télécharge que son chunk quand l'user y navigue.
// Le SW cache-first sur /assets/* rend la 2e visite instantanée.
const Home          = lazy(() => import('./pages/Home'));
const ShopHome      = lazy(() => import('./pages/ShopHome'));
const ProductPage   = lazy(() => import('./pages/ProductPage'));
const CartPage      = lazy(() => import('./pages/CartPage'));
const CheckoutPage  = lazy(() => import('./pages/CheckoutPage'));
const BrandPage     = lazy(() => import('./pages/BrandPage'));
const SignPage      = lazy(() => import('./pages/SignPage'));
const Search        = lazy(() => import('./pages/Search'));
const Product       = lazy(() => import('./pages/Product'));
const Cart          = lazy(() => import('./pages/Cart'));
const Orders        = lazy(() => import('./pages/Orders'));
const Profile       = lazy(() => import('./pages/Profile'));
const Pharmacies    = lazy(() => import('./pages/Pharmacies'));
const PharmacyDetail= lazy(() => import('./pages/PharmacyDetail'));
const Addresses     = lazy(() => import('./pages/Addresses'));
const Favorites     = lazy(() => import('./pages/Favorites'));
const Payments      = lazy(() => import('./pages/Payments'));
const Evolution     = lazy(() => import('./pages/Evolution'));
const Categories    = lazy(() => import('./pages/Categories'));
const Loyalty       = lazy(() => import('./pages/Loyalty'));
const Referral      = lazy(() => import('./pages/Referral'));
const NotifSettings = lazy(() => import('./pages/NotifSettings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Promos        = lazy(() => import('./pages/Promos'));
const Help          = lazy(() => import('./pages/Help'));
const SkinQuiz      = lazy(() => import('./pages/SkinQuiz'));
const Checkout      = lazy(() => import('./pages/Checkout'));
const Payment       = lazy(() => import('./pages/Payment'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const Scan          = lazy(() => import('./pages/Scan'));
const ScanResult    = lazy(() => import('./pages/ScanResult'));
const ScanHistory   = lazy(() => import('./pages/ScanHistory'));
const Admin         = lazy(() => import('./pages/Admin'));
const Pharma        = lazy(() => import('./pages/Pharma'));
const Brand         = lazy(() => import('./pages/Brand'));
const Livreur       = lazy(() => import('./pages/Livreur'));
const ClientConfirm = lazy(() => import('./pages/ClientConfirm'));
const PiSpiTest     = lazy(() => import('./pages/PiSpiTest'));
const DistributorView = lazy(() => import('./pages/DistributorView'));
const DriverApp       = lazy(() => import('./pages/driver/DriverApp'));
const Privacy         = lazy(() => import('./pages/Privacy'));
const Terms           = lazy(() => import('./pages/Terms'));
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'));
const DeleteAccount   = lazy(() => import('./pages/DeleteAccount'));
const International = lazy(() => import('./pages/International'));
const Newsletter      = lazy(() => import('./pages/Newsletter'));
const PartnerApplication = lazy(() => import('./pages/PartnerApplication'));
const DriverApplication  = lazy(() => import('./pages/DriverApplication'));
const BrandsPage         = lazy(() => import('./pages/BrandsPage'));
const WishlistShared     = lazy(() => import('./pages/WishlistShared'));
const BundlePage         = lazy(() => import('./pages/BundlePage'));
const Subscriptions      = lazy(() => import('./pages/Subscriptions'));
const BlogHome           = lazy(() => import('./pages/BlogHome'));
const BlogArticle        = lazy(() => import('./pages/BlogArticle'));
const BlogCategory       = lazy(() => import('./pages/BlogCategory'));
const MerchantOnboarding = lazy(() => import('./pages/MerchantOnboarding'));
const CorporateApply     = lazy(() => import('./pages/CorporateApply'));
const CorporateDashboard = lazy(() => import('./pages/CorporateDashboard'));
const PremiumConcierge   = lazy(() => import('./pages/PremiumConcierge'));
const TradeIn            = lazy(() => import('./pages/TradeIn'));
const ARTryOn            = lazy(() => import('./pages/ARTryOn'));

// ════════════════════════════════════════════════════════════════
//  FIX juin 2026 #8 — LazyFallback FULL SCREEN (CAUSE RACINE BLANCHE)
//
//  AVANT : minHeight 60vh + texte "Chargement…" sur fond blanc
//  → invisible sur petit écran, l'user voyait du blanc.
//
//  MAINTENANT : 100dvh + fond YARAM vert subtil + spinner discret.
//  Couvre toute la zone, donne un feedback visuel cohérent.
// ════════════════════════════════════════════════════════════════
function LazyFallback() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #F8FAF7 0%, #EAF5EE 100%)',
      zIndex: 1,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '2.5px solid rgba(31, 139, 76, 0.12)',
        borderTopColor: '#1F8B4C',
        animation: 'yaram-spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes yaram-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

const NavContext = createContext(null);
export function useNav() { return useContext(NavContext); }

const UserContext = createContext(null);
export function useUser() { return useContext(UserContext); }

// Splash minimum display time (pour que ce soit visible meme si le auth est ultra rapide)
// Perf juillet 2026 : 600ms → 350ms. Le splash inline (index.html #yaram-boot)
// est déjà visible dès le 1er byte, ce délai ne fait qu'ajouter du temps
// perçu si l'auth+prewarm sont ultra rapides (2e visite avec SW cache).
const SPLASH_MIN_DURATION = 350;

function routeToPath(route) {
  if (!route || !route.name || route.name === 'landing') return '/';
  const params = route.params || {};
  switch (route.name) {
    case 'home': return '/shop';  // alias historique vers shop
    case 'shop': return '/shop';
    case 'wishlist_shared': return `/wishlist/${params.slug}`;
    case 'product': return `/product/${params.id}`;
    case 'productPage': return `/product/${params.id}`;
    case 'bundle': return `/bundle/${params.slug}`;
    case 'brand': return `/brand/${params.id}`;
    case 'brand_detail': return `/brand/${params.id}`;
    case 'pharmacy_detail': return `/pharmacy/${params.id}`;
    case 'merchant_onboarding': return `/merchant/onboarding/${params.applicationId}`;
    case 'order_tracking': return `/order/${params.orderId}`;
    case 'scan_result': return `/scan/result/${params.scanId}`;
    case 'payment': return `/payment/${params.orderId}`;
    case 'corporate': return '/corporate';
    case 'corporate_dashboard': return '/corporate/dashboard';
    case 'blog': return '/blog';
    case 'blog_article': return `/blog/${params.slug}`;
    case 'blog_category': return `/blog/category/${params.slug}`;
    case 'premium_concierge': return '/premium/concierge';
    case 'trade_in': return '/trade-in';
    case 'ar_tryon': return `/ar/${params.productId}`;
    case 'search': {
      const sp = new URLSearchParams();
      if (params.q) sp.set('q', params.q);
      if (params.category) sp.set('category', params.category);
      if (params.brand) sp.set('brand', params.brand);
      if (params.marque) sp.set('marque', params.marque);
      if (params.tri) sp.set('tri', params.tri);
      if (params.promo) sp.set('promo', String(params.promo));
      const q = sp.toString();
      return q ? `/search?${q}` : '/search';
    }
    default: return `/${route.name}`;
  }
}

// Restore le path preserve par public/404.html si Cloudflare a servi le 404
// fallback avant que _redirects /* -> /index.html ne s applique. Ce cas se
// produit surtout pour les routes SPA imbriquees (/sign/xxx, /product/yyy,
// /pharmacy/zzz, etc.). Le 404.html met le path original en sessionStorage
// puis redirige vers /. On restore ici via history.replaceState pour que
// parseRoute mappe la bonne page.
if (typeof window !== 'undefined') {
  try {
    const saved = sessionStorage.getItem('yaram-spa-redirect');
    if (saved && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
      sessionStorage.removeItem('yaram-spa-redirect');
      window.history.replaceState({}, '', saved);
    }
  } catch (_e) { /* no-op */ }
}

function pathToRoute(pathname, search = '') {
  const path = pathname.replace(/^\//, '');
  const searchParams = new URLSearchParams(search);

  if (path === '' || path === '/') return { name: 'landing', params: {} };

  const parts = path.split('/');

  if (parts[0] === 'corporate' && parts[1] === 'dashboard') return { name: 'corporate_dashboard', params: {} };
  if (parts[0] === 'corporate') return { name: 'corporate', params: {} };
  if (parts[0] === 'wishlist' && parts[1]) return { name: 'wishlist_shared', params: { slug: parts[1] } };
  if (parts[0] === 'product' && parts[1]) return { name: 'product', params: { id: parts[1] } };
  if (parts[0] === 'bundle' && parts[1]) return { name: 'bundle', params: { slug: parts[1] } };
  if (parts[0] === 'brand' && parts[1]) return { name: 'brand', params: { id: parts[1] } };
  if (parts[0] === 'sign' && parts[1]) return { name: 'sign', params: { token: parts[1] } };
  if (parts[0] === 'merchant' && parts[1] === 'onboarding' && parts[2]) {
    return { name: 'merchant_onboarding', params: { applicationId: parts[2] } };
  }
  if (parts[0] === 'pharmacy' && parts[1]) return { name: 'pharmacy_detail', params: { id: parts[1] } };
  if (parts[0] === 'order' && parts[1]) return { name: 'order_tracking', params: { orderId: parts[1] } };
  if (parts[0] === 'scan' && parts[1] === 'result' && parts[2]) return { name: 'scan_result', params: { scanId: parts[2] } };
  if (parts[0] === 'payment' && parts[1]) return { name: 'payment', params: { orderId: parts[1] } };

  // ─── Scaffolds : Concierge / Trade-In / AR try-on ───
  if (parts[0] === 'premium' && parts[1] === 'concierge') return { name: 'premium_concierge', params: {} };
  if (parts[0] === 'trade-in') return { name: 'trade_in', params: {} };
  if (parts[0] === 'ar' && parts[1]) return { name: 'ar_tryon', params: { productId: parts[1] } };

  // ─── Blog SEO (/blog, /blog/:slug, /blog/category/:slug) ───
  if (parts[0] === 'blog') {
    if (!parts[1]) return { name: 'blog', params: {} };
    if (parts[1] === 'category' && parts[2]) {
      return { name: 'blog_category', params: { slug: parts[2] } };
    }
    return { name: 'blog_article', params: { slug: parts[1] } };
  }

  // ─── Shop (catalogue e-commerce complet) ───
  if (parts[0] === 'shop' || parts[0] === 'home') return { name: 'shop', params: {} };

  const simpleRoutes = ['search', 'cart', 'checkout', 'orders', 'profile', 'pharmacies', 'scan', 'scan_history', 'addresses', 'favorites', 'payments', 'evolution', 'categories', 'quiz', 'loyalty', 'referral', 'notifications', 'notif_settings', 'promos', 'privacy', 'terms', 'mentions', 'delete_account', 'international', 'help', 'newsletter', 'brands', 'partner-application', 'driver-application', 'subscriptions'];
  if (simpleRoutes.includes(parts[0])) {
    const params = {};
    if (parts[0] === 'search') {
      const cat = searchParams.get('category');
      if (cat) params.category = cat;
      const br = searchParams.get('brand');
      if (br) params.brand = br;
      const qq = searchParams.get('q');
      if (qq) params.q = qq;
    }
    return { name: parts[0], params };
  }

  return { name: 'landing', params: {} };
}

// ─────────────────────────────────────────────────────────────
//  Detection mode admin "sophistique" — survit au refresh F5
// ─────────────────────────────────────────────────────────────
//
// Problème : sur iOS Capacitor ou si l'URL perd `?admin` (redirect,
// service worker, retour navigation), on retombait sur ClientApp.
//
// Fix : si une session admin VALIDE existe en localStorage
//   (clé yaram-admin-session, expires_at futur, token non-null),
// on force le mode admin et on re-attache `?admin` à l'URL via
// history.replaceState — sans rechargement, sans clignotement.
//
// Même logique pour pharma (clé yaram-pharma-session) et livreur
// (la route livreur exige un token public dans l'URL : pas de
// persistance possible — sa session est volatile par design).
function isStickyAdminSession() {
  try {
    const raw = localStorage.getItem('yaram-admin-session');
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!(s && s.token && s.expires_at && s.expires_at > Date.now());
  } catch { return false; }
}
function isStickyPharmaSession() {
  try {
    const raw = localStorage.getItem('yaram-pharma-session');
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!(s && (s.token || s.pharmacy_id) && (!s.expires_at || s.expires_at > Date.now()));
  } catch { return false; }
}
function isStickyBrandSession() {
  try {
    const raw = localStorage.getItem('yaram-brand-session');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.token) return false;
    if (!s.expires_at) return true;
    // expires_at peut être un ISO string (RPC brand_login) ou un timestamp
    const exp = typeof s.expires_at === 'string' ? new Date(s.expires_at).getTime() : s.expires_at;
    return exp > Date.now();
  } catch { return false; }
}
function reattachQueryParam(key) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, '1');
      window.history.replaceState({}, '', url.toString());
    }
  } catch { /* no-op */ }
}

export default function App() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

  // ─── Sticky admin / pharma : session localStorage > URL ───
  // Si une session admin valide existe, on force le mode admin même si
  // l'URL a perdu `?admin` (refresh iOS Capacitor, etc.).
  //
  // ⚠️ CRITIQUE : ces sticky checks NE doivent PAS s'activer si une AUTRE
  // route explicite est dans l'URL (`?livreur=TOKEN`, `?confirm=...`, `?pispi`).
  // Sinon : ouvrir `?livreur=TOKEN` depuis un tel qui a une session admin
  // localStorage redirige sur Admin au lieu de Livreur (bug critique).
  const hasAnyExplicitRoute =
    typeof window !== 'undefined' && (
      params.has('admin')   ||
      params.has('pharma')  ||
      params.has('brand')   ||
      params.has('livreur') ||
      params.has('confirm') ||
      params.has('pispi')
    );

  // Helper pour wrapper toutes les routes top-level avec ErrorBoundary +
  // Suspense uniforme. Plus jamais d'ecran blanc silencieux sur Admin/Pharma/Livreur.
  const wrapRoute = (Comp) => (
    <>
      <ErrorBoundary>
        <Suspense fallback={<SplashScreen />}><Comp /></Suspense>
      </ErrorBoundary>
      <Toaster />
    </>
  );

  // ─── Vue publique distributeur (par token, sans login) ───────────
  // URL : /admin/distributor-view?token=XXX → bypass sticky admin session
  // pour permettre à un distributeur partenaire (Bonfoni, etc.) d'accéder
  // à son dashboard sans avoir besoin du compte admin YARAM.
  const isDistributorView =
    typeof window !== 'undefined' &&
    window.location.pathname === '/admin/distributor-view';
  if (isDistributorView) {
    return wrapRoute(DistributorView);
  }

  // ─── App livreur PWA dédiée (route /driver/*) ───────────────────
  // Bypass TOTAL des autres détections (sticky admin/pharma, ?livreur=,
  // ?confirm=, etc.) : la PWA driver est une expérience standalone.
  // Routes : /driver, /driver/login, /driver/dashboard, /driver/profile,
  //          /driver/earnings, /driver/help, /driver/delivery/:id
  const isDriverApp =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/driver' || window.location.pathname.startsWith('/driver/'));
  if (isDriverApp) {
    return wrapRoute(DriverApp);
  }

  // ─── Brand dashboard PWA (route /brand exacte, sans ID) ──────
  // Attention : /brand/:id existe deja et pointe sur BrandPage (catalogue
  // d'une marque cote client). Notre dashboard marque n'est declenche que
  // sur la route EXACTE /brand (sans segment supplementaire).
  const isBrandDashboard =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/brand' || window.location.pathname === '/brand/');
  if (isBrandDashboard) {
    return wrapRoute(Brand);
  }

  // ─── Routes publiques PRIORITAIRES sur tous les checks admin/pharma/livreur ─
  // /sign/*, /merchant/onboarding/*, /wishlist/* sont des liens publics envoyes
  // a des tiers (pharmaciens, partenaires, clients partages). Ils NE doivent
  // JAMAIS etre detournes par un ?admin=1 present dans l URL, ni par une
  // sticky session admin/pharma en localStorage. On les detecte AVANT tout
  // autre check pour garantir un bypass total.
  const publicPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isPublicSharedRoute =
    publicPath.startsWith('/sign/') ||
    publicPath === '/sign' ||
    publicPath.startsWith('/merchant/onboarding/') ||
    publicPath.startsWith('/wishlist/');
  if (isPublicSharedRoute) {
    return <ClientApp />;
  }

  if (typeof window !== 'undefined' && !hasAnyExplicitRoute && isStickyAdminSession()) {
    reattachQueryParam('admin');
    return wrapRoute(Admin);
  }
  if (typeof window !== 'undefined' && !hasAnyExplicitRoute && isStickyPharmaSession()) {
    reattachQueryParam('pharma');
    return wrapRoute(Pharma);
  }
  if (typeof window !== 'undefined' && !hasAnyExplicitRoute && isStickyBrandSession()) {
    reattachQueryParam('brand');
    return wrapRoute(Brand);
  }

  // Routes top-level (non-client) : chunks separes, wrap dans Suspense + ErrorBoundary.
  // NB: le check isPublicSharedRoute plus haut renvoie deja ClientApp avant
  // d arriver ici pour /sign/*, /merchant/onboarding/*, /wishlist/*. Meme
  // avec ?admin=1 dans l URL, ces routes publiques restent client-side.
  if (params.has('admin'))   return wrapRoute(Admin);
  if (params.has('pharma'))  return wrapRoute(Pharma);
  if (params.has('brand'))   return wrapRoute(Brand);
  if (params.has('livreur')) return wrapRoute(Livreur);
  if (params.has('confirm')) return wrapRoute(ClientConfirm);
  if (params.has('pispi'))   return wrapRoute(PiSpiTest);

  return <ClientApp />;
}

function ClientApp() {
  const initialRoute = typeof window !== 'undefined' 
    ? pathToRoute(window.location.pathname, window.location.search)
    : { name: 'home', params: {} };
  
  const [route, setRoute] = useState(initialRoute);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Splash minimum duration
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MIN_DURATION);
    return () => clearTimeout(t);
  }, []);

  // PERF : pre-warm du cache des qu'on est cote client.
  // Fire-and-forget : declenche les requetes les plus communes en parallele
  // pendant que le splash est encore affiche. Resultat : quand l'user clique
  // sur Search / Categories, les donnees sont DEJA en cache memoire (instant).
  // Sur 4G Senegal ca economise 1-3 sec de wait sur les 2 premiers ecrans.
  useEffect(() => {
    // setTimeout(0) = ne pas bloquer le render initial
    const t = setTimeout(() => {
      getAllProducts().catch(() => { /* silent : sera retry au vrai usage */ });
      getAllBrands().catch(() => { /* silent */ });
      getProductCategorySlugs().catch(() => { /* silent */ });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // PUSH NOTIFICATIONS : init OneSignal SDK au boot (no-op sur web).
  // Ne demande PAS la permission encore (on le fera après login pour avoir
  // un meilleur taux d'acceptation : "j'ai mon compte, j'autorise les notifs").
  useEffect(() => {
    initPush().catch(() => { /* silent : push optionnel, ne doit pas bloquer */ });
  }, []);

  // ─── ANALYTICS (PostHog) : init au boot + app_opened event ───
  // No-op en dev (MODE !== 'production') ou si VITE_POSTHOG_KEY pas défini.
  useEffect(() => {
    initAnalytics();
    trackEvent('app_opened', { platform: 'web' });
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  REPRISE APRÈS BACKGROUND (fix lenteur quand on revient sur l'app)
  // ═══════════════════════════════════════════════════════════════════
  // Quand iOS / Android mettent l'app en background pendant 5+ min :
  //   - La JS context peut être gelée (fetches en attente bloqués)
  //   - Le JWT Supabase expire (par défaut 1h)
  //   - Les realtime channels sont coupés
  // Au retour, l'app paraît "stuck" : les fetches relancés tombent sur des
  // sessions périmées et hang sans erreur.
  //
  // Fix : on détecte la reprise, on refresh la session, et on dispatche un
  // event que les pages peuvent écouter pour relancer leur loadData.
  const [resumeCount, setResumeCount] = useState(0);
  useEffect(() => {
    let lastHiddenAt = null;
    const RESUME_THRESHOLD_MS = 60 * 1000; // 1 min : si on revient après ça, on refresh

    const handleVisibility = async () => {
      if (document.hidden) {
        lastHiddenAt = Date.now();
        return;
      }
      // L'app revient au foreground
      const awayDuration = lastHiddenAt ? Date.now() - lastHiddenAt : 0;
      if (awayDuration < RESUME_THRESHOLD_MS) return; // <1 min : pas besoin

      console.log('[App] Resume after', Math.round(awayDuration / 1000), 's away — refreshing...');
      try {
        // 1. Refresh la session Supabase (re-valide le JWT, refresh si expiré)
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('[App] session refresh failed:', error.message);
          if (error.message?.includes('refresh_token') || error.message?.includes('expired')) {
            window.location.reload();
            return;
          }
        }

        // 2. Invalide les caches critiques qui peuvent être obsolètes
        //    + purge les promises en-vol zombies (TCP fermé par iOS)
        try {
          const supabaseMod = await import('./lib/supabase');
          // Invalide les caches data qui changent (produits, pharmas, brands, banners)
          ['all_products', 'all_pharmacies', 'all_brands', 'all_banners', 'active_banners', 'site_settings']
            .forEach(k => supabaseMod.invalidateCache?.(k));

          // Purge les fetches en-vol zombies (>10s) qui bloqueraient les nouveaux appelants
          const cacheMod = await import('./lib/dataCache');
          cacheMod.purgeStaleInflight?.();
        } catch { /* noop */ }

        // 2.bis FIX v7 : force la reconnexion des realtime channels.
        // iOS coupe les websockets après ~30s en background → au retour,
        // les channels semblent "alive" mais ne reçoivent plus rien.
        // disconnect() + connect() force tous les channels actifs à rejoin.
        try {
          if (awayDuration > 30 * 1000 && supabase.realtime) {
            supabase.realtime.disconnect();
            // microtask pour laisser le close se propager avant le reconnect
            setTimeout(() => {
              try { supabase.realtime.connect(); } catch { /* noop */ }
            }, 50);
          }
        } catch { /* realtime pas dispo, on s'en moque */ }

        // 3. Dispatch event que les pages peuvent écouter pour reload
        // FIX juin 2026 : wrappé try/catch (listener custom peut throw et casser le boot foreground)
        try {
          window.dispatchEvent(new CustomEvent('yaram-app-resumed', {
            detail: { awayDuration },
          }));
        } catch (e) { console.warn('[YARAM] yaram-app-resumed dispatch error:', e?.message); }

        // 4. FIX juin 2026 : on n'incrémente PLUS resumeCount
        // (resumeCount n'est plus dans pageKey, donc inutile + causait remounts
        // qui resetaient tous les useState locaux des pages → skeletons).
        // Le focusManager.setFocused(true) de main.jsx déclenche déjà un refetch
        // intelligent des queries stale, sans remount.
      } catch (e) {
        console.warn('[App] resume handler error:', e?.message);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) handleVisibility();
    });

    // ─── Capacitor iOS / Android : App.addListener('resume') ───
    // Sur certaines versions de WKWebView, visibilitychange ne fire pas
    // de manière fiable après un long background (ex : iPhone qui dort).
    // L'event Capacitor resume est plus déterministe pour le natif.
    let capSub = null;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        capSub = await CapApp.addListener('resume', () => {
          // Simule un visibilitychange : si on était caché >1min, refresh.
          // Note : sur Capacitor, document.hidden peut rester false → on injecte
          // un lastHiddenAt si pas déjà set par visibilitychange.
          if (!lastHiddenAt) lastHiddenAt = Date.now() - 2 * 60 * 1000; // assume long away
          handleVisibility();
        });
        // Track lastHiddenAt aussi sur pause Capacitor (plus fiable que visibilitychange)
        await CapApp.addListener('pause', () => {
          lastHiddenAt = Date.now();
        });
      } catch {
        // Web build : pas de @capacitor/app, on s'en moque
      }
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      try { capSub?.remove?.(); } catch { /* noop */ }
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const newRoute = pathToRoute(window.location.pathname, window.location.search);
      // Scroll en haut + set route en même temps pour un retour fluide
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
      setRoute(newRoute);

      // ─── Auto-refresh sur retour iOS ───
      // Note : avec le key={pageKey} dans <Suspense>, chaque navigation force
      // un remount complet de la page, donc useEffect re-fetch les données auto.
      // Le yaram-route-back reste utile pour les pages qui veulent un refresh
      // sans remount complet (rare).
      try {
        window.dispatchEvent(new CustomEvent('yaram-route-back', {
          detail: { to: newRoute },
        }));
      } catch { /* ignore */ }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ─── Universal Links iOS / App Links Android ───
  // Quand un user clique sur https://yaram.app/order/XXX dans son email ou WhatsApp,
  // iOS ouvre directement l'app YARAM (si AASA bien hébergé + entitlement OK)
  // au lieu de Safari. On reçoit l'URL ici et on route vers la bonne page.
  useEffect(() => {
    let sub = null;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        sub = await CapApp.addListener('appUrlOpen', ({ url }) => {
          try {
            console.log('[YARAM] appUrlOpen:', url);
            const u = new URL(url);
            const newRoute = pathToRoute(u.pathname, u.search);
            window.history.pushState(null, '', u.pathname + u.search);
            window.scrollTo(0, 0);
            setRoute(newRoute);
          } catch (e) {
            console.warn('[YARAM] appUrlOpen parse error:', e?.message);
          }
        });
      } catch {
        // Web build : @capacitor/app pas disponible, on no-op
      }
    })();
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let isFirstLoad = true;
    // Dedup in-memory : evite que getSession() ET onAuthStateChange(SIGNED_IN)
    // declenchent tous les 2 maybeSendWelcomeEmail avant que welcomed_at soit
    // persiste en DB (race au premier signup). Onboarding.jsx envoie aussi un
    // welcome au signup direct ; maybeSendWelcomeEmail short-circuit via
    // welcomed_at une fois persiste, mais cet in-memory guard couvre la fenetre.
    const welcomeAttempted = new Set();
    const tryWelcome = (userObj) => {
      if (!userObj?.id) return;
      if (welcomeAttempted.has(userObj.id)) return;
      welcomeAttempted.add(userObj.id);
      maybeSendWelcomeEmail(userObj).catch(() => { /* non-bloquant */ });
    };

    // 1. Premier chargement : check session + fetch profil une seule fois
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        // Optim : passe la session deja recuperee a getCurrentUser pour eviter
        // un 2eme appel reseau (gain ~150ms au boot)
        getCurrentUser(session).then(u => {
          if (!cancelled) {
            const userObj = u || { id: session.user.id, email: session.user.email };
            setUser(userObj);
            setAuthChecked(true);
            // Welcome email si jamais envoye (Google OAuth, magic link, etc.)
            tryWelcome(userObj);
          }
        }).catch(() => {
          if (!cancelled) {
            setUser({ id: session.user.id, email: session.user.email });
            setAuthChecked(true);
          }
        });
      } else {
        setUser(null);
        setAuthChecked(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setUser(null);
        setAuthChecked(true);
      }
    });

    // 2. Auth state change : NE FETCH QUE sur SIGN_IN ou SIGN_OUT, pas sur TOKEN_REFRESHED
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      // Ignore le premier event (INITIAL_SESSION) car deja gere ci-dessus
      // SAUF si c'est SIGNED_OUT : on doit toujours forcer la deconnexion (cas rare ou
      // signOut() arrive AVANT que getSession() initial ne termine).
      if (isFirstLoad && event !== 'SIGNED_OUT') { isFirstLoad = false; return; }
      isFirstLoad = false;
      // Ignore les refresh de token qui ne changent pas l'user
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;

      if (session?.user) {
        try {
          const u = await getCurrentUser();
          if (!cancelled) {
            const userObj = u || { id: session.user.id, email: session.user.email };
            setUser(userObj);
            // Welcome email si jamais envoye (couvre Google OAuth + signup email/password)
            tryWelcome(userObj);
          }
        } catch (e) {
          if (!cancelled) setUser({ id: session.user.id, email: session.user.email });
        }
      } else {
        if (!cancelled) setUser(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ─── SENTRY : identifie l'user pour corréler les erreurs (id only, no PII) ───
  // Import dynamique : si le module sentry.js fail à charger (ou si Sentry pas
  // installé), on ignore silencieusement. Aucun crash possible côté boot.
  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    import('./lib/sentry').then(({ identifySentry }) => {
      if (cancelled) return;
      try { identifySentry(user || null); } catch { /* silent */ }
    }).catch(() => { /* sentry pas dispo */ });
    return () => { cancelled = true; };
  }, [authChecked, user?.id]);

  // ─── NOTIFICATIONS WHATSAPP : 1 SEULE FOIS PAR SESSION ───
  const notifsSentRef = useRef(false);
  useEffect(() => {
    if (!authChecked || !user?.id || !user?.phone) return;
    if (notifsSentRef.current) return; // Deja envoye dans cette session
    notifsSentRef.current = true;

    const welcomeTimer = setTimeout(() => {
      notifyWelcome({
        userId: user.id,
        phone: user.phone,
        firstName: user.first_name || user.name || 'toi',
      }).catch(() => {});

      // ─── PUSH NOTIF welcome (best-effort, no-op si pas de device iOS) ───
      // Gate via localStorage : 1 seule fois par device. Si l'user désinstalle/réinstalle
      // il en aura un nouveau, c'est OK (rare et cohérent avec un "welcome").
      try {
        const welcomeKey = `yaram_welcome_push_${user.id}`;
        if (!localStorage.getItem(welcomeKey)) {
          import('./lib/pushAdmin').then(mod => {
            mod.pushSelfWelcome({
              userId: user.id,
              firstName: user.first_name || user.name || '',
            }).then(res => {
              if (res?.success) localStorage.setItem(welcomeKey, '1');
            }).catch(() => {});
          }).catch(() => {});
        }
      } catch { /* localStorage indisponible : silent skip */ }
    }, 2000);

    const cartTimer = setTimeout(() => {
      checkAndNotifyCartAbandon({
        userId: user.id,
        phone: user.phone,
        firstName: user.first_name || 'toi',
      }).catch(() => {});
    }, 4000);

    return () => {
      clearTimeout(welcomeTimer);
      clearTimeout(cartTimer);
    };
  }, [authChecked, user?.id, user?.phone]);

  // ─── CART SYNC cross-device : pull DB au login, push DB sur chaque change ─
  //   Une seule fois par session (guard par ref). Fire-and-forget.
  //   Sur logout, on coupe le push pour eviter un upsert avec un anon JWT.
  const cartSyncRef = useRef(false);
  useEffect(() => {
    if (!authChecked) return;
    if (!user?.id) {
      // Logout OU jamais logue : couper le push. Le cart local reste utilisable.
      disableCartSync();
      return;
    }
    if (cartSyncRef.current) return;
    cartSyncRef.current = true;
    // Attache le listener AVANT le pull : si le pull dispatche un event silent,
    // le listener l'ignore ; si l'user modifie son cart pendant le pull, le
    // change sera bien capture et debouncera un push apres la fin du pull.
    attachCartSyncListener();
    syncCartOnLogin().catch(() => { /* silent — le cart local reste source de verite */ });
  }, [authChecked, user?.id]);

  // ─── PUSH NOTIFICATIONS : setup après login (popup permission iOS + save device en DB) ───
  // Délai de 3 secondes pour laisser l'user "atterrir" sur l'app avant de
  // lui demander la permission (= meilleur taux d'acceptation).
  // No-op sur web (le helper isNativeApp() check ça).
  const pushSetupRef = useRef(false);
  useEffect(() => {
    if (!authChecked || !user?.id) return;
    if (pushSetupRef.current) return;
    pushSetupRef.current = true;

    // PERF : pre-charge les favoris du user dans le cache global immédiatement
    // pour que tous les ProductTile soient instant sans queries individuelles.
    import('./lib/supabase').then(mod => mod.preloadFavorites?.()).catch(() => {});

    const t = setTimeout(() => {
      setupPushForUser(user).catch(() => { /* silent : push optionnel, ne doit pas bloquer */ });
    }, 3000);
    return () => clearTimeout(t);
  }, [authChecked, user?.id]);

  // ─── Interstitial Promos : fetch + affichage au boot Home ───
  // Affiche une promo plein écran 1.5s après l'arrivée sur Home (laisse le temps
  // à l'écran de rendre, puis interstitiel). Frequency contrôlée DB-side.
  const [activePromo, setActivePromo] = useState(null);
  const promoFetchRef = useRef(false);
  useEffect(() => {
    if (!authChecked) return;
    if (promoFetchRef.current) return;
    // Ne fetch qu'au 1er render Home (pas sur les pages internes)
    if (route?.name && route.name !== 'home') return;
    promoFetchRef.current = true;

    const t = setTimeout(async () => {
      try {
        const userStats = user?.id ? await computeUserStats(user) : {};
        const promo = await getNextPromo({
          placement: 'home',
          user,
          userStats,
        });
        if (promo) setActivePromo(promo);
      } catch { /* silent */ }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, user?.id, route?.name]);

  const navigate = (target) => {
    if (target === -1) { goBack(); return; }

    let newRoute;

    if (typeof target === 'string') {
      const path = target.split('?')[0].replace(/^\//, '');
      if (path.startsWith('product/')) {
        newRoute = { name: 'product', params: { id: path.split('/')[1] } };
      } else if (path.startsWith('ar/')) {
        newRoute = { name: 'ar_tryon', params: { productId: path.split('/')[1] } };
      } else if (path === 'trade-in') {
        newRoute = { name: 'trade_in', params: {} };
      } else if (path === 'premium/concierge') {
        newRoute = { name: 'premium_concierge', params: {} };
      } else {
        // Map exhaustif : couvre TOUTES les routes du switch principal
        // (sinon route inconnue → fallback home silencieux, gros source de bugs)
        const map = {
          '': 'landing',
          landing: 'landing',
          shop: 'shop',
          home: 'home',
          search: 'search',
          cart: 'cart',
          checkout: 'checkout',
          profile: 'profile',
          orders: 'orders',
          pharmacies: 'pharmacies',
          brands: 'brands',
          categories: 'categories',
          international: 'international',
          help: 'help',
          privacy: 'privacy',
          terms: 'terms',
          mentions: 'mentions',
          scan: 'scan',
          scan_history: 'scan_history',
          scan_result: 'scan_result',
          promos: 'promos',
          loyalty: 'loyalty',
          referral: 'referral',
          subscriptions: 'subscriptions',
          addresses: 'addresses',
          favorites: 'favorites',
          payments: 'payments',
          evolution: 'evolution',
          quiz: 'quiz',
          notifications: 'notifications',
          delete_account: 'delete_account',
          newsletter: 'newsletter',
          auth: 'auth',
          'partner-application': 'partner-application',
          'driver-application': 'driver-application',
          blog: 'blog',
        };
        const routeName = map[path];
        if (!routeName) {
          console.warn('[nav] Route inconnue:', path, '→ fallback home');
          newRoute = { name: 'home', params: {} };
        } else {
          newRoute = { name: routeName, params: {} };
        }
      }
    } else if (typeof target === 'object') {
      // Garantit params: {} si pas fourni (sinon key={pageKey} produit un key incohérent)
      newRoute = { ...target, params: target.params || {} };
    } else {
      return;
    }

    const newPath = routeToPath(newRoute);
    if (newPath !== window.location.pathname + window.location.search) {
      window.history.pushState(null, '', newPath);
    }

    // ─── FIX (juin 2026) : dispatch yaram-route-back AUSSI sur navigate() programmatique ───
    // Avant : l'event ne firait que sur popstate (vrai back button). Donc quand l'user
    // tape Home / Orders / Cart dans la TabBar (= navigate() pushState), les pages
    // n'avaient AUCUN signal pour invalider leur cache → données stale au retour.
    // Maintenant : on dispatch toujours, et les handlers décident quoi faire selon to.name.
    // Le payload inclut `from` pour permettre des heuristiques fines plus tard.
    try {
      const prevRoute = route;
      window.dispatchEvent(new CustomEvent('yaram-route-back', {
        detail: { to: newRoute, from: prevRoute, source: 'navigate' },
      }));
    } catch { /* ignore */ }

    setRoute(newRoute);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const goBack = () => {
    // Si on est déjà sur Home (root), faire un back n'a aucun sens et peut
    // bloquer iOS (history vide → rien). On gère le cas explicitement.
    if (route?.name === 'home' || !route?.name) {
      return; // déjà à la racine
    }
    // Si window.history a au moins 1 entry à revenir → back normal
    if (window.history.length > 1) {
      window.history.back();
      // Fallback : si après 200ms popstate n'a pas fire (cas rare iOS),
      // on force le navigate vers home pour ne pas laisser l'user bloqué.
      const before = window.location.pathname;
      setTimeout(() => {
        if (window.location.pathname === before) {
          // popstate n'a pas marché → on force le retour Home
          navigate('/');
        }
      }, 200);
    } else {
      // Pas d'historique → navigate direct vers Home
      navigate('/');
    }
  };

  const refreshUser = async (directUser) => {
    // Permet refreshUser(null) explicite pour deconnecter immediatement
    if (directUser !== undefined) {
      setUser(directUser);
      // ANALYTICS : reset PostHog session quand user se deconnecte
      if (directUser === null) {
        try { resetAnalytics(); } catch {}
      }
      return;
    }
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch (e) {
      console.error('refreshUser error:', e);
    }
  };

  // ─── ANALYTICS : identify quand user disponible, pageview à chaque route ───
  useEffect(() => {
    if (user?.id) {
      try { identifyUser(user); } catch {}
    }
  }, [user?.id]);

  useEffect(() => {
    if (route?.name) {
      try { trackPageview(route.name); } catch {}
    }
  }, [route?.name, route?.params?.id, route?.params?.orderId, route?.params?.scanId]);

  // ─── SPLASH (auth pas check OU splash min duration pas atteint) ───
  if (!authChecked || !splashDone) {
    return <SplashScreen />;
  }

  // ─── ROUTES PUBLIQUES (avant gates auth/skin_type) ───
  // Ces routes doivent fonctionner SANS être connecté à YARAM.
  // Ex : /sign/:token → pharmacien qui signe un contrat, il n'a pas de compte client.
  // Ex : /wishlist/:slug → liste publique partagée (WhatsApp, etc.), pas d'auth.
  if (route.name === 'wishlist_shared') {
    return (
      <NavContext.Provider value={{ navigate, goBack, route }}>
        <UserContext.Provider value={{ user, refreshUser }}>
          <div className="app-shell app-shell--site">
            <ErrorBoundary key="wishlist-shared-eb">
              <Suspense fallback={<LazyFallback />}>
                <WishlistShared slug={route.params?.slug} />
              </Suspense>
            </ErrorBoundary>
          </div>
          <Toaster />
        </UserContext.Provider>
      </NavContext.Provider>
    );
  }

  if (route.name === 'sign') {
    return (
      <NavContext.Provider value={{ navigate, goBack, route }}>
        <UserContext.Provider value={{ user, refreshUser }}>
          {/* app-shell--site : libère le scroll natif via html:has() dans index.css */}
          <div className="app-shell app-shell--site">
            <ErrorBoundary key="sign-eb">
              <Suspense fallback={<LazyFallback />}>
                <SignPage />
              </Suspense>
            </ErrorBoundary>
          </div>
          <Toaster />
        </UserContext.Provider>
      </NavContext.Provider>
    );
  }

  // ─── Route publique merchant onboarding (bypass auth gate) ─────
  // Pharmacie qui suit son onboarding sans compte YARAM.
  if (route.name === 'merchant_onboarding') {
    return (
      <NavContext.Provider value={{ navigate, goBack, route }}>
        <UserContext.Provider value={{ user, refreshUser }}>
          <div className="app-shell app-shell--site">
            <ErrorBoundary key="merchant-onboarding-eb">
              <Suspense fallback={<LazyFallback />}>
                <MerchantOnboarding applicationId={route.params?.applicationId} />
              </Suspense>
            </ErrorBoundary>
          </div>
          <Toaster />
        </UserContext.Provider>
      </NavContext.Provider>
    );
  }

  // ─── Blog SEO : route publique (bypass onboarding + skin quiz) ───
  // Un lecteur qui arrive de Google sur /blog/xxx doit voir l article
  // directement, sans onboarding forcé.
  if (route.name === 'blog' || route.name === 'blog_article' || route.name === 'blog_category') {
    const BlogPage = route.name === 'blog_article'
      ? BlogArticle
      : route.name === 'blog_category'
        ? BlogCategory
        : BlogHome;
    return (
      <NavContext.Provider value={{ navigate, goBack, route }}>
        <UserContext.Provider value={{ user, refreshUser }}>
          <div className="app-shell app-shell--site">
            <ErrorBoundary key={`blog-${route.name}-eb`}>
              <Suspense fallback={<LazyFallback />}>
                <BlogPage />
              </Suspense>
            </ErrorBoundary>
          </div>
          <Toaster />
        </UserContext.Provider>
      </NavContext.Provider>
    );
  }

  if (!user) {
    return (
      <NavContext.Provider value={{ navigate, goBack, route }}>
        <UserContext.Provider value={{ user, refreshUser }}>
          {/* app-shell--site : full-width responsive, plus de frame iPhone */}
          <div className="app-shell app-shell--site">
            <Onboarding onComplete={refreshUser} />
            <InstallPrompt />
          </div>
          <Toaster />
        </UserContext.Provider>
      </NavContext.Provider>
    );
  }

  if (user && !user.skin_type) {
    return (
      <NavContext.Provider value={{ navigate, goBack, route }}>
        <UserContext.Provider value={{ user, refreshUser }}>
          <div className="app-shell app-shell--site">
            <Suspense fallback={<LazyFallback />}>
              <SkinQuiz onComplete={refreshUser} />
            </Suspense>
            <InstallPrompt />
          </div>
          <Toaster />
        </UserContext.Provider>
      </NavContext.Provider>
    );
  }

  let page;
  switch (route.name) {
    case 'search': page = <Search initialCategory={route.params?.category} initialBrand={route.params?.brand} />; break;
    case 'product': page = <ProductPage />; break;
    // Pour conserver l'ancienne version mobile-first si besoin : <Product id={route.params.id} />
    case 'product_legacy': page = <Product id={route.params.id} />; break;
    case 'cart': page = <CartPage />; break;
    case 'cart_legacy': page = <Cart />; break;
    case 'checkout': page = <CheckoutPage />; break;
    case 'checkout_legacy': page = <Checkout items={route.params.items} paymentMethod={route.params.paymentMethod} />; break;
    case 'brand': page = <BrandPage />; break;
    case 'brand_detail': page = <BrandPage />; break;
    case 'bundle': page = <Suspense fallback={<LazyFallback />}><BundlePage /></Suspense>; break;
    case 'productPage': page = <ProductPage />; break;
    case 'sign': page = <SignPage />; break;
    case 'payment': page = <Payment orderId={route.params.orderId} mode={route.params.mode} />; break;
    case 'order_tracking': page = <OrderTracking orderId={route.params.orderId} />; break;
    case 'orders': page = <Orders />; break;
    case 'profile': page = <Profile />; break;
    case 'pharmacies': page = <Pharmacies />; break;
    case 'pharmacy_detail': page = <PharmacyDetail pharmacyId={route.params.id} />; break;
    case 'scan': page = <Scan />; break;
    case 'scan_result': page = <ScanResult scanId={route.params.scanId} />; break;
    case 'scan_history': page = <ScanHistory />; break;
    case 'addresses': page = <Addresses />; break;
    case 'favorites': page = <Favorites />; break;
    case 'payments': page = <Payments />; break;
    case 'evolution': page = <Evolution />; break;
    case 'categories': page = <Categories />; break;
    case 'quiz': page = <SkinQuiz onComplete={refreshUser} />; break;
    case 'loyalty': page = <Loyalty />; break;
    case 'referral': page = <Referral />; break;
    case 'subscriptions': page = <Suspense fallback={<LazyFallback />}><Subscriptions /></Suspense>; break;
    case 'premium_concierge': page = <Suspense fallback={<LazyFallback />}><PremiumConcierge /></Suspense>; break;
    case 'trade_in': page = <Suspense fallback={<LazyFallback />}><TradeIn /></Suspense>; break;
    case 'ar_tryon': page = <Suspense fallback={<LazyFallback />}><ARTryOn /></Suspense>; break;
    // notifications = vraie liste (Notifications.jsx)
    // notif_settings = paramètres push/email (NotifSettings.jsx)
    case 'notifications': page = <Notifications />; break;
    case 'notif_settings': page = <NotifSettings />; break;
    case 'promos': page = <Promos />; break;
    case 'help': page = <Help />; break;
    case 'international': page = <Suspense fallback={<LazyFallback />}><International /></Suspense>; break;
    case 'privacy': page = <Suspense fallback={<LazyFallback />}><Privacy /></Suspense>; break;
    case 'terms': page = <Suspense fallback={<LazyFallback />}><Terms /></Suspense>; break;
    case 'mentions': page = <Suspense fallback={<LazyFallback />}><MentionsLegales /></Suspense>; break;
    case 'delete_account': page = <Suspense fallback={<LazyFallback />}><DeleteAccount /></Suspense>; break;
    case 'newsletter': page = <Suspense fallback={<LazyFallback />}><Newsletter /></Suspense>; break;
    case 'brands': page = <Suspense fallback={<LazyFallback />}><BrandsPage /></Suspense>; break;
    case 'partner-application': page = <Suspense fallback={<LazyFallback />}><PartnerApplication /></Suspense>; break;
    case 'driver-application':  page = <Suspense fallback={<LazyFallback />}><DriverApplication /></Suspense>; break;
    case 'corporate':           page = <Suspense fallback={<LazyFallback />}><CorporateApply /></Suspense>; break;
    case 'corporate_dashboard': page = <Suspense fallback={<LazyFallback />}><CorporateDashboard /></Suspense>; break;
    // ─── Landing = home marketing (style Uber/DoorDash) ───
    case 'landing': page = <Landing />; break;
    // ─── Shop = nouvelle home e-commerce premium (DoorDash-style) ───
    case 'shop': page = <ShopHome />; break;
    // ─── Home = ancienne home mobile-first (PWA app preview) ───
    case 'home': page = <Home />; break;
    default: page = <Landing />;
  }

  // ════════════════════════════════════════════════════════════════
  // FIX juin 2026 #9 (CAUSE RACINE PAGE BLANCHE TOUTES PAGES AU RETOUR BG)
  //
  // AVANT : pageKey = route.name + params + '-r' + resumeCount
  //   → resumeCount s'incrémentait à chaque retour de background (>60s)
  //   → key change → REMOUNT COMPLET de TOUTES les pages
  //   → tous les useState reset (loading=true) → skeletons partout
  //   → user excédé qui dit "TOUTES les pages galère au retour"
  //
  // APRÈS : pageKey stable = route.name + params (sans resumeCount)
  //   → pas de remount au retour de background
  //   → les pages gardent leur state local + leur cache TanStack
  //   → handleAppResume() (main.jsx) déclenche focusManager.setFocused(true)
  //     qui fait du refetch INTELLIGENT en background des queries stale
  //   → l'UI reste peuplée pendant que les données se rafraîchissent
  // ════════════════════════════════════════════════════════════════
  const pageKey = route.name + (route.params ? JSON.stringify(route.params) : '');

  // ─── Site mode : TOUTES les routes s'affichent en pleine largeur desktop.
  //     On garde la Set uniquement pour permettre à des routes futures d'opter-out
  //     si on veut vraiment un mockup mobile (aujourd'hui : aucune).
  // Juillet 2026 : conversion complète app cliente → site responsive pour qu'elle
  // matche le style Uber/DoorDash déjà appliqué au /shop et à /landing.
  const APP_MOCKUP_ONLY_ROUTES = new Set([
    // Vide pour l'instant — toutes les routes doivent être responsive.
    // Ajoute ici si un jour tu veux forcer un frame mobile pour une preview app.
  ]);
  const isSiteMode = !APP_MOCKUP_ONLY_ROUTES.has(route.name);

  return (
    <NavContext.Provider value={{ navigate, goBack, route }}>
      <UserContext.Provider value={{ user, refreshUser }}>
        <div className={`app-shell ${isSiteMode ? 'app-shell--site' : ''}`}>
          {/* ErrorBoundary global : capture les exceptions de render et affiche
              un fallback visible au lieu d'écran blanc silencieux. */}
          <ErrorBoundary key={pageKey + '-eb'}>
            <Suspense fallback={<LazyFallback />} key={pageKey}>{page}</Suspense>
          </ErrorBoundary>
          <InstallPrompt />
          {/* Banner "Ouvrir dans l'app YARAM" — mobile web only, dismissible 7j.
              Interne au composant : matchMedia + UA + display-mode standalone. */}
          <OpenInAppBanner />
        </div>
        <NetworkStatus />
        <Toaster />
        <Suspense fallback={null}><SupportChatWidget /></Suspense>
        {activePromo && (
          <InterstitialPromo
            promo={activePromo}
            onClose={() => setActivePromo(null)}
          />
        )}
      </UserContext.Provider>
    </NavContext.Provider>
  );
}
