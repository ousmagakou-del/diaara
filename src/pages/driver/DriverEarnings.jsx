import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const fmtFcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week',  label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'total', label: 'Total' },
];

export default function DriverEarnings({ session }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.token) return;
      try {
        const { data: r, error } = await supabase.rpc('driver_get_earnings', { p_token: session.token });
        if (cancelled) return;
        if (error || !r?.success) {
          console.warn('[Earnings] error:', error || r);
          return;
        }
        setData(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.token]);

  const current = data?.[period] || { count: 0, fcfa: 0 };
  const breakdown = data?.breakdown || [];
  const recent = data?.recent || [];
  const maxBar = Math.max(1, ...breakdown.map((b) => Number(b.fcfa) || 0));

  if (loading) {
    return (
      <div className="dvr-page">
        <div className="dvr-skel" style={{ height: 140, marginBottom: 12 }} />
        <div className="dvr-skel" style={{ height: 60, marginBottom: 12 }} />
        <div className="dvr-skel" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <>
      <header className="dvr-header">
        <div className="dvr-header-card">
          <div className="dvr-avatar" style={{ background: 'linear-gradient(135deg, var(--y-warning), #C18C13)' }} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="dvr-header-text">
            <div className="dvr-header-name">Mes gains</div>
            <div className="dvr-header-sub">Estimation des courses livrées</div>
          </div>
        </div>
      </header>

      <div className="dvr-page">
        {/* HERO GAINS */}
        <div className="dvr-earn-hero">
          <div className="dvr-earn-tag">{PERIODS.find((p) => p.key === period)?.label}</div>
          <div className="dvr-earn-amount">{fmtFcfa(current.fcfa)}</div>
          <div className="dvr-earn-count">
            {current.count} livraison{current.count > 1 ? 's' : ''}
          </div>
        </div>

        {/* PERIODES */}
        <div className="dvr-period-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`dvr-period-tab ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* BREAKDOWN BAR CHART */}
        <div className="dvr-card">
          <div className="dvr-section-label" style={{ marginBottom: 4, padding: 0 }}>
            7 derniers jours
          </div>
          {breakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--dvr-text-mute)', padding: '20px 0' }}>
              Aucune donnée pour cette période.
            </div>
          ) : (
            <div className="dvr-bars">
              {breakdown.map((b) => {
                const pct = maxBar > 0 ? Math.max(4, Math.round((Number(b.fcfa) / maxBar) * 100)) : 4;
                return (
                  <div className="dvr-bar" key={b.day}>
                    <div className="dvr-bar-track">
                      <div
                        className="dvr-bar-fill"
                        style={{ height: `${pct}%` }}
                        title={`${b.label} : ${fmtFcfa(b.fcfa)} (${b.count} livraison${b.count > 1 ? 's' : ''})`}
                      />
                    </div>
                    <div className="dvr-bar-label">{b.label.slice(0, 3)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="dvr-divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--dvr-text-mute)' }}>
            <span>Total 7 jours : <strong style={{ color: 'var(--dvr-text)' }}>{fmtFcfa(breakdown.reduce((s, b) => s + Number(b.fcfa || 0), 0))}</strong></span>
            <span>{breakdown.reduce((s, b) => s + Number(b.count || 0), 0)} courses</span>
          </div>
        </div>

        {/* DERNIERES LIVRAISONS */}
        <div className="dvr-section">
          <div className="dvr-section-label">Dernières livraisons</div>
          {recent.length === 0 ? (
            <div className="dvr-empty">
              <div className="dvr-empty-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
              <div className="dvr-empty-title">Pas encore de gains</div>
              <div className="dvr-empty-sub">
                Tes gains apparaîtront ici dès tes premières livraisons complétées.
              </div>
            </div>
          ) : (
            <div className="dvr-card" style={{ padding: '8px 16px' }}>
              {recent.map((o) => (
                <div className="dvr-history-row" key={o.id}>
                  <div className="dvr-history-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
                  <div className="dvr-history-mid">
                    <div className="dvr-history-name">
                      {o.address?.name || 'Cliente'}
                    </div>
                    <div className="dvr-history-date">
                      #{String(o.id).slice(0, 8)} · {new Date(o.done_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      {' · '}
                      <span style={{ color: 'var(--dvr-text-mid)' }}>{fmtFcfa(o.total)} cmd</span>
                    </div>
                  </div>
                  <div className="dvr-history-amt">+{fmtFcfa(o.earn)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--dvr-text-mute)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
          Estimation indicative : 1000 FCFA de base + 200 FCFA par article<br />
          (plafonné à 3000 FCFA / course). Le montant final est confirmé par l'admin.
        </div>
      </div>
    </>
  );
}
