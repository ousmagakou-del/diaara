import { useState, useEffect } from 'react';
import { useNav, useUser } from '../App';
import { getAllProducts, getAllPharmacies, supabase } from '../lib/supabase';
import { getUserPosition, sortByDistance, formatDistance, getPermissionState } from '../lib/geo';
import ProductTile from '../components/ProductTile';
import TabBar from '../components/TabBar';
import BannerCarousel from '../components/BannerCarousel';
import './Home.css';

const CATEGORY_EMOJI = {
  'Visage': '✨', 'Corps': '🧴', 'Bébé': '👶', 'Bucco-dentaire': '🦷',
  'Compléments': '💊', 'Cheveux': '💇', 'Solaire': '☀️', 'Intime': '🌸',
  'Hygiène': '🧼', 'Pieds & Mains': '🦶', 'Lèvres': '💋', 'Déodorants': '🌿',
};

export default function Home() {
  const { navigate } = useNav();
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('unknown'); // 'unknown' | 'requesting' | 'granted' | 'denied'
  const [categories, setCategories] = useState([]);
  const [favIds, setFavIds] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [latestScan, setLatestScan] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Demander GPS au démarrage ───
  useEffect(() => {
    (async () => {
      const state = await getPermissionState();
      if (state === 'granted') {
        // Déjà autorisé → on récupère direct
        const pos = await getUserPosition();
        if (pos) {
          setUserPos(pos);
          setGpsStatus('granted');
        }
      } else if (state === 'prompt' || state === 'unknown') {
        // Pas encore demandé → on tente
        setGpsStatus('requesting');
        const pos = await getUserPosition(3000);
        if (pos) {
          setUserPos(pos);
          setGpsStatus('granted');
        } else {
          setGpsStatus('denied');
        }
      } else {
        setGpsStatus('denied');
      }
    })();
  }, []);

  // ─── Charger données ───
  useEffect(() => {
    (async () => {
      const [p, ph] = await Promise.all([getAllProducts(), getAllPharmacies()]);
      setProducts(p);
      setPharmacies(ph);

      // Catégories dynamiques
      const catMap = {};
      p.forEach(prod => {
        if (!prod.category) return;
        const cat = prod.category;
        if (cat[0] !== cat[0].toUpperCase()) return;
        if (!catMap[cat]) catMap[cat] = { id: cat, name: cat, count: 0, sampleImg: null };
        catMap[cat].count++;
        if (!catMap[cat].sampleImg && prod.img) catMap[cat].sampleImg = prod.img;
      });
      setCategories(Object.values(catMap).sort((a, b) => b.count - a.count));

      if (user?.id) {
        const { data: favs } = await supabase
          .from('favorites').select('product_id').eq('user_id', user.id);
        setFavIds((favs || []).map(f => f.product_id));

        const { data: scan } = await supabase
          .from('skin_scans').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false })
          .limit(1).maybeSingle();
        setLatestScan(scan);
      }

      // Best sellers
      try {
        const { data: orders } = await supabase
          .from('orders').select('items')
          .in('status', ['delivered', 'shipped', 'ready', 'preparing']);
        
        const productSales = {};
        (orders || []).forEach(o => {
          (o.items || []).forEach(item => {
            if (item.productId) {
              productSales[item.productId] = (productSales[item.productId] || 0) + (item.qty || 1);
            }
          });
        });
        
        const sortedIds = Object.entries(productSales)
          .sort((a, b) => b[1] - a[1]).map(([id]) => id);
        const best = sortedIds.map(id => p.find(pr => pr.id === id)).filter(Boolean);
        setBestSellers(best);
      } catch (e) {
        console.error('best sellers error:', e);
      }

      setLoading(false);
    })();
  }, [user?.id]);

  // ─── Trier pharmacies par distance quand GPS dispo ───
  useEffect(() => {
    if (pharmacies.length === 0) return;
    
    if (userPos) {
      const sorted = sortByDistance(pharmacies, userPos.lat, userPos.lng);
      setNearbyPharmacies(sorted.slice(0, 5));
    } else {
      setNearbyPharmacies(pharmacies.slice(0, 5));
    }
  }, [pharmacies, userPos]);

  const handleEnableGPS = async () => {
    setGpsStatus('requesting');
    const pos = await getUserPosition();
    if (pos) {
      setUserPos(pos);
      setGpsStatus('granted');
    } else {
      setGpsStatus('denied');
    }
  };

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const firstName = user?.first_name || 'toi';
  const avatar = user?.avatar || ('https://ui-avatars.com/api/?background=1F8B4C&color=fff&bold=true&name=' + encodeURIComponent(firstName));
  const skinType = cap(user?.skin_type) || 'Mixte';
  const phototype = user?.skin_phototype || 'VI';
  const concerns = user?.skin_concerns?.map(cap).join(' · ') || 'Taches post-acné · Brillance zone T';

  const scoreProduct = (p) => {
    let score = 0;
    const userSkin = (user?.skin_type || '').toLowerCase();
    if (p.skin_types && p.skin_types.length > 0) {
      const compatible = p.skin_types.some(t => 
        t.toLowerCase() === userSkin || t.toLowerCase() === 'toutes' || t.toLowerCase() === 'all'
      );
      if (compatible) score += 30;
    } else score += 15;
    score += (p.score || 50) * 0.3;
    
    if (latestScan?.diagnosis?.ingredients_recommandes) {
      const recommended = latestScan.diagnosis.ingredients_recommandes.map(i => i.toLowerCase());
      const productText = `${p.name || ''} ${p.inci || ''} ${p.short_desc || ''}`.toLowerCase();
      const matches = recommended.filter(ing => productText.includes(ing)).length;
      score += matches * 5;
    }
    if (latestScan?.diagnosis?.ingredients_a_eviter) {
      const avoid = latestScan.diagnosis.ingredients_a_eviter.map(i => i.toLowerCase());
      const productText = `${p.name || ''} ${p.inci || ''}`.toLowerCase();
      const matches = avoid.filter(ing => productText.includes(ing)).length;
      score -= matches * 10;
    }
    if (user?.skin_concerns && p.short_desc) {
      const desc = p.short_desc.toLowerCase();
      user.skin_concerns.forEach(c => { if (desc.includes(c.toLowerCase())) score += 5; });
    }
    if (favIds.includes(p.id)) score += 20;
    return score;
  };

  const compatibleProducts = products.filter(p => {
    if (!p.skin_types || p.skin_types.length === 0) return true;
    const userSkin = (user?.skin_type || '').toLowerCase();
    return p.skin_types.some(t => 
      t.toLowerCase() === userSkin || t.toLowerCase() === 'toutes' || t.toLowerCase() === 'all'
    );
  });

  const compat = compatibleProducts.length;
  const avoid = products.length - compat;
  const favs = favIds.length;

  const topMatches = products
    .slice()
    .map(p => ({ ...p, _personalScore: scoreProduct(p) }))
    .sort((a, b) => b._personalScore - a._personalScore)
    .slice(0, 6);
  
  const trending = bestSellers.length > 0
    ? bestSellers.slice(0, 4)
    : products.slice().sort((a, b) => {
        const scoreA = (a.review_count || 0) * 0.6 + (a.score || 0) * 0.4;
        const scoreB = (b.review_count || 0) * 0.6 + (b.score || 0) * 0.4;
        return scoreB - scoreA;
      }).slice(0, 4);

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
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
            {latestScan ? 'Refaire le diagnostic →' : 'Faire ton diagnostic IA →'}
          </button>
        </div>

        <div style={{ padding: '0 16px' }}><BannerCarousel /></div>

        {/* 🆕 PRÈS DE CHEZ TOI - GPS */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>
                📍 Près de chez toi
              </div>
              {gpsStatus === 'granted' && (
                <div style={{ fontSize: 11, color: '#1F8B4C', fontWeight: 600 }}>
                  GPS activé · trié par distance
                </div>
              )}
              {gpsStatus === 'denied' && (
                <div style={{ fontSize: 11, color: '#9B9B9B' }}>
                  Active le GPS pour voir les distances
                </div>
              )}
            </div>
            <button 
              onClick={() => navigate({ name: 'pharmacies', params: {} })}
              style={{ background: 'transparent', border: 'none', color: '#1F8B4C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Tout voir →
            </button>
          </div>

          {gpsStatus === 'denied' && (
            <div style={{ padding: '0 16px', marginBottom: 12 }}>
              <button
                onClick={handleEnableGPS}
                style={{
                  width: '100%', padding: 14,
                  background: 'linear-gradient(135deg, #1F8B4C, #166635)',
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                📍 Activer la localisation
              </button>
            </div>
          )}

          {gpsStatus === 'requesting' && (
            <div style={{ padding: 20, textAlign: 'center', color: '#9B9B9B', fontSize: 13 }}>
              📍 Recherche de ta position…
            </div>
          )}

          {/* Cards horizontales scrollables */}
          <div style={{ 
            display: 'flex', gap: 12, padding: '0 16px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
          }}>
            {nearbyPharmacies.map(ph => (
              <button
                key={ph.id}
                onClick={() => navigate({ name: 'pharmacy_detail', params: { id: ph.id } })}
                style={{
                  flexShrink: 0, width: 220,
                  background: 'white', border: '1px solid #EEE',
                  borderRadius: 14, padding: 0, cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                  scrollSnapAlign: 'start', overflow: 'hidden',
                }}
              >
                <div style={{
                  height: 100,
                  background: ph.cover 
                    ? `url(${ph.cover}) center/cover`
                    : 'linear-gradient(135deg, #1F8B4C, #166635)',
                  position: 'relative',
                }}>
                  {ph.distance !== undefined && ph.distance !== Infinity && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'white', padding: '4px 10px',
                      borderRadius: 999, fontSize: 11, fontWeight: 800,
                      color: '#1F8B4C', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}>
                      📍 {formatDistance(ph.distance)}
                    </div>
                  )}
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ph.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6B6B', marginBottom: 6 }}>
                    {ph.neighborhood ? `${ph.neighborhood}, ` : ''}{ph.city}
                  </div>
                  {ph.rating > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#F4B53A', fontWeight: 700 }}>
                      ★ {ph.rating} <span style={{ color: '#9B9B9B', fontWeight: 400 }}>· {ph.review_count || 0} avis</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CATÉGORIES */}
        <div className="home-section" style={{ marginTop: 24 }}>
          <div className="home-section-head">
            <div className="section-title">Catégories</div>
            <button className="section-link" onClick={() => navigate({ name: 'categories', params: {} })}>Tout voir →</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#9B9B9B' }}>Chargement…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, padding: '0 16px' }}>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => navigate({ name: 'search', params: { category: cat.id } })}
                  style={{
                    background: 'white', border: '1px solid #EEE', borderRadius: 14,
                    padding: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '1/1',
                    background: 'linear-gradient(135deg, #1F8B4C20, #1F8B4C10)',
                    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, marginBottom: 8, overflow: 'hidden',
                  }}>
                    {cat.sampleImg ? (
                      <img src={cat.sampleImg} alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = CATEGORY_EMOJI[cat.name] || '📦'; }}
                      />
                    ) : (CATEGORY_EMOJI[cat.name] || '📦')}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>{cat.name}</div>
                  <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>{cat.count} produit{cat.count > 1 ? 's' : ''}</div>
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
              <div className="section-sub">
                {latestScan ? `Basé sur ton scan IA · peau ${skinType.toLowerCase()}` : `Pour ta peau ${skinType.toLowerCase()}`}
              </div>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : topMatches.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Aucun produit</div>
          ) : (
            <div className="product-grid">
              {topMatches.map(p => <ProductTile key={p.id} product={p} />)}
            </div>
          )}
        </div>

        {/* TENDANCES */}
        <div className="home-section">
          <div className="home-section-head">
            <div>
              <div className="section-title">🔥 Tendances cette semaine</div>
              <div className="section-sub">
                {bestSellers.length > 0 ? 'Les plus commandés' : 'Les plus appréciés'}
              </div>
            </div>
          </div>
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
