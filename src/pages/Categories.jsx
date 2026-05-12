import { useNav } from '../App';
import TabBar from '../components/TabBar';
import './Categories.css';

const CATEGORIES = [
  { id: 'serum', name: 'Sérums', img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80', desc: 'Concentrés actifs' },
  { id: 'solaire', name: 'Solaires', img: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&q=80', desc: 'SPF & protection UV' },
  { id: 'nettoyant', name: 'Nettoyants', img: 'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=400&q=80', desc: 'Démaquillants & gels' },
  { id: 'hydratant', name: 'Hydratants', img: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80', desc: 'Crèmes & émulsions' },
  { id: 'masque', name: 'Masques', img: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400&q=80', desc: 'Soins intensifs' },
  { id: 'corps', name: 'Corps', img: 'https://images.unsplash.com/photo-1601612628452-9e99ced43524?w=400&q=80', desc: 'Hydratation corps' },
  { id: 'levres', name: 'Lèvres', img: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&q=80', desc: 'Baumes & rouges' },
  { id: 'maquillage', name: 'Maquillage', img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80', desc: 'Make-up complet' },
  { id: 'cheveux', name: 'Cheveux', img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80', desc: 'Soins capillaires' },
  { id: 'huile', name: 'Huiles', img: 'https://images.unsplash.com/photo-1599387737669-d56586d75f08?w=400&q=80', desc: 'Huiles végétales' },
];

export default function Categories() {
  const { navigate } = useNav();

  return (
    <div className="cats-screen page-anim">
      <div className="cats-header">
        <button className="icon-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div>
          <h1>Catégories</h1>
          <p>Toutes nos catégories beauté</p>
        </div>
      </div>

      <div className="cats-scroll">
        <div className="cats-grid">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className="cats-tile"
              onClick={() => navigate({ name: 'search', params: { category: cat.id } })}
            >
              <img src={cat.img} alt="" />
              <div className="cats-overlay">
                <div className="cats-name">{cat.name}</div>
                <div className="cats-desc">{cat.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{height: 40}} />
      </div>
      <TabBar />
    </div>
  );
}