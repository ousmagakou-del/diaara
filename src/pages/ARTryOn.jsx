// ════════════════════════════════════════════════════════════════════
// ARTryOn.jsx — Essayage virtuel (route /ar/:productId)
// ════════════════════════════════════════════════════════════════════
// Scaffold : placeholder pour l integration future de Perfect Corp ou
// ModiFace. L utilisateur peut s inscrire a la beta pour recevoir une
// notif quand l essayage virtuel est disponible pour ce produit.
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { useNav, useUser } from '../App';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { haptic } from '../lib/haptic';
import './ARTryOn.css';

async function fetchProduct(productId) {
  if (!productId) return null;
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, brand_name, image_url, price, category, tags')
      .eq('id', productId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) {
    console.warn('[ARTryOn.fetchProduct]', e?.message);
    return null;
  }
}

async function checkIsOnWaitlist(userId, productId) {
  if (!userId || !productId) return false;
  try {
    const { count } = await supabase
      .from('ar_beta_waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('product_id', productId);
    return (count || 0) > 0;
  } catch { return false; }
}

async function joinWaitlist(productId) {
  try {
    const { data: sess } = await supabase.auth.getUser();
    const uid = sess?.user?.id;
    if (!uid) return { error: 'not_authenticated' };
    const { error } = await supabase
      .from('ar_beta_waitlist')
      .upsert({ user_id: uid, product_id: productId }, { onConflict: 'user_id,product_id' });
    if (error) throw error;
    return { error: null };
  } catch (e) {
    return { error: e?.message || 'unknown_error' };
  }
}

export default function ARTryOn() {
  const { navigate, goBack, route } = useNav();
  const { user } = useUser();
  const productId = route?.params?.productId;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [joining, setJoining] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, w] = await Promise.all([
      fetchProduct(productId),
      user ? checkIsOnWaitlist(user.id, productId) : Promise.resolve(false),
    ]);
    setProduct(p);
    setOnWaitlist(w);
    setLoading(false);
  }, [productId, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleJoin = async () => {
    if (!user) {
      toast('Connecte-toi pour rejoindre la beta', 'info');
      navigate('auth');
      return;
    }
    setJoining(true);
    try {
      haptic('light');
      const { error } = await joinWaitlist(productId);
      if (error) throw new Error(error);
      setOnWaitlist(true);
      toast('Inscription a la beta enregistree');
    } catch (e) {
      toast(e?.message || 'Erreur inscription', 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="ar-page">
      <header className="ar-topbar">
        <button className="ar-back" type="button" onClick={() => goBack('shop')} aria-label="Retour">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Retour</span>
        </button>
        <span className="ar-topbar__title">Essayage virtuel</span>
        <span className="ar-topbar__spacer" />
      </header>

      <div className="ar-card">
        <div className="ar-preview">
          {product?.image_url ? (
            <img
              src={product.image_url}
              alt={product.name || ''}
              className="ar-preview__img"
              loading="lazy"
            />
          ) : (
            <div className="ar-preview__ph">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 15l-5-5-8 8" />
              </svg>
            </div>
          )}
          <span className="ar-preview__badge">Bientot</span>
        </div>

        <div className="ar-info">
          <span className="ar-info__eyebrow">ESSAYAGE VIRTUEL BIENTOT</span>
          <h1 className="ar-info__title">
            {loading ? 'Chargement...' : product?.name || 'Produit'}
          </h1>
          {product?.brand_name ? (
            <div className="ar-info__brand">{product.brand_name}</div>
          ) : null}

          <p className="ar-info__lead">
            Essaie ce produit en realite augmentee, directement depuis ton telephone.
            Notre technologie AR arrive tres bientot. Inscris-toi pour recevoir une
            notification des qu elle est disponible.
          </p>

          <ul className="ar-info__perks">
            <li>Essayage temps reel en camera face</li>
            <li>Compare plusieurs teintes en un swipe</li>
            <li>Partage ton look avec ton pharmacien</li>
          </ul>

          <button
            type="button"
            className="ar-cta"
            onClick={handleJoin}
            disabled={joining || onWaitlist}
          >
            {onWaitlist ? 'Inscription confirmee' : joining ? 'Inscription...' : 'M inscrire a la beta'}
          </button>

          <p className="ar-info__legal">
            On te previendra des que l essayage virtuel est actif pour ce produit.
            Sans engagement, desinscription possible a tout moment.
          </p>
        </div>
      </div>
    </div>
  );
}
