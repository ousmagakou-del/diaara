import { supabase } from './client';
import { compressImage } from './storage';

// ═══════════════════════════════════════════════
// PUSH NOTIFICATIONS (existant, conserve)
// ═══════════════════════════════════════════════

const VAPID_PUBLIC_KEY = 'BNxe7DjGiK8jp_LdEKgZbI3oFG9p_X0wmKHHfsXOlVHwBE3FB_pIRgFb_VxkN1xnzPxRzz0w8hYqYnFw7yWEpQk';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function subscribeToPush(userId) {
  if (!isPushSupported()) return { success: false, error: 'Pas supporté' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { success: false, error: 'Permission refusée' };
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const sub = subscription.toJSON();
    await supabase.from('push_subscriptions').upsert({
      user_id: userId, endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh, auth: sub.keys.auth,
      user_agent: navigator.userAgent, enabled: true,
    }, { onConflict: 'endpoint' });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function unsubscribeFromPush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    }
    return true;
  } catch { return false; }
}

export async function showLocalNotification(title, body, options = {}) {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body, icon: '/icon-192.png', badge: '/icon-96.png',
    vibrate: [200, 100, 200], ...options,
  });
}

export async function getNotifications(userId, limit = 50) {
  const { data } = await supabase.from('notifications').select('*')
    .eq('user_id', userId).order('sent_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function getUnreadCount(userId) {
  const { count } = await supabase.from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('read', false);
  return count || 0;
}

export async function createNotification({ userId, title, body, url, type = 'info' }) {
  return supabase.from('notifications').insert({
    user_id: userId, title, body, url, type,
  });
}

export function scheduleSkinRoutineReminders(morningTime, eveningTime) {
  localStorage.setItem('yaram-routine-morning', morningTime || '');
  localStorage.setItem('yaram-routine-evening', eveningTime || '');
  startRoutineReminderCheck();
}

let reminderInterval = null;
function startRoutineReminderCheck() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(() => {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const morning = localStorage.getItem('yaram-routine-morning');
    const evening = localStorage.getItem('yaram-routine-evening');
    const lastNotif = localStorage.getItem('yaram-last-reminder');
    const today = now.toDateString();
    if (morning && currentTime === morning && lastNotif !== `${today}-morning`) {
      showLocalNotification('☀️ Routine matin', 'C\'est l\'heure de ta routine matinale !');
      localStorage.setItem('yaram-last-reminder', `${today}-morning`);
    }
    if (evening && currentTime === evening && lastNotif !== `${today}-evening`) {
      showLocalNotification('🌙 Routine soir', 'C\'est l\'heure de ta routine du soir !');
      localStorage.setItem('yaram-last-reminder', `${today}-evening`);
    }
  }, 60000);
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS — list, mark as read, count unread (RPC-based)
// ═══════════════════════════════════════════════════════════════════

export async function getMyNotifications(limit = 50) {
  // FIX juin 2026 : check session avant query (RLS-protected)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('session_not_ready');

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, icon, url, type, read, sent_at')
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[notifs] getMy error:', error.message);
    // FIX : throw au lieu de return [] (sinon le cache TanStack est empoisonné
    // avec [] et l'UI reste figée à "aucune notification")
    throw error;
  }
  return data || [];
}

export async function getUnreadNotificationsCount() {
  try {
    const { data, error } = await supabase.rpc('count_unread_notifications');
    if (error) return 0;
    return Number(data) || 0;
  } catch { return 0; }
}

export async function markAllNotificationsRead() {
  try {
    const { data, error } = await supabase.rpc('mark_all_notifications_read');
    if (error) return 0;
    return Number(data) || 0;
  } catch { return 0; }
}

export async function markNotificationRead(notificationId) {
  try {
    const { data, error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
    });
    if (error) return false;
    return !!data;
  } catch { return false; }
}

// Real-time subscription : appelle onUpdate(count) à chaque INSERT/UPDATE
// sur la table notifications du user courant. Retourne unsubscribe.
export function subscribeNotificationsCount(userId, onUpdate) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`notif-count-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, async () => {
      try {
        const c = await getUnreadNotificationsCount();
        onUpdate(c);
      } catch { /* ignore */ }
    })
    .subscribe();
  return () => {
    try { supabase.removeChannel(channel); } catch { /* ignore */ }
  };
}

// ═══════════════════════════════════════════════
// REVIEWS — table `product_reviews` (aligne native/app)
// Colonnes : id, user_id, product_id, order_id, rating,
//            title, body, photos jsonb, verified_purchase,
//            helpful_count, status ('published'), created_at
// ═══════════════════════════════════════════════

// Whitelist des hosts autorises pour les URLs de photos.
// Anti-XSS/anti-SSRF : on refuse tout ce qui n'est pas Supabase Storage YARAM.
const SUPABASE_STORAGE_HOSTS = [
  'qxhhnrnworwrnwmqekmb.supabase.co',
  'qxhhnrnworwrnwmqekmb.supabase.in',
];

export function isSafeReviewPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (!SUPABASE_STORAGE_HOSTS.includes(u.hostname)) return false;
    if (!u.pathname.startsWith('/storage/v1/object/public/review-photos/')) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizePhotos(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isSafeReviewPhotoUrl).slice(0, 5);
}

// Mappe une row product_reviews vers la shape UI (compat ReviewCard.jsx)
function mapReviewRow(r, nameById) {
  return {
    id: r.id,
    product_id: r.product_id,
    user_id: r.user_id,
    order_id: r.order_id,
    rating: r.rating,
    title: r.title || '',
    comment: r.body || '',
    body: r.body || '',
    photos: sanitizePhotos(r.photos),
    photo_urls: sanitizePhotos(r.photos), // alias legacy
    verified_purchase: !!r.verified_purchase,
    helpful_count: Number(r.helpful_count) || 0,
    status: r.status || 'published',
    created_at: r.created_at,
    author_name: nameById?.[r.user_id] || 'Anonyme',
    user_name: nameById?.[r.user_id] || 'Anonyme',
  };
}

export async function getProductReviews(productId) {
  if (!productId) return [];
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, user_id, product_id, order_id, rating, title, body, photos, verified_purchase, helpful_count, status, created_at')
    .eq('product_id', productId)
    .eq('status', 'published')
    .order('helpful_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { console.warn('[getProductReviews]', error.message); return []; }

  // Enrichissement noms user (safe RLS-side via users_profile)
  const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))];
  let nameById = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from('users_profile')
      .select('id, full_name, email')
      .in('id', userIds);
    nameById = Object.fromEntries(
      (profs || []).map((p) => [
        p.id,
        p.full_name || (p.email ? p.email.split('@')[0] : 'Anonyme'),
      ])
    );
  }

  return (data || []).map((r) => mapReviewRow(r, nameById));
}

// Auto-detection verified_purchase depuis l'historique orders.
async function _checkVerifiedPurchase(userId, productId) {
  if (!userId || !productId) return { verified: false, orderId: null };
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, items')
      .eq('user_id', userId)
      .in('status', ['delivered', 'client_confirmed', 'livre', 'livré', 'completed']);
    if (!Array.isArray(orders)) return { verified: false, orderId: null };
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      const match = items.some((it) =>
        it && (it.id === productId || it.product_id === productId || String(it.id) === String(productId))
      );
      if (match) return { verified: true, orderId: o.id };
    }
  } catch (e) {
    console.warn('[verifiedPurchase] failed:', e?.message);
  }
  return { verified: false, orderId: null };
}

export async function createReview({ productId, userId, rating, title, comment, body, photoUrls = [], photos: photosArg = [] }) {
  if (!userId || !productId) return false;
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) return false;

  const photos = sanitizePhotos(
    Array.isArray(photosArg) && photosArg.length > 0 ? photosArg : photoUrls
  );
  const bodyText = String(body || comment || '').slice(0, 1000);
  const titleText = title ? String(title).slice(0, 120) : null;

  const { verified, orderId } = await _checkVerifiedPurchase(userId, productId);

  // Upsert-like : si l'utilisateur a deja review ce produit, on met a jour.
  const { data: existing } = await supabase
    .from('product_reviews')
    .select('id')
    .eq('product_id', productId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('product_reviews')
      .update({
        rating: r,
        title: titleText,
        body: bodyText,
        photos,
        verified_purchase: verified,
        order_id: orderId,
        status: 'published',
      })
      .eq('id', existing.id);
    if (error) { console.warn('[createReview:update]', error.message); return false; }
    return true;
  }

  const { error } = await supabase.from('product_reviews').insert({
    user_id: userId,
    product_id: productId,
    order_id: orderId,
    rating: r,
    title: titleText,
    body: bodyText,
    photos,
    verified_purchase: verified,
    status: 'published',
  });
  if (error) { console.warn('[createReview:insert]', error.message); return false; }
  return true;
}

// Upload d'une photo : le bucket exige que le fichier soit
// prefixe par `${auth.uid()}/…` (policy owner_insert).
// Formats : jpg / jpeg / png / webp uniquement, max 5 MB.
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function uploadReviewPhoto(file, userId) {
  if (!file) return null;
  if (!userId) {
    // Recupere le user courant si non fourni
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id;
    if (!userId) { console.warn('[uploadReviewPhoto] not authenticated'); return null; }
  }

  if (file.size > MAX_FILE_SIZE) {
    console.warn('[uploadReviewPhoto] file too large:', file.size);
    return null;
  }
  const type = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.includes(type)) {
    console.warn('[uploadReviewPhoto] mime not allowed:', type);
    return null;
  }

  const compressed = await compressImage(file, 1200, 0.82);
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('review-photos')
    .upload(fileName, compressed, {
      contentType: type === 'image/png' ? 'image/png' : type === 'image/webp' ? 'image/webp' : 'image/jpeg',
      upsert: false,
    });
  if (error) { console.error('[uploadReviewPhoto]', error.message); return null; }

  const { data } = supabase.storage.from('review-photos').getPublicUrl(fileName);
  const url = data?.publicUrl || null;
  return isSafeReviewPhotoUrl(url) ? url : null;
}

export async function markReviewHelpful(reviewId) {
  if (!reviewId) return;
  try {
    const { error } = await supabase.rpc('increment_review_helpful', { review_id: reviewId });
    if (!error) return;
  } catch { /* fallback */ }

  const { data } = await supabase.from('product_reviews').select('helpful_count').eq('id', reviewId).single();
  if (data) {
    await supabase.from('product_reviews')
      .update({ helpful_count: (data.helpful_count || 0) + 1 })
      .eq('id', reviewId);
  }
}

export async function reportReview(reviewId, reason = 'flagged_by_user') {
  if (!reviewId) return;
  await supabase.from('product_reviews')
    .update({ status: 'flagged', flagged_reason: reason })
    .eq('id', reviewId);
}

export async function getReviewStats(productId) {
  const reviews = await getProductReviews(productId);
  if (reviews.length === 0) return { avg: 0, total: 0, distribution: [0, 0, 0, 0, 0] };
  const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
  const avg = sum / reviews.length;
  const distribution = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;
  });
  return { avg, total: reviews.length, distribution };
}

export async function respondToReview(_reviewId, _response) {
  // NOOP : la reponse pharmacie n'est pas dans product_reviews.
  // Conserve pour compat API : on ignore silencieusement.
  return { data: null, error: null };
}
