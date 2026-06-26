// ════════════════════════════════════════════════════════════════════
// SiteLayout — wrapper desktop premium (Header + Footer + container)
// ════════════════════════════════════════════════════════════════════
// Utilisé par Landing, Shop, Product, Brand, Cart, Checkout, etc.
// pour avoir une navigation consistante style Uber/DoorDash.
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNav, useUser } from '../App';
import { getCartCount } from '../lib/cart';
import './SiteLayout.css';

const APP_STORE_URL = 'https://apps.apple.com/app/yaram/id6771017009';

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export default function SiteLayout({ children, transparentHeader = false, hideFooter = false }) {
  const { navigate, route } = useNav();
  const { user } = useUser();
  const [platform] = useState(detectPlatform);
  const [cartCount, setCartCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      try {
        const n = getCartCount();
        // getCartCount peut être sync (return) ou async (Promise) selon version
        if (n && typeof n.then === 'function') {
          n.then((v) => setCartCount(v || 0)).catch(() => {});
        } else {
          setCartCount(Number(n) || 0);
        }
      } catch {}
    };
    update();
    const i = setInterval(update, 5000);
    window.addEventListener('focus', update);
    return () => { clearInterval(i); window.removeEventListener('focus', update); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [route?.name]);

  const downloadApp = () => {
    if (platform === 'android') {
      // Bientôt Play Store
      navigate('shop');
    } else {
      window.open(APP_STORE_URL, '_blank');
    }
  };

  const navItems = [
    { id: 'shop', label: 'Catalogue', route: 'shop' },
    { id: 'brands', label: 'Marques', route: 'brands' },
    { id: 'international', label: 'International', route: 'international' },
    { id: 'pharmacies', label: 'Pharmacies', route: 'pharmacies' },
    { id: 'help', label: 'Aide', route: 'help' },
  ];

  return (
    <div className="site-layout">
      {/* ━━━━━━━━━ HEADER ━━━━━━━━━ */}
      <header className={`site-header ${transparentHeader && !scrolled ? 'site-header--transparent' : ''} ${scrolled ? 'site-header--scrolled' : ''}`}>
        <div className="site-header-inner">
          <button className="site-logo" onClick={() => navigate('landing')}>
            <span className="site-logo-mark">Y</span>
            <span className="site-logo-text">YARAM</span>
          </button>

          {/* Desktop nav */}
          <nav className="site-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={route?.name === item.route ? 'site-nav-item site-nav-item--active' : 'site-nav-item'}
                onClick={() => navigate(item.route)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* CTA cluster */}
          <div className="site-header-cta">
            <button className="site-icon-btn" onClick={() => navigate('search')} aria-label="Rechercher">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
            <button className="site-icon-btn site-icon-btn--cart" onClick={() => navigate('cart')} aria-label="Panier">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {cartCount > 0 && <span className="site-cart-badge">{cartCount}</span>}
            </button>
            {user ? (
              <button className="site-icon-btn" onClick={() => navigate('profile')} aria-label="Mon compte">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </button>
            ) : (
              <button className="site-btn-ghost site-hide-mobile" onClick={() => navigate('auth')}>
                Se connecter
              </button>
            )}
            <button className="site-btn-primary site-hide-mobile" onClick={downloadApp}>
              📱 Télécharger l'app
            </button>
            <button
              className="site-icon-btn site-show-mobile"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                ) : (
                  <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="site-mobile-menu">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => navigate(item.route)}>
                {item.label}
              </button>
            ))}
            <div className="site-mobile-menu-divider"></div>
            {!user && (
              <button onClick={() => navigate('auth')}>👤 Se connecter</button>
            )}
            {user && (
              <button onClick={() => navigate('profile')}>👤 Mon compte</button>
            )}
            <button className="site-mobile-cta" onClick={downloadApp}>
              📱 Télécharger l'app
            </button>
          </div>
        )}
      </header>

      {/* ━━━━━━━━━ CONTENT ━━━━━━━━━ */}
      <main className="site-main">{children}</main>

      {/* ━━━━━━━━━ FOOTER ━━━━━━━━━ */}
      {!hideFooter && (
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="site-footer-col site-footer-brand">
              <div className="site-logo site-footer-logo">
                <span className="site-logo-mark">Y</span>
                <span className="site-logo-text">YARAM</span>
              </div>
              <p>La première parapharmacie 100% digitale du Sénégal. Livraison express, produits authentiques.</p>
              <div className="site-footer-app">
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="site-store-badge-img" aria-label="Télécharger sur l'App Store">
                  <img
                    src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/fr-fr?size=250x83"
                    alt="Télécharger sur l'App Store"
                    height="40"
                    style={{ display: 'block' }}
                  />
                </a>
                <span className="site-store-badge-img site-store-badge-img--disabled" aria-label="Bientôt sur Google Play">
                  <img
                    src="https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png"
                    alt="Bientôt sur Google Play"
                    height="40"
                    style={{ display: 'block' }}
                  />
                </span>
              </div>
            </div>

            <div className="site-footer-col">
              <h4>Produit</h4>
              <button onClick={() => navigate('shop')}>Catalogue</button>
              <button onClick={() => navigate('brands')}>Marques</button>
              <button onClick={() => navigate('international')}>International</button>
              <button onClick={() => navigate('pharmacies')}>Pharmacies</button>
            </div>

            <div className="site-footer-col">
              <h4>Pour pros</h4>
              <button onClick={() => navigate('partner-application')}>Pharmacies partenaires</button>
              <button onClick={() => navigate('driver-application')}>Devenir livreur</button>
              <button onClick={() => window.open('mailto:pro@yaram.app')}>Distributeurs</button>
            </div>

            <div className="site-footer-col">
              <h4>Support</h4>
              <button onClick={() => navigate('help')}>Aide & FAQ</button>
              <button onClick={() => window.open('https://wa.me/221777608983', '_blank')}>WhatsApp</button>
              <button onClick={() => navigate('privacy')}>Confidentialité</button>
              <button onClick={() => navigate('mentions')}>Mentions légales</button>
            </div>

            <div className="site-footer-col">
              <h4>YARAM</h4>
              <button onClick={() => navigate('terms')}>CGV</button>
              <button onClick={() => window.open('mailto:contact@yaram.app')}>Nous contacter</button>
            </div>
          </div>

          <div className="site-footer-bottom">
            <span>© 2026 YARAM SAS — Dakar, Sénégal</span>
            <div className="site-footer-socials">
              <a href="https://wa.me/221777608983" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488"/></svg>
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} aria-label="TikTok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/></svg>
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
