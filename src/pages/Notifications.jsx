import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNav, useUser } from '../App';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotificationsCount,
} from '../lib/supabase';
import { usePersistedData } from '../lib/usePersistedData';
import TabBar from '../components/TabBar';
import { toast } from '../lib/toast';
import './Notifications.css';

// ─── Page Notifications — VRAI journal commande/paiement/livraison ────
// - Lit `public.notifications` filtré par user (RLS auto via auth.uid())
// - Real-time : nouvelle notif arrive → liste se met à jour sans refresh
// - Tap sur notif → marque comme lue + navigue vers notif.url (ex: /order/<id>)
// - Bouton "Tout lire" en haut à droite
// - Empty state propre + skeleton loading
// - Grouping par jour : Aujourd'hui / Hier / Cette semaine / Plus ancien
// - Pull to refresh (geste tactile) + bouton refresh visuel
// ─────────────────────────────────────────────────────────────────────────

function timeAgo(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Icône selon contexte (type + titre, pour mapper statuts commande) ─
function pickIcon(n) {
  const title = (n.title || '').toLowerCase();
  const type = (n.type || '').toLowerCase();

  // Détection fine par titre (notifs cycle commande)
  if (title.includes('payé') || title.includes('paiement validé') || title.includes('acompte')) return '';
  if (title.includes('paiement') && (title.includes('refus') || title.includes('échou'))) return '';
  if (title.includes('paiement')) return '';
  if (title.includes('prépar')) return '';
  if (title.includes('prête') || title.includes('pret')) return '';
  if (title.includes('route') || title.includes('chemin') || title.includes('livreur')) return '';
  if (title.includes('livré') || title.includes('réception confirm')) return '';
  if (title.includes('annul')) return '';
  if (title.includes('contest') || title.includes('litige')) return '';
  if (title.includes('transit') || title.includes('import') || title.includes('international')) return '';
  if (title.includes('solde')) return '';
  if (title.includes('confirme') || title.includes('confirm')) return '';

  switch (type) {
    case 'order_status':
    case 'order':       return '';
    case 'payment':     return '';
    case 'delivery':    return '';
    case 'promo':       return '';
    case 'welcome':     return '';
    case 'review':      return '';
    case 'reminder':    return '';
    default:            return '';
  }
}

// ─── Variante accent visuel (couleur de fond icône) ────────────────────
function pickAccent(n) {
  const title = (n.title || '').toLowerCase();
  if (title.includes('livré') || title.includes('payé') || title.includes('validé')) return 'success';
  if (title.includes('refus') || title.includes('annul') || title.includes('échou')) return 'danger';
  if (title.includes('contest') || title.includes('attente') || title.includes('solde')) return 'warning';
  if (title.includes('prépar') || title.includes('prête') || title.includes('route')
      || title.includes('livreur') || title.includes('transit')) return 'info';
  return null;
}

// ─── Bucketize par "fraîcheur" pour les sections du journal ────────────
function bucketOf(date) {
  if (!date) return 'older';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86400000;
  const startWeek = startToday - 6 * 86400000;
  const t = d.getTime();
  if (t >= startToday) return 'today';
  if (t >= startYesterday) return 'yesterday';
  if (t >= startWeek) return 'week';
  return 'older';
}

const BUCKET_LABEL = {
  today:     'Aujourd\'hui',
  yesterday: 'Hier',
  week:      'Cette semaine',
  older:     'Plus ancien',
};
const BUCKET_ORDER = ['today', 'yesterday', 'week', 'older'];

// ─── Catégorie (Gmail-style sidebar filter) ────────────────────────────
function categoryOf(n) {
  const t = (n.type || '').toLowerCase();
  const title = (n.title || '').toLowerCase();
  if (t.startsWith('order') || t === 'payment' || t === 'delivery'
      || title.includes('commande') || title.includes('livr') || title.includes('paiement')) {
    return 'orders';
  }
  if (t === 'promo' || title.includes('promo') || title.includes('code') || title.includes('offre')) {
    return 'promos';
  }
  return 'system';
}

const CATEGORY_TABS = [
  { id: 'all',    label: 'Toutes',    icon: '' },
  { id: 'orders', label: 'Commandes', icon: '' },
  { id: 'promos', label: 'Promos',    icon: '' },
  { id: 'system', label: 'Système',   icon: '' },
];

export default function Notifications() {
  const { navigate } = useNav();
  const { user } = useUser();
  const [markingAll, setMarkingAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('all');

  // Pull-to-refresh : on track touchstart Y, et si delta > seuil → reload
  const mainRef = useRef(null);
  const touchStartY = useRef(null);
  const pullDelta = useRef(0);

  // FIX juin 2026 : usePersistedData → hydrate depuis cache au remount.
  // Plus de skeleton 1-3s au retour de navigation / foreground.
  const { data: notifsData, loading, refresh: refreshNotifs, setData: setNotifs } = usePersistedData(
    `notifications-${user?.id || 'anon'}`,
    async () => {
      const list = await getMyNotifications(100);
      return list || [];
    },
    { ttl: 2 * 60 * 1000, enabled: !!user?.id }
  );
  const notifs = notifsData || [];

  const load = useCallback(async () => {
    try {
      await refreshNotifs();
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotifs]);

  // ─── Real-time subscription : nouvelle notif arrive → refresh liste ───
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeNotificationsCount(user.id, () => {
      load();
    });
    return unsub;
  }, [user?.id, load]);

  // ─── Pull-to-refresh natif (touch) ────────────────────────────────────
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop > 4) return; // déjà scrollé → pas de PTR
      touchStartY.current = e.touches[0].clientY;
      pullDelta.current = 0;
    };
    const onTouchMove = (e) => {
      if (touchStartY.current == null) return;
      pullDelta.current = e.touches[0].clientY - touchStartY.current;
    };
    const onTouchEnd = async () => {
      const delta = pullDelta.current;
      touchStartY.current = null;
      pullDelta.current = 0;
      if (delta > 70 && !refreshing) {
        setRefreshing(true);
        await load();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: true });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [load, refreshing]);

  const handleTap = async (notif) => {
    if (!notif.read) {
      // Optimistic UI
      setNotifs(notifs.map(n => n.id === notif.id ? { ...n, read: true } : n));
      markNotificationRead(notif.id).catch(() => { /* swallow */ });
    }
    // Navigation : url = chemin interne (/order/abc) ou route name
    if (notif.url) {
      if (notif.url.startsWith('/')) {
        // Chemin → push history + popstate (App.jsx écoute popstate pour router)
        window.history.pushState(null, '', notif.url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        navigate({ name: notif.url, params: {} });
      }
    }
  };

  const handleMarkAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    // Optimistic
    setNotifs(notifs.map(n => ({ ...n, read: true })));
    const count = await markAllNotificationsRead();
    setMarkingAll(false);
    if (count > 0) toast.success(`${count} notification${count > 1 ? 's' : ''} marquée${count > 1 ? 's' : ''} lue${count > 1 ? 's' : ''}`);
  };

  const unreadCount = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);

  // ─── Counts par catégorie (Gmail-style sidebar badge) ─────────────────
  const categoryCounts = useMemo(() => {
    const c = { all: 0, orders: 0, promos: 0, system: 0 };
    for (const n of notifs) {
      if (!n.read) {
        c.all++;
        c[categoryOf(n)]++;
      }
    }
    return c;
  }, [notifs]);

  // ─── Notifs filtrées par catégorie (UI-only, aucun refetch RPC) ───────
  const filteredNotifs = useMemo(() => {
    if (category === 'all') return notifs;
    return notifs.filter((n) => categoryOf(n) === category);
  }, [notifs, category]);

  // ─── Grouping par bucket de fraîcheur ─────────────────────────────────
  const grouped = useMemo(() => {
    const map = { today: [], yesterday: [], week: [], older: [] };
    for (const n of filteredNotifs) {
      map[bucketOf(n.sent_at)].push(n);
    }
    return map;
  }, [filteredNotifs]);

  return (
    <div className="notif-screen page-anim">
      <header className="notif-header">
        <button className="icon-back-btn" onClick={() => navigate(-1)} aria-label="Retour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div className="notif-header-title">
          <h1>Notifications</h1>
          {unreadCount > 0 && <p>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>}
        </div>
        {unreadCount > 0 && (
          <button
            className="notif-mark-all"
            onClick={handleMarkAll}
            disabled={markingAll}
            aria-busy={markingAll}
          >
            {markingAll ? '…' : 'Tout lire'}
          </button>
        )}
      </header>

      {/* Mobile category tabs (visible < 900px) */}
      <nav className="notif-tabs" role="tablist" aria-label="Catégories notifications">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={category === tab.id}
            className={`notif-tab ${category === tab.id ? 'active' : ''}`}
            onClick={() => setCategory(tab.id)}
          >
            <span className="notif-tab-icon" aria-hidden>{tab.icon}</span>
            <span className="notif-tab-label">{tab.label}</span>
            {categoryCounts[tab.id] > 0 && (
              <span className="notif-tab-count">{categoryCounts[tab.id]}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="notif-body">
        {/* Desktop sidebar (visible ≥ 900px) — Gmail style */}
        <aside className="notif-sidebar" aria-label="Filtres">
          <div className="notif-sidebar-title">Catégories</div>
          <ul className="notif-sidebar-list">
            {CATEGORY_TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  className={`notif-sidebar-item ${category === tab.id ? 'active' : ''}`}
                  onClick={() => setCategory(tab.id)}
                  aria-current={category === tab.id ? 'true' : undefined}
                >
                  <span className="notif-sidebar-icon" aria-hidden>{tab.icon}</span>
                  <span className="notif-sidebar-label">{tab.label}</span>
                  {categoryCounts[tab.id] > 0 && (
                    <span className="notif-sidebar-count">{categoryCounts[tab.id]}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

      <main className="notif-main" ref={mainRef}>
        {refreshing && (
          <div className="notif-refresh-indicator" aria-live="polite">
            <span className="notif-refresh-spinner" />
            Actualisation…
          </div>
        )}

        {loading && (
          <div className="notif-skeletons">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="notif-skeleton" />
            ))}
          </div>
        )}

        {!loading && notifs.length === 0 && (
          <div className="notif-empty">
            <div className="notif-empty-icon"></div>
            <h3>Pas encore d'activité</h3>
            <p>Le journal de tes commandes et livraisons apparaîtra ici : paiement validé, préparation, livreur en route, livraison…</p>
            <button className="btn-primary" onClick={() => navigate({ name: 'home', params: {} })}>
              Découvrir le catalogue →
            </button>
          </div>
        )}

        {!loading && notifs.length > 0 && (
          <div className="notif-groups">
            {BUCKET_ORDER.map((bucket) => {
              const items = grouped[bucket];
              if (!items || items.length === 0) return null;
              return (
                <section key={bucket} className="notif-group">
                  <h2 className="notif-group-title">{BUCKET_LABEL[bucket]}</h2>
                  <ul className="notif-list">
                    {items.map((n, idx) => {
                      const accent = pickAccent(n);
                      return (
                        <li
                          key={n.id}
                          className={`notif-item ${n.read ? 'read' : 'unread'}${accent ? ' accent-' + accent : ''}`}
                          style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                          onClick={() => handleTap(n)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleTap(n); }}
                        >
                          <div className="notif-item-icon">
                            {n.icon
                              ? <img src={n.icon} alt="" loading="lazy" decoding="async" />
                              : <span>{pickIcon(n)}</span>}
                          </div>
                          <div className="notif-item-body">
                            <div className="notif-item-head">
                              <strong className="notif-item-title">{n.title || 'YARAM'}</strong>
                              <span className="notif-item-time">{timeAgo(n.sent_at)}</span>
                            </div>
                            {n.body && <p className="notif-item-text">{n.body}</p>}
                            {n.url && n.url.startsWith('/order/') && (
                              <span className="notif-item-cta">Voir le suivi →</span>
                            )}
                          </div>
                          {!n.read && <span className="notif-item-dot" aria-label="Non lue" />}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {!loading && notifs.length > 0 && filteredNotifs.length === 0 && (
          <div className="notif-empty">
            <div className="notif-empty-icon"></div>
            <h3>Rien dans cette catégorie</h3>
            <p>Aucune notification ne correspond au filtre choisi pour le moment.</p>
            <button className="btn-primary" onClick={() => setCategory('all')}>
              Voir tout
            </button>
          </div>
        )}

        <div style={{ height: 100 }} />
      </main>
      </div>

      <TabBar active="notifications" />
    </div>
  );
}
