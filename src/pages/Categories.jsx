import { useState, useEffect } from 'react';
import { useNav } from '../App';
import { supabase, getAllProducts } from '../lib/supabase';
import TabBar from '../components/TabBar';
import './Categories.css';

const DEFAULT_PRESET = {
  bg_color: '#F4F4F2',
  text_color: '#1A1A1A',
};

export default function Categories() {
  const { navigate } = useNav();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, prods] = await Promise.all([
          supabase.from('categories').select('*').eq('active', true).order('display_order', { ascending: true }),
          getAllProducts(),
        ]);

        const catData = catRes?.data || [];

        // Compter les produits par slug
        const counts = {};
        (prods || []).forEach(p => {
          if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
        });

        if (catData.length > 0) {
          setCategories(catData.map(c => ({ ...c, product_count: counts[c.slug] || 0 })));
        } else {
          // Fallback : depuis products
          const catMap = {};
          (prods || []).forEach(prod => {
            if (!prod.category) return;
            if (!catMap[prod.category]) {
              catMap[prod.category] = {
                id: prod.category,
                slug: prod.category,
                name: prod.category.charAt(0).toUpperCase() + prod.category.slice(1),
                bg_color: DEFAULT_PRESET.bg_color,
                text_color: DEFAULT_PRESET.text_color,
                icon_url: null,
                product_count: 0,
              };
            }
            catMap[prod.category].product_count++;
          });
          setCategories(Object.values(catMap).sort((a, b) => b.product_count - a.product_count));
        }
      } catch (e) {
        console.error('Categories load error:', e);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="ycat-screen page-anim">
      <div className="ycat-scroll">
        <header className="ycat-header">
          <button className="ycat-back-btn" onClick={() => navigate(-1)} aria-label="Retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div>
            <h1>Catégories</h1>
            <p>Toutes nos catégories beauté</p>
          </div>
        </header>

        {loading ? (
          <div className="ycat-loading">Chargement…</div>
        ) : categories.length === 0 ? (
          <div className="ycat-empty">
            <div style={{ fontSize: 48, opacity: 0.3 }}>📂</div>
            <p>Aucune catégorie disponible</p>
          </div>
        ) : (
          <div className="ycat-grid">
            {categories.map(cat => (
              <button
                key={cat.id}
                className="ycat-item"
                onClick={() => navigate({ name: 'search', params: { category: cat.slug } })}
              >
                <div
                  className="ycat-tile"
                  style={{
                    background: cat.bg_color || DEFAULT_PRESET.bg_color,
                    color: cat.text_color || DEFAULT_PRESET.text_color,
                  }}
                >
                  {cat.icon_url ? (
                    <img
                      src={cat.icon_url}
                      alt=""
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.textContent = cat.name.charAt(0);
                      }}
                    />
                  ) : (
                    <span>{cat.name.charAt(0)}</span>
                  )}
                </div>
                <div className="ycat-name">{cat.name}</div>
                {cat.product_count > 0 && (
                  <div className="ycat-count">{cat.product_count} produit{cat.product_count > 1 ? 's' : ''}</div>
                )}
              </button>
            ))}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>

      <TabBar active="home" />
    </div>
  );
}