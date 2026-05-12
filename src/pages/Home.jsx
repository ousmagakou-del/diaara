import { useState, useEffect } from 'react';
import { useNav, useUser } from '../App';
import { getAllProducts, getAllPharmacies } from '../lib/supabase';
import ProductTile from '../components/ProductTile';
import TabBar from '../components/TabBar';
import BannerCarousel from '../components/BannerCarousel';
import './Home.css';

const CATEGORIES = [
  { id: 'serum', name: 'Sérums', img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80' },
  { id: 'solaire', name: 'Solaires', img: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&q=80' },
  { id: 'nettoyant', name: 'Nettoyants', img: 'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=400&q=80' },
  { id: 'hydratant', name: 'Hydratants', img: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80' },
  { id: 'masque', name: 'Masques', img: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400&q=80' },
  { id: 'corps', name: 'Corps', img: 'https://images.unsplash.com/photo-1601612628452-9e99ced43524?w=400&q=80' },
  { id: 'levres', name: 'Lèvres', img: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&q=80' },
  { id: 'maquillage', name: 'Maquillage', img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80' },
  { id: 'cheveux', name: 'Cheveux', img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80' },
  { id: 'huile', name: 'Huiles', img: 'https://images.unsplash.com/photo-1599387737669-d56586d75f08?w=400&q=80' },
];

export default function Home() {
  const { navigate } = useNav();
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, ph] = await Promise.all([getAllProducts(), getAllPharmacies()]);
      setProducts(p);
      setPharmacies(ph);
      setLoading(false);
    })();
  }, []);

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const firstName = user?.first_name || 'toi';
  const avatar = user?.avatar || ('https://ui-avatars.com/api/?background=1F8B4C&color=fff&bold=true&name=' + encodeURIComponent(firstName));
  const skinType = cap(user?.skin_type) || 'Mixte';
  const phototype = user?.skin_phototype || 'VI';
  const concerns = user?.skin_concerns?.map(cap).join(' · ') || 'Taches post-acné · Brillance zone T';

  const compat = 87;
  const avoid = 12;
  const favs = 6;

  const topMatches = products.slice(0, 6);
  const trending = products.slice().sort((a, b) => (b.review_count || 0) - (a.review_count || 0)).slice(0, 4);

  return (
    <div className="home-screen page-anim">
      <div className="home-scroll">
        <div className="home-header">
          <button className="home-avatar-btn" onClick={() => navigate('/profile')}>
            <img src={avatar} alt="" />
            <div>
              <div className="home-hello">Salut {firstName} 👋</div>
              <div className="home-loc">
                <span className="home-dot" /> {user?.neighborhood ? `${user.neighborhood}, ` : ''}{user?.city || 'Dakar'}
              </div>
            </div>
          </button>
          <button className="home-bell" onClick={() => navigate('/orders')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span className="home-bell-dot" />
          </button>
        </div>

        <button className="home-search-bar" onClick={() => navigate('/search')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Cherche un produit, une marque...</span>
        </button>

        <div className="home-skin-card">
          <div className="home-skin-label">TON PROFIL PEAU</div>
          <div className="home-skin-type">{skinType} · Phototype {phototype}</div>
          <div className="home-skin-concerns">{concerns}</div>

          <div className="home-skin-stats">
            <div className="home-skin-stat">
              <div className="home-skin-num">{compat}</div>
              <div className="home-skin-stat-lbl">compatibles</div>
            </div>
            <div className="home-skin-stat">
              <div className="home-skin-num">{avoid}</div>
              <div className="home-skin-stat-lbl">à éviter</div>
            </div>
            <div className="home-skin-stat">
              <div className="home-skin-num">{favs}</div>
              <div className="home-skin-stat-lbl">favoris</div>
            </div>
          </div>

          <button className="home-skin-cta" onClick={() => navigate({ name: 'scan', params: {} })}>
            Refaire le diagnostic →
          </button>
        </div>

        {/* 🎨 BANNIÈRE CAROUSEL */}
        <div style={{ padding: '0 16px' }}>
          <BannerCarousel />
        </div>

        <button className="home-banner" onClick={() => navigate('/pharmacies')}>
          <div className="home-banner-icon">🏥</div>
          <div className="home-banner-text">
            <strong>{pharmacies.length} pharmacies partenaires</strong>
            <span>Découvre les boutiques près de chez toi</span>
          </div>
          <span className="home-banner-arrow">→</span>
        </button>

        <div className="home-section">
          <div className="home-section-head">
            <div className="section-title">Catégories</div>
            <button className="section-link" onClick={() => navigate({ name: 'categories', params: {} })}>Tout voir →</button>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className="cat-tile"
                onClick={() => navigate({ name: 'search', params: { category: cat.id } })}
              >
                <img src={cat.img} alt="" />
                <div className="cat-name">{cat.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="home-section">
          <div className="home-section-head">
            <div>
              <div className="section-title">✨ Pour toi, {firstName}</div>
              <div className="section-sub">Sélectionnés pour ta peau {skinType.toLowerCase()}</div>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : (
            <div className="product-grid">
              {topMatches.map(p => <ProductTile key={p.id} product={p} />)}
            </div>
          )}
        </div>

        <div className="home-section">
          <div className="section-title">🔥 Tendances cette semaine</div>
          <div className="product-grid" style={{ marginTop: 12 }}>
            {trending.map(p => <ProductTile key={p.id} product={p} />)}
          </div>
        </div>

        <div style={{ height: 30 }} />
      </div>
      <TabBar active="home" />
    </div>
  );
}