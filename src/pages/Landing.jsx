// ════════════════════════════════════════════════════════════════════
// YARAM — Page Landing style Uber (marketing-forward, responsive)
// ════════════════════════════════════════════════════════════════════
// Sert d'accueil pour les visiteurs sans l'app : push vers App Store,
// présente la marque, et garde le catalogue accessible pour ne pas
// perdre de conversion. Style inspiré uber.com / lyft.com.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNav } from '../App';
import { getAllBrands, getAllPharmacies } from '../lib/supabase';
import './Landing.css';

const APP_STORE_URL = 'https://apps.apple.com/app/yaram/id6771017009';
const PLAY_STORE_URL = null; // Bientôt

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export default function Landing() {
  const { navigate } = useNav();
  const [platform] = useState(detectPlatform);
  const [brands, setBrands] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);

  useEffect(() => {
    getAllBrands().then((b) => setBrands((b || []).slice(0, 12))).catch(() => {});
    getAllPharmacies().then((p) => setPharmacies((p || []).slice(0, 6))).catch(() => {});
  }, []);

  const goToShop = () => navigate('shop');
  const downloadApp = () => {
    if (platform === 'android') {
      // Bientôt Play Store
      navigate('shop');
    } else {
      window.open(APP_STORE_URL, '_blank');
    }
  };

  return (
    <div className="lp-root">
      {/* ━━━ HEADER ━━━ */}
      <header className="lp-header">
        <div className="lp-header-inner">
          <a href="/" className="lp-logo" onClick={(e) => { e.preventDefault(); }}>
            <span className="lp-logo-mark">Y</span>
            <span className="lp-logo-text">YARAM</span>
          </a>
          <nav className="lp-nav">
            <button onClick={() => navigate('shop')}>Catalogue</button>
            <button onClick={() => navigate('brands')}>Marques</button>
            <button onClick={() => document.getElementById('lp-partner')?.scrollIntoView({ behavior: 'smooth' })}>
              Pharmacies
            </button>
            <button onClick={() => document.getElementById('lp-driver')?.scrollIntoView({ behavior: 'smooth' })}>
              Devenir livreur
            </button>
          </nav>
          <div className="lp-header-cta">
            <button className="lp-btn-ghost" onClick={() => navigate('auth')}>Se connecter</button>
            <button className="lp-btn-primary" onClick={downloadApp}>
              📱 Télécharger l'app
            </button>
          </div>
        </div>
      </header>

      {/* ━━━ HERO ━━━ */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-content">
            <div className="lp-hero-badge">
              <span className="lp-pulse"></span>
              <span>Livraison en 30 min à Dakar</span>
            </div>
            <h1 className="lp-hero-title">
              Ta parapharmacie
              <br/>
              <span className="lp-hero-accent">dans ta poche.</span>
            </h1>
            <p className="lp-hero-sub">
              Plus de 5 000 produits beauté & santé livrés à domicile.
              Pharmacies vérifiées, marques 100% authentiques,
              livreurs YARAM en moins de 30 min.
            </p>
            <div className="lp-hero-cta">
              <button className="lp-btn-primary lp-btn-lg" onClick={downloadApp}>
                {platform === 'ios' ? '📱 Télécharger sur App Store' : platform === 'android' ? '📱 Voir le catalogue' : '📱 Télécharger l\'app'}
              </button>
              <button className="lp-btn-ghost lp-btn-lg" onClick={goToShop}>
                Voir le catalogue
              </button>
            </div>
            <div className="lp-hero-trust">
              <div className="lp-trust-item">
                <strong>4.9★</strong>
                <span>App Store</span>
              </div>
              <div className="lp-trust-item">
                <strong>5K+</strong>
                <span>Produits</span>
              </div>
              <div className="lp-trust-item">
                <strong>30 min</strong>
                <span>Livraison Dakar</span>
              </div>
            </div>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-phone-mockup">
              <div className="lp-phone-screen">
                <div className="lp-phone-header">
                  <span className="lp-phone-time">9:41</span>
                  <span className="lp-phone-bars">●●●●</span>
                </div>
                <div className="lp-phone-app">
                  <div className="lp-phone-greeting">Bonjour Aïssatou 👋</div>
                  <div className="lp-phone-search">🔍 Rechercher un produit…</div>
                  <div className="lp-phone-banner">
                    <div className="lp-phone-banner-title">Promo La Roche-Posay</div>
                    <div className="lp-phone-banner-sub">-20% jusqu'à dimanche</div>
                  </div>
                  <div className="lp-phone-grid">
                    <div className="lp-phone-card"><div className="lp-phone-card-img"></div><div className="lp-phone-card-name">Bioderma H2O</div><div className="lp-phone-card-price">8 500 FCFA</div></div>
                    <div className="lp-phone-card"><div className="lp-phone-card-img"></div><div className="lp-phone-card-name">Avène Eau</div><div className="lp-phone-card-price">5 800 FCFA</div></div>
                    <div className="lp-phone-card"><div className="lp-phone-card-img"></div><div className="lp-phone-card-name">Vichy Mineral</div><div className="lp-phone-card-price">12 000 FCFA</div></div>
                    <div className="lp-phone-card"><div className="lp-phone-card-img"></div><div className="lp-phone-card-name">Caudalie Vinosource</div><div className="lp-phone-card-price">15 200 FCFA</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ COMMENT ÇA MARCHE ━━━ */}
      <section className="lp-section lp-how">
        <h2 className="lp-section-title">Comment ça marche</h2>
        <div className="lp-steps">
          <div className="lp-step">
            <div className="lp-step-num">1</div>
            <div className="lp-step-icon">📱</div>
            <h3>Tu commandes en 2 minutes</h3>
            <p>Cherche ton produit, scan le code-barre, ou demande à notre IA un conseil personnalisé.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-num">2</div>
            <div className="lp-step-icon">💊</div>
            <h3>On prépare en pharmacie</h3>
            <p>Une pharmacie YARAM partenaire prépare ta commande avec des produits 100% authentiques.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-num">3</div>
            <div className="lp-step-icon">🛵</div>
            <h3>On livre en 30 min</h3>
            <p>Un livreur YARAM t'apporte ta commande à domicile, tracking en temps réel sur l'app.</p>
          </div>
        </div>
      </section>

      {/* ━━━ MARQUES PARTENAIRES ━━━ */}
      <section className="lp-section lp-brands">
        <h2 className="lp-section-title">Les plus grandes marques</h2>
        <p className="lp-section-sub">Bioderma, La Roche-Posay, Caudalie, Vichy, Avène, Embryolisse et bien d'autres — toutes officielles, toutes garanties.</p>
        {brands.length > 0 && (
          <div className="lp-brands-grid">
            {brands.map((b) => (
              <button key={b.id} className="lp-brand-tile" onClick={() => navigate({ name: 'brand', id: b.id })}>
                {b.logo_url ? <img src={b.logo_url} alt={b.name} /> : <div className="lp-brand-name">{b.name}</div>}
              </button>
            ))}
          </div>
        )}
        <div className="lp-section-cta">
          <button className="lp-btn-ghost" onClick={() => navigate('brands')}>Voir toutes les marques →</button>
        </div>
      </section>

      {/* ━━━ APP DOWNLOAD ━━━ */}
      <section className="lp-section lp-app">
        <div className="lp-app-inner">
          <div className="lp-app-content">
            <div className="lp-app-badge">📲 L'expérience complète</div>
            <h2>Télécharge l'app pour vivre YARAM à fond</h2>
            <ul className="lp-app-features">
              <li>🤖 Conseiller IA personnalisé selon ton type de peau</li>
              <li>📸 Scanner peau + analyse beauté en 30 sec</li>
              <li>🛵 Suivi livreur GPS en temps réel</li>
              <li>🎁 Programme fidélité YARAM+</li>
              <li>🔔 Notifications de tes commandes</li>
              <li>🌍 Marques exclusives Internationales</li>
            </ul>
            <div className="lp-app-stores">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="lp-store-badge">
                <span className="lp-store-icon"></span>
                <div>
                  <span className="lp-store-pre">Télécharger sur</span>
                  <span className="lp-store-name">App Store</span>
                </div>
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} className="lp-store-badge lp-store-disabled">
                <span className="lp-store-icon-android"></span>
                <div>
                  <span className="lp-store-pre">Bientôt sur</span>
                  <span className="lp-store-name">Google Play</span>
                </div>
              </a>
            </div>
          </div>
          <div className="lp-app-visual">
            <div className="lp-app-glow"></div>
          </div>
        </div>
      </section>

      {/* ━━━ PHARMACIES PARTENAIRES (B2B) ━━━ */}
      <section className="lp-section lp-partner" id="lp-partner">
        <div className="lp-partner-inner">
          <div className="lp-partner-content">
            <span className="lp-section-eyebrow">POUR LES PHARMACIES</span>
            <h2>Booste tes ventes avec YARAM</h2>
            <p>Rejoins le réseau YARAM et multiplie ton chiffre d'affaires. On t'apporte une nouvelle clientèle digitale qui découvre tes produits sans bouger de chez elle.</p>
            <ul className="lp-partner-perks">
              <li>✓ Aucun investissement initial</li>
              <li>✓ Dashboard de gestion en temps réel</li>
              <li>✓ Livraison gérée 100% par YARAM</li>
              <li>✓ Paiement sous 48h</li>
            </ul>
            <button className="lp-btn-primary" onClick={() => navigate('partner-application')}>
              Devenir pharmacie partenaire
            </button>
          </div>
          <div className="lp-partner-stats">
            <div className="lp-stat-card">
              <div className="lp-stat-num">+45%</div>
              <div className="lp-stat-label">CA moyen après 3 mois</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-num">{pharmacies.length || '20'}+</div>
              <div className="lp-stat-label">Pharmacies partenaires</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-num">100%</div>
              <div className="lp-stat-label">Authentiques garantis</div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ LIVREURS ━━━ */}
      <section className="lp-section lp-driver" id="lp-driver">
        <div className="lp-driver-inner">
          <div className="lp-driver-content">
            <span className="lp-section-eyebrow">POUR LES LIVREURS</span>
            <h2>Gagne ta journée avec YARAM</h2>
            <p>Rejoins notre équipe de livreurs et choisis tes horaires. Bonus selon performance, paiements sous 24h, et une app dédiée pour gérer tes courses comme un pro.</p>
            <ul className="lp-driver-perks">
              <li>🛵 Moto, voiture ou vélo accepté</li>
              <li>💰 Gains visibles en temps réel sur ton app</li>
              <li>⏰ Horaires 100% flexibles</li>
              <li>📍 Zones de livraison de ton choix</li>
            </ul>
            <button className="lp-btn-primary" onClick={() => navigate('driver-application')}>
              Devenir livreur YARAM
            </button>
          </div>
          <div className="lp-driver-visual">
            <div className="lp-driver-emoji">🛵</div>
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-col">
            <div className="lp-logo lp-footer-logo">
              <span className="lp-logo-mark">Y</span>
              <span className="lp-logo-text">YARAM</span>
            </div>
            <p>La première parapharmacie 100% digitale du Sénégal.</p>
            <div className="lp-footer-stores">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="lp-store-mini">App Store</a>
            </div>
          </div>
          <div className="lp-footer-col">
            <h4>Produit</h4>
            <button onClick={() => navigate('shop')}>Catalogue</button>
            <button onClick={() => navigate('brands')}>Marques</button>
            <button onClick={() => navigate('international')}>Section International</button>
            <button onClick={() => navigate('cart')}>Panier</button>
          </div>
          <div className="lp-footer-col">
            <h4>Pour pros</h4>
            <button onClick={() => navigate('partner-application')}>Pharmacies</button>
            <button onClick={() => navigate('driver-application')}>Livreurs</button>
            <button onClick={() => window.open('mailto:pro@yaram.app')}>Distributeurs</button>
          </div>
          <div className="lp-footer-col">
            <h4>YARAM</h4>
            <button onClick={() => navigate('help')}>Aide & FAQ</button>
            <button onClick={() => navigate('legal')}>Mentions légales</button>
            <button onClick={() => navigate('cgv')}>CGV</button>
            <button onClick={() => navigate('privacy')}>Confidentialité</button>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 YARAM — Dakar, Sénégal</span>
          <a href="https://wa.me/221777608983" target="_blank" rel="noopener noreferrer">WhatsApp YARAM</a>
        </div>
      </footer>
    </div>
  );
}
