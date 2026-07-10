// ════════════════════════════════════════════════════════════════════
// YARAM — Cart sync cross-device (web ↔ native ↔ n'importe quel navigateur)
// ════════════════════════════════════════════════════════════════════
//
// Contrat backend (deja deploye en prod, ne pas re-toucher) :
//
//   Table user_carts
//     user_id uuid PK, items jsonb, promo_code text, gift_card text,
//     last_device text, updated_at timestamptz
//   RLS owner_all : seul auth.uid() = user_id peut lire/ecrire.
//
//   RPC get_user_cart() -> { success, items, promo_code, last_device, updated_at }
//   RPC upsert_user_cart(p_items jsonb, p_promo_code text, p_device text)
//        -> { success, updated_at }
//
// Strategie sync :
//   1. Sur login → pullFromDB()
//      - Si DB updated_at > local last-write → replace local par DB (last-write-wins).
//      - Sinon (local plus recent OU DB vide) → pushToDB(local) pour hydrater la DB.
//      - Si local vide et DB non vide → replace local par DB (recuperation panier).
//
//   2. Sur chaque changement du cart (event 'yaram-cart-updated' non silencieux)
//      → debounce 1.5s → pushToDB. Fire-and-forget : ne bloque JAMAIS l'UI si le
//      reseau est down. Le prochain change reprogrammera le push.
//
// Failure mode : tous les appels sont wrappes en try/catch, jamais throw.
// Le cart local reste la source de verite pour l'UI ; la DB est un miroir best-effort.
// ════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import {
  getCart,
  getCartLastWrite,
  replaceCartFromRemote,
  CART_LAST_WRITE_KEY,
} from './cart';
import { getPendingPromo, setPendingPromo } from './promoStorage';

// ─── Debounce sync push ───────────────────────────────────────────
const DEBOUNCE_MS = 1500;
let pushTimer = null;
let syncEnabled = false; // active seulement une fois qu'on a un user authentifie

// ─── Push local → DB (debounced) ──────────────────────────────────
function schedulePush() {
  if (!syncEnabled) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushLocalToDB().catch(() => { /* silent, l'UI n'est jamais bloquee */ });
  }, DEBOUNCE_MS);
}

async function pushLocalToDB() {
  try {
    const items = getCart();
    const promoCode = getPendingPromo() || null;
    const { data, error } = await supabase.rpc('upsert_user_cart', {
      p_items: items,
      p_promo_code: promoCode,
      p_device: 'web',
    });
    if (error) {
      console.warn('[cartSync] upsert_user_cart error:', error.message);
      return null;
    }
    return data?.updated_at || null;
  } catch (e) {
    console.warn('[cartSync] push exception:', e?.message);
    return null;
  }
}

// ─── Pull DB → arbitrage last-write-wins ──────────────────────────
async function pullFromDB() {
  try {
    const { data, error } = await supabase.rpc('get_user_cart');
    if (error) {
      console.warn('[cartSync] get_user_cart error:', error.message);
      return null;
    }
    if (!data || data.success === false) return null;
    return {
      items: Array.isArray(data.items) ? data.items : [],
      promo_code: data.promo_code || '',
      updated_at: data.updated_at || null,
    };
  } catch (e) {
    console.warn('[cartSync] pull exception:', e?.message);
    return null;
  }
}

// ─── Sync on login : merge local ↔ DB une fois, puis activer le push auto ─
//
// Regle simple last-write-wins :
//   - Local a un timestamp CART_LAST_WRITE plus recent que DB updated_at
//     → push local vers DB (on garde local, on ecrase DB).
//   - DB updated_at plus recent OU local jamais ecrit sur ce device
//     → replace local par DB (on adopte le cart DB).
//   - Local vide + DB non vide → replace local par DB (recuperation panier
//     depuis un autre device).
//   - Local non vide + DB vide → push local vers DB (premiere synchro).
//
// L'user peut avoir 2 onglets ouverts : celui qui push en dernier gagne. C'est
// acceptable pour un e-commerce ou les modifs concurrentes sont rares.
export async function syncCartOnLogin() {
  // Active le sync avant tout : si push echoue, on garde tenter au prochain change.
  syncEnabled = true;

  const remote = await pullFromDB();
  const localItems = getCart();
  const localLastWrite = getCartLastWrite();

  // Cas 1 : rien en DB → push local si non vide, sinon rien a faire.
  if (!remote) {
    if (localItems.length > 0) schedulePush();
    return { action: 'no_remote', pushed: localItems.length > 0 };
  }

  const remoteTs = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
  const localTs = localLastWrite ? new Date(localLastWrite).getTime() : 0;

  // Cas 2 : DB plus recente OU local jamais ecrit ici → adopter DB.
  //   - Si l'un des deux est vide, on prefere quand meme la timestamp la plus recente
  //     (un "vide" recent peut representer un checkout).
  if (remoteTs > localTs) {
    replaceCartFromRemote(remote.items);
    // Ecrase le last-write local pour eviter un push retour immediat qui
    // ecraserait la DB avec ce qu'on vient d'adopter.
    try { localStorage.setItem(CART_LAST_WRITE_KEY, remote.updated_at); } catch {}
    if (remote.promo_code) {
      try { setPendingPromo(remote.promo_code); } catch {}
    }
    return { action: 'adopted_remote', count: remote.items.length };
  }

  // Cas 3 : local plus recent → pousser vers DB.
  if (localTs > remoteTs) {
    schedulePush();
    return { action: 'pushed_local', count: localItems.length };
  }

  // Cas 4 : egalite parfaite (edge case) → rien a faire.
  return { action: 'noop' };
}

// ─── Wire listener global (a appeler UNE fois au boot cote user connecte) ─
//
// Ecoute yaram-cart-updated dispatche par setCart(). Ignore les updates
// "silent" (venus de replaceCartFromRemote apres pull), sinon on ferait une
// boucle sync -> event -> push.
let listenerAttached = false;
export function attachCartSyncListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  const handler = (e) => {
    if (e?.detail?.silent) return;
    schedulePush();
  };
  window.addEventListener('yaram-cart-updated', handler);
  // Note : pas de detach — le listener vit pour toute la session (comme
  // les listeners auth). Si user se deconnecte, disableCartSync() coupe le push.
}

// ─── Desactiver le sync (appele sur logout) ────────────────────────
export function disableCartSync() {
  syncEnabled = false;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}
