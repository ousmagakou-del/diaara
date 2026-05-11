import { useState, useEffect } from 'react';
import { getAllPharmacies, getAllProducts } from './lib/supabase';

function App() {
  const [pharmacies, setPharmacies] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const phs = await getAllPharmacies();
        const prs = await getAllProducts();
        setPharmacies(phs);
        setProducts(prs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div style={{padding:40,fontFamily:'sans-serif'}}>⏳ Chargement Supabase...</div>;
  }

  if (error) {
    return <div style={{padding:40,fontFamily:'sans-serif',color:'red'}}>❌ Erreur : {error}</div>;
  }

  return (
    <div style={{padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto'}}>
      <h1 style={{color: '#1F8B4C'}}>🎉 Diaara — Connexion Supabase OK</h1>
      <p><strong>{pharmacies.length}</strong> pharmacies · <strong>{products.length}</strong> produits</p>

      <h3>🏥 Pharmacies :</h3>
      <ul>
        {pharmacies.map(p => (
          <li key={p.id}>
            <strong>{p.name}</strong> — {p.neighborhood}, {p.city}
          </li>
        ))}
      </ul>

      <h3>🛍️ Produits :</h3>
      <ul>
        {products.slice(0, 5).map(p => (
          <li key={p.id}>
            <strong>{p.name}</strong> ({p.brand}) — {p.price?.toLocaleString('fr-FR')} FCFA · score {p.score}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;