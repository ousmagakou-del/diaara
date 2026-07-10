// ════════════════════════════════════════════════════════════════════
// Stepper — Selecteur de quantite premium (+/-)
// ════════════════════════════════════════════════════════════════════

import './Stepper.css';

const IcoMinus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IcoPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export default function Stepper({
  value = 1,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  disabled = false,
  ariaLabel = 'Quantite',
}) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const dec = () => !disabled && value > min && onChange?.(clamp(value - 1));
  const inc = () => !disabled && value < max && onChange?.(clamp(value + 1));

  return (
    <div className={`stepper stepper--${size} ${disabled ? 'is-disabled' : ''}`} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="stepper-btn"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Diminuer"
      >
        <IcoMinus />
      </button>
      <span className="stepper-value" aria-live="polite">{value}</span>
      <button
        type="button"
        className="stepper-btn"
        onClick={inc}
        disabled={disabled || value >= max}
        aria-label="Augmenter"
      >
        <IcoPlus />
      </button>
    </div>
  );
}
