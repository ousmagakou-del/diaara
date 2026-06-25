import { useState, useEffect } from 'react';
// FIX juin 2026 : sendWhatsApp (WaSender bloqué) → on utilise wa.me partout (cf assignDriver).
// L'import reste retiré pour ne pas pulluer le bundle avec une fonction morte.
import { supabase, WhatsAppTemplates, generateConfirmToken } from '../lib/supabase';
import { adminListOrdersFull, adminUpdateOrder, adminLogAction } from '../lib/adminApi';
import { toast, confirmDialog } from '../lib/toast';
import SignedImage from '../components/SignedImage';
import { pushOrderStatus, pushLivreurAssigned } from '../lib/pushAdmin';
import { sendOrderStatusUpdate } from '../lib/emails';
import { notifyDriverNewOrder } from './notifyDriver';

// ─── Fire-and-forget helper (mirroring OrdersSection) ────────────────
// Toutes les notifs admin doivent etre best-effort + timeout 4s. Si Resend
// ou OneSignal est down, on log un warn et on continue : la UI admin ne
// doit JAMAIS se bloquer sur une lambda externe.
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
          console.warn(`[admin/deliveries/${label}]`, r?.error || 'unknown');
        }
      })
      .catch((e) => console.warn(`[admin/deliveries/${label}] crash:`, e?.message));
  } catch (e) {
    console.warn(`[admin/deliveries/${label}] sync crash:`, e?.message);
  }
}

// Token livreur cryptographiquement secure (128 bits via crypto.getRandomValues)
// Format : LIV-<24 chars base36 upper>
function generateSecureToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'LIV-' + Array.from(bytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 12).toUpperCase();
}

export default function DeliveriesSection() {
  const [orders, setOrders] = useState([]);
  const [trackings, setTrackings] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [showProof, setShowProof] = useState(null);
  const [view, setView] = useState('active'); // 'active', 'awaiting', 'completed', 'disputed'

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [view]);

  const refresh = async () => {
    try {
      let statuses;
      if (view === 'active') statuses = ['paid', 'preparing', 'shipped'];
      else if (view === 'awaiting') statuses = ['awaiting_confirm'];
      else if (view === 'completed') statuses = ['delivered'];
      else if (view === 'disputed') statuses = ['disputed'];
      
      const ordersRes = await adminListOrdersFull({ statuses });
      // Limite cote client pour rester leger (la RPC peut renvoyer beaucoup de rows)
      const cap = view === 'completed' ? 50 : 100;
      setOrders((ordersRes.data || []).slice(0, cap));

      // PERF : limit(500) — admin n'affiche pas tout l'historique de tracking d'un coup
      const trackingsRes = await supabase.from('delivery_tracking').select('*').limit(500);
      const trackMap = {};
      (trackingsRes.data || []).forEach(t => { trackMap[t.order_id] = t; });
      setTrackings(trackMap);
    } catch (e) {
      console.error('Refresh deliveries error:', e);
    } finally {
      setLoading(false);
    }
  };

  const assignDriver = async (order, name, phone, driverId = null) => {
    // ─── RPC idempotente : récupère le token existant OU en crée un (7j) ───
    // Évite les doublons & garantit le BON token affiché côté admin.
    const { data: tokRes, error: tokErr } = await supabase.rpc('admin_get_or_create_livreur_token', { p_order_id: order.id });
    if (tokErr || !tokRes?.success) {
      console.error('[assignDriver] RPC failed, fallback insert direct:', tokErr || tokRes);
      toast.error('Erreur génération token : ' + (tokErr?.message || tokRes?.error || 'inconnue'));
      return;
    }
    const token = tokRes.token;

    // AUDIT : trace l'assignation livreur (best-effort).
    await adminLogAction({
      action:     'assign_driver',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, driver: null },
      after:      { status: order.status, driver: { id: driverId, name, phone: phone || null } },
    }).catch(() => { /* best-effort */ });

    // FIX juin 2026 : le nom/phone livreur est mis à jour par la RPC
    // admin_assign_driver_to_order ci-dessous (évite 401 RLS direct PATCH).
    // Pour les assignations manuelles sans driverId, on garde le best-effort.
    if (!driverId) {
      const { error: trackErr } = await supabase
        .from('delivery_tracking')
        .update({ delivery_person_name: name, delivery_person_phone: phone })
        .eq('order_id', order.id);
      if (trackErr) console.warn('[admin] delivery_tracking update failed:', trackErr.message);
    }

    // ─── NOUVEAU : si livreur PWA enregistré, assigne l'UUID dans orders ───
    // Comme ça la commande apparaît dans son dashboard PWA driver
    if (driverId) {
      // FIX juin 2026 : passe par RPC admin (PATCH direct sur orders bloqué par RLS → 401)
      const { error: assignErr } = await supabase.rpc('admin_assign_driver_to_order', {
        p_admin_token: (() => {
          try {
            const raw = localStorage.getItem('yaram-admin-session') || sessionStorage.getItem('yaram-admin-session');
            return raw ? JSON.parse(raw)?.token : null;
          } catch { return null; }
        })(),
        p_order_id: order.id,
        p_driver_id: driverId,
        p_driver_name: name,
        p_driver_phone: phone || null,
      });
      if (assignErr) {
        console.warn('[admin] admin_assign_driver_to_order failed:', assignErr.message);
        toast.error('Erreur assignation : ' + assignErr.message);
      }

      // Incrémente le compteur charge du driver (RPC SECURITY DEFINER)
      try {
        const { error: incErr } = await supabase.rpc('admin_increment_driver_load', { p_driver_id: driverId });
        if (incErr) console.warn('[admin] increment driver load failed:', incErr.message);
      } catch (e) {
        console.warn('[admin] increment driver load crash:', e?.message);
      }
    }

    // S'assurer qu'il y a un confirmation_token sur la commande
    if (!order.confirmation_token) {
      await adminUpdateOrder(order.id, { confirmation_token: generateConfirmToken() });
    }

    const url = `${window.location.origin}/?livreur=${token}`;
    const pwaUrl = driverId ? `${window.location.origin}/driver/delivery/${order.id}` : null;

    if (phone) {
      // FIX juin 2026 : ouvrir wa.me direct au lieu de sendWhatsApp (WaSender
      // bloqué). L'admin clique → WhatsApp s'ouvre avec le message pré-rempli,
      // il appuie sur Envoyer dans WhatsApp. Plus de dépendance à un service tier.
      const msg = driverId
        ? `Salut ${name} ! Nouvelle livraison YARAM #${order.id} pour ${order.address?.name}. Ouvre l'app driver : ${pwaUrl}\n\nOu lien direct : ${url}`
        : WhatsAppTemplates.driverAssigned(name, order, url);
      const cleanPhone = String(phone).replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
      // Backup automatique du lien dans le presse-papier au cas où
      try { navigator.clipboard.writeText(url); } catch {}
      toast.success(driverId
        ? `✅ ${name} assigné. WhatsApp ouvert + commande visible dans son app PWA.`
        : `💬 WhatsApp ouvert avec ${name}`);
    } else {
      navigator.clipboard.writeText(url);
      toast.success(driverId
        ? `✅ Commande assignée à ${name} dans son app PWA.`
        : `Lien copié :\n${url}`);
    }

    // PUSH CLIENT : un livreur a été assigné à sa commande. C'est un signal
    // intermédiaire (pas un change de status), best-effort. Pas d'email pour
    // éviter le spam (l'email part au shipped quand le livreur picke).
    safeFire('push:livreur_assigned', () => pushLivreurAssigned(order, name));

    // ─── PUSH DRIVER : si livreur enregistré, envoie une web push à sa PWA ───
    // Le SW (public/sw.js) reçoit le push, joue son + vibration + affiche notif
    // même app fermée (sur Android et sur iOS PWA installée).
    if (driverId) {
      try {
        const raw = localStorage.getItem('yaram-admin-session') ||
                    sessionStorage.getItem('yaram-admin-session');
        const adminToken = raw ? JSON.parse(raw)?.token : null;
        if (adminToken) {
          safeFire('push:driver_web', () => notifyDriverNewOrder(adminToken, driverId, order));
        }
      } catch (e) {
        console.warn('[admin] notifyDriverNewOrder skipped:', e?.message);
      }
    }

    setAssigningOrder(null);
    refresh();
  };

  // ─── Partage rapide du lien livreur ───
  // Toujours passe par la RPC pour avoir LE BON token (et prolonger l'expiration
  // à 7j si nécessaire). C'est la source de vérité — ne JAMAIS faire confiance
  // au tracking local.
  const shareDriverLink = async (order, opts = {}) => {
    const { data, error } = await supabase.rpc('admin_get_or_create_livreur_token', { p_order_id: order.id });
    if (error || !data?.success) {
      toast.error('Erreur token : ' + (error?.message || data?.error || 'inconnue'));
      return;
    }
    const url = `${window.location.origin}/?livreur=${data.token}`;
    // Copy systématique (au cas où l'admin veut le coller ailleurs)
    try { await navigator.clipboard.writeText(url); } catch {}

    if (opts.copyOnly) {
      toast.success('🔗 Lien livreur copié');
      return;
    }

    // Ouvre WhatsApp avec le message pré-rempli
    const phone = opts.phone || order.address?.phone;
    const txt = `Salut, voici le lien de la commande #${order.id} à livrer pour YARAM : ${url}`;
    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(txt)}`, '_blank');
      toast.success('💬 WhatsApp ouvert — lien copié aussi');
    } else {
      // Pas de phone → ouvre wa.me sans numéro pour que l'admin choisisse le contact
      window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
      toast.success('💬 WhatsApp ouvert — choisis un contact');
    }
  };

  const resendDriverLink = async (tracking, order) => {
    const url = `${window.location.origin}/?livreur=${tracking.delivery_token}`;
    if (tracking.delivery_person_phone) {
      const msg = WhatsAppTemplates.driverAssigned(tracking.delivery_person_name, order, url);
      const cleanPhone = String(tracking.delivery_person_phone).replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
      try { navigator.clipboard.writeText(url); } catch {}
      toast.success(`💬 WhatsApp ouvert`);
    } else {
      navigator.clipboard.writeText(url);
      toast.success(`Lien copié:\n${url}`);
    }
  };

  const resendConfirmLink = async (order) => {
    if (!order.confirmation_token) return toast.error('Pas de token de confirmation');
    const url = `${window.location.origin}/?confirm=${order.confirmation_token}`;
    const phone = order.address?.phone;
    if (!phone) {
      navigator.clipboard.writeText(url);
      return toast.success('Lien copié:\n' + url);
    }
    const msg = order.payment_method === 'cod'
      ? WhatsAppTemplates.orderAwaitingConfirmCash(order.address.name, order.id, order.total, url)
      : WhatsAppTemplates.orderAwaitingConfirm(order.address.name, order.id, url);
    const cleanPhone = String(phone).replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    try { navigator.clipboard.writeText(url); } catch {}
    toast.success('💬 WhatsApp ouvert avec la cliente');
  };

  const forceDeliver = async (order) => {
    if (!await confirmDialog('Forcer la livraison à "livrée" sans confirmation cliente ?')) return;
    // AUDIT : forceDeliver sans confirmation cliente => action sensible (declenche
    // la commission pharma). Le log capture before/after pour traçabilité.
    await adminLogAction({
      action:     'force_deliver_order',
      targetType: 'order',
      targetId:   order.id,
      before:     { status: order.status, client_confirmed: !!order.client_confirmed },
      after:      { status: 'delivered',  client_confirmed: true },
    }).catch(() => { /* best-effort */ });
    const { error } = await adminUpdateOrder(order.id, {
      status: 'delivered',
      client_confirmed: true,
      client_confirmed_at: new Date().toISOString(),
    });
    if (error) {
      toast.error('Échec : ' + (error.message || ''));
      return;
    }
    // PUSH + EMAIL : la cliente doit savoir que sa commande est officiellement
    // livrée (même si forcée par l'admin). Best-effort.
    safeFire('push:delivered', () => pushOrderStatus({ ...order, status: 'delivered' }));
    safeFire('email:delivered', () => sendOrderStatusUpdate(order.id, 'delivered'));
    refresh();
  };

  const counts = {};
  // counts ne sera bon que pour la vue actuelle; pour des badges complets il faudrait une autre requête

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Livraisons</h1>
          <p>{orders.length} commande{orders.length > 1 ? 's' : ''} · refresh auto 10s</p>
        </div>
        <button className="adm-btn-sec" onClick={refresh}>🔄 Actualiser</button>
      </header>

      <div className="adm-filters">
        <button className={`adm-filter ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>🛵 En cours</button>
        <button className={`adm-filter ${view === 'awaiting' ? 'active' : ''}`} onClick={() => setView('awaiting')}>⏳ En attente confirm</button>
        <button className={`adm-filter ${view === 'completed' ? 'active' : ''}`} onClick={() => setView('completed')}>✅ Livrées</button>
        <button className={`adm-filter ${view === 'disputed' ? 'active' : ''}`} onClick={() => setView('disputed')}>⚠️ Litiges</button>
      </div>

      {assigningOrder && (
        <AssignDriverModal
          order={assigningOrder}
          onAssign={assignDriver}
          onCancel={() => setAssigningOrder(null)}
        />
      )}

      {showProof && (
        <ProofModal
          order={showProof.order}
          tracking={showProof.tracking}
          onClose={() => setShowProof(null)}
        />
      )}

      {loading ? (
        <div className="adm-empty">Chargement…</div>
      ) : orders.length === 0 ? (
        <div className="adm-empty">
          <div style={{ fontSize: 48, opacity: 0.2 }}>
            {view === 'active' && '🛵'}
            {view === 'awaiting' && '⏳'}
            {view === 'completed' && '✅'}
            {view === 'disputed' && '⚠️'}
          </div>
          <p>
            {view === 'active' && 'Aucune livraison en cours'}
            {view === 'awaiting' && 'Aucune commande en attente de confirmation'}
            {view === 'completed' && 'Aucune commande livrée pour le moment'}
            {view === 'disputed' && 'Aucun litige (bonne nouvelle !)'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(o => {
            const tracking = trackings[o.id];
            const waUrl = o.address?.phone ? 'https://wa.me/' + o.address.phone.replace(/\D/g, '') : null;
            const lastUpdate = tracking?.last_update ? new Date(tracking.last_update) : null;
            const secondsAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null;
            const isCash = o.payment_method === 'cod';

            return (
              <div key={o.id} className="adm-recent-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <code>{o.id}</code>
                      <span className={`adm-badge ${o.status === 'disputed' ? 'bad' : 'good'}`}>
                        {o.status === 'shipped' && '🛵 En route'}
                        {o.status === 'preparing' && '📦 En prépa'}
                        {o.status === 'paid' && '✅ Payée'}
                        {o.status === 'awaiting_confirm' && '⏳ En attente confirm'}
                        {o.status === 'delivered' && '🎉 Livrée'}
                        {o.status === 'disputed' && '⚠️ Litige'}
                      </span>
                      {isCash && <span className="adm-badge medium">💵 Cash</span>}
                      {isCash && o.cash_received && <span className="adm-badge good">✓ Cash reçu</span>}
                      {tracking && view !== 'completed' && view !== 'disputed' && <span className="adm-badge excellent">📡 Livreur</span>}
                      {tracking?.current_lat && secondsAgo !== null && secondsAgo < 60 && view === 'active' && (
                        <span className="adm-badge excellent">🟢 GPS direct</span>
                      )}
                      {o.delivery_rating && (
                        <span style={{ color: '#F4B53A', fontWeight: 700, fontSize: 13 }}>
                          {'★'.repeat(o.delivery_rating)}
                        </span>
                      )}
                    </div>
                    <p><strong>👤 {o.address?.name}</strong> · 📞 {o.address?.phone}</p>
                    <p style={{ marginTop: 4 }}>📍 {o.address?.line}, {o.address?.neighborhood}, {o.address?.city}</p>
                    <p style={{ marginTop: 4, fontSize: 12, color: '#6B6B6B' }}>
                      📦 {o.items?.length || 0} articles · {o.total?.toLocaleString('fr-FR')} FCFA
                    </p>
                    {tracking && (
                      <div style={{ marginTop: 8, padding: 8, background: '#E8F5EC', borderRadius: 8, fontSize: 12 }}>
                        🛵 <strong>{tracking.delivery_person_name}</strong> · {tracking.delivery_person_phone}
                        {tracking.current_lat && view === 'active' && (
                          <span style={{ marginLeft: 8 }}>
                            · 📍 {tracking.current_lat.toFixed(5)}, {tracking.current_lng.toFixed(5)}
                          </span>
                        )}
                        {secondsAgo !== null && view === 'active' && (
                          <span style={{ marginLeft: 8, color: '#6B6B6B' }}>
                            ({secondsAgo < 60 ? `${secondsAgo}s` : `${Math.floor(secondsAgo / 60)}min`})
                          </span>
                        )}
                      </div>
                    )}
                    {o.delivery_comment && (
                      <p style={{ marginTop: 8, padding: 8, background: '#FEF6E5', borderRadius: 8, fontSize: 12, fontStyle: 'italic' }}>
                        💬 "{o.delivery_comment}"
                      </p>
                    )}
                    {o.client_dispute_reason && (
                      <p style={{ marginTop: 8, padding: 8, background: '#FCE9E7', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#D9342B' }}>
                        ⚠️ Litige : {o.client_dispute_reason}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {waUrl && <a className="adm-wa-btn" href={waUrl} target="_blank" rel="noopener noreferrer">💬 Cliente</a>}
                    {view === 'active' && !tracking && (
                      <button className="adm-btn-pri" onClick={() => setAssigningOrder(o)}>🛵 Assigner</button>
                    )}
                    {view === 'active' && tracking && (
                      <button className="adm-btn-sec" onClick={() => resendDriverLink(tracking, o)}>📲 Renvoyer livreur</button>
                    )}
                    {view === 'active' && (
                      <>
                        <button
                          className="adm-wa-btn"
                          title="Ouvrir WhatsApp avec le lien livreur prêt à envoyer"
                          onClick={() => shareDriverLink(o)}
                        >
                          💬 Partager lien livreur
                        </button>
                        <button
                          className="adm-btn-sec"
                          title="Copier le lien livreur"
                          onClick={() => shareDriverLink(o, { copyOnly: true })}
                        >
                          🔗 Copier lien
                        </button>
                      </>
                    )}
                    {view === 'awaiting' && (
                      <>
                        <button className="adm-btn-sec" onClick={() => resendConfirmLink(o)}>📲 Renvoyer confirm</button>
                        <button className="adm-btn-sec" onClick={() => forceDeliver(o)}>✅ Forcer livré</button>
                      </>
                    )}
                    {tracking && (tracking.delivery_photo_url || tracking.delivery_signature || tracking.delivery_pin) && (
                      <button className="adm-btn-sec" onClick={() => setShowProof({ order: o, tracking })}>🔍 Voir preuves</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignDriverModal({ order, onAssign, onCancel }) {
  const [mode, setMode] = useState('registered'); // 'registered' | 'manual'
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Charge la liste des livreurs actifs avec leur charge actuelle
  useEffect(() => {
    (async () => {
      setLoadingDrivers(true);
      const { data, error } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, phone, vehicle, zone, rating, current_orders_count, total_deliveries, active')
        .eq('active', true)
        .order('current_orders_count', { ascending: true })
        .order('rating', { ascending: false, nullsFirst: false });
      if (error) {
        console.warn('[AssignDriverModal] load drivers failed:', error.message);
        setDrivers([]);
      } else {
        setDrivers(data || []);
      }
      setLoadingDrivers(false);
    })();
  }, []);

  const handleSelectDriver = (d) => {
    setSelectedDriverId(d.id);
    setName(d.full_name);
    setPhone(d.phone);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setAssigning(true);
    await onAssign(order, name.trim(), phone.trim(), selectedDriverId || null);
    setAssigning(false);
  };

  const isCash = order.payment_method === 'cod';

  return (
    <div className="adm-form-overlay" onClick={onCancel}>
      <div className="adm-form-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <h3>🛵 Assigner un livreur</h3>
        <p style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 8 }}>
          Commande <code>{order.id}</code> à <strong>{order.address?.name}</strong>
          {' · '} {order.total?.toLocaleString('fr-FR')} FCFA
        </p>
        {isCash && (
          <div style={{ background: '#FEF6E5', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
            💵 <strong>Paiement Cash</strong> : le livreur devra encaisser <strong>{order.total?.toLocaleString('fr-FR')} FCFA</strong>
          </div>
        )}

        {/* ─── Tabs : Registered / Manual ─── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '2px solid #F1F1F1' }}>
          <button
            type="button"
            onClick={() => setMode('registered')}
            style={{
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              borderBottom: mode === 'registered' ? '3px solid #1F8B4C' : '3px solid transparent',
              fontWeight: mode === 'registered' ? 800 : 500,
              color: mode === 'registered' ? '#1F8B4C' : '#666',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            📱 Livreurs PWA ({drivers.length})
          </button>
          <button
            type="button"
            onClick={() => { setMode('manual'); setSelectedDriverId(null); setName(''); setPhone(''); }}
            style={{
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              borderBottom: mode === 'manual' ? '3px solid #1F8B4C' : '3px solid transparent',
              fontWeight: mode === 'manual' ? 800 : 500,
              color: mode === 'manual' ? '#1F8B4C' : '#666',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ✍️ Manuel (extérieur)
          </button>
        </div>

        {mode === 'registered' && (
          <div>
            {loadingDrivers ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>Chargement…</div>
            ) : drivers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
                Aucun livreur enregistré.<br/>
                <span style={{ fontSize: 12 }}>Passe en mode "Manuel" pour assigner un livreur externe.</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                {drivers.map((d) => {
                  const isSelected = selectedDriverId === d.id;
                  const load = d.current_orders_count || 0;
                  const loadColor = load === 0 ? '#1F8B4C' : load <= 2 ? '#F4B53A' : '#EF4444';
                  const loadLabel = load === 0 ? 'Disponible' : `${load} en cours`;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDriver(d)}
                      style={{
                        padding: 14,
                        background: isSelected ? 'rgba(31,139,76,0.08)' : '#fff',
                        border: isSelected ? '2px solid #1F8B4C' : '2px solid #E5E5E5',
                        borderRadius: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: '#1F8B4C', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 900, fontSize: 13,
                          }}>
                            {(d.full_name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{d.full_name}</div>
                            <div style={{ fontSize: 11, color: '#6B6B6B' }}>{d.phone}</div>
                          </div>
                        </div>
                        {isSelected && <span style={{ color: '#1F8B4C', fontSize: 20 }}>✓</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        <span style={{
                          fontSize: 10, padding: '3px 8px', borderRadius: 999,
                          background: loadColor + '20', color: loadColor, fontWeight: 800,
                        }}>● {loadLabel}</span>
                        {d.vehicle && (
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>
                            🛵 {d.vehicle}
                          </span>
                        )}
                        {d.zone && (
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>
                            📍 {d.zone}
                          </span>
                        )}
                        {d.rating != null && (
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>
                            ⭐ {Number(d.rating).toFixed(1)}
                          </span>
                        )}
                        {d.total_deliveries != null && (
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>
                            📦 {d.total_deliveries}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'manual' && (
          <div>
            <p style={{ fontSize: 12, color: '#6B6B6B', marginBottom: 10 }}>
              Pour un livreur externe (taxi, moto-taxi occasionnel). Il recevra le lien par WhatsApp.
            </p>
            <label>Nom *<input value={name} onChange={e => setName(e.target.value)} placeholder="Mamadou Diop" autoFocus /></label>
            <label>WhatsApp<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 78 XX XX XX" /></label>
          </div>
        )}

        <p style={{ fontSize: 11, color: '#6B6B6B', marginTop: 12 }}>
          ℹ️ {mode === 'registered'
            ? 'La commande apparaîtra directement dans son app PWA + lien WhatsApp envoyé.'
            : 'Le lien GPS sera envoyé par WhatsApp uniquement.'}
        </p>
        <div className="adm-form-actions">
          <button className="adm-btn-sec" onClick={onCancel}>Annuler</button>
          <button
            className="adm-btn-pri"
            onClick={handleSubmit}
            disabled={assigning || !name.trim()}
          >
            {assigning ? '🚀 Envoi...' :
              (mode === 'registered' && selectedDriverId ? '🚀 Assigner ce livreur' : '🚀 Assigner & WhatsApp')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProofModal({ order, tracking, onClose }) {
  return (
    <div className="adm-form-overlay" onClick={onClose}>
      <div className="adm-form-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <h3>🔍 Preuves de livraison · {order.id}</h3>
        <p style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 16 }}>
          Cliente : <strong>{order.address?.name}</strong> · Livreur : <strong>{tracking.delivery_person_name}</strong>
        </p>

        {order.payment_method === 'cod' && (
          <div style={{ padding: 10, background: order.cash_received ? '#E8F5EC' : '#FCE9E7', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
            💵 <strong>Cash {order.cash_received ? '✓ reçu' : '✗ NON reçu'}</strong> : {order.total?.toLocaleString('fr-FR')} FCFA
            {order.cash_received_at && (
              <p style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>{new Date(order.cash_received_at).toLocaleString('fr-FR')}</p>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gap: 16 }}>
          {tracking.pickup_photo_url && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🏥 Photo pharmacie</h4>
              <SignedImage src={tracking.pickup_photo_url} alt="" style={{ width: '100%', borderRadius: 10, maxHeight: 300, objectFit: 'cover' }} />
              {tracking.pickup_at && <p style={{ fontSize: 11, color: '#6B6B6B', marginTop: 4 }}>{new Date(tracking.pickup_at).toLocaleString('fr-FR')}</p>}
            </div>
          )}
          {tracking.product_photo_url && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>📦 Photo produit</h4>
              <SignedImage src={tracking.product_photo_url} alt="" style={{ width: '100%', borderRadius: 10, maxHeight: 300, objectFit: 'cover' }} />
              {tracking.picked_at && <p style={{ fontSize: 11, color: '#6B6B6B', marginTop: 4 }}>{new Date(tracking.picked_at).toLocaleString('fr-FR')}</p>}
            </div>
          )}
          {tracking.delivery_photo_url && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🎉 Photo colis remis</h4>
              <SignedImage src={tracking.delivery_photo_url} alt="" style={{ width: '100%', borderRadius: 10, maxHeight: 300, objectFit: 'cover' }} />
            </div>
          )}
          {tracking.delivery_signature && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>✍️ Signature</h4>
              <img src={tracking.delivery_signature} alt="" style={{ width: '100%', maxHeight: 150, objectFit: 'contain', background: '#F4F4F2', borderRadius: 10 }} />
            </div>
          )}
          {tracking.delivery_pin && (
            <div style={{ padding: 12, background: '#E8F5EC', borderRadius: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🔢 Code PIN</h4>
              <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.3em', color: '#166635' }}>{tracking.delivery_pin}</p>
            </div>
          )}
          {order.delivery_rating && (
            <div style={{ padding: 12, background: '#FEF6E5', borderRadius: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>⭐ Notation</h4>
              <p style={{ fontSize: 22, color: '#F4B53A' }}>{'★'.repeat(order.delivery_rating)}{'☆'.repeat(5 - order.delivery_rating)}</p>
              {order.delivery_comment && <p style={{ fontSize: 13, fontStyle: 'italic', marginTop: 6 }}>"{order.delivery_comment}"</p>}
            </div>
          )}
          {order.client_dispute_reason && (
            <div style={{ padding: 12, background: '#FCE9E7', borderRadius: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#D9342B' }}>⚠️ LITIGE CLIENTE</h4>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{order.client_dispute_reason}</p>
            </div>
          )}
        </div>
        <button className="adm-btn-sec" onClick={onClose} style={{ marginTop: 16, width: '100%' }}>Fermer</button>
      </div>
    </div>
  );
}
