// ============================================================
// YARAM — Timeline
// Timeline verticale reutilisable (order tracking, evolution,
// signature status...). Design tokens uniquement.
//
// steps: [{ id, label, sub?, timestamp?, icon? }]
// currentStep: index (0-based). Steps < current sont 'done', ==
// est 'current' (spinner), > est 'future'.
// finished: si true, meme currentStep est marque done (fin de flow)
// ============================================================
import './Timeline.css';

export default function Timeline({
  steps = [],
  currentStep = 0,
  finished = false,
  compact = false,
}) {
  return (
    <ol className={`y-tl ${compact ? 'y-tl-compact' : ''}`}>
      {steps.map((s, i) => {
        const isDone = i < currentStep || (finished && i <= currentStep);
        const isCurrent = i === currentStep && !finished;
        const cls = isDone ? 'done' : isCurrent ? 'current' : 'future';
        return (
          <li
            key={s.id || i}
            className={`y-tl-step y-tl-${cls}`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="y-tl-rail">
              <div className="y-tl-bullet">
                {isDone && (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {isCurrent && <span className="y-tl-spin" aria-hidden="true" />}
              </div>
              {i < steps.length - 1 && <div className="y-tl-line" />}
            </div>
            <div className="y-tl-body">
              <div className="y-tl-label">
                <span>{s.label}</span>
                {s.timestamp && <time className="y-tl-time">{s.timestamp}</time>}
              </div>
              {s.sub && <div className="y-tl-sub">{s.sub}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
