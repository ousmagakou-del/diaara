import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPharmacyStats,
  getPharmacyDashboardKpi,
  getPharmacyTopSellers,
  getPharmacyStockAlerts,
  getPharmacyReorderSuggestions,
  getPharmacyBenchmark,
} from '../lib/supabase';

/* -------------------------------------------------------------------------
 * PharmaDashboard — vue premium (KPI + chart CA 30j + top sellers +
 * stock alerts + reorder suggestions + benchmark anonymise).
 * ------------------------------------------------------------------------- */

const fmtFcfa = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString('fr-FR');
};

const fmtInt = (n) => Number(n || 0).toLocaleString('fr-FR');

/* Chart SVG minimaliste — pas de dependance externe */
function CaLineChart({ series }) {
  const data = Array.isArray(series) ? series : [];
  if (data.length === 0) {
    return <div className="phar-chart-empty">Pas encore de vente sur les 30 derniers jours.</div>;
  }

  const width = 720;
  const height = 220;
  const padTop = 16;
  const padBottom = 32;
  const padLeft = 44;
  const padRight = 16;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const values = data.map(d => Number(d.ca || 0));
  const maxV = Math.max(1, ...values);
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const points = data.map((d, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + chartH - (Number(d.ca || 0) / maxV) * chartH;
    return { x, y, d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${padLeft + (data.length - 1) * stepX} ${padTop + chartH} L ${padLeft} ${padTop + chartH} Z`;

  // Axes labels : min / max
  const gridLines = [0, 0.5, 1].map((f) => ({
    y: padTop + chartH * (1 - f),
    v: Math.round(maxV * f),
  }));

  // Xticks : premier / milieu / dernier
  const xTicks = data.length > 2
    ? [0, Math.floor(data.length / 2), data.length - 1]
    : data.map((_, i) => i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="phar-chart-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pharChartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--y-brand)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--y-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((g, idx) => (
        <g key={idx}>
          <line x1={padLeft} x2={width - padRight} y1={g.y} y2={g.y}
                stroke="var(--y-n-200)" strokeDasharray="3 4" />
          <text x={padLeft - 6} y={g.y + 4} textAnchor="end"
                fontSize="10" fill="var(--y-n-500)">
            {fmtInt(g.v)}
          </text>
        </g>
      ))}
      <path d={areaD} fill="url(#pharChartGrad)" />
      <path d={pathD} fill="none" stroke="var(--y-brand)" strokeWidth="2.2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.4" fill="var(--y-brand)">
          <title>{`${p.d.date} : ${fmtFcfa(p.d.ca)} FCFA`}</title>
        </circle>
      ))}
      {xTicks.map((i) => {
        const p = points[i];
        if (!p) return null;
        const label = (p.d.date || '').slice(5);
        return (
          <text key={`x${i}`} x={p.x} y={height - 10} textAnchor="middle"
                fontSize="10" fill="var(--y-n-500)">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------------------
 * ReorderModal — pre-remplit une quantite proposee pour le produit choisi.
 * Envoi non implemente cote backoffice : la modal affiche l'info pour
 * copier/coller ou capturer, en attendant un flux d'approvisionnement dedie.
 * ------------------------------------------------------------------------- */
function ReorderModal({ item, onClose }) {
  const [qty, setQty] = useState(item?.suggested_reorder_qty || item?.suggested_qty || 5);

  useEffect(() => {
    setQty(item?.suggested_reorder_qty || item?.suggested_qty || 5);
  }, [item]);

  if (!item) return null;

  return (
    <div className="phar-modal-backdrop" onClick={onClose}>
      <div className="phar-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Suggerer un reapprovisionnement</h3>
        <p className="phar-modal-sub">{item.name}</p>
        <div className="phar-modal-row">
          <span>Stock actuel</span>
          <strong>{fmtInt(item.stock_quantity ?? item.current_stock ?? 0)}</strong>
        </div>
        <div className="phar-modal-row">
          <span>Vendu 30 derniers jours</span>
          <strong>{fmtInt(item.velocity_30d ?? item.qty_30d ?? 0)}</strong>
        </div>
        <label className="phar-modal-label">Quantite a commander</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="phar-modal-input"
        />
        <p className="phar-modal-hint">
          Copie cette suggestion et transmets-la a ton fournisseur. Le flux d'approvisionnement
          integre arrive bientot.
        </p>
        <div className="phar-modal-actions">
          <button className="phar-btn-ghost" onClick={onClose}>Fermer</button>
          <button
            className="phar-btn-primary"
            onClick={() => {
              const text = `Reapprovisionnement demande\nProduit : ${item.name}\nQuantite : ${qty}`;
              try {
                navigator.clipboard?.writeText?.(text);
              } catch { /* ignore */ }
              onClose();
            }}
          >
            Copier la suggestion
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PharmaDashboard({ pharmacy, setSection, onPendingChange }) {
  const [stats, setStats] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [topSellers, setTopSellers] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [reorderList, setReorderList] = useState([]);
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reorderItem, setReorderItem] = useState(null);

  const load = useCallback(async () => {
    if (!pharmacy?.id) return;
    try {
      const [s, k, ts, sa, rl, bm] = await Promise.all([
        getPharmacyStats(pharmacy.id),
        getPharmacyDashboardKpi(),
        getPharmacyTopSellers(30),
        getPharmacyStockAlerts(),
        getPharmacyReorderSuggestions(),
        getPharmacyBenchmark(),
      ]);
      setStats(s);
      setKpi(k);
      setTopSellers(ts || []);
      setStockAlerts(sa || []);
      setReorderList(rl || []);
      setBenchmark(bm);
      if (onPendingChange && s && typeof s.pendingCount === 'number') {
        onPendingChange(s.pendingCount);
      }
    } finally {
      setLoading(false);
    }
  }, [pharmacy, onPendingChange]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const commissionPct = useMemo(() => {
    const rate = Number(kpi?.commission_rate || 0);
    return rate > 0 ? Math.round(rate * 1000) / 10 : 8;
  }, [kpi]);

  const compPct = Number(kpi?.comparison_vs_avg_pct || 0);
  const positiveComp = compPct >= 0;

  const rankPct = Number(benchmark?.your_rank_percentile || 0);

  if (loading) {
    return (
      <div className="phar-section">
        <div className="phar-empty">Chargement du tableau de bord...</div>
      </div>
    );
  }

  const s = stats || {};
  const pending = s.pendingCount || 0;

  const caToday = Number(kpi?.ca_today || s.todayRevenue || 0);
  const caWeek  = Number(kpi?.ca_week || 0);
  const caMonth = Number(kpi?.ca_month || s.monthRevenue || 0);
  const commissionMonth = Number(kpi?.commission_month || 0);

  return (
    <div className="phar-section phar-dashboard-premium">
      {/* Header */}
      <div className="phar-header">
        <div>
          <h1>Tableau de bord</h1>
          <p style={{ textTransform: 'capitalize' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Alerte pending */}
      {pending > 0 && (
        <button
          className="phar-alert phar-alert-urgent"
          onClick={() => setSection && setSection('orders')}
        >
          <div>
            <strong>{pending} commande{pending > 1 ? 's' : ''} en attente</strong>
            <span>Accepte ou refuse pour demarrer la preparation</span>
          </div>
          <span className="phar-alert-arrow">&rsaquo;</span>
        </button>
      )}

      {/* KPI Cards — 4 tuiles */}
      <div className="phar-kpi-grid">
        <div className="phar-kpi">
          <div className="phar-kpi-label">CA aujourd&apos;hui</div>
          <div className="phar-kpi-value">{fmtFcfa(caToday)}<span className="phar-kpi-unit"> FCFA</span></div>
          <div className="phar-kpi-meta">{fmtInt(kpi?.orders_today || 0)} commande{(kpi?.orders_today || 0) > 1 ? 's' : ''}</div>
        </div>
        <div className="phar-kpi">
          <div className="phar-kpi-label">CA cette semaine</div>
          <div className="phar-kpi-value">{fmtFcfa(caWeek)}<span className="phar-kpi-unit"> FCFA</span></div>
          <div className="phar-kpi-meta">{fmtInt(kpi?.orders_week || 0)} commande{(kpi?.orders_week || 0) > 1 ? 's' : ''}</div>
        </div>
        <div className="phar-kpi">
          <div className="phar-kpi-label">CA ce mois</div>
          <div className="phar-kpi-value">{fmtFcfa(caMonth)}<span className="phar-kpi-unit"> FCFA</span></div>
          <div className="phar-kpi-meta">Panier moyen {fmtFcfa(kpi?.avg_basket || 0)} FCFA</div>
        </div>
        <div className="phar-kpi phar-kpi-highlight">
          <div className="phar-kpi-label">Commission YARAM ({commissionPct}%)</div>
          <div className="phar-kpi-value">{fmtFcfa(commissionMonth)}<span className="phar-kpi-unit"> FCFA</span></div>
          <div className="phar-kpi-meta">Ce mois</div>
        </div>
      </div>

      {/* Chart CA 30 derniers jours */}
      <div className="phar-card phar-chart-card">
        <div className="phar-card-head">
          <h3>Chiffre d&apos;affaires — 30 derniers jours</h3>
          {benchmark?.city && (
            <span className="phar-card-sub">{benchmark.city}</span>
          )}
        </div>
        <CaLineChart series={benchmark?.ca_series_30d || []} />
      </div>

      {/* Grid : Top Sellers + Benchmark */}
      <div className="phar-two-col">
        {/* Top Sellers */}
        <div className="phar-card">
          <div className="phar-card-head">
            <h3>Top 10 des produits vendus</h3>
            <span className="phar-card-sub">30 derniers jours</span>
          </div>
          {topSellers.length === 0 ? (
            <div className="phar-empty phar-empty-inline">Aucune vente sur la periode.</div>
          ) : (
            <ol className="phar-top-list">
              {topSellers.map((p, i) => (
                <li key={p.product_id || i}>
                  <span className="phar-top-rank">{i + 1}</span>
                  <div className="phar-top-info">
                    <strong>{p.name}</strong>
                    <span>{fmtInt(p.qty_sold)} unite{p.qty_sold > 1 ? 's' : ''}</span>
                  </div>
                  <span className="phar-top-rev">{fmtFcfa(p.revenue)} FCFA</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Benchmark anonymise */}
        <div className="phar-card phar-benchmark-card">
          <div className="phar-card-head">
            <h3>Ta pharmacie vs le reseau</h3>
            <span className="phar-card-sub">Anonymise</span>
          </div>
          <div className="phar-bench-hero">
            {benchmark && benchmark.avg_ca_similar_pharmas > 0 ? (
              <>
                <div className={`phar-bench-badge ${positiveComp ? 'positive' : 'negative'}`}>
                  {positiveComp ? '+' : ''}{compPct}%
                </div>
                <p>
                  Ton CA ce mois est {positiveComp ? 'au-dessus' : 'en-dessous'} de la moyenne
                  des pharmacies partenaires YARAM.
                </p>
              </>
            ) : (
              <p className="phar-bench-neutral">Pas encore assez de donnees pour comparer.</p>
            )}
          </div>
          <div className="phar-bench-rows">
            <div>
              <span>Ton CA (mois)</span>
              <strong>{fmtFcfa(benchmark?.your_ca_month || 0)} FCFA</strong>
            </div>
            <div>
              <span>Moyenne pharmacies similaires</span>
              <strong>{fmtFcfa(benchmark?.avg_ca_similar_pharmas || 0)} FCFA</strong>
            </div>
            <div>
              <span>Top 10% du reseau</span>
              <strong>{fmtFcfa(benchmark?.top10_ca_similar || 0)} FCFA</strong>
            </div>
          </div>
          {rankPct > 0 && (
            <div className="phar-bench-rank">
              <strong>Top {Math.max(1, Math.round(100 - rankPct))}%</strong>
              <span>des pharmacies {benchmark?.city ? `de ${benchmark.city}` : 'du reseau'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stock alerts */}
      <div className="phar-card">
        <div className="phar-card-head">
          <h3>Alertes stock</h3>
          <span className="phar-card-sub">{stockAlerts.length} produit{stockAlerts.length > 1 ? 's' : ''}</span>
        </div>
        {stockAlerts.length === 0 ? (
          <div className="phar-empty phar-empty-inline">Aucune alerte, ton stock est sain.</div>
        ) : (
          <ul className="phar-alert-list">
            {stockAlerts.map((a) => (
              <li key={a.product_id} className={`phar-alert-row phar-alert-${a.severity}`}>
                <div className="phar-alert-info">
                  <strong>{a.name}</strong>
                  <span>
                    Stock : {fmtInt(a.stock_quantity)}
                    {' - '}
                    Vendu 30j : {fmtInt(a.velocity_30d)}
                    {' - '}
                    Suggere : {fmtInt(a.suggested_reorder_qty)}
                  </span>
                </div>
                <div className="phar-alert-side">
                  <span className={`phar-badge phar-badge-${a.severity}`}>
                    {a.severity === 'out_of_stock' ? 'Rupture' : 'Stock faible'}
                  </span>
                  <button className="phar-btn-ghost-sm" onClick={() => setReorderItem(a)}>
                    Suggerer reorder
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reorder suggestions */}
      <div className="phar-card">
        <div className="phar-card-head">
          <h3>Suggestions de reapprovisionnement</h3>
          <span className="phar-card-sub">Top {reorderList.length} — velocite 30j</span>
        </div>
        {reorderList.length === 0 ? (
          <div className="phar-empty phar-empty-inline">Aucune suggestion pour le moment.</div>
        ) : (
          <ul className="phar-reorder-list">
            {reorderList.map((r) => (
              <li key={r.product_id} className={`phar-reorder-row phar-reorder-${r.urgency}`}>
                <div className="phar-reorder-info">
                  <strong>{r.name}</strong>
                  <span>
                    Vendu 30j : {fmtInt(r.qty_30d)} - Stock : {fmtInt(r.current_stock)} - CA 30j : {fmtFcfa(r.revenue_30d)} FCFA
                  </span>
                </div>
                <div className="phar-reorder-side">
                  <span className="phar-reorder-qty">Recharger {fmtInt(r.suggested_qty)}</span>
                  <button className="phar-btn-ghost-sm" onClick={() => setReorderItem(r)}>
                    Details
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal reorder */}
      {reorderItem && (
        <ReorderModal item={reorderItem} onClose={() => setReorderItem(null)} />
      )}
    </div>
  );
}
