import { useNav, useUser } from '../App';
import { invalidateCache, supabase } from '../lib/supabase';
import { useMyOrders } from '../lib/queries';
import { safeFormatDate } from '../lib/utils';
import TabBar from '../components/TabBar';
import PullToRefresh from '../components/PullToRefresh';
import './Orders.css';

// Libellés statut alignés 1:1 sur l'app native (couleurs + copy)
const STATUS_LABEL = {
  pending_payment:       { label: 'En attente paiement', color: '#F59E0B', bg: '#FEF3C7' },
  pending:               { label: 'En attente paiement', color: '#F59E0B', bg: '#FEF3C7' },
  awaiting_verification: { label: 'Vérification',        color: '#F59E0B', bg: '#FEF3C7' },
  paid:                  { label: 'Payée',               color: '#1F8B4C', bg: '#DCFCE7' },
  confirmed:             { label: 'Confirmée',           color: '#1F8B4C', bg: '#DCFCE7' },
  preparing:             { label: 'En préparation',      color: '#1F8B4C', bg: '#DCFCE7' },
  shipped:               { label: 'En livraison',        color: '#0064B0', bg: '#DBEAFE' },
  in_delivery:           { label: 'En livraison',        color: '#0064B0', bg: '#DBEAFE' },
  delivered:             { label: 'Livrée',              color: '#16A34A', bg: '#DCFCE7' },
  cancelled:             { label: 'Annulée',             color: '#9CA3AF', bg: '#F3F4F6' },
};

export default function Orders() {
  const { navigate } = useNav();
  const { user } = useUser();

  // ════════════════════════════════════════════════════════════════
  //  TanStack Query : cold start INSTANT + retour navigation FLUIDE
  //  - Cache mémoire 1 min + persistance IndexedDB 24h
  //  - placeholderData: keepPreviousData → l'UI reste peuplée pendant
  //    le refetch silencieux au retour de navigation (plus de skeletons figés)
  //  - refetchOnMount: 'always' → données toujours fraîches au retour
  //  - handleAppResume() global (main.jsx) gère le retour foreground iOS
  //
  //  FIX juin 2026 : on a SUPPRIMÉ le useEffect manuel d'invalidation
  //  qui créait une double-race avec refetchOnMount + placeholderData
  //  (skeletons figés en permanence au retour de navigation).
  // ════════════════════════════════════════════════════════════════
  const { data: orders = [], isLoading, isFetching, refetch } = useMyOrders(user?.id);
  // Loading = true UNIQUEMENT si on n'a JAMAIS eu de data (vrai cold start).
  // Au retour navigation, on a déjà des orders en cache (placeholderData)
  // → isLoading=false, on affiche les vraies données pendant le refetch.
  const loading = isLoading && !orders.length;

  // Pull-to-refresh : on invalide le cache legacy ET TanStack
  const handlePullRefresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) invalidateCache(`my_orders_${session.user.id}`);
      await refetch();
      await new Promise(r => setTimeout(r, 300));
    } catch { /* silent */ }
  };

  return (
    <div className="orders-screen page-anim">
      <div className="orders-header">
        <button className="icon-back-btn" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h1>Mes commandes</h1>
      </div>

      <div className="orders-scroll">
        <PullToRefresh onRefresh={handlePullRefresh}>
        {loading ? (
          /* PERF : skeleton rows qui ressemblent à des order cards */
          <div style={{ padding: '12px 16px' }}>
            {[0, 1, 2].map((i) => (
              <div key={'sk-' + i} style={{
                display: 'flex', gap: 12, padding: 14, marginBottom: 12,
                background: '#fff', borderRadius: 14, border: '1px solid #eef3f0', opacity: 0.6,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'linear-gradient(90deg, #eef3f0 0%, #f7faf8 50%, #eef3f0 100%)', backgroundSize: '200% 100%', animation: 'yaramShimmer 1.4s linear infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '70%', height: 14, background: '#eef3f0', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ width: '40%', height: 11, background: '#eef3f0', borderRadius: 4 }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes yaramShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
          </div>
        ) : orders.length === 0 ? (
          <div className="orders-empty">
            <div style={{fontSize: 64, opacity: 0.2}}></div>
            <h3>Aucune commande</h3>
            <p>Tes commandes apparaîtront ici</p>
          </div>
        ) : (
          orders.map(o => {
            const status = STATUS_LABEL[o.status] || STATUS_LABEL.pending_payment;
            const dateStr = safeFormatDate(o.created_at, { type: 'datetime' });
            return (
              <button
                key={o.id}
                className="order-card"
                onClick={() => navigate({ name: 'order_tracking', params: { orderId: o.id } })}
              >
                <div className="order-card-head">
                  {/* Pastille statut colorée alignée native */}
                  <span
                    className="order-status-pill"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: status.bg,
                      color: status.color,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 0.2,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: status.color }} />
                    {status.label}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {o.is_preorder && (
                      <span style={{
                        background: 'linear-gradient(135deg,#0066CC,#004999)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        letterSpacing: 0.3,
                      }}>IMPORT</span>
                    )}
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{dateStr}</span>
                  </div>
                </div>
                <div className="order-card-body">
                  <span>{(o.items?.length || 0)} article{(o.items?.length || 0) > 1 ? 's' : ''} · {Number(o.total || 0).toLocaleString('fr-FR')} FCFA</span>
                  <code style={{ fontSize: 10, color: '#94A3B8' }}>#{String(o.id).slice(-6).toUpperCase()}</code>
                </div>
                {o.is_preorder && o.expected_arrival_date && (
                  <div style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px dashed var(--line)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>Arrivée prévue : {safeFormatDate(o.expected_arrival_date)}</span>
                    <span style={{ color: '#0066CC', fontWeight: 600 }}>
                      {o.deposit_paid_at ? 'Acompte payé' : 'Acompte en attente'}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
        </PullToRefresh>
      </div>
      <TabBar />
    </div>
  );
}