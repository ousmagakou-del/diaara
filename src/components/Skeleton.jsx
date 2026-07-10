// ════════════════════════════════════════════════════════════════════
// YARAM — Skeleton (loader shimmer réutilisable)
// ────────────────────────────────────────────────────────────────────
// Composant unique pour tous les états de chargement du site. Le
// shimmer utilise UNIQUEMENT les tokens CSS (packages/design-tokens).
// ════════════════════════════════════════════════════════════════════

import './Skeleton.css';

/**
 * Skeleton — bloc animé "pulse" utilisable partout où on attend des données.
 *
 * @param {'text'|'circle'|'rect'|'card'|'thumb'|'chip'} [variant='rect']
 *   Forme préréglée. Pour un contrôle libre, laisse rect + width/height.
 * @param {number|string} [width]  Largeur (px ou string css). Défaut 100%.
 * @param {number|string} [height] Hauteur (px ou string css). Défaut 16.
 * @param {number|string} [radius] Radius override (défaut selon variant).
 * @param {string} [className] Classes additionnelles.
 * @param {object} [style]     Style inline additionnel.
 */
export default function Skeleton({
  variant = 'rect',
  width,
  height,
  radius,
  className = '',
  style = {},
}) {
  const w = width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined;
  const h = height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined;
  const r = radius !== undefined ? (typeof radius === 'number' ? `${radius}px` : radius) : undefined;

  const finalStyle = {
    ...(w ? { width: w } : {}),
    ...(h ? { height: h } : {}),
    ...(r ? { borderRadius: r } : {}),
    ...style,
  };

  return <span className={`y-skel y-skel--${variant} ${className}`} style={finalStyle} />;
}

/**
 * SkeletonProductCard — placeholder d'une ProductTile complète (image + textes + prix).
 * A utiliser dans les grilles pendant le fetch.
 */
export function SkeletonProductCard() {
  return (
    <div className="y-skel-card">
      {/* image 1:1 (matche .y-tile__img) */}
      <span className="y-skel y-skel-card-thumb" />
      <div className="y-skel-card-body">
        {/* brand line ~12px (matche .y-tile__brand fs-xs) */}
        <Skeleton variant="text" width="40%" height={12} />
        {/* name 2 lignes ~48px (matche .y-tile__name min-height) */}
        <Skeleton variant="text" width="100%" height={48} radius={6} />
        {/* meta 18px (matche .y-tile__meta min-height) */}
        <Skeleton variant="text" width="50%" height={18} />
        {/* prix 20px (matche .y-tile__price fs-md) */}
        <Skeleton variant="text" width={90} height={20} />
      </div>
    </div>
  );
}

/**
 * SkeletonBrandCard — placeholder BrandTile.
 */
export function SkeletonBrandCard() {
  return (
    <div className="y-skel-brand">
      <Skeleton variant="circle" width={64} height={64} />
      <Skeleton variant="text" width="70%" height={12} />
      <Skeleton variant="text" width="40%" height={10} />
    </div>
  );
}

/**
 * SkeletonList — n cards en boucle (utilitaire).
 */
export function SkeletonList({ count = 6, ItemComponent = SkeletonProductCard }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ItemComponent key={i} />
      ))}
    </>
  );
}
