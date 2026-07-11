import { useState, useEffect, useRef, useMemo } from 'react';
import { useNav, useUser } from '../App';
import { supabase } from '../lib/supabase';
import { usePersistedData } from '../lib/usePersistedData';
import { haptic } from '../lib/haptic';
import TabBar from '../components/TabBar';
import './Loyalty.css';

/* ─── Paliers Bronze / Silver / Gold — server-driven (loyalty_tiers_config) ─── */
/* Fallback si le fetch RPC echoue (offline / cold cache) */
const TIER_STATIC_META = {
  bronze: { name: 'Bronze', bg: 'linear-gradient(135deg, #C8956A 0%, #8C5A2C 100%)' },
  silver: { name: 'Argent', bg: 'linear-gradient(135deg, #BBC5CB 0%, #6B7780 100%)' },
  gold:   { name: 'Or',     bg: 'linear-gradient(135deg, #F6D365 0%, #BF9B25 100%)' },
};

/* Traduction perks token -> libelle FR pour affichage */
const PERK_LABELS = {
  basic_support:         'Support client standard',
  free_delivery_25k:     'Livraison gratuite des 25 000 FCFA',
  free_delivery_always:  'Livraison TOUJOURS gratuite',
  early_access:          'Acces anticipe aux nouveautes',
  concierge_whatsapp:    'Conciergerie WhatsApp VIP',
  birthday_gift:         'Cadeau surprise anniversaire',
};

const TIERS_FALLBACK = [
  { tier: 'bronze', min_points: 0,    cashback_pct: 3, free_delivery_from: 50000, perks: ['basic_support'],                                                     color: '#CD7F32' },
  { tier: 'silver', min_points: 500,  cashback_pct: 5, free_delivery_from: 25000, perks: ['free_delivery_25k','birthday_gift'],                                 color: '#C0C0C0' },
  { tier: 'gold',   min_points: 2000, cashback_pct: 8, free_delivery_from: 0,     perks: ['free_delivery_always','early_access','concierge_whatsapp','birthday_gift'], color: '#FFD700' },
];

/* ─── Options d\'échange (calque strict natif) ─── */
const REDEEM_OPTIONS = [
  { points: 500,  value: 1000,  label: '1 000 FCFA sur ta commande' },
  { points: 1000, value: 2500,  label: '2 500 FCFA sur ta commande' },
  { points: 2500, value: 7000,  label: '7 000 FCFA sur ta commande' },
  { points: 5000, value: 15000, label: '15 000 FCFA sur ta commande' },
];

/* Détermine palier courant depuis earned12m + config server */
function getTierFromEarned(earned, tiers) {
  const sorted = [...(tiers || [])].sort((a, b) => a.min_points - b.min_points);
  let current = sorted[0];
  for (const t of sorted) if (earned >= t.min_points) current = t;
  return current || TIERS_FALLBACK[0];
}

function getNextTier(current, tiers) {
  const sorted = [...(tiers || [])].sort((a, b) => a.min_points - b.min_points);
  return sorted.find((t) => t.min_points > (current?.min_points || 0)) || null;
}

/* Hook counter animé */
function useCounter(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(from + (target - from) * ease(p)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return value;
}

export default function Loyalty() {
  const { navigate } = useNav();
  const { user, refreshUser } = useUser();
  const [toast, setToast] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  // FIX juin 2026 : usePersistedData → hydrate depuis cache au remount.
  const { data: txData, loading } = usePersistedData(
    `loyalty-tx-${user?.id || 'anon'}`,
    async () => {
      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    { ttl: 5 * 60 * 1000, enabled: !!user?.id }
  );
  const transactions = txData || [];

  const balance = user?.loyalty_points || 0;
  const totalEarned = user?.loyalty_total_earned || balance || 0;
  const animatedPoints = useCounter(balance);
  const equivFCFA = Math.floor(balance / 100) * 1000; // 100 pts = 1000 FCFA
  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

  /* ─── Server-driven tier config + RPC snapshot ────────────────── */
  const [tiersConfig, setTiersConfig] = useState(TIERS_FALLBACK);
  const [tierInfo, setTierInfo] = useState(null); // { tier, cashback_pct, points_to_next_tier, next_tier, ... }
  const [simulateAmount, setSimulateAmount] = useState(20000);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [{ data: cfg }, rpcResp] = await Promise.all([
          supabase.from('loyalty_tiers_config').select('*').order('min_points', { ascending: true }),
          user?.id ? supabase.rpc('loyalty_get_my_tier') : Promise.resolve({ data: null }),
        ]);
        if (cancel) return;
        if (Array.isArray(cfg) && cfg.length) setTiersConfig(cfg);
        if (rpcResp?.data?.success) setTierInfo(rpcResp.data);
      } catch { /* fallback */ }
    })();
    return () => { cancel = true; };
  }, [user?.id]);

  const earned12m = tierInfo?.earned_12m ?? totalEarned;
  const currentTier = useMemo(() => {
    const cfg = tierInfo?.tier_config;
    if (cfg?.tier) return cfg;
    return getTierFromEarned(earned12m, tiersConfig);
  }, [tierInfo, tiersConfig, earned12m]);
  const nextTier = useMemo(() => tierInfo?.next_tier_config || getNextTier(currentTier, tiersConfig), [tierInfo, currentTier, tiersConfig]);

  const currentTierName = currentTier?.label || TIER_STATIC_META[currentTier?.tier]?.name || (currentTier?.tier?.charAt(0).toUpperCase() + currentTier?.tier?.slice(1)) || 'Bronze';
  const currentTierBg = TIER_STATIC_META[currentTier?.tier]?.bg || `linear-gradient(135deg, ${currentTier?.color || '#1F8B4C'} 0%, #166B3A 100%)`;
  const cashbackPct = Number(currentTier?.cashback_pct || 3);
  const freeDeliveryFrom = currentTier?.free_delivery_from;

  const pointsToNext = tierInfo?.points_to_next_tier ?? (nextTier ? Math.max(0, (nextTier.min_points || 0) - earned12m) : 0);
  const tierProgressPct = nextTier
    ? Math.min(100, ((earned12m - (currentTier?.min_points || 0)) / ((nextTier.min_points || 0) - (currentTier?.min_points || 0))) * 100)
    : 100;

  // animate progress fill on mount
  useEffect(() => {
    const t = setTimeout(() => setProgressPct(tierProgressPct), 250);
    return () => clearTimeout(t);
  }, [tierProgressPct]);

  /* Simulation : depense X FCFA -> gagne Y points */
  const simulatedPoints = Math.round((Number(simulateAmount) || 0) * cashbackPct / 100);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2500);
  };

  /* CTA : utiliser mes points → set credit + redirect */
  const useMyPoints = () => {
    if (balance < 100) {
      showToast('Il te faut au moins 100 points');
      return;
    }
    haptic('medium');
    const fcfa = Math.floor(balance / 100) * 1000;
    try {
      localStorage.setItem('yaram_loyalty_credit', String(fcfa));
      localStorage.setItem('yaram_loyalty_credit_pts', String(Math.floor(balance / 100) * 100));
    } catch {}
    showToast(`${fmt(fcfa)} FCFA prêts à l'usage`);
    setTimeout(() => navigate('/cart'), 700);
  };

  /* Échange direct d\'un palier prédéfini (calque natif) */
  const redeemOption = (opt) => {
    if (balance < opt.points) {
      showToast(`Il te faut ${fmt(opt.points - balance)} points de plus`);
      return;
    }
    haptic('medium');
    try {
      localStorage.setItem('yaram_loyalty_credit', String(opt.value));
      localStorage.setItem('yaram_loyalty_credit_pts', String(opt.points));
    } catch {}
    showToast(`${fmt(opt.value)} FCFA appliqués à ta prochaine commande`);
    setTimeout(() => navigate('/cart'), 700);
  };

  /* Icon mapping pour transactions */
  const txMeta = (type) => {
    switch (type) {
      case 'earn_order':    return { icon: '', defaultLabel: 'Commande livrée' };
      case 'earn_admin':    return { icon: '', defaultLabel: 'Bonus offert' };
      case 'earn_review':   return { icon: '', defaultLabel: 'Avis publié' };
      case 'earn_referral': return { icon: '', defaultLabel: 'Parrainage validé' };
      case 'redeem':        return { icon: '', defaultLabel: 'Points utilisés' };
      case 'adjust_admin':  return { icon: '', defaultLabel: 'Ajustement' };
      default:              return { icon: '', defaultLabel: type };
    }
  };

  return (
    <div className="yloy-screen page-anim">
      <div className="yloy-scroll">
        {/* HEADER */}
        <header className="yloy-header">
          <button className="yloy-back" onClick={() => navigate(-1)} aria-label="Retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <h1 className="yloy-header-title">Fidélité</h1>
        </header>

        {/* HERO GRADIENT — tier-colored */}
        <div className="yloy-hero" style={{ backgroundImage: currentTierBg }}>
          <div className="yloy-hero-inner">
            <div className="yloy-hero-tier">
              <span>Palier {currentTierName}</span>
            </div>
            <div className="yloy-hero-points">{fmt(animatedPoints)}</div>
            <div className="yloy-hero-label">points fidelite</div>
            <div className="yloy-hero-equiv">
              <span>≈</span>
              <strong>{fmt(equivFCFA)} FCFA</strong>
              <span>disponibles</span>
            </div>

            {nextTier && (
              <div className="yloy-hero-progress">
                <div className="yloy-hero-progress-label">
                  <span>Plus que <strong>{fmt(pointsToNext)} pts</strong> pour {(TIER_STATIC_META[nextTier.tier]?.name || nextTier.label || nextTier.tier)}</span>
                  <span><strong>{Math.round(progressPct)}%</strong></span>
                </div>
                <div className="yloy-hero-progress-bar">
                  <div className="yloy-hero-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
            {!nextTier && (
              <div className="yloy-hero-progress">
                <div className="yloy-hero-progress-label">
                  <span>Tu es au palier maximum, bravo !</span>
                </div>
                <div className="yloy-hero-progress-bar">
                  <div className="yloy-hero-progress-fill" style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CASHBACK + PERKS card */}
        <section className="yloy-section">
          <div style={{
            background: '#fff',
            border: '1px solid #EFEFEC',
            borderRadius: 18,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: currentTierBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 20, fontWeight: 900,
              }}>{cashbackPct}%</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>
                  Tu gagnes {cashbackPct}% cashback sur chaque commande
                </div>
                <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>
                  {typeof freeDeliveryFrom === 'number' && freeDeliveryFrom === 0
                    ? 'Livraison TOUJOURS gratuite'
                    : typeof freeDeliveryFrom === 'number'
                      ? `Livraison gratuite des ${fmt(freeDeliveryFrom)} FCFA`
                      : 'Frais de livraison standards'}
                </div>
              </div>
            </div>

            {/* Perks list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Array.isArray(currentTier?.perks) ? currentTier.perks : []).map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1A1A1A', fontWeight: 600 }}>
                  <span style={{ color: 'var(--y-brand)', fontWeight: 900 }}>✓</span>
                  <span>{PERK_LABELS[p] || String(p).replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>

            {/* Simulation */}
            <div style={{ borderTop: '1px solid #F0F0EC', paddingTop: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#6B6B6B', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Simulation : depense X FCFA
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={simulateAmount}
                  onChange={(e) => setSimulateAmount(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #E5E5E1',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#1A1A1A',
                    background: '#FAFAF7',
                    outline: 'none',
                  }}
                />
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--y-brand)' }}>
                  = {fmt(simulatedPoints)} pts
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMMENT ÇA MARCHE — 3 cards horizontales */}
        <section className="yloy-section">
          <h2 className="yloy-section-title">Comment ça marche</h2>
          <p className="yloy-section-sub">Gagne des points à chaque achat et débloque des avantages.</p>
        </section>
        <div className="yloy-how-scroll">
          <div className="yloy-how-card">
            <div className="yloy-how-num">1</div>
            <div className="yloy-how-icon"></div>
            <h3 className="yloy-how-title">Tu commandes</h3>
            <p className="yloy-how-desc">1 FCFA dépensé = 1 point fidélité crédité dès la livraison.</p>
          </div>
          <div className="yloy-how-card">
            <div className="yloy-how-num">2</div>
            <div className="yloy-how-icon"></div>
            <h3 className="yloy-how-title">Tu accumules</h3>
            <p className="yloy-how-desc">1 000 points = 1 000 FCFA de crédit utilisable directement.</p>
          </div>
          <div className="yloy-how-card">
            <div className="yloy-how-num">3</div>
            <div className="yloy-how-icon"></div>
            <h3 className="yloy-how-title">Tu profites</h3>
            <p className="yloy-how-desc">Utilise ton crédit au checkout ou attends de débloquer le palier suivant.</p>
          </div>
        </div>

        {/* ÉCHANGE POINTS — calque natif (yaram-native/app/loyalty.jsx REDEEM_OPTIONS) */}
        <section className="yloy-section">
          <h2 className="yloy-section-title">Échange tes points</h2>
          <p className="yloy-section-sub">Utilise tes points comme crédit sur ta prochaine commande.</p>
          <div className="yloy-redeem-list">
            {REDEEM_OPTIONS.map((opt) => {
              const canRedeem = balance >= opt.points;
              return (
                <button
                  key={opt.points}
                  className={`yloy-redeem-item ${canRedeem ? 'ready' : ''}`}
                  onClick={() => redeemOption(opt)}
                  disabled={!canRedeem}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 14,
                    marginBottom: 10,
                    border: '1px solid rgba(0,0,0,0.06)',
                    background: canRedeem ? 'var(--y-brand)' : 'var(--y-surface, #fff)',
                    color: canRedeem ? '#fff' : 'var(--y-ink, #15171A)',
                    cursor: canRedeem ? 'pointer' : 'not-allowed',
                    opacity: canRedeem ? 1 : 0.65,
                    boxShadow: canRedeem
                      ? '0 6px 14px rgba(31,139,76,0.25)'
                      : '0 2px 8px rgba(0,0,0,0.05)',
                    transition: 'transform 0.15s ease',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: canRedeem ? 'rgba(255,255,255,0.18)' : 'var(--y-brand-soft, #EAF7F0)',
                      color: canRedeem ? '#fff' : 'var(--y-brand)',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 12 20 22 4 22 4 12"/>
                      <rect x="2" y="7" width="20" height="5"/>
                      <line x1="12" y1="22" x2="12" y2="7"/>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                    </svg>
                  </span>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: 15, fontWeight: 700 }}>{opt.label}</strong>
                    <span style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                      {fmt(opt.points)} points
                    </span>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, opacity: 0.85 }} aria-hidden>→</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* PALIERS */}
        <section className="yloy-section">
          <h2 className="yloy-section-title">Mes paliers</h2>
          <p className="yloy-section-sub">Plus tu commandes, plus tu debloques d avantages.</p>
          <div className="yloy-tier-grid">
            {tiersConfig.map((t, idx) => {
              const isCurrent = t.tier === currentTier?.tier;
              const nextInList = tiersConfig[idx + 1];
              const bg = TIER_STATIC_META[t.tier]?.bg || `linear-gradient(135deg, ${t.color || '#1F8B4C'} 0%, #166B3A 100%)`;
              const displayName = t.label || TIER_STATIC_META[t.tier]?.name || t.tier;
              return (
                <div key={t.tier} className={`yloy-tier-card ${isCurrent ? 'current' : ''}`}>
                  <div className="yloy-tier-icon-wrap" style={{ background: bg }}>
                    <span style={{ fontWeight: 900, fontSize: 14 }}>{Number(t.cashback_pct)}%</span>
                  </div>
                  <div className="yloy-tier-info">
                    <div className="yloy-tier-name-row">
                      <h3 className="yloy-tier-name">{displayName}</h3>
                      {isCurrent && <span className="yloy-tier-badge">Actuel</span>}
                    </div>
                    <p className="yloy-tier-req">
                      {nextInList
                        ? `${fmt(t.min_points)} → ${fmt(nextInList.min_points)} pts / 12 mois`
                        : `${fmt(t.min_points)}+ pts / 12 mois`}
                    </p>
                    <ul className="yloy-tier-perks">
                      <li>{Number(t.cashback_pct)}% cashback sur chaque commande</li>
                      {(Array.isArray(t.perks) ? t.perks : []).map((p, i) => (
                        <li key={i}>{PERK_LABELS[p] || String(p).replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* HISTORIQUE */}
        <section className="yloy-section">
          <h2 className="yloy-section-title">Historique</h2>
          <p className="yloy-section-sub">Tes 30 dernières transactions de points.</p>
          {loading ? (
            /* PERF : skeleton lignes transactions */
            <div>
              {[0, 1, 2, 3].map((i) => (
                <div key={'sk-' + i} className="skeleton-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-line" style={{ width: '60%' }} />
                    <div className="skeleton-line" style={{ width: '30%', marginBottom: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="yloy-empty">
              <div style={{ fontSize: 36, opacity: 0.4 }}></div>
              <p>Aucune transaction pour l'instant</p>
              <p style={{ fontSize: 11, color: '#9B9B9B' }}>Passe ta 1ère commande pour gagner tes premiers points.</p>
            </div>
          ) : (
            <div className="yloy-tx-list">
              {transactions.map((tx, i) => {
                const meta = txMeta(tx.type);
                return (
                  <div
                    key={tx.id}
                    className="yloy-tx-item"
                    style={{ animationDelay: `${Math.min(i * 30, 600)}ms` }}
                  >
                    <div className="yloy-tx-icon">{meta.icon}</div>
                    <div className="yloy-tx-text">
                      <strong>{tx.reason || meta.defaultLabel}</strong>
                      <span>{new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className={`yloy-tx-pts ${tx.points > 0 ? 'positive' : 'negative'}`}>
                      {tx.points > 0 ? '+' : ''}{fmt(tx.points)} pts
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* CTA BOTTOM */}
      <div className="yloy-cta-wrap">
        <button
          className="yloy-cta"
          onClick={useMyPoints}
          disabled={balance < 100}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <circle cx="9" cy="21" r="1.5"/><circle cx="20" cy="21" r="1.5"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/>
          </svg>
          Utiliser mes points {balance >= 100 && `(${fmt(equivFCFA)} FCFA)`}
        </button>
      </div>

      {toast && <div className="yloy-toast">{toast}</div>}

      <TabBar active="profile" />
    </div>
  );
}
