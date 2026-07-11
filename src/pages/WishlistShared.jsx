import { useEffect, useState } from 'react';
import { useNav } from '../App';
import { getWishlistBySlug } from '../lib/supabase';
import { ProductTile } from '../components/tiles';
import './Favorites.css';

// ═══════════════════════════════════════════════════════════════
// YARAM — Wishlist publique (partage) — route /wishlist/:slug
//   Accessible sans compte connecté (RPC wishlist_get_by_slug)
// ═══════════════════════════════════════════════════════════════

export default function WishlistShared({ slug: slugProp }) {
  const { navigate } = useNav();
  const slug =
    slugProp ||
    (typeof window !== 'undefined'
      ? window.location.pathname.replace(/^\/wishlist\//, '').replace(/\/$/, '')
      : '');

  const [wl, setWl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getWishlistBySlug(slug);
        if (cancelled) return;
        if (!data) setNotFound(true);
        else setWl(data);
      } catch (e) {
        console.warn('[wishlist-shared]', e?.message);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const handleAddAllToCart = () => {
    if (!wl?.items?.length) return;
    try {
      const cart = JSON.parse(localStorage.getItem('yaram_cart') || '[]');
      wl.items.forEach(p => {
        cart.push({ id: p.id, name: p.name, brand: p.brand, price: p.price, img: p.img, qty: 1 });
      });
      localStorage.setItem('yaram_cart', JSON.stringify(cart));
    } catch {}
    showToast(`${wl.items.length} produit${wl.items.length > 1 ? 's' : ''} ajouté${wl.items.length > 1 ? 's' : ''}`);
    setTimeout(() => navigate('/cart'), 500);
  };

  return (
    <div className="yfav-screen page-anim">
      <header className="yfav-header">
        <button className="yfav-back" onClick={() => navigate('/')} aria-label="Accueil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div className="yfav-title-wrap">
          <h1 className="yfav-title">{wl?.name || 'Liste partagée'}</h1>
          {wl?.owner_name && (
            <p className="yfav-sub">Par {wl.owner_name}</p>
          )}
        </div>
      </header>

      {wl?.description && (
        <p style={{
          margin: '10px 16px 0',
          padding: '10px 14px',
          background: '#FFF',
          border: '1px solid #EFEFEC',
          borderRadius: 12,
          fontSize: 13,
          color: '#4A4A4A',
          lineHeight: 1.5,
        }}>{wl.description}</p>
      )}

      {wl?.items?.length > 0 && (
        <div style={{ padding: '12px 14px 4px' }}>
          <button
            onClick={handleAddAllToCart}
            className="yfav-empty-cta"
            style={{ width: '100%', padding: '14px 22px' }}
          >
            Ajouter tout au panier ({wl.items.length})
          </button>
        </div>
      )}

      <div className="yfav-scroll">
        {loading ? (
          <div className="yfav-skel-grid">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="yfav-skel" />)}
          </div>
        ) : notFound ? (
          <div className="yfav-empty">
            <h3 className="yfav-empty-title">Liste introuvable</h3>
            <p className="yfav-empty-sub">Cette liste n'existe pas ou n'est pas publique.</p>
            <button className="yfav-empty-cta" onClick={() => navigate('/')}>
              Découvrir YARAM
            </button>
          </div>
        ) : !wl?.items?.length ? (
          <div className="yfav-empty">
            <h3 className="yfav-empty-title">Liste vide</h3>
            <p className="yfav-empty-sub">Le propriétaire n'a pas encore ajouté de produits.</p>
          </div>
        ) : (
          <div className="yfav-grid">
            {wl.items.map((p, i) => (
              <div
                key={p.id}
                className="yfav-cell"
                style={{ animationDelay: `${Math.min(i * 35, 600)}ms` }}
              >
                <ProductTile product={p} />
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="yfav-toast">{toast}</div>}
    </div>
  );
}
