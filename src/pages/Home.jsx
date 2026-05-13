import { useState, useEffect } from 'react';
import { useNav, useUser } from '../App';
import { getAllProducts, getAllPharmacies } from '../lib/supabase';
import ProductTile from '../components/ProductTile';
import TabBar from '../components/TabBar';
import BannerCarousel from '../components/BannerCarousel';
import './Home.css';

// Emojis pour chaque catégorie (fallback si pas d'image produit)
const CATEGORY_EMOJI = {
  'Visage': '✨',
  'Corps': '🧴',
  'Bébé': '👶',
  'Bucco-dentaire': '🦷',
  'Compléments': '💊',
  'Cheveux': '💇',
  'Solaire': '☀️',
  'Intime': '🌸',
  'Hygiène': '🧼',
  'Pieds & Mains': '🦶',
  'Lèvres': '💋',
  'Déodorants': '🌿',
};

export default function Home() {
  const { navigate } = useNav();
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, ph] = await Promise.all([getAllProducts(), getAllPharmacies()]);
      setProducts(p);
      setPharmacies(ph);
      
      // Construire les catégories à partir des vrais produits
      const catMap = {};
      p.forEach(prod => {
        if (!prod.category) return;
        // Normaliser : "serum" et "Sérums" → "Visage" 
        // On garde uniquement les catégories qui commencent par majuscule
        const cat = prod.category;
        if (cat[0] !== cat[0].toUpperCase()) return; // skip les minuscules
        
        if (!catMap[cat]) {
          catMap[cat] = { id: cat, name: cat, count: 0, sampleImg: null };
        }
        catMap[cat].count++;
        // Prendre l'image du premier produit de la catégorie (qui a une image)
        if (!catMap[cat].sampleImg && prod.img) {
          catMap[cat].sampleImg = prod.img;
        }
      });
      
      const cats = Object.values(catMap).sort((a, b) => b.count - a.count);
      setCategories(cats);
      setLoading(false);
    })();
  }, []);

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const firstName = user?.first_name || 'toi';
  const avatar = user?.avatar || ('https://ui-avatars.com/api/?background=1F8B4C&color=fff&bold=true&name=' + encodeURIComponent(firstName));
  const skinType = cap(user?.skin_type) || 'Mixte';
  const phototype = user?.skin_phototype || 'VI';
  const concerns = user?.skin_concerns?.map(cap).join(' · ') || 'Taches post-acné · Brillance zone T';

  // Filtre les produits compatibles avec le type de peau de la cliente
  const compatibleProducts = products.filter(p => {
    if (!p.skin_types || p.skin_types.length === 0) return true;
    const userSkin = (user?.skin_type || '').toLowerCase();
    return p.skin_types.some(t => 
      t.toLowerCase() === userSkin || 
      t.toLowerCase() === 'toutes' || 
      t.toLowerCase() === 'all'
    );
  });

  const compat = compatibleProducts.length;
  const avoid = products.length - compat;
  const favs = 6;

  // Top matches : produits compatibles avec le meilleur score
  const topMatches = compatibleProducts
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 6);
  
  // Tendances : produits avec le plus de reviews
  const trending = products
    .slice()
    .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
    .slice(0, 4);

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

        {/* BANNIÈRE CAROUSEL */}
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

        {/* CATÉGORIES DYNAMIQUES */}
        <div className="home-section">
          <div className="home-section-head">
            <div className="section-title">Catégories</div>
            <button className="section-link" onClick={() => navigate({ name: 'categories', params: {} })}>Tout voir →</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#9B9B9B' }}>Chargement…</div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
              gap: 10, 
              padding: '0 16px',
            }}>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => navigate({ name: 'search', params: { category: cat.id } })}
                  style={{
                    background: 'white',
                    border: '1px solid #EEE',
                    borderRadius: 14,
                    padding: 10,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    background: 'linear-gradient(135deg, #1F8B4C20, #1F8B4C10)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                    marginBottom: 8,
                    overflow: 'hidden',
                  }}>
                    {cat.sampleImg ? (
                      <img 
                        src={cat.sampleImg} 
                        alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { 
                          e.target.style.display = 'none'; 
                          e.target.parentElement.innerHTML = CATEGORY_EMOJI[cat.name] || '📦';
                        }}
                      />
                    ) : (
                      CATEGORY_EMOJI[cat.name] || '📦'
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                    {cat.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>
                    {cat.count} produit{cat.count > 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* POUR TOI */}
        <div className="home-section">
          <div className="home-section-head">
            <div>
              <div className="section-title">✨ Pour toi, {firstName}</div>
              <div className="section-sub">Sélectionnés pour ta peau {skinType.toLowerCase()}</div>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : topMatches.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Aucun produit pour le moment</div>
          ) : (
            <div className="product-grid">
              {topMatches.map(p => <ProductTile key={p.id} product={p} />)}
            </div>
          )}
        </div>

        {/* TENDANCES */}
        <div className="home-section">
          <div className="section-title">🔥 Tendances cette semaine</div>
          {loading ? null : (
            <div className="product-grid" style={{ marginTop: 12 }}>
              {trending.map(p => <ProductTile key={p.id} product={p} />)}
            </div>
          )}
        </div>

        <div style={{ height: 30 }} />
      </div>
      <TabBar active="home" />
    </div>
  );
}