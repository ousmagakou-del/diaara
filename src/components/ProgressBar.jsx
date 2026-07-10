// ════════════════════════════════════════════════════════════════════
// ProgressBar — Barre de progression multi-etape (checkout)
// Style Amazon / Best Buy : cercles numerotes + connecteurs remplis.
// ════════════════════════════════════════════════════════════════════

import './ProgressBar.css';

const IcoCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

/**
 * <ProgressBar
 *   steps={[{ id, label }]}
 *   current="delivery"
 *   onStepClick={(id, index) => ...}   // optionnel : navigation
 * />
 */
export default function ProgressBar({ steps = [], current, onStepClick, className = '' }) {
  const currentIdx = Math.max(0, steps.findIndex((s) => s.id === current));

  return (
    <nav className={`pb ${className}`} aria-label="Etapes du checkout">
      <ol className="pb-list">
        {steps.map((step, i) => {
          const state =
            i < currentIdx ? 'done' :
            i === currentIdx ? 'current' :
            'todo';
          const clickable = onStepClick && i <= currentIdx;
          return (
            <li key={step.id} className={`pb-step pb-step--${state}`}>
              {i > 0 && (
                <span className={`pb-conn ${i <= currentIdx ? 'pb-conn--filled' : ''}`} aria-hidden />
              )}
              <button
                type="button"
                className="pb-node"
                onClick={() => clickable && onStepClick(step.id, i)}
                disabled={!clickable}
                aria-current={i === currentIdx ? 'step' : undefined}
              >
                <span className="pb-node-circle">
                  {state === 'done' ? <IcoCheck /> : <span>{i + 1}</span>}
                </span>
                <span className="pb-node-label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
