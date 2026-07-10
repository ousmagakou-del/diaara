// ════════════════════════════════════════════════════════════════════
// YARAM — ProductTile (grille catalogue, home, search, categories)
// ────────────────────────────────────────────────────────────────────
// Version world-class basée sur les design tokens. Zero hex en dur.
// Deux tailles : 'md' (default) et 'sm' (rails horizontaux compacts).
// ════════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { useNav } from '../../App';
import { addToCart } from '../../lib/cart';
import { imgSrc } from '../../lib/imgSrc';
import { formatPrice } from '../../lib/utils';
import './ProductTile.css';

/**
 * @param {object} props
 * @param {object} props.product   — l'objet produit (id, name, brand, price, image_url|img, rating, review_count, badges, promo, old_price, stock, is_imported, lead_time_days)
 * @param {'md'|'sm'} [props.size] — taille visuelle
 * @param {object|null} [props.pharmacy] — pharmacie source pour add-to-cart (optionnel)
 * @param {(product:object)=>void} [props.onOpen] — override navigation
 */
function ProductTile({ product, size = 'md', pharmacy = null, onOpen }) {
  const { navigate } = useNav();
  if (!product) return null;

  const price = Number(product.price) || 0;
  const oldPrice = Number(product.old_price || product.list_price || 0);
  const hasPromo = oldPrice && oldPrice > price;
  const promoPct = hasPromo ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  const rating = Number(product.rating) || 0;
  const reviews = Number(product.review_count) || 0;
  const stock = product.stock;
  const lowStock = typeof stock === 'number' && stock > 0 && stock < 5;
  const outOfStock = typeof stock === 'number' && stock <= 0;

  const image = product.image_url || product.img || null;
  const brand = product.brand || product.brand_name || '';

  const handleOpen = () => {
    if (onOpen) return onOpen(product);
    navigate({ name: 'product', params: { id: product.id }, id: product.id });
  };

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!pharmacy) {
      // Pas de pharmacie fournie → on route sur la fiche produit pour choix pharma.
      handleOpen();
      return;
    }
    try {
      addToCart({
        product: {
          id: product.id,
          name: product.name,
          brand,
          img: image,
          price,
          is_imported: product.is_imported,
          lead_time_days: product.lead_time_days,
          origin_country: product.origin_country,
        },
        pharmacy,
        qty: 1,
      });
    } catch { /* silencieux */ }
  };

  return (
    <button
      type="button"
      className={`y-tile y-tile--${size}`}
      onClick={handleOpen}
      aria-label={`${brand} ${product.name}`}
    >
      <div className="y-tile__img">
        {image ? (
          <img
            src={imgSrc(image, { w: size === 'sm' ? 260 : 420, q: 82 })}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
        ) : (
          <div className="y-tile__img-fallback" aria-hidden>
            {(brand || product.name || '?').slice(0, 2).toUpperCase()}
          </div>
        )}

        {hasPromo && (
          <span className="y-tile__badge y-tile__badge--promo">-{promoPct}%</span>
        )}
        {!hasPromo && product.is_imported && (
          <span className="y-tile__badge y-tile__badge--import">Import</span>
        )}
        {lowStock && (
          <span className="y-tile__badge y-tile__badge--stock">
            Plus que {stock}
          </span>
        )}
        {outOfStock && (
          <span className="y-tile__badge y-tile__badge--out">Rupture</span>
        )}

        <span
          className="y-tile__add"
          onClick={handleAdd}
          role="button"
          aria-label="Ajouter au panier"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </div>

      <div className="y-tile__body">
        {brand && <span className="y-tile__brand">{brand}</span>}
        <span className="y-tile__name">{product.name}</span>

        <div className="y-tile__meta">
          {rating > 0 && (
            <span className="y-tile__rating">
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {rating.toFixed(1)}
              {reviews > 0 && <span className="y-tile__reviews">({reviews})</span>}
            </span>
          )}
        </div>

        <div className="y-tile__bottom">
          <div className="y-tile__prices">
            <span className="y-tile__price">{formatPrice(price)} FCFA</span>
            {hasPromo && <span className="y-tile__price-old">{formatPrice(oldPrice)}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

export default memo(ProductTile, (prev, next) => (
  prev.product?.id === next.product?.id &&
  prev.product?.price === next.product?.price &&
  prev.product?.stock === next.product?.stock &&
  prev.size === next.size &&
  prev.pharmacy?.id === next.pharmacy?.id
));
