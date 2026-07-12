/* ══════════════════════════════════════════════════════════════════
   YARAM — TrackingTimeline
   Timeline horizontale style Papa Track / Domino s Pizza Tracker.
   Props :
     steps: Array<{
       key: string,
       label: string,            // libelle small caps sous l icone
       icon: ReactComponent,     // composant SVG issu de TrackingIcons
       status: 'done'|'active'|'pending'
     }>
   ══════════════════════════════════════════════════════════════════ */

export default function TrackingTimeline({ steps }) {
  return (
    <ol className="yt-timeline" role="list">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isDone = step.status === 'done';
        const isActive = step.status === 'active';
        const cls = isDone ? 'done' : isActive ? 'active' : 'pending';
        return (
          <li key={step.key} className={`yt-step yt-step-${cls}`}>
            {/* Connector rail (a gauche de la puce, sauf 1er) */}
            {i > 0 && (
              <span
                className={`yt-rail yt-rail-left ${isDone || isActive ? 'yt-rail-on' : ''}`}
                aria-hidden="true"
              />
            )}
            {/* Connector rail (a droite de la puce, sauf dernier) */}
            {i < steps.length - 1 && (
              <span
                className={`yt-rail yt-rail-right ${isDone ? 'yt-rail-on' : ''}`}
                aria-hidden="true"
              />
            )}

            <div className="yt-bubble-wrap">
              <div className="yt-bubble" aria-hidden="true">
                <Icon size={32} />
              </div>
              {isDone && (
                <span className="yt-check" aria-label="Etape terminee">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 8 7 12 13 4" />
                  </svg>
                </span>
              )}
              {isActive && <span className="yt-glow" aria-hidden="true" />}
            </div>
            <span className="yt-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
