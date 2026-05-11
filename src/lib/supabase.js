import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qxhhnrnworwrnwmqekmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4aGhucm53b3J3cm53bXFla21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTExMzYsImV4cCI6MjA5NDA4NzEzNn0.l_7-Eg06UFnXvSw1BQiuNw0yU94jillHNycx-jvP1Aw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══ AUTH ═══
export async function signUp(email, password, firstName) {
  return supabase.auth.signUp({
    email, password,
    options: { data: { first_name: firstName } },
  });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users_profile').select('*').eq('id', user.id).single();
  return profile;
}

export async function updateProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase.from('users_profile').update(updates).eq('id', user.id).select().single();
}

// ═══ PRODUITS & MARQUES ═══
export async function getAllProducts() {
  const { data } = await supabase.from('products').select('*').eq('active', true);
  return data || [];
}

export async function getAllBrands() {
  const { data } = await supabase.from('brands').select('*');
  return data || [];
}

export async function getProductAvailability(productId) {
  const { data } = await supabase
    .from('inventory')
    .select('*, pharmacy:pharmacies(*)')
    .eq('product_id', productId)
    .gt('stock', 0)
    .eq('active', true);
  return data || [];
}

// ═══ PHARMACIES ═══
export async function getAllPharmacies() {
  const { data } = await supabase.from('pharmacies').select('*').eq('active', true);
  return data || [];
}

// ═══ COMMANDES ═══
function generateOrderId() {
  return 'DIA-' + Date.now().toString(36).toUpperCase();
}

export async function createOrder({ items, address, paymentMethod, subtotal, shipping, total, promoCode }) {
  const { data: { user } } = await supabase.auth.getUser();
  const order = {
    id: generateOrderId(),
    user_id: user?.id,
    status: 'pending_payment',
    items, address,
    payment_method: paymentMethod,
    subtotal, shipping, total,
    promo_code: promoCode,
  };
  const { data, error } = await supabase.from('orders').insert(order).select().single();
  return error ? null : data;
}

export async function getMyOrders() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return data || [];
}

export async function updateOrderStatus(id, status) {
  return supabase.from('orders').update({ status }).eq('id', id);
}

// ═══ REALTIME ═══
export function subscribeToNewOrders(callback) {
  return supabase
    .channel('orders-changes')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => callback(payload.new))
    .subscribe();
}