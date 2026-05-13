import { useState, useEffect } from 'react';
import { useNav } from '../App';
import { getAllProducts, getProductAvailability, isFavorite, toggleFavorite } from '../lib/supabase';
import { scoreClass, formatPrice } from '../lib/utils';
import { haptic } from '../lib/haptic';
import ReviewsSection from '../components/ReviewsSection';
import './Product.css';

export default function Product({ id }) {
  const { navigate } = useNav();
  const [product, setProduct] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPh, setSelectedPh] = useState(null);
  const [tab, setTab] = useState('ingredients');
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await getAllProducts();
      const p = all.find(x => x.id === id);
      setProduct(p);
      if (p) {
        const [av, isFav] = await Promise.all([
          getProductAvailability(p.id),
          isFavorite(p.id),
        ]);
        setPharmacies(av);
        setFav(isFav);
        if (av.length > 0) setSelectedPh(av[0]);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleFav = async () => {
    haptic('light');
    const next = await toggleFavorite(product.id);
    setFav(next);
  };

  const addToCart = () => {
    if (!selectedPh) {
      alert('Sélectionne une pharmacie');
      return;
    }
    try {
      const cart = JSON.parse(localStorage.getItem('diaara_cart') || '[]');
      const exists = cart.find(c => c.productId === product.id && c.pharmacyId === selectedPh.pharmacy.id);
      if (exists) exists.qty += 1;
      else cart.push({
        productId: product.id,
        pharmacyId: selectedPh.pharmacy.id,
        pharmacyName: selectedPh.pharmacy.name,
        name: product.name,
        brand: product.brand,
        img: product.img,
        price: product.price,
        qty: 1,
      });
      localStorage.setItem('diaara_cart', JSON.stringify(cart));
      haptic('success');
      navigate('/cart');
    } catch (e) {
      alert('Erreur panier');
    }
  };

  if (loading) return <div style={{padding: 40, textAlign: 'center'}}>Chargement…</div>;

  if (!product) {
    return (
      <div style={{padding: 40, textAlign: 'center'}}>
        <p>Produit introuvable</p>
        <button className="btn-primary" onClick={() => navigate('/')} style={{ marginTop: 20 }}>Retour</button>
      </div>
    );
  }

  const sc = scoreClass(product.score);
  const hasStock = pharmacies.length > 0;
  const waUrl = "https://wa.me/221785211234?text=" + encodeURIComponent("Bonjour, j'ai une question sur " + product.name);

  return (
    <div className="prod-screen page-anim">
      <div className="prod-header">
        <button className="icon-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{display: 'flex', gap: 8}}>
          <button className={`icon-back-btn ${fav ? 'fav-active' : ''}`} onClick={handleFav} style={fav ? {color: '#D9342B'} : {}}>
            <svg viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
          <button className="icon-back-btn" onClick={() => navigate('/cart')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="prod-scroll">
        <div className="prod-image">
          <img src={product.img} alt={product.name} />
          <div className={`prod-score ${sc}`}>
            <div className="prod-score-num">{product.score}</div>
            <div className="prod-score-lbl">/100</div>
          </div>
        </div>

        <div className="prod-info">
          <div className="prod-brand">{product.brand}</div>
          <h1 className="prod-name">{product.name}</h1>
          <p className="prod-short">{product.short_desc}</p>

          <div className="prod-rating">
            <span>★ {product.rating}</span>
            <span style={{color: 'var(--ink-soft)'}}>· {product.review_count} avis</span>
          </div>

          <div className="prod-price">
            <strong>{formatPrice(product.price)}</strong>
            <small>FCFA</small>
          </div>

          {product.badges?.length > 0 && (
            <div className="prod-badges">
              {product.badges.map(b => <span key={b} className="prod-badge">{b}</span>)}
            </div>
          )}

          <div className="prod-tabs">
            <button className={`prod-tab ${tab === 'ingredients' ? 'active' : ''}`} onClick={() => setTab('ingredients')}>Ingrédients</button>
            <button className={`prod-tab ${tab === 'desc' ? 'active' : ''}`} onClick={() => setTab('desc')}>Description</button>
            <button className={`prod-tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>Avis</button>
          </div>

          <div className="prod-tab-content">
            {tab === 'ingredients' && (
              <p style={{fontSize: 12, lineHeight: 1.6, color: 'var(--ink-soft)'}}>{product.inci || 'INCI non disponible'}</p>
            )}
            {tab === 'desc' && (
              <div>
                <p style={{fontSize: 13, lineHeight: 1.6, color: 'var(--ink)'}}>{product.long_desc}</p>
                {product.reason && (
                  <div style={{marginTop: 12, padding: 12, background: 'var(--excellent-bg)', borderRadius: 10, fontSize: 12}}>
                    💡 <strong>Pourquoi pour toi :</strong> {product.reason}
                  </div>
                )}
              </div>
            )}
            {tab === 'reviews' && (
              <ReviewsSection productId={product.id} />
            )}
          </div>

          <div className="prod-section">
            <h3 className="prod-section-title">🏥 Disponible chez {pharmacies.length} pharmacie{pharmacies.length > 1 ? 's' : ''}</h3>
            {!hasStock ? (
              <div className="prod-no-stock">😢 Aucune pharmacie n'a ce produit en stock</div>
            ) : (
              <div className="prod-pharmacies">
                {pharmacies.map(av => (
                  <button
                    key={av.id}
                    className={`prod-ph-card ${selectedPh?.id === av.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPh(av)}
                  >
                    <div className="prod-ph-radio">
                      {selectedPh?.id === av.id && <div className="prod-ph-radio-dot" />}
                    </div>
                    <div className="prod-ph-info">
                      <strong>{av.pharmacy.name}</strong>
                      <span>📍 {av.pharmacy.neighborhood}, {av.pharmacy.city}</span>
                    </div>
                    <div className="prod-ph-stock">
                      <span className="prod-ph-stock-num">{av.stock}</span>
                      <span>en stock</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="prod-wa-btn">
            💬 Conseil WhatsApp
          </a>
        </div>
        <div style={{ height: 120 }} />
      </div>

      <div className="prod-cta">
        <button className="btn-primary" onClick={addToCart} disabled={!hasStock}>
          {hasStock ? `Ajouter au panier · ${formatPrice(product.price)} FCFA` : 'Indisponible'}
        </button>
      </div>
    </div>
  );
}