// ════════════════════════════════════════════════════════════════════
// ImageZoom — Zoom premium sur galerie produit
// - Desktop : hover + mouseMove ajuste background-position sur un
//   overlay (effet "loupe" plein cadre style Amazon / Sephora).
// - Mobile  : pinch-to-zoom simplifie (2 doigts) avec transform:scale.
// - Fallback : simple <img> si onError.
// ════════════════════════════════════════════════════════════════════

import { useRef, useState, useCallback, useEffect } from 'react';
import './ImageZoom.css';

export default function ImageZoom({
  src,
  alt = '',
  zoomLevel = 2.2,
  className = '',
  onError,
}) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  // Touch pinch state
  const touchState = useRef({
    startDist: 0,
    startScale: 1,
    scale: 1,
    dragging: false,
  });
  const [tScale, setTScale] = useState(1);

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const onMouseMove = useCallback((e) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }, []);

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState.current.startDist = Math.hypot(dx, dy);
      touchState.current.startScale = tScale;
      touchState.current.dragging = true;
    }
  }, [tScale]);

  const onTouchMove = useCallback((e) => {
    if (!touchState.current.dragging || e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / (touchState.current.startDist || 1);
    const next = Math.max(1, Math.min(3, touchState.current.startScale * ratio));
    setTScale(next);
  }, []);

  const onTouchEnd = useCallback(() => {
    touchState.current.dragging = false;
    if (tScale < 1.15) setTScale(1); // snap back
  }, [tScale]);

  useEffect(() => {
    setTScale(1);
    setHover(false);
  }, [src]);

  return (
    <div
      ref={wrapRef}
      className={`img-zoom ${hover ? 'is-hover' : ''} ${className}`}
      onMouseEnter={() => !isTouchDevice && setHover(true)}
      onMouseLeave={() => !isTouchDevice && setHover(false)}
      onMouseMove={!isTouchDevice ? onMouseMove : undefined}
      onTouchStart={isTouchDevice ? onTouchStart : undefined}
      onTouchMove={isTouchDevice ? onTouchMove : undefined}
      onTouchEnd={isTouchDevice ? onTouchEnd : undefined}
      style={{ '--zoom-bg': `url(${JSON.stringify(src || '')})` }}
    >
      <img
        src={src}
        alt={alt}
        className="img-zoom-img"
        style={{
          transform: isTouchDevice ? `scale(${tScale})` : undefined,
          transformOrigin: 'center',
          transition: touchState.current.dragging ? 'none' : 'transform 200ms var(--y-ease-out)',
        }}
        onError={onError}
        draggable={false}
      />

      {!isTouchDevice && hover && (
        <div
          className="img-zoom-lens"
          style={{
            backgroundImage: `url(${JSON.stringify(src || '').replace(/^"|"$/g, '')})`,
            backgroundSize: `${zoomLevel * 100}% ${zoomLevel * 100}%`,
            backgroundPosition: `${pos.x}% ${pos.y}%`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
