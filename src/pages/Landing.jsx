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
import SiteLayout from '../components/SiteLayout';
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
    <SiteLayout transparentHeader={true}>
    <div className="lp-root">

      {/* ━━━ HERO ━━━ */}
      <section className="lp-hero">
        <div className="lp-hero-bg-orb lp-orb-1"></div>
        <div className="lp-hero-bg-orb lp-orb-2"></div>
        <div className="lp-hero-inner">
          <div className="lp-hero-content">
            <h1 className="lp-hero-title">
              La beauté du Sénégal,
              <br/>
              <span className="lp-hero-accent">livrée chez toi.</span>
            </h1>
            <p className="lp-hero-sub">
              Plus de 5 000 produits cosmétiques et soins authentiques, sélectionnés par nos pharmaciens partenaires.
            </p>
            <div className="lp-hero-cta">
              <button className="lp-btn-primary lp-btn-lg" onClick={downloadApp}>
                Télécharger l'app
              </button>
              <button className="lp-btn-ghost lp-btn-lg" onClick={goToShop}>
                Explorer le catalogue
              </button>
            </div>
            <div className="lp-hero-trust">
              <div className="lp-trust-item">
                <strong>4.9★</strong>
                <span>App Store</span>
              </div>
              <div className="lp-trust-divider"></div>
              <div className="lp-trust-item">
                <strong>5 000+</strong>
                <span>Produits</span>
              </div>
              <div className="lp-trust-divider"></div>
              <div className="lp-trust-item">
                <strong>20+</strong>
                <span>Pharmacies</span>
              </div>
            </div>
          </div>
          {/* Marques iconiques en strip visuelle sous le hero */}
          {brands.length > 0 && (
            <div className="lp-hero-brand-strip">
              <span className="lp-strip-label">Nos marques partenaires</span>
              <div className="lp-strip-row">
                {brands.slice(0, 8).map((b) => (
                  <button
                    key={b.id}
                    className="lp-strip-tile"
                    onClick={() => navigate({ name: 'brand', id: b.id })}
                    aria-label={b.name}
                  >
                    {b.img ? <img src={b.img} alt={b.name} loading="lazy" decoding="async" /> : <span>{b.name}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ COMMENT ÇA MARCHE ━━━ */}
      <section className="lp-section lp-how">
        <h2 className="lp-section-title">Une expérience pensée pour toi</h2>
        <p className="lp-section-sub">Du catalogue à ta porte, tout est conçu pour te simplifier la vie.</p>
        <div className="lp-steps">
          <div className="lp-step">
            <div className="lp-step-num">1</div>
            <div className="lp-step-icon">
              {/* Shopping bag */}
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1F8B4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h3>Tu choisis</h3>
            <p>Plus de 5 000 produits beauté, soins et bien-être triés sur le volet par nos pharmaciens.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-num">2</div>
            <div className="lp-step-icon">
              {/* Pharmacy / pill */}
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1F8B4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
                <circle cx="18" cy="18" r="4"/>
                <path d="m15.5 15.5 5 5"/>
              </svg>
            </div>
            <h3>On prépare</h3>
            <p>Une pharmacie partenaire prépare ta commande avec des produits authentiques garantis.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-num">3</div>
            <div className="lp-step-icon">
              {/* Delivery / truck */}
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1F8B4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                <rect x="9" y="11" width="14" height="10" rx="2"/>
                <circle cx="12" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
              </svg>
            </div>
            <h3>Tu reçois</h3>
            <p>Livraison à domicile partout à Dakar, avec un suivi en temps réel sur l'app.</p>
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
                {b.img ? <img src={b.img} alt={b.name} loading="lazy" decoding="async" /> : <div className="lp-brand-name">{b.name}</div>}
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
            <div className="lp-app-badge">L'expérience complète</div>
            <h2>L'app YARAM, le meilleur de la beauté à portée de main</h2>
            <ul className="lp-app-features">
              <li>📸 Scanner peau et reçois des conseils personnalisés</li>
              <li>🎁 Programme fidélité YARAM+ et avantages exclusifs</li>
              <li>🔔 Notifications du statut de tes commandes</li>
              <li>🌍 Section International — marques exclusives importées</li>
              <li>📦 Historique de tes commandes et ré-achat 1-click</li>
              <li>💝 Routines beauté personnalisées</li>
            </ul>
            <div className="lp-app-stores">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="lp-store-badge-img" aria-label="Télécharger sur l'App Store">
                <img
                  src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/fr-fr?size=250x83"
                  alt="Télécharger sur l'App Store"
                  height="48"
                />
              </a>
              <span className="lp-store-badge-img lp-store-badge-img--disabled" aria-label="Bientôt sur Google Play">
                <img
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png"
                  alt="Bientôt sur Google Play"
                  height="48"
                />
              </span>
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
            <div className="lp-driver-card">
              <div className="lp-driver-card-header">
                <div className="lp-driver-avatar">M</div>
                <div>
                  <div className="lp-driver-card-name">Mamadou S.</div>
                  <div className="lp-driver-card-sub">Livreur YARAM · Dakar</div>
                </div>
                <span className="lp-driver-card-rating">★ 4.9</span>
              </div>
              <div className="lp-driver-card-stat">
                <span className="lp-driver-card-num">142 000 FCFA</span>
                <span className="lp-driver-card-label">cette semaine</span>
              </div>
              <div className="lp-driver-card-bars">
                <div className="lp-bar" style={{height: '40%'}}></div>
                <div className="lp-bar" style={{height: '60%'}}></div>
                <div className="lp-bar" style={{height: '80%'}}></div>
                <div className="lp-bar" style={{height: '50%'}}></div>
                <div className="lp-bar" style={{height: '90%'}}></div>
                <div className="lp-bar" style={{height: '70%'}}></div>
                <div className="lp-bar" style={{height: '100%', background: '#1F8B4C'}}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
    </SiteLayout>
  );
}
