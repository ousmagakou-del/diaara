import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

// ══════════════════════════════════════════════════════════════════
//  PEDALEL — Wallet + Payouts (Phase 4)
//  Balance teal + KPIs + Cette semaine + Bouton Retirer + Historique
// ══════════════════════════════════════════════════════════════════

const fmtFcfa = (cents) => {
  const n = Math.round(Number(cents || 0) / 100);
  return `${n.toLocaleString('fr-FR')} FCFA`;
};
const fmtFcfaRaw = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

// Methodes de retrait
const PAYOUT_METHODS = [
  {
    key: 'wave',
    label: 'Wave',
    sub: 'Instant, sans frais',
    color: '#1DC1FF',
    Icon: () => (
      <div className="ped-payout-logo" style={{ background: '#1DC1FF' }}>W</div>
    ),
  },
  {
    key: 'orange_money',
    label: 'Orange Money',
    sub: 'Frais opérateur',
    color: '#FF7900',
    Icon: () => (
      <div className="ped-payout-logo" style={{ background: '#FF7900' }}>OM</div>
    ),
  },
  {
    key: 'free_money',
    label: 'Free Money',
    sub: 'Frais opérateur',
    color: '#CD1F5F',
    Icon: () => (
      <div className="ped-payout-logo" style={{ background: '#CD1F5F' }}>FM</div>
    ),
  },
];

// ═════════ Icons SVG ═════════
const IconWallet = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
const IconTrend = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconArrowUp = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

// ═════════ Fetcher — combine driver_get_info + fallback driver_get_earnings ═════════
async function fetchWalletData(token) {
  const [infoRes, earnRes] = await Promise.all([
    supabase.rpc('driver_get_info', { p_token: token }).then((r) => r).catch((e) => ({ error: e })),
    supabase.rpc('driver_get_earnings', { p_token: token }).then((r) => r).catch(() => ({ error: null, data: null })),
  ]);

  return {
    info: infoRes?.data || null,
    earnings: earnRes?.data || null,
    error: infoRes?.error || null,
  };
}

export default function DriverEarnings({ session }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayout, setShowPayout] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const res = await fetchWalletData(session.token);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  // ─── Derived data ───
  const wallet = data?.info?.wallet || {};
  const earnings = data?.earnings || {};
  const balanceCents = Number(wallet?.balance_cents ?? wallet?.balance ?? 0);
  const totalEarnedCents = Number(
    wallet?.total_earned_cents ?? wallet?.total_earned ?? (earnings?.total?.fcfa ? earnings.total.fcfa * 100 : 0)
  );
  const pendingCents = Number(wallet?.pending_cents ?? wallet?.pending ?? 0);
  const paidOutCents = Number(wallet?.paid_out_cents ?? wallet?.paid_out ?? 0);

  const breakdown = earnings?.breakdown || wallet?.weekly || [];
  const recentEarnings = earnings?.recent || wallet?.recent_earnings || [];
  const recentPayouts = wallet?.recent_payouts || wallet?.payouts || [];

  const maxBar = Math.max(1, ...breakdown.map((b) => Number(b.fcfa) || 0));
  const weekTotal = breakdown.reduce((s, b) => s + Number(b.fcfa || 0), 0);
  const weekCount = breakdown.reduce((s, b) => s + Number(b.count || 0), 0);

  if (loading) {
    return (
      <>
        <header className="dvr-header">
          <div className="dvr-header-card">
            <div className="dvr-avatar"><IconWallet /></div>
            <div className="dvr-header-text">
              <div className="dvr-header-name">Ton portefeuille</div>
              <div className="dvr-header-sub">Chargement…</div>
            </div>
          </div>
        </header>
        <div className="dvr-page">
          <div className="dvr-skel" style={{ height: 180, marginBottom: 12 }} />
          <div className="dvr-skel" style={{ height: 80, marginBottom: 12 }} />
          <div className="dvr-skel" style={{ height: 200 }} />
        </div>
      </>
    );
  }

  return (
    <>
      <header className="dvr-header">
        <div className="dvr-header-card">
          <div className="dvr-avatar"><IconWallet /></div>
          <div className="dvr-header-text">
            <div className="dvr-header-name">Ton portefeuille</div>
            <div className="dvr-header-sub">Retire tes gains quand tu veux</div>
          </div>
        </div>
      </header>

      <div className="dvr-page">
        {/* ─── BALANCE HERO ─── */}
        <div className="ped-wallet-hero">
          <div className="ped-wallet-hero-decor" />
          <div className="ped-wallet-label">Solde disponible</div>
          <div className="ped-wallet-balance">{fmtFcfa(balanceCents)}</div>
          <div className="ped-wallet-note">
            {pendingCents > 0
              ? `${fmtFcfa(pendingCents)} en attente de validation`
              : 'Tout est confirmé, tu peux retirer.'}
          </div>
          <button
            className="ped-wallet-cta"
            onClick={() => setShowPayout(true)}
            disabled={balanceCents <= 0}
          >
            <IconArrowUp />
            Retirer
          </button>
        </div>

        {/* ─── KPI GRID ─── */}
        <div className="ped-wallet-kpis">
          <div className="ped-wallet-kpi">
            <div className="ped-wallet-kpi-icon" style={{ color: 'var(--pedalel-brand)' }}>
              <IconTrend />
            </div>
            <div className="ped-wallet-kpi-val">{fmtFcfa(totalEarnedCents)}</div>
            <div className="ped-wallet-kpi-label">Total gagné</div>
          </div>
          <div className="ped-wallet-kpi">
            <div className="ped-wallet-kpi-icon" style={{ color: 'var(--y-warning, #F59E0B)' }}>
              <IconClock />
            </div>
            <div className="ped-wallet-kpi-val">{fmtFcfa(pendingCents)}</div>
            <div className="ped-wallet-kpi-label">En attente</div>
          </div>
          <div className="ped-wallet-kpi">
            <div className="ped-wallet-kpi-icon" style={{ color: 'var(--pedalel-brand-dark)' }}>
              <IconCheck />
            </div>
            <div className="ped-wallet-kpi-val">{fmtFcfa(paidOutCents)}</div>
            <div className="ped-wallet-kpi-label">Retiré</div>
          </div>
        </div>

        {/* ─── CETTE SEMAINE ─── */}
        <div className="dvr-card ped-wallet-week">
          <div className="ped-wallet-week-head">
            <div>
              <div className="ped-wallet-week-title">Cette semaine</div>
              <div className="ped-wallet-week-sub">
                {fmtFcfaRaw(weekTotal)} · {weekCount} livraison{weekCount > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {breakdown.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--dvr-text-mute)', fontSize: 13 }}>
              Aucune livraison cette semaine.
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
                        title={`${b.label} : ${fmtFcfaRaw(b.fcfa)}`}
                      />
                    </div>
                    <div className="dvr-bar-label">{b.label?.slice(0, 3) || ''}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── HISTORIQUE ─── */}
        <div className="dvr-section">
          <div className="dvr-section-label">Historique</div>

          {recentPayouts.length === 0 && recentEarnings.length === 0 ? (
            <div className="dvr-empty">
              <div className="dvr-empty-icon"><IconWallet /></div>
              <div className="dvr-empty-title">Pas encore de mouvements</div>
              <div className="dvr-empty-sub">
                Tes livraisons et retraits s'afficheront ici.
              </div>
            </div>
          ) : (
            <div className="dvr-card" style={{ padding: '8px 16px' }}>
              {recentPayouts.map((p) => (
                <div className="dvr-history-row" key={`p-${p.id}`}>
                  <div className="dvr-history-icon" style={{ background: '#FFEDD5', color: '#F59E0B' }}>
                    <IconArrowUp />
                  </div>
                  <div className="dvr-history-mid">
                    <div className="dvr-history-name">Retrait {p.method || ''}</div>
                    <div className="dvr-history-date">
                      {p.destination || ''} · {p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                      {p.status && ` · ${p.status}`}
                    </div>
                  </div>
                  <div className="dvr-history-amt" style={{ color: '#F59E0B' }}>
                    -{fmtFcfa(p.amount_cents)}
                  </div>
                </div>
              ))}
              {recentEarnings.map((o) => (
                <div className="dvr-history-row" key={`e-${o.id}`}>
                  <div className="dvr-history-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <div className="dvr-history-mid">
                    <div className="dvr-history-name">{o.address?.name || 'Livraison'}</div>
                    <div className="dvr-history-date">
                      #{String(o.id).slice(0, 8)} · {o.done_at ? new Date(o.done_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                    </div>
                  </div>
                  <div className="dvr-history-amt">+{fmtFcfaRaw(o.earn)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--dvr-text-mute)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
          Traitement des retraits : 24 à 48h ouvrées.<br />
          Frais Wave = 0. Frais Orange Money / Free Money = tarif opérateur.
        </div>
      </div>

      {showPayout && (
        <PayoutSheet
          token={session.token}
          balanceCents={balanceCents}
          onClose={() => setShowPayout(false)}
          onSuccess={() => {
            setShowPayout(false);
            toast.success('Retrait demandé — traitement 24-48h');
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

// ═════════ PAYOUT BOTTOM SHEET ═════════
function PayoutSheet({ token, balanceCents, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('wave');
  const [destination, setDestination] = useState('+221 ');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const balanceFcfa = Math.round(balanceCents / 100);
  const amountNum = Number(String(amount).replace(/\D/g, '')) || 0;

  const canSubmit =
    amountNum >= 1000 &&
    amountNum * 100 <= balanceCents &&
    destination.replace(/\D/g, '').length >= 9 &&
    !!method;

  const handleAmountChange = (v) => {
    const cleaned = String(v).replace(/\D/g, '').slice(0, 8);
    setAmount(cleaned);
    setErr('');
  };

  const handleSubmit = async () => {
    setErr('');
    if (amountNum < 1000) {
      setErr('Montant minimum : 1 000 FCFA');
      return;
    }
    if (amountNum * 100 > balanceCents) {
      setErr(`Ton solde disponible est de ${balanceFcfa.toLocaleString('fr-FR')} FCFA.`);
      return;
    }
    if (destination.replace(/\D/g, '').length < 9) {
      setErr('Numéro de destination invalide.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('driver_request_payout', {
        p_token: token,
        p_amount_cents: amountNum * 100,
        p_method: method,
        p_destination: destination.trim(),
      });
      if (error || (data && data.success === false)) {
        console.warn('[Payout] error:', error || data);
        setErr(data?.error || 'Impossible de traiter la demande.');
        setBusy(false);
        return;
      }
      onSuccess?.();
    } catch (e) {
      console.error('[Payout] fatal:', e);
      setErr('Erreur réseau.');
    } finally {
      setBusy(false);
    }
  };

  const quicks = [5000, 10000, 25000, balanceFcfa]
    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i && v <= balanceFcfa)
    .slice(0, 4);

  return (
    <div className="ped-sheet-overlay" onClick={busy ? undefined : onClose}>
      <div className="ped-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ped-sheet-grabber" />
        <div className="ped-sheet-head">
          <div>
            <div className="ped-sheet-title">Retirer mes gains</div>
            <div className="ped-sheet-sub">
              Disponible : <strong>{balanceFcfa.toLocaleString('fr-FR')} FCFA</strong>
            </div>
          </div>
          <button className="ped-sheet-close" onClick={onClose} aria-label="Fermer">
            <IconClose />
          </button>
        </div>

        <div className="ped-sheet-body">
          {/* Montant */}
          <div className="ped-payout-field">
            <label>Montant à retirer</label>
            <div className="ped-payout-amount-wrap">
              <input
                className="ped-payout-amount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount ? Number(amount).toLocaleString('fr-FR') : ''}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={busy}
              />
              <span className="ped-payout-amount-cur">FCFA</span>
            </div>
            {quicks.length > 0 && (
              <div className="ped-payout-quicks">
                {quicks.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="ped-payout-quick"
                    onClick={() => handleAmountChange(String(q))}
                    disabled={busy}
                  >
                    {q.toLocaleString('fr-FR')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Methode */}
          <div className="ped-payout-field">
            <label>Méthode de retrait</label>
            <div className="ped-payout-methods">
              {PAYOUT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`ped-payout-method ${method === m.key ? 'active' : ''}`}
                  onClick={() => setMethod(m.key)}
                  disabled={busy}
                >
                  <m.Icon />
                  <div className="ped-payout-method-text">
                    <div className="ped-payout-method-name">{m.label}</div>
                    <div className="ped-payout-method-sub">{m.sub}</div>
                  </div>
                  <div className="ped-payout-method-radio">
                    {method === m.key && <div className="ped-payout-method-radio-in" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Destination */}
          <div className="ped-payout-field">
            <label>Numéro de destination</label>
            <input
              className="ped-payout-input"
              type="tel"
              inputMode="tel"
              placeholder="+221 77 000 00 00"
              value={destination}
              onChange={(e) => { setDestination(e.target.value); setErr(''); }}
              disabled={busy}
            />
            <div className="ped-payout-hint">
              Vérifie bien le numéro — l'argent est envoyé instantanément.
            </div>
          </div>

          {err && <div className="ped-payout-err">{err}</div>}

          <button
            className="ped-payout-submit"
            onClick={handleSubmit}
            disabled={busy || !canSubmit}
          >
            {busy ? (
              <span className="ped-signup-spin" />
            ) : (
              `Valider le retrait${amountNum ? ` — ${amountNum.toLocaleString('fr-FR')} FCFA` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
