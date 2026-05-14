import { useState, useEffect } from 'react';
import { useNav } from '../App';
import { scoreClass, formatPrice } from '../lib/utils';
import { isFavorite, toggleFavorite, getProductAvailability } from '../lib/supabase';
import { addToCart } from '../lib/cart';
import { haptic } from '../lib/haptic';
import './ProductTile.css';

export default function ProductTile({ product, size = 'normal' }) {
  const { navigate } = useNav();
  const [fav, setFav] = useState(false);

  // Quick-add state
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => setFav(await isFavorite(product.id)))();
  }, [product.id]);

  const handleFav = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    haptic('light');
    const next = await toggleFavorite(product.id);
    setFav(next);
  };

  const handleOpen = () => {
    navigate(`/product/${product.id}`);
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2200);
  };

  // ─── Bouton + intelligent ───
  const handleQuickAdd = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    haptic('light');

    try {
      const av = await getProductAvailability(product.id);
      setAdding(false);

      if (!av || av.length === 0) {
        showToast('😢 Aucun stock disponible');
        return;
      }

      // 1 seule pharmacie : ajout direct
      if (av.length === 1) {
        const pharmacy = av[0].pharmacy || av[0];
        addToCart({ product, pharmacy });
        haptic('success');
        showToast('✓ Ajouté au panier');
        return;
      }

      // Plusieurs : picker
      setPharmacies(av);
      setPickerOpen(true);
    } catch (err) {
      setAdding(false);
      showToast('Erreur, réessaie');
      console.error('quickAdd error:', err);
    }
  };

  const handlePick = (av) => {
    const pharmacy = av.pharmacy || av;
    addToCart({ product, pharmacy });
    haptic('success');
    setPickerOpen(false);
    showToast('✓ Ajouté au panier');
  };

  const sc = scoreClass(product.score);
  const fallbackImg = 'https://placehold.co/400x400/E8F5EC/1F8B4C?text=' + encodeURIComponent(product.brand || 'Produit');

  return (
    <>
      <div className={`product-tile ${size}`} onClick={handleOpen} role="button" tabIndex={0}>
        <div className="pt-img-wrap">
          <img
            src={product.img}
            alt={product.name}
            onError={(e) => { e.target.src = fallbackImg; }}
          />
          <div className={`pt-score ${sc}`}>{product.score}</div>
          <button
            type="button"
            className={`pt-fav ${fav ? 'active' : ''}`}
            onClick={handleFav}
            aria-label="Ajouter aux favoris"
          >
            <svg viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
        </div>
        <div className="pt-info">
          <div className="pt-brand">{product.brand}</div>
          <div className="pt-name">{product.name}</div>
          <div className="pt-bottom">
            <span className="pt-price">{formatPrice(product.price)}<small> FCFA</small></span>
            <span className="pt-rating">★ {product.rating}</span>
          </div>
        </div>

        {/* Bouton + flottant */}
        <button
          type="button"
          className="pt-add"
          onClick={handleQuickAdd}
          disabled={adding}
          aria-label="Ajouter au panier"
        >
          {adding ? (
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ animation: 'pt-spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="45" strokeDashoffset="20" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && <div className="pt-toast">{toast}</div>}

      {/* Picker multi-pharmacies */}
      {pickerOpen && (
        <div className="pt-picker-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="pt-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="pt-picker-head">
              <div>
                <h3>Choisis une pharmacie</h3>
                <p>{product.name}</p>
              </div>
              <button className="pt-picker-close" onClick={() => setPickerOpen(false)}>×</button>
            </div>
            <div className="pt-picker-body">
              {pharmacies.map((av) => {
                const ph = av.pharmacy || av;
                const stock = av.stock ?? '?';
                const price = av.custom_price || product.price;
                return (
                  <button key={ph.id} className="pt-picker-row" onClick={() => handlePick(av)}>
                    <div className="pt-picker-left">
                      <strong>{ph.name}</strong>
                      <span>📍 {ph.neighborhood ? ph.neighborhood + ', ' : ''}{ph.city}</span>
                    </div>
                    <div className="pt-picker-right">
                      <div className="pt-picker-price">{formatPrice(price)} FCFA</div>
                      <div className="pt-picker-stock">{stock} en stock</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
