// ============================================================
// YARAM — ProgressRing
// Ring SVG parametrable (utilise pour loyalty tier, scan score,
// step progress, etc.). Design tokens uniquement.
// ============================================================
import { useEffect, useState } from 'react';

export default function ProgressRing({
  size = 132,
  stroke = 10,
  value = 0,            // 0..100
  color,                // fallback var(--y-brand)
  trackColor,           // fallback var(--y-n-200)
  duration = 900,       // ms d'anim
  children,             // contenu centre
  ariaLabel,
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, Number(value) || 0));
    const start = performance.now();
    const from = 0;
    let raf;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(from + (target - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (display / 100) * c;

  const strokeColor = color || 'var(--y-brand)';
  const track = trackColor || 'var(--y-n-200)';

  return (
    <div
      className="y-progress-ring"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke 0.3s ease' }}
        />
      </svg>
      {children != null && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', pointerEvents: 'none', textAlign: 'center',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
