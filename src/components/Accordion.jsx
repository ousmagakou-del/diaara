// ════════════════════════════════════════════════════════════════════
// Accordion — Composant premium, controllable (mono ou multi ouvert)
// ════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import './Accordion.css';

/**
 * <Accordion
 *   items={[{ id, title, subtitle?, content }]}
 *   defaultOpen="description"
 *   allowMultiple={false}
 * />
 */
export default function Accordion({
  items = [],
  defaultOpen,
  allowMultiple = false,
  className = '',
}) {
  const [openSet, setOpenSet] = useState(() => {
    if (!defaultOpen) return new Set();
    if (Array.isArray(defaultOpen)) return new Set(defaultOpen);
    return new Set([defaultOpen]);
  });

  const toggle = useCallback((id) => {
    setOpenSet((cur) => {
      const next = new Set(cur);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (!allowMultiple) next.clear();
      next.add(id);
      return next;
    });
  }, [allowMultiple]);

  return (
    <div className={`acc ${className}`}>
      {items.map((item) => {
        const open = openSet.has(item.id);
        return (
          <div key={item.id} className={`acc-item ${open ? 'acc-item--open' : ''}`}>
            <button
              type="button"
              className="acc-head"
              aria-expanded={open}
              aria-controls={`acc-body-${item.id}`}
              onClick={() => toggle(item.id)}
            >
              <div className="acc-head-txt">
                <span className="acc-title">{item.title}</span>
                {item.subtitle && <span className="acc-subtitle">{item.subtitle}</span>}
              </div>
              <span className="acc-chev" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </button>
            <div id={`acc-body-${item.id}`} className="acc-body" role="region">
              <div className="acc-body-inner">
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
