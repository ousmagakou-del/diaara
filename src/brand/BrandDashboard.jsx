// ════════════════════════════════════════════════════════════════
// BrandDashboard — Vue d'ensemble
// ────────────────────────────────────────────────────────────────
// Affiche : KPI (produits en ligne / en attente / rejetes)
//         + carte hero + steps "comment ca marche" + WhatsApp support
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getBrandToken } from '../pages/Brand';
import { getWhatsAppNumber } from '../lib/utils';
import BrandInstallCard from './BrandInstallCard';

export default function BrandDashboard({ brand, setSection, onStatsChange }) {
  const [stats, setStats] = useState({
    total_products: 0,
    pending_products: 0,
    rejected_products: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getBrandToken();
      if (!token) return;
      try {
        const { data, error } = await supabase.rpc('brand_get_info', { p_token: token });
        if (cancelled) return;
        if (error) {
          console.error('[BrandDashboard] brand_get_info error:', error.message);
          setLoading(false);
          return;
        }
        if (data?.stats) {
          setStats(data.stats);
          if (onStatsChange) onStatsChange(data.stats);
        }
        setLoading(false);
      } catch (e) {
        console.error('[BrandDashboard] error:', e?.message);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.id]);

  const openWhatsApp = () => {
    const msg = `Bonjour Ousmane,\n\nJe suis la marque ${brand?.name || ''}. J'ai besoin d'aide sur mon dashboard YARAM.`;
    window.open(`https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="brnd-section">
      <div className="brnd-header">
        <div>
          <h1>Salut, {brand?.name} 👋</h1>
          <p>Voici l'état de tes produits sur YARAM.</p>
        </div>
      </div>

      {/* HERO CARD */}
      <div className="brnd-hero-card">
        <div className="brnd-hero-eyebrow">Ton espace marque</div>
        <h2 className="brnd-hero-title">Gère tes produits en autonomie</h2>
        <p className="brnd-hero-sub">
          Ajoute tes produits, mets à jour tes prix, propose des nouveautés — YARAM valide sous 24-48h et tes produits sont en vente.
        </p>
        <button className="brnd-hero-cta" onClick={() => setSection('products')}>
          Ajouter un produit
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>

      {/* KPI */}
      <div className="brnd-kpi-grid">
        <div className="brnd-kpi kpi-approved">
          <div className="brnd-kpi-label">
            <span className="brnd-kpi-dot" />
            Produits en ligne
          </div>
          <div className="brnd-kpi-value">{loading ? '…' : stats.total_products}</div>
          <div className="brnd-kpi-meta">Visibles par tes clientes</div>
        </div>
        <div className="brnd-kpi kpi-pending">
          <div className="brnd-kpi-label">
            <span className="brnd-kpi-dot" />
            En attente de validation
          </div>
          <div className="brnd-kpi-value">{loading ? '…' : stats.pending_products}</div>
          <div className="brnd-kpi-meta">Sous 24-48h par YARAM</div>
        </div>
        <div className="brnd-kpi kpi-rejected">
          <div className="brnd-kpi-label">
            <span className="brnd-kpi-dot" />
            Rejetés
          </div>
          <div className="brnd-kpi-value">{loading ? '…' : stats.rejected_products}</div>
          <div className="brnd-kpi-meta">À corriger et resoumettre</div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="brnd-card" style={{ marginBottom: 20 }}>
        <div className="brnd-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Comment ça marche
        </div>
        <div className="brnd-steps">
          <div className="brnd-step">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="brnd-step-num">1</div>
              <div className="brnd-step-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
            </div>
            <h4>Tu ajoutes ton produit</h4>
            <p>Photo, nom, prix, description — tout depuis ton téléphone.</p>
          </div>
          <div className="brnd-step">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="brnd-step-num">2</div>
              <div className="brnd-step-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
            </div>
            <h4>YARAM modère</h4>
            <p>Sous 24-48h — vérif conformité, qualité photo, prix.</p>
          </div>
          <div className="brnd-step">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="brnd-step-num">3</div>
              <div className="brnd-step-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>
            <h4>Le produit est en vente</h4>
            <p>Il apparaît dans le shop YARAM — tes clientes peuvent commander.</p>
          </div>
        </div>
      </div>

      {/* WHATSAPP SUPPORT */}
      <div className="brnd-wa-card">
        <div className="brnd-wa-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
        <div className="brnd-wa-info">
          <h3>Une question ? On te répond en direct.</h3>
          <p>Écris à Ousmane sur WhatsApp — support marque prioritaire.</p>
        </div>
        <button className="brnd-wa-btn" onClick={openWhatsApp}>
          Ouvrir WhatsApp
        </button>
      </div>

      {/* INSTALL PWA + NOTIFS */}
      <BrandInstallCard brandId={brand?.id} />
    </div>
  );
}
