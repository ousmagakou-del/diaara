// src/lib/cart.js
// Gestion centralisée du panier localStorage

const KEY = 'yaram_cart';
const LAST_ADDED_KEY = 'yaram_cart_last_added_at';
// LAST_WRITE_KEY : timestamp ISO du dernier setCart local (ajout / modif / suppression).
// Sert d'arbitre au sync cross-device : si local est plus récent que le cart en DB
// (colonne user_carts.updated_at), on push local -> DB. Sinon on remplace local par DB.
// Écrit à chaque setCart, remis à jour même quand le panier est vidé (pour distinguer
// "vidé sur ce device il y a 5 min" de "vidé sur autre device il y a 2h").
export const CART_LAST_WRITE_KEY = 'yaram_cart_last_write';

// Sanitize : un cart hérité d'avant les nouveaux champs (is_imported, pharmacyName…)
// pouvait être malformé et planter `grouped.reduce` ou `buildPreorderSummary`,
// ce qui blanchissait la page Cart (React 19 unmount silencieux sans ErrorBoundary).
// On filtre tout item incomplet et on garantit des valeurs par défaut sûres.
function sanitizeCartItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it) => it && typeof it === 'object' && it.productId && it.pharmacyId)
    .map((it) => ({
      productId: it.productId,
      pharmacyId: it.pharmacyId,
      pharmacyName: it.pharmacyName || 'Pharmacie',
      name: it.name || 'Produit',
      brand: it.brand || '',
      img: it.img || '',
      price: Number(it.price) || 0,
      qty: Math.max(1, Number(it.qty) || 1),
      is_imported: !!it.is_imported,
      lead_time_days: Number(it.lead_time_days) || 1,
      origin_country: it.origin_country || 'SN',
    }));
}

export function getCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return sanitizeCartItems(raw);
  } catch {
    return [];
  }
}

export function setCart(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    // Si panier vide → on retire le timestamp d'ajout (le user a checkout)
    if (!items || items.length === 0) {
      try { localStorage.removeItem(LAST_ADDED_KEY); } catch {}
    }
    // Tag le device : "cart modifié ici, à cet instant". Utilisé par cartSync.js
    // pour arbitrer local vs DB au prochain login sur un autre device.
    try { localStorage.setItem(CART_LAST_WRITE_KEY, new Date().toISOString()); } catch {}
    // Évenement custom pour que d'autres composants (badge panier dans TabBar,
    // cartSync listener dans App.jsx) réagissent au changement.
    window.dispatchEvent(new CustomEvent('yaram-cart-updated', { detail: { items } }));
  } catch (e) {
    console.error('setCart error:', e);
  }
}

// Timestamp ISO du dernier setCart sur ce device. null si jamais écrit ici.
export function getCartLastWrite() {
  try { return localStorage.getItem(CART_LAST_WRITE_KEY) || null; } catch { return null; }
}

// Écriture "silencieuse" : remplace le cart local sans redéclencher yaram-cart-updated
// ni bumper le CART_LAST_WRITE_KEY. Utilisée par cartSync.js après pull DB pour éviter
// une boucle sync → event → push.
export function replaceCartFromRemote(items) {
  try {
    const sanitized = sanitizeCartItems(items);
    localStorage.setItem(KEY, JSON.stringify(sanitized));
    // Notifie les composants pour rafraîchir leur affichage, MAIS sans bumper
    // le last-write (le detail.silent = true est un signal pour cartSync).
    window.dispatchEvent(new CustomEvent('yaram-cart-updated', { detail: { items: sanitized, silent: true } }));
  } catch (e) {
    console.error('replaceCartFromRemote error:', e);
  }
}

export function getCartCount() {
  return getCart().reduce((s, it) => s + (Number(it.qty) || 0), 0);
}

// Ajoute un produit au panier pour une pharmacie donnée
export function addToCart({ product, pharmacy, qty = 1 }) {
  if (!product || !pharmacy) return { success: false, error: 'Produit ou pharmacie manquant' };
  const cart = getCart();
  const exists = cart.find(c => c.productId === product.id && c.pharmacyId === pharmacy.id);
  if (exists) {
    exists.qty += qty;
  } else {
    cart.push({
      productId: product.id,
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      name: product.name,
      brand: product.brand,
      img: product.img,
      price: product.price,
      qty,
      // ─── Infos import (preorder) — undefined = produit local ───
      is_imported: product.is_imported || false,
      lead_time_days: product.lead_time_days || 1,
      origin_country: product.origin_country || 'SN',
    });
  }
  setCart(cart);
  // Track le dernier ajout pour la notif cart abandoned (24h)
  try { localStorage.setItem(LAST_ADDED_KEY, new Date().toISOString()); } catch {}
  return { success: true };
}

// Vide explicitement le panier (au checkout)
export function clearCart() {
  setCart([]);
}
