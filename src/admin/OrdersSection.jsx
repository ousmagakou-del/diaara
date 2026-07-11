import { useState, useEffect, useRef } from 'react';
import { getCachedSetting, supabase } from '../lib/supabase';
import {
  adminListOrders,
  adminUpdateOrder,
  adminSearchOrders,
  adminLogAction,
  adminConfirmPayment,
  adminConfirmBalancePayment,
  adminRejectPayment,
} from '../lib/adminApi';
import { getAdminSession } from '../lib/adminAuth';
import { confirmDialog, toast } from '../lib/toast';
import { pushOrderStatus } from '../lib/pushAdmin';
import { sendOrderConfirmation, sendPaymentVerified, sendOrderStatusUpdate } from '../lib/emails';

// ─── FLOW IMPORT (commandes is_preorder=true) ───────────────────────────
// Un flow parallele au flow standard, dedie aux commandes d'import
// international (~10-15j). L'admin fait avancer manuellement chaque
// etape depuis le drawer detail. Sequence :
//   paid -> awaiting_supplier -> in_transit_intl -> arrived_local
//        -> awaiting_balance -> ready -> shipped -> delivered
// A chaque transition on : (1) audit `order_import_status_change`,
// (2) push OneSignal, (3) email Resend (templates importSupplierOrdered,
// importInTransit, importArrivedDakar, importBalanceReminder). A partir
// du moment ou la cliente a paye le solde (bouton "Forcer marquer solde
// paye", superadmin only) on rebascule sur le flow normal (ready ->
// shipped -> delivered) gere par les boutons standards + livreur.
// ────────────────────────────────────────────────────────────────────────

// ─── Fire-and-forget helper ──────────────────────────────────────────
// Toutes les notifs admin (email + push) doivent etre best-effort. Si
// Resend ou OneSignal est down, on ne bloque jamais le flow admin :
// on log un warn et on continue. Promise.allSettled + timeout 4s pour
// eviter qu'une lambda Resend qui timeout ne bloque indefiniment.
function safeFire(label, promiseFactory) {
  try {
    const p = promiseFactory();
    if (!p || typeof p.then !== 'function') return;
    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ success: false, error: 'timeout' }), 4000)
    );
    Promise.race([p, timeout])
      .then((r) => {
        if (r?.success === false) {
          console.warn(`[admin/${label}]`, r?.error || 'unknown');
        }
      })
      .catch((e) => console.warn(`[admin/${label}] crash:`, e?.message));
  } catch (e) {
    console.warn(`[admin/${label}] sync crash:`, e?.message);
  }
}

// Flow lineaire des statuts "normaux" d'une commande. Une commande peut sortir
// de ce flow (refused, cancelled, disputed...) et ne plus etre "avancable".
const STATUS_FLOW = ['pending_payment', 'paid', 'preparing', 'ready', 'shipped', 'awaiting_confirm', 'delivered'];
const STATUS_LABELS = {
  pending_payment:        { label: 'Paiement en attente',  color: 'medium',    emoji: '⏳' },
  awaiting_verification:  { label: 'À vérifier',           color: 'medium',    emoji: '💰' },
  paid:                   { label: 'Payée',                color: 'good',      emoji: '✅' },
  confirmed:              { label: 'Confirmée',            color: 'good',      emoji: '✅' },
  preparing:         { label: 'En préparation',       color: 'good',      emoji: '📦' },
  ready:             { label: 'Prête à livrer',       color: 'good',      emoji: '✔️' },
  shipped:           { label: 'En route',             color: 'excellent', emoji: '🛵' },
  awaiting_cash:     { label: 'Encaissement cash',    color: 'medium',    emoji: '💵' },
  awaiting_confirm:  { label: 'Confirm cliente',      color: 'medium',    emoji: '⌛' },
  client_confirmed:  { label: 'Confirmée cliente',    color: 'excellent', emoji: '🤝' },
  delivered:         { label: 'Livrée',               color: 'excellent', emoji: '🎉' },
  cancelled:         { label: 'Annulée',              color: 'bad',       emoji: '❌' },
  refused:           { label: 'Refusée',              color: 'bad',       emoji: '🚫' },
  disputed:          { label: 'Litige',               color: 'bad',       emoji: '⚠️' },
  // ─── Statuts flow IMPORT (uniquement pour is_preorder=true) ───
  awaiting_supplier: { label: 'Cmd fournisseur',      color: 'medium',    emoji: '📦' },
  in_transit_intl:   { label: 'Transit intl',         color: 'medium',    emoji: '✈️' },
  arrived_local:     { label: 'Arrivé Dakar',         color: 'good',      emoji: '🛬' },
  awaiting_balance:  { label: 'Attente solde',        color: 'medium',    emoji: '💳' },
};

// Statuts qui appartiennent au flow import "en cours" (avant retour au
// flow normal ready/shipped/delivered). Utilise pour le filtre header et
// le badge "Import en cours".
const IMPORT_FLOW_STATUSES = new Set([
  'paid',
  'awaiting_supplier',
  'in_transit_intl',
  'arrived_local',
  'awaiting_balance',
]);

const PAGE_SIZE = 50;

// ─── Utilities pour le tab "À vérifier" ────────────────────────────────
// Formate "il y a 2h 14min" depuis un timestamp ISO. Si null → "—".
function formatWaitSince(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const min = Math.floor(ms / 60000);
  if (min < 1)   return 'à l\'instant';
  if (min < 60)  return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24)    return `il y a ${h}h ${rest}min`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j ${h % 24}h`;
}

// SLA : seuils en ms (1h / 4h). Retourne null / 'warn' / 'crit'.
function slaLevel(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms >= 4 * 3600_000) return 'crit';
  if (ms >= 1 * 3600_000) return 'warn';
  return null;
}

export default function OrdersSection() {
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState(false); // true => résultats viennent de admin_search_orders
  const searchTimerRef = useRef(null);

  // Compteur live des commandes en awaiting_verification (badge sur le tab).
  // On le tient à jour indépendamment de la page courante pour qu'il reste
  // visible même quand l'admin filtre par autre chose.
  const [pendingVerifCount, setPendingVerifCount] = useState(0);

  // Force-refresh des temps "il y a Xmin" et de l'indicateur SLA chaque minute,
  // sans re-fetcher la DB.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Récupère le count des awaiting_verification (toutes pages confondues).
  const refreshVerifCount = async () => {
    const { count } = await adminListOrders({ limit: 1, offset: 0, status: 'awaiting_verification' });
    setPendingVerifCount(count || 0);
  };
  useEffect(() => { refreshVerifCount(); }, []);

  // Re-fetch quand on change de page OU de filtre — sauf si on est en
  // mode recherche full-table (autonome).
  useEffect(() => {
    if (searchMode) return;
    refresh();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [page, filter, searchMode]);

  // Debounce recherche full-table : tape 300ms après la dernière frappe,
  // on tape admin_search_orders qui scanne TOUTE la table.
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = search.trim();
    if (!q) {
      // Sortie du mode recherche => re-charger la page courante
      if (searchMode) {
        setSearchMode(false);
        setPage(0);
      }
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setLoading(true);
      setSearchMode(true);
      const { data, count, error } = await adminSearchOrders({ query: q, limit: PAGE_SIZE, offset: 0 });
      if (error) {
        if (error.message === 'admin_session_expired') {
          toast.error('Session admin expirée — reconnexion requise');
        }
        setOrders([]);
        setTotalCount(0);
      } else {
        setOrders(data || []);
        setTotalCount(count || 0);
        setPage(0);
      }
      setLoading(false);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [search]);

  const refresh = async () => {
    setLoading(true);
    try {
      // Phase 2 RLS : on passe par la RPC admin_list_orders (token requis,
      // SECURITY DEFINER cote DB). Le filtre 'active' est applique cote client
      // pour rester sur le seul parametre p_status que la RPC accepte.
      // Idem pour 'imports_active' qui est un filtre compose (is_preorder
      // + status IN import_flow) qu'on applique cote client.
      const isCompoundFilter = (filter === 'all' || filter === 'active' || filter === 'imports_active');
      const status = isCompoundFilter ? null : filter;
      const { data, count, error } = await adminListOrders({
        limit:  PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status,
      });

      if (error) {
        if (error.message === 'admin_session_expired') {
          toast.error('Session admin expirée — reconnexion requise');
        }
        setOrders([]);
        setTotalCount(0);
        return;
      }

      let rows = data || [];
      if (filter === 'active') {
        const closed = new Set(['delivered', 'cancelled', 'refused', 'disputed']);
        rows = rows.filter(o => !closed.has(o.status));
      }
      if (filter === 'imports_active') {
        // Isole les commandes d'import encore en cours (avant retour au
        // flow normal ready/shipped). Filtre client-side : le RPC ne
        // supporte pas de compound filter (is_preorder + status IN ...).
        rows = rows.filter(o => o.is_preorder === true && IMPORT_FLOW_STATUSES.has(o.status));
      }

      // Tab "À vérifier" : on trie en FIFO sur client_marked_paid_at (les plus
      // anciennes en premier). Fallback sur created_at si le timestamp est absent.
      if (filter === 'awaiting_verification') {
        rows = [...rows].sort((a, b) => {
          const ta = new Date(a.client_marked_paid_at || a.created_at).getTime();
          const tb = new Date(b.client_marked_paid_at || b.created_at).getTime();
          return ta - tb;
        });
      }

      setOrders(rows);
      setTotalCount(count || 0);
      if (selected) {
        const upd = rows.find(o => o.id === selected.id);
        if (upd) setSelected(upd);
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset page a 0 quand on change de filtre (via setFilter helper)
  const changeFilter = (f) => { setFilter(f); setPage(0); };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const advance = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];

    // AUDIT : on trace AVANT execution. "forceDeliver" = avance manuelle
    // vers 'delivered' qui declenche la commission => particulierement
    // sensible. Le log capture before/after.
    const isForceDeliver = next === 'delivered';
    await adminLogAction({
      action:     isForceDeliver ? 'force_deliver_order' : 'advance_order_status',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, total: order.total },
      after:      { status: next, total: order.total },
    }).catch(() => { /* audit best-effort — n'empeche pas l'action si la RPC log echoue */ });

    const { error } = await adminUpdateOrder(order.id, { status: next });
    if (error) {
      toast.error('Échec mise à jour : ' + (error.message || ''));
      refresh();
      return;
    }
    // PUSH NOTIF : informe la cliente du nouveau status (best-effort, ne bloque pas).
    // Si pas de device iOS lié → skip silencieux côté serveur.
    safeFire(`push:${next}`, () => pushOrderStatus({ ...order, status: next }));
    // EMAIL : update status (paid/preparing/shipped/delivered/awaiting_confirm).
    // Resend = idempotent côté template; si user n'a pas d'email, no_recipient.
    safeFire(`email:${next}`, () => sendOrderStatusUpdate(order.id, next));
    refresh();
  };

  // ─── Flow IMPORT : transition manuelle admin ─────────────────────────
  // Utilise pour les 4 transitions du flow d'import (paid -> awaiting_supplier,
  // awaiting_supplier -> in_transit_intl, in_transit_intl -> arrived_local,
  // arrived_local -> awaiting_balance) ainsi que pour le "Forcer solde paye"
  // (awaiting_balance -> ready) superadmin only. Chaque call trace un
  // `order_import_status_change` avec before/after + envoie push/email.
  const advanceImport = async (order, nextStatus) => {
    if (!order?.id || !nextStatus) return;

    await adminLogAction({
      action:     'order_import_status_change',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, total: order.total, is_preorder: order.is_preorder },
      after:      { status: nextStatus, total: order.total },
    }).catch(() => { /* audit best-effort */ });

    const { error } = await adminUpdateOrder(order.id, { status: nextStatus });
    if (error) {
      toast.error('Echec transition import : ' + (error.message || ''));
      refresh();
      return;
    }
    toast.success('Statut import mis a jour');
    // Push + email best-effort. sendOrderStatusUpdate dispatch vers les
    // templates importSupplierOrdered / importInTransit / importArrivedDakar /
    // importBalanceReminder (ajoutes cote send-email edge function).
    safeFire(`push:${nextStatus}`, () => pushOrderStatus({ ...order, status: nextStatus }));
    safeFire(`email:${nextStatus}`, () => sendOrderStatusUpdate(order.id, nextStatus));
    refresh();
  };

  const cancel = async (order) => {
    if (!await confirmDialog('Annuler cette commande ?')) return;

    // AUDIT : trace l'annulation avant execution.
    await adminLogAction({
      action:     'cancel_order',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, total: order.total },
      after:      { status: 'cancelled', total: order.total },
    }).catch(() => { /* best-effort */ });

    const { error } = await adminUpdateOrder(order.id, { status: 'cancelled' });
    if (error) {
      toast.error('Échec annulation : ' + (error.message || ''));
      refresh();
      return;
    }
    safeFire('push:cancelled', () => pushOrderStatus({ ...order, status: 'cancelled' }));
    safeFire('email:cancelled', () => sendOrderStatusUpdate(order.id, 'cancelled'));
    refresh();
  };

  // ─── Confirm / Reject paiement awaiting_verification ─────────────────
  // Ces deux flows tapent directement les RPC admin_confirm_payment /
  // admin_reject_payment côté DB. Ils gèrent eux-mêmes la transition de statut
  // (paid/confirmed ou pending_payment) et émettent les notifs push. Côté UI
  // on se contente d'auditer avant, afficher un toast et refresh.

  const confirmPayment = async (order) => {
    // ─── FLOW IMPORT : distinguer paiement du SOLDE ───
    // Une commande import passe par 2 verifications de paiement :
    //   1. Acompte (50%) : status='awaiting_verification' apres depot Wave/OM.
    //   2. Solde (50%)   : idem, mais avec balance_paid_at set (via client_mark_balance_paid).
    // Le cas #2 saute la case 'paid'/'preparing' et va directement en 'ready'
    // (le colis est deja arrive a Dakar, il suffit de programmer la livraison).
    const isBalanceVerification = order.is_preorder && order.balance_paid_at;
    if (isBalanceVerification) {
      return confirmBalancePayment(order);
    }

    const note = window.prompt(
      'Note de vérification (optionnel)\nEx: "Wave ref ABC123", "OM transaction du 14:32"',
      ''
    );
    // null = annulation. Empty string = on continue sans note.
    if (note === null) return;

    await adminLogAction({
      action:     'confirm_payment',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, total: order.total },
      after:      { status: 'paid_or_confirmed', total: order.total, note },
    }).catch(() => { /* best-effort */ });

    const res = await adminConfirmPayment(order.id, note);
    if (!res.success) {
      if (res.error === 'session_required') {
        toast.error('Session admin expirée — reconnexion requise');
      } else {
        toast.error('Échec confirmation : ' + (res.error || 'erreur inconnue'));
      }
      return;
    }
    toast.success('💰 Paiement confirmé');

    // ─── EMAIL CLIENT : déclenché APRÈS confirmation paiement par admin ───
    // Le user a payé Wave/OM/Card → status awaiting_verification (pas d'email envoyé).
    // L'admin vient de valider → status paid → maintenant on envoie l'email
    // "ta commande est confirmée + on prépare". Fire-and-forget : si Resend
    // est down, on ne bloque pas le flow admin.
    safeFire('email:confirmation', () => sendOrderConfirmation(order.id));
    // Email annexe "paiement validé" — distinct de la confirmation de commande.
    // Utile pour Wave/OM où le user veut savoir que SON virement est arrivé.
    safeFire('email:payment_verified', () => sendPaymentVerified(order.id));

    // La RPC a déjà push à la cliente, on enchaîne juste sur refresh + count.
    refresh();
    refreshVerifCount();
  };

  // ─── Confirm paiement du SOLDE (import) ────────────────────────────────
  // Distinct de confirmPayment : cible uniquement les commandes import ou le
  // client a paye les 50% restants. Transitionne awaiting_verification -> ready
  // (skip preparing car le colis est deja arrive et pret pour la livraison).
  const confirmBalancePayment = async (order) => {
    const note = window.prompt(
      'Note (optionnel) — Verification du SOLDE (50% restant)\nEx: "Wave ref XYZ", "OM du 15:22"',
      ''
    );
    if (note === null) return;

    await adminLogAction({
      action:     'confirm_balance_payment',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, balance_paid_at: order.balance_paid_at },
      after:      { status: 'ready', note },
    }).catch(() => { /* best-effort */ });

    const res = await adminConfirmBalancePayment(order.id, note);
    if (!res.success) {
      if (res.error === 'session_required') {
        toast.error('Session admin expiree — reconnexion requise');
      } else if (res.error === 'not_a_preorder') {
        toast.error('Cette commande n est pas un import');
      } else if (res.error === 'balance_not_paid_by_client') {
        toast.error('La cliente n a pas encore paye le solde');
      } else {
        toast.error('Echec confirmation solde : ' + (res.error || 'erreur inconnue'));
      }
      return;
    }
    toast.success('Solde valide — commande prete pour livraison');

    // Email dedie : "Ton solde est valide, ta commande sera livree bientot"
    safeFire('email:balance_verified', () => sendOrderStatusUpdate(order.id, 'ready'));

    refresh();
    refreshVerifCount();
  };

  const rejectPayment = async (order) => {
    const reason = window.prompt(
      'Raison du rejet (obligatoire)\nEx: "Montant insuffisant", "Pas de virement reçu", "Mauvais numéro"',
      ''
    );
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('La raison est obligatoire pour rejeter');
      return;
    }

    await adminLogAction({
      action:     'reject_payment',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, total: order.total },
      after:      { status: 'pending_payment', total: order.total, reason },
    }).catch(() => { /* best-effort */ });

    const res = await adminRejectPayment(order.id, reason.trim());
    if (!res.success) {
      if (res.error === 'session_required') {
        toast.error('Session admin expirée — reconnexion requise');
      } else {
        toast.error('Échec rejet : ' + (res.error || 'erreur inconnue'));
      }
      return;
    }
    toast.success('Paiement rejeté — cliente notifiée');

    // EMAIL : "paiement refusé". La RPC admin_reject_payment a déjà déclenché
    // le push, mais Resend reste à la charge du client (le template "refused"
    // vit dans email-templates/order-status-update.js). Fire-and-forget.
    safeFire('email:refused', () => sendOrderStatusUpdate(order.id, 'refused'));

    refresh();
    refreshVerifCount();
  };

  // Le filtrage par statut est fait cote serveur via la RPC admin_list_orders.
  // La recherche est elle aussi cote serveur (admin_search_orders), qui scanne
  // TOUTE la table — plus de "rien trouve" parce que le n° de commande etait
  // en page 3. On affiche orders tel quel.
  const filtered = orders;

  return (
    <div className="adm-section">
      {/* Keyframe SLA crit (>4h en awaiting_verification) — clignotement léger. */}
      <style>{`@keyframes admPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(229,57,53,0.0); }
        50%      { box-shadow: 0 0 0 4px rgba(229,57,53,0.18); }
      }`}</style>
      <header className="adm-header">
        <div>
          <h1>Commandes</h1>
          <p>
            {searchMode
              ? `${totalCount} résultat${totalCount > 1 ? 's' : ''} pour "${search.trim()}"`
              : `${totalCount} commande${totalCount > 1 ? 's' : ''} au total`}
            {!searchMode && totalPages > 1 && ` · page ${page + 1}/${totalPages}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="adm-btn-sec"
            onClick={async () => {
              const ok = await confirmDialog(
                'Annuler automatiquement toutes les commandes en attente de paiement depuis +24h ?',
                { confirmLabel: 'Nettoyer', danger: false }
              );
              if (!ok) return;
              try {
                const { data, error } = await supabase.rpc('cleanup_stale_pending_orders');
                if (error) {
                  toast.error('Erreur : ' + error.message);
                  return;
                }
                const row = Array.isArray(data) ? data[0] : data;
                const count = row?.cancelled_count || 0;
                if (count > 0) {
                  toast.success(`${count} commande${count > 1 ? 's' : ''} annulée${count > 1 ? 's' : ''} (${row?.total_amount?.toLocaleString('fr-FR') || 0} FCFA)`);
                  refresh();
                } else {
                  toast.success('Aucune commande à nettoyer ✨');
                }
              } catch (e) {
                toast.error('Erreur : ' + e.message);
              }
            }}
            title="Annule les commandes en pending_payment depuis +24h"
          >
            🧹 Nettoyer pending
          </button>
          <button className="adm-btn-sec" onClick={refresh}>🔄 Actualiser</button>
        </div>
      </header>

      <input
        type="text"
        className="adm-search-input"
        placeholder="🔍 Rechercher par n° commande, nom, téléphone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="adm-filters">
        {/* Tab "À vérifier" injecté EN PREMIER (avant Toutes) — c'est l'action
            n°1 du quotidien admin maintenant que le flow paiement passe par
            awaiting_verification. Badge rouge avec count temps réel. */}
        <button
          className={`adm-filter ${filter === 'awaiting_verification' ? 'active' : ''}`}
          onClick={() => changeFilter('awaiting_verification')}
          style={pendingVerifCount > 0 ? { fontWeight: 700 } : undefined}
        >
          💰 À vérifier
          {pendingVerifCount > 0 && (
            <span style={{
              marginLeft: 6,
              background: '#E53935',
              color: '#FFF',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
              minWidth: 20,
              display: 'inline-block',
              textAlign: 'center',
            }}>{pendingVerifCount}</span>
          )}
        </button>
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'active', label: 'En cours' },
          { id: 'imports_active', label: '✈️ Imports en cours' },
          { id: 'pending_payment', label: '⏳ Paiement' },
          { id: 'paid', label: '✅ Payées' },
          { id: 'preparing', label: '📦 Prépa' },
          { id: 'shipped', label: '🛵 En route' },
          { id: 'delivered', label: '🎉 Livrées' },
        ].map(f => (
          <button
            key={f.id}
            className={`adm-filter ${filter === f.id ? 'active' : ''}`}
            onClick={() => changeFilter(f.id)}
          >
            {f.label}
            {/* Compteur de la page courante uniquement — pour le total appliquer le filtre */}
          </button>
        ))}
      </div>

      <div className="adm-split">
        <div className="adm-list">
          {loading ? (
            <div className="adm-empty">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="adm-empty">
              <div style={{ fontSize: 48, opacity: 0.2 }}>📦</div>
              <p>Aucune commande</p>
            </div>
          ) : (
            filtered.map(o => {
              const s = STATUS_LABELS[o.status];
              const isAwaitingVerif = o.status === 'awaiting_verification';
              const sla = isAwaitingVerif ? slaLevel(o.client_marked_paid_at) : null;
              // Style spécial card "À vérifier" : fond légèrement orangé/rouge
              // clair pour attirer l'œil, bordure SLA (orange > 1h, rouge clignotant > 4h).
              const cardStyle = isAwaitingVerif ? {
                background: '#FFF4E5',
                borderLeft:
                  sla === 'crit' ? '4px solid #E53935'
                  : sla === 'warn' ? '4px solid #FB8C00'
                  : '4px solid #FFB74D',
                animation: sla === 'crit' ? 'admPulse 1.6s ease-in-out infinite' : undefined,
              } : undefined;
              return (
                <button
                  key={o.id}
                  className={`adm-list-item ${selected?.id === o.id ? 'active' : ''}`}
                  style={cardStyle}
                  onClick={() => setSelected(o)}
                >
                  <div className="adm-list-row">
                    <code>{o.id}</code>
                    <span className={`adm-badge ${s?.color}`}>{s?.emoji}</span>
                  </div>
                  {o.is_preorder === true && (
                    <div style={{
                      display: 'inline-block',
                      marginTop: 4,
                      background: '#EEF3FE',
                      color: '#2A4DA6',
                      border: '1px solid #C7D6F0',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    }}>
                      Import 10-15j
                    </div>
                  )}
                  <div className="adm-list-name">{o.address?.name || 'Anonyme'}</div>
                  {isAwaitingVerif && (
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: sla === 'crit' ? '#C62828' : sla === 'warn' ? '#E65100' : '#BF6A00',
                      marginTop: 4,
                      marginBottom: 2,
                    }}>
                      💰 À vérifier · {formatWaitSince(o.client_marked_paid_at)}
                    </div>
                  )}
                  <div className="adm-list-meta">
                    <span>{o.items?.length || 0} art. · {o.total?.toLocaleString('fr-FR')} FCFA</span>
                    <span>{new Date(o.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </button>
              );
            })
          )}

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 8px',
              borderTop: '1px solid #EEE',
              fontSize: 12,
            }}>
              <button
                className="adm-btn-sec"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                style={{ minWidth: 80 }}
              >← Préc.</button>
              <span style={{ color: '#6B6B6B', fontWeight: 600 }}>
                {page + 1} / {totalPages}
              </span>
              <button
                className="adm-btn-sec"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                style={{ minWidth: 80 }}
              >Suiv. →</button>
            </div>
          )}
        </div>

        <div className="adm-detail">
          {!selected ? (
            <div className="adm-empty" style={{ height: '100%' }}>
              <div style={{ fontSize: 48, opacity: 0.2 }}>👈</div>
              <p>Sélectionne une commande</p>
            </div>
          ) : (
            <OrderDetail
              order={selected}
              isSuperAdmin={getAdminSession()?.role === 'super_admin'}
              onAdvance={() => advance(selected)}
              onAdvanceImport={(next) => advanceImport(selected, next)}
              onCancel={() => cancel(selected)}
              onConfirmPayment={() => confirmPayment(selected)}
              onRejectPayment={() => rejectPayment(selected)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, isSuperAdmin, onAdvance, onAdvanceImport, onCancel, onConfirmPayment, onRejectPayment }) {
  const s = STATUS_LABELS[order.status];
  const flowIdx = STATUS_FLOW.indexOf(order.status);
  // canAdvance vrai SEULEMENT si le statut est dans le flow ET n'est pas le dernier.
  // Sinon (refused, cancelled, disputed, etc.), le bouton "Avancer" est cache.
  const canAdvance = flowIdx >= 0 && flowIdx < STATUS_FLOW.length - 1;
  const nextStatus = canAdvance ? STATUS_LABELS[STATUS_FLOW[flowIdx + 1]] : null;
  const isAwaitingVerif = order.status === 'awaiting_verification';
  // Une commande import n'affiche les boutons "flow normal" qu'a partir de
  // 'ready' (apres solde paye). Avant ca, on route sur les boutons import.
  const isImportOrder = order.is_preorder === true;
  const isInImportFlow = isImportOrder && IMPORT_FLOW_STATUSES.has(order.status);
  const verifSla = isAwaitingVerif ? slaLevel(order.client_marked_paid_at) : null;
  // Taux commission dynamique depuis settings (fallback 8%)
  const rate = getCachedSetting('commission', 8) / 100;
  const waUrl = order.address?.phone ? 'https://wa.me/' + order.address.phone.replace(/\D/g, '') : null;

  return (
    <div className="adm-detail-content">
      <div className="adm-detail-head">
        <div>
          <code>{order.id}</code>
          {isImportOrder && (
            <span style={{
              display: 'inline-block',
              marginLeft: 8,
              background: '#EEF3FE',
              color: '#2A4DA6',
              border: '1px solid #C7D6F0',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
              verticalAlign: 'middle',
            }}>
              Import 10-15j
            </span>
          )}
          <div className="adm-detail-date">{new Date(order.created_at).toLocaleString('fr-FR')}</div>
        </div>
        <span className={`adm-badge ${s?.color}`}>{s?.emoji} {s?.label}</span>
      </div>

      {isAwaitingVerif && (
        <div
          className="adm-detail-card"
          style={{
            background: verifSla === 'crit' ? '#FFEBEE' : '#FFF4E5',
            borderLeft:
              verifSla === 'crit' ? '4px solid #E53935'
              : verifSla === 'warn' ? '4px solid #FB8C00'
              : '4px solid #FFB74D',
          }}
        >
          <h3>{order.is_preorder && order.balance_paid_at ? '💰 SOLDE à vérifier (50% restant)' : '💰 Paiement à vérifier'}</h3>
          <p style={{ margin: '4px 0' }}>
            {order.is_preorder && order.balance_paid_at
              ? <>La cliente a paye le SOLDE <strong>{formatWaitSince(order.balance_paid_at)}</strong>. Verifie et valide pour lancer la livraison finale.</>
              : <>La cliente a déclaré avoir payé <strong>{formatWaitSince(order.client_marked_paid_at)}</strong>.</>}
          </p>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#6B6B6B' }}>
            Méthode : <strong>{order.payment_method}</strong> · Montant attendu : <strong>{(order.is_preorder && order.balance_paid_at ? (order.balance_amount || Math.round((order.total || 0) / 2)) : order.total)?.toLocaleString('fr-FR')} FCFA</strong>
          </p>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#6B6B6B' }}>
            Vérifie sur ton app Wave/OM/PayTech que le virement est bien arrivé puis confirme ou rejette.
          </p>
        </div>
      )}

      <div className="adm-detail-card">
        <h3>👤 Cliente</h3>
        <p><strong>{order.address?.name}</strong></p>
        <p>📞 <a href={`tel:${order.address?.phone}`}>{order.address?.phone}</a></p>
        <p>📍 {order.address?.line}</p>
        <p>{order.address?.neighborhood}, {order.address?.city}</p>
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="adm-wa-btn">
            💬 WhatsApp la cliente
          </a>
        )}
      </div>

      <div className="adm-detail-card">
        <h3>📦 Articles ({order.items?.length})</h3>
        {order.items?.map((it, i) => (
          <div key={`${it.id || it.name}-${i}`} className="adm-detail-item">
            <img src={it.img} alt="" />
            <div style={{ flex: 1 }}>
              <strong>{it.name}</strong>
              <div className="adm-detail-item-meta">
                <span>🏥 {it.pharmacyName}</span>
                <span>{Number(it.qty || 1)} × {Number(it.price || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-detail-card">
        <h3>💰 Total</h3>
        <div className="adm-row"><span>Sous-total</span><strong>{order.subtotal?.toLocaleString('fr-FR')} FCFA</strong></div>
        <div className="adm-row"><span>Livraison</span><strong>{order.shipping?.toLocaleString('fr-FR')} FCFA</strong></div>
        <div className="adm-row"><span>Paiement</span><strong>{order.payment_method}</strong></div>
        <div className="adm-row total"><span>Total</span><strong>{order.total?.toLocaleString('fr-FR')} FCFA</strong></div>
        <div className="adm-row commission"><span>Commission YARAM ({rate * 100}%)</span><strong>{Math.round(Number(order.total || 0) * rate).toLocaleString('fr-FR')} FCFA</strong></div>
      </div>

      <div className="adm-detail-actions">
        {isAwaitingVerif && (
          <>
            {/* Action principale : valider le virement reçu. Gros bouton vert,
                en haut de la liste pour ne pas se tromper.
                Libelle adapte si SOLDE (import) : "Confirmer paiement SOLDE"
                appelle admin_confirm_balance_payment -> ready (skip preparing). */}
            <button
              className="adm-btn-pri"
              onClick={onConfirmPayment}
              style={{
                background: '#2E7D32',
                borderColor: '#2E7D32',
                fontWeight: 700,
                fontSize: 16,
                padding: '14px 18px',
              }}
            >
              {order.is_preorder && order.balance_paid_at
                ? '✅ Confirmer paiement SOLDE (import)'
                : '✅ Confirmer paiement reçu'}
            </button>
            {/* Rejet : repasse en pending_payment (initial) ou awaiting_balance
                (solde), la cliente peut réessayer. */}
            <button
              className="adm-btn-danger"
              onClick={onRejectPayment}
              style={{ marginTop: 8 }}
            >
              ❌ Rejeter paiement
            </button>
          </>
        )}

        {/* ─── FLOW IMPORT : boutons dedies pour is_preorder=true ────────
            On remplace le bouton "avancer" standard tant que la commande
            est dans le flow import. A partir de ready/shipped, on retombe
            sur les boutons normaux via isInImportFlow=false. */}
        {!isAwaitingVerif && isInImportFlow && (
          <>
            {order.status === 'paid' && (
              <button className="adm-btn-pri" onClick={() => onAdvanceImport('awaiting_supplier')}>
                Marquer commande fournisseur
              </button>
            )}
            {order.status === 'awaiting_supplier' && (
              <button className="adm-btn-pri" onClick={() => onAdvanceImport('in_transit_intl')}>
                Marquer en transit international
              </button>
            )}
            {order.status === 'in_transit_intl' && (
              <button className="adm-btn-pri" onClick={() => onAdvanceImport('arrived_local')}>
                Marquer arrive a Dakar
              </button>
            )}
            {order.status === 'arrived_local' && (
              <button className="adm-btn-pri" onClick={() => onAdvanceImport('awaiting_balance')}>
                Envoyer relance solde
              </button>
            )}
            {order.status === 'awaiting_balance' && (
              <>
                <div style={{
                  padding: '12px 14px',
                  background: '#FFF4E5',
                  border: '1px solid #FFD9A6',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#8A5A00',
                  fontWeight: 600,
                }}>
                  En attente paiement solde par la cliente. Une fois le solde
                  reglé, la commande passera automatiquement en preparation.
                </div>
                {isSuperAdmin && (
                  <button
                    className="adm-btn-sec"
                    onClick={async () => {
                      const ok = await confirmDialog(
                        'Forcer le passage en "Prete a livrer" (solde marque paye) ?',
                        { confirmLabel: 'Forcer', danger: false }
                      );
                      if (!ok) return;
                      onAdvanceImport('ready');
                    }}
                    style={{ marginTop: 8 }}
                    title="Superadmin : bascule vers le flow normal (ready -> shipped -> delivered)"
                  >
                    Forcer marquer solde paye
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* Flow normal : uniquement quand pas en awaiting_verif et pas en
            flow import. Une commande import qui a atteint ready/shipped
            passe ici et hérite du bouton "Passer a ..." standard. */}
        {!isAwaitingVerif && !isInImportFlow && canAdvance && (
          <button className="adm-btn-pri" onClick={onAdvance}>
            ⚡ Passer à {nextStatus.emoji} {nextStatus.label}
          </button>
        )}
        {order.status !== 'delivered' && order.status !== 'cancelled' && !isAwaitingVerif && (
          <button className="adm-btn-danger" onClick={onCancel}>Annuler</button>
        )}
      </div>
    </div>
  );
}
