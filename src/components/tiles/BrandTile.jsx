// ════════════════════════════════════════════════════════════════════
// YARAM — BrandTile (grille marques mise en avant)
// ────────────────────────────────────────────────────────────────────
// Tuile marque premium avec logo centré, nom, ville / tagline en sous-titre.
// Utilisée sur la home, le Search empty state, la page Categories.
// ════════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { useNav } from '../../App';
import { imgSrc } from '../../lib/imgSrc';
import './BrandTile.css';

/**
 * @param {object} props
 * @param {object} props.brand — { id, name, img|logo, city, tagline, product_count, local }
 * @param {'md'|'sm'} [props.size]
 * @param {(brand:object)=>void} [props.onOpen]
 */
function BrandTile({ brand, size = 'md', onOpen }) {
  const { navigate } = useNav();
  if (!brand) return null;

  const logo = brand.img || brand.logo_url || brand.logo || null;
  const tagline = brand.tagline || brand.description || null;
  const city = brand.city || brand.origin || null;
  const count = Number(brand.product_count || 0);

  const handleOpen = () => {
    if (onOpen) return onOpen(brand);
    if (brand.id) navigate({ name: 'brand', id: brand.id, params: { id: brand.id } });
    else navigate({ name: 'search', params: { brand: brand.name } });
  };

  return (
    <button
      type="button"
      className={`y-brand-tile y-brand-tile--${size}`}
      onClick={handleOpen}
      aria-label={brand.name}
    >
      <div className="y-brand-tile__logo">
        {logo ? (
          <img
            src={imgSrc(logo, { w: size === 'sm' ? 180 : 260, q: 82 })}
            alt={brand.name}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fb = e.currentTarget.nextSibling;
              if (fb) fb.style.display = 'flex';
            }}
          />
        ) : null}
        <span
          className="y-brand-tile__logo-fallback"
          style={{ display: logo ? 'none' : 'flex' }}
        >
          {(brand.name || '?').slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="y-brand-tile__body">
        <span className="y-brand-tile__name">{brand.name}</span>
        {(city || tagline) && (
          <span className="y-brand-tile__sub">
            {city ? city : ''}
            {city && tagline ? ' · ' : ''}
            {tagline || ''}
          </span>
        )}
        {count > 0 && (
          <span className="y-brand-tile__count">
            {count} produit{count > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  );
}

export default memo(BrandTile, (prev, next) => (
  prev.brand?.id === next.brand?.id &&
  prev.brand?.name === next.brand?.name &&
  prev.size === next.size
));
