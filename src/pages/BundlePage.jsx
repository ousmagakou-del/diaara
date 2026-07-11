// ════════════════════════════════════════════════════════════════════
// BundlePage — Page bundle / routine complete
// URL : /bundle/:slug
// ════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react';
import { useNav } from '../App';
import SiteLayout from '../components/SiteLayout';
import { getBundleBySlug, getAllPharmacies } from '../lib/supabase';
import { addToCart } from '../lib/cart';
import './BundlePage.css';

const formatPrice = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';

export default function BundlePage() {
  const { route, navigate } = useNav();
  const slug = route?.params?.slug;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.scrollTo(0, 0);
    Promise.all([
      getBundleBySlug(slug).catch(() => null),
      getAllPharmacies().catch(() => []),
    ]).then(([bundleData, phs]) => {
      if (cancelled) return;
      setData(bundleData);
      setPharmacies(phs || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  const bundle = data?.bundle || null;
  const items = data?.items || [];
  const totalOriginal = data?.total_original || 0;
  const totalDiscounted = data?.total_discounted || 0;
  const savings = totalOriginal - totalDiscounted;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const handleAddBundle = () => {
    if (!items.length) return;
    const pharmacy = pharmacies?.[0] || { id: 'default', name: 'YARAM' };
    const dealTag = {
      slug: bundle.slug,
      title: bundle.title,
      discount_pct: bundle.discount_pct || 10,
    };
    items.forEach((it) => {
      addToCart({
        product: {
          id: it.id,
          name: it.name,
          brand: it.brand || '',
          img: it.image_url || it.img || '',
          price: it.price,
        },
        pharmacy,
        qty: 1,
        is_bundle_deal: dealTag,
      });
    });
    showToast('Kit ajoute au panier');
  };

  if (loading) {
    return (
      <SiteLayout>
        <div className="bp-loading">Chargement de la routine...</div>
      </SiteLayout>
    );
  }

  if (!bundle) {
    return (
      <SiteLayout>
        <div className="bp-empty">
          <h1>Routine introuvable</h1>
          <p>Cette routine n existe pas ou n est plus disponible.</p>
          <button className="bp-btn-primary" onClick={() => navigate('shop')}>
            Retour a la boutique
          </button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="bp-page">
        {toast && <div className="bp-toast">{toast}</div>}

        {/* Header */}
        <header className="bp-header">
          {bundle.cover_url && (
            <div className="bp-cover">
              <img src={bundle.cover_url} alt={bundle.title} />
            </div>
          )}
          <div className="bp-header-body">
            <span className="bp-header-tag">Routine complete</span>
            <h1 className="bp-title">{bundle.title}</h1>
            {bundle.description && (
              <p className="bp-desc">{bundle.description}</p>
            )}
            <div className="bp-header-badges">
              <span className="bp-badge bp-badge--discount">-{bundle.discount_pct || 10}% pack</span>
              <span className="bp-badge">{items.length} produits</span>
            </div>
          </div>
        </header>

        <div className="bp-layout">
          {/* Liste des items */}
          <div className="bp-items">
            <h2 className="bp-h2">Contenu du kit</h2>
            {items.map((it, idx) => (
              <article key={it.id} className="bp-item">
                <div className="bp-item-num">{idx + 1}</div>
                <button
                  type="button"
                  className="bp-item-img"
                  onClick={() => navigate('productPage', { id: it.id })}
                  aria-label={it.name}
                >
                  <img
                    src={it.image_url || it.img || ''}
                    alt={it.name}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.opacity = 0.25; }}
                  />
                </button>
                <div className="bp-item-body">
                  <div className="bp-item-brand">{it.brand || ''}</div>
                  <button
                    type="button"
                    className="bp-item-name"
                    onClick={() => navigate('productPage', { id: it.id })}
                  >
                    {it.name}
                  </button>
                  {it.short_desc && <div className="bp-item-desc">{it.short_desc}</div>}
                </div>
                <div className="bp-item-price">{formatPrice(it.price)}</div>
              </article>
            ))}
          </div>

          {/* Sidebar - Recap prix */}
          <aside className="bp-summary">
            <div className="bp-summary-inner">
              <h3 className="bp-summary-title">Recapitulatif</h3>
              <div className="bp-summary-line">
                <span>Sous-total</span>
                <span>{formatPrice(totalOriginal)}</span>
              </div>
              <div className="bp-summary-line bp-summary-line--save">
                <span>Remise kit (-{bundle.discount_pct || 10}%)</span>
                <span>- {formatPrice(savings)}</span>
              </div>
              <div className="bp-summary-total">
                <span>Total</span>
                <span>{formatPrice(totalDiscounted)}</span>
              </div>
              <div className="bp-summary-save">
                Tu economises <strong>{formatPrice(savings)}</strong>
              </div>
              <button
                type="button"
                className="bp-btn-primary bp-btn-block"
                onClick={handleAddBundle}
                disabled={!items.length}
              >
                Ajouter le kit -{bundle.discount_pct || 10}% au panier
              </button>
              <p className="bp-summary-note">
                Livraison rapide au Senegal. Retour 14 jours.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
