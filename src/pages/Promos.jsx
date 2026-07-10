import { useState, useEffect, useMemo } from 'react';
import { useNav, useUser } from '../App';
import { supabase } from '../lib/supabase';
import { usePersistedData } from '../lib/usePersistedData';
import TabBar from '../components/TabBar';
import './Promos.css';

// Filtres calqués sur native (labels sans emoji, ton pro sobre)
const FILTER_TABS = [
  { id: 'all',      label: 'Toutes' },
  { id: 'product',  label: 'Produit' },
  { id: 'category', label: 'Catégorie' },
  { id: 'brand',    label: 'Marque' },
  { id: 'first',    label: '1ère commande' },
];

// ─── Countdown live hook ───
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(target, now) {
  if (!target) return null;
  const t = new Date(target).getTime();
  if (isNaN(t)) return null;
  let diff = Math.max(0, t - now);
  if (diff === 0) return 'Expirée';
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
  const m = Math.floor(diff / 60000);    diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  if (d > 0) return `${d}j ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function Promos() {
  const { navigate } = useNav();
  const { user } = useUser();
  const now = useNow(1000);

  const [filter, setFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState('');
  const [toast, setToast] = useState('');

  // FIX juin 2026 : usePersistedData → hydrate depuis cache au remount.
  // On regroupe promos + userUses dans un seul fetch pour éviter le skeleton.
  const { data: promosBundle, loading } = usePersistedData(
    `promos-${user?.id || 'anon'}`,
    async () => {
      // FIX juin 2026 : .or() chaînés timestamp cassaient l'URL → 400.
      const nowMs = Date.now();
      const { data: promosData } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('active', true)
        .neq('is_referral', true)
        .order('created_at', { ascending: false });

      const filtered = (promosData || []).filter(p => {
        if (p.expires_at && new Date(p.expires_at).getTime() <= nowMs) return false;
        if (p.starts_at && new Date(p.starts_at).getTime() > nowMs) return false;
        if (p.max_uses && p.uses_count >= p.max_uses) return false;
        return true;
      });

      let counts = {};
      if (user?.id) {
        const { data: uses } = await supabase
          .from('promo_uses')
          .select('promo_code')
          .eq('user_id', user.id);
        (uses || []).forEach(u => {
          counts[u.promo_code] = (counts[u.promo_code] || 0) + 1;
        });
      }
      return { promos: filtered, userUses: counts };
    },
    { ttl: 5 * 60 * 1000 }
  );
  const promos = promosBundle?.promos || [];
  const userUses = promosBundle?.userUses || {};

  // ─── Copy code ───
  const handleCopy = async (code) => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      const t = document.createElement('textarea');
      t.value = code;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(t);
    }
    try { localStorage.setItem('yaram_pending_promo', code); } catch {}
    setCopiedCode(code);
    if (navigator.vibrate) navigator.vibrate(40);
    setToast(`Code ${code} copié !`);
    setTimeout(() => setCopiedCode(''), 2000);
    setTimeout(() => setToast(''), 2200);
  };

  // ─── Helpers ───
  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

  const promoValueLabel = (p) => {
    if (p.type === 'percent' || p.type === 'percentage') return `-${p.value}%`;
    if (p.type === 'amount' || p.type === 'fixed' || p.type === 'flat') return `-${fmt(p.value)} FCFA`;
    if (p.type === 'shipping' || p.type === 'free_shipping') return 'Livraison offerte';
    return p.value ? `-${p.value}` : 'Promo';
  };

  const promoScope = (p) => {
    if (p.scope) return String(p.scope).toLowerCase();
    if (p.product_id) return 'product';
    if (p.category_id || p.category) return 'category';
    if (p.brand_id || p.brand) return 'brand';
    if (p.first_order || p.first_purchase_only) return 'first';
    return 'all';
  };

  // Icônes SVG sobres (calque native sans emoji)
  const promoIcon = (p) => {
    const s = promoScope(p);
    const stroke = 'currentColor';
    const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
    if (s === 'product')  return <svg {...common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
    if (s === 'category') return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    if (s === 'brand')    return <svg {...common}><path d="M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>;
    if (s === 'first')    return <svg {...common}><polyline points="20 6 9 17 4 12"/></svg>;
    if (p.type === 'shipping' || p.type === 'free_shipping') return <svg {...common}><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>;
    return <svg {...common}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7 8.5 3.5A2.5 2.5 0 0 1 12 7"/><path d="M12 7l3.5-3.5A2.5 2.5 0 0 0 12 7"/></svg>;
  };

  // ─── Filtre par tab ───
  const filteredPromos = useMemo(() => {
    if (filter === 'all') return promos;
    return promos.filter(p => promoScope(p) === filter);
  }, [promos, filter]);

  // ─── Hero : promo la plus attractive ───
  const heroPromo = useMemo(() => {
    if (promos.length === 0) return null;
    const sorted = [...promos].sort((a, b) => {
      if (a.type === 'percent' && b.type !== 'percent') return -1;
      if (b.type === 'percent' && a.type !== 'percent') return 1;
      return (b.value || 0) - (a.value || 0);
    });
    return sorted[0];
  }, [promos]);

  const daysLeftBadge = (p) => {
    if (!p.expires_at) return null;
    const expDate = new Date(p.expires_at).getTime();
    if (isNaN(expDate)) return null;
    const diff = expDate - now;
    if (diff <= 0) return 'Expirée';
    const days = Math.ceil(diff / 86400000);
    if (days === 0) return "Expire aujourd'hui";
    if (days === 1) return 'Plus que 1 jour';
    if (days <= 7) return `Plus que ${days} jours`;
    return null;
  };

  const isExhausted = (p) => {
    if (!p.per_user_limit) return false;
    return (userUses[p.code] || 0) >= p.per_user_limit;
  };

  return (
    <div className="ypromos-screen page-anim">
      <div className="ypromos-scroll">

        {/* ════════ HEADER STICKY GLASS ════════ */}
        <header className="ypromos-header">
          <button className="ypromos-back" onClick={() => navigate(-1)} aria-label="Retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div className="ypromos-header-titles">
            <h1>Promos en cours</h1>
            <p>{promos.length} bon{promos.length > 1 ? 's' : ''} plan{promos.length > 1 ? 's' : ''} disponible{promos.length > 1 ? 's' : ''}</p>
          </div>
        </header>

        {/* ════════ HERO FEATURED PROMO ════════ */}
        {heroPromo && (
          <section className="ypromos-hero-wrap ypromos-stagger" style={{ '--i': 0 }}>
            <div className="ypromos-hero">
              <div className="ypromos-hero-glow" />
              <div className="ypromos-hero-glow ypromos-hero-glow-2" />

              <div className="ypromos-hero-top">
                <span className="ypromos-hero-badge">★ MEILLEURE OFFRE</span>
                {formatCountdown(heroPromo.expires_at, now) && (
                  <span className="ypromos-hero-countdown">
                    <span className="ypromos-pulse-dot" />
                    {formatCountdown(heroPromo.expires_at, now)}
                  </span>
                )}
              </div>

              <div className="ypromos-hero-value">{promoValueLabel(heroPromo)}</div>
              <div className="ypromos-hero-desc">
                {heroPromo.description || 'Offre exclusive sur ta routine beauté'}
              </div>

              <div className="ypromos-hero-code-row">
                <div className="ypromos-hero-code-wrap">
                  <span className="ypromos-hero-code-label">CODE PROMO</span>
                  <div className="ypromos-hero-code">{heroPromo.code}</div>
                </div>
                <button
                  className={`ypromos-hero-copy-btn ${copiedCode === heroPromo.code ? 'copied' : ''}`}
                  onClick={() => handleCopy(heroPromo.code)}
                >
                  {copiedCode === heroPromo.code ? (
                    <>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Copié
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copier
                    </>
                  )}
                </button>
              </div>

              <button className="ypromos-hero-cta" onClick={() => {
                try { localStorage.setItem('yaram_pending_promo', heroPromo.code); } catch {}
                navigate('/');
              }}>
                Voir les produits →
              </button>

              {heroPromo.min_order > 0 && (
                <div className="ypromos-hero-min">
                  Dès {fmt(heroPromo.min_order)} FCFA d'achat
                </div>
              )}
            </div>
          </section>
        )}

        {/* ════════ TABS ════════ */}
        {promos.length > 1 && (
          <div className="ypromos-tabs-wrap">
            <div className="ypromos-tabs">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`ypromos-tab ${filter === tab.id ? 'active' : ''}`}
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════════ GRID DE CARDS ════════ */}
        <section className="ypromos-section">
          {loading ? (
            <div className="ypromos-loading">
              <div className="ypromos-skel" />
              <div className="ypromos-skel" />
              <div className="ypromos-skel" />
            </div>
          ) : filteredPromos.length === 0 ? (
            <div className="ypromos-empty">
              <div className="ypromos-empty-illu" aria-hidden>
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="56" height="56">
                  <path d="M20 6 6 20l22 22 14-14z"/>
                  <circle cx="14" cy="14" r="2"/>
                </svg>
              </div>
              <h3>Aucun bon plan</h3>
              <p>Reviens plus tard, on en ajoute régulièrement.</p>
            </div>
          ) : (
            <div className="ypromos-grid">
              {filteredPromos.map((p, idx) => {
                const left = daysLeftBadge(p);
                const exhausted = isExhausted(p);
                const scope = promoScope(p);
                return (
                  <div
                    key={p.id}
                    className={`ypromos-card ypromos-stagger ${exhausted ? 'exhausted' : ''}`}
                    style={{ '--i': idx + 1 }}
                  >
                    <div className="ypromos-card-head">
                      <div className="ypromos-card-icon-wrap">
                        <span className="ypromos-card-icon">{promoIcon(p)}</span>
                      </div>
                      <div className="ypromos-card-head-text">
                        <div className="ypromos-card-value">{promoValueLabel(p)}</div>
                        <div className="ypromos-card-sub">
                          {p.description || 'Offre exclusive YARAM'}
                        </div>
                      </div>
                      {left && (
                        <span className={`ypromos-card-badge ${left === 'Expirée' ? 'expired' : ''}`}>
                          {left}
                        </span>
                      )}
                    </div>

                    {(p.min_order > 0 || scope !== 'all' || p.per_user_limit > 0) && (
                      <div className="ypromos-card-meta">
                        {p.min_order > 0 && (
                          <span className="ypromos-meta-chip">
                            Min. {fmt(p.min_order)} FCFA
                          </span>
                        )}
                        {scope === 'first' && (
                          <span className="ypromos-meta-chip first">
                            1ère commande
                          </span>
                        )}
                        {p.per_user_limit > 0 && (
                          <span className="ypromos-meta-chip">
                            {p.per_user_limit}× max
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      className={`ypromos-card-code-pill ${copiedCode === p.code ? 'copied' : ''}`}
                      onClick={() => handleCopy(p.code)}
                      disabled={exhausted}
                    >
                      <span className="ypromos-card-code-label">CODE</span>
                      <span className="ypromos-card-code-text">{p.code}</span>
                      <span className="ypromos-card-code-action">
                        {copiedCode === p.code ? '✓ Copié' : 'Tap'}
                      </span>
                    </button>

                    <button
                      className="ypromos-card-cta"
                      onClick={() => {
                        try { localStorage.setItem('yaram_pending_promo', p.code); } catch {}
                        navigate('/');
                      }}
                      disabled={exhausted}
                    >
                      {exhausted ? 'Promo épuisée' : 'Voir produits éligibles →'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ════════ PROGRAMME FIDÉLITÉ (calque native) ════════ */}
        {!loading && (
          <section className="ypromos-loyalty ypromos-stagger" style={{ '--i': 10 }}>
            <div className="ypromos-loyalty-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <path d="M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
              </svg>
            </div>
            <div className="ypromos-loyalty-body">
              <h3>Programme Fidélité</h3>
              <p>Gagne <strong>500 pts</strong> par commande</p>
            </div>
            <button className="ypromos-loyalty-cta" onClick={() => navigate('/loyalty')}>
              →
            </button>
          </section>
        )}

        <div style={{ height: 40 }} />
      </div>

      {/* Toast de copie */}
      {toast && (
        <div className="ypromos-toast" role="status">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {toast}
        </div>
      )}

      <TabBar active="home" />
    </div>
  );
}
