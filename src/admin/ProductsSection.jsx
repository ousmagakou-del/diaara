import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['serum', 'solaire', 'nettoyant', 'hydratant', 'masque', 'corps', 'levres', 'maquillage', 'cheveux', 'huile'];
const COMMON_BADGES = ['Made in Sénégal', 'Bio', 'Vegan', 'Sans parfum', 'Sans alcool', 'Recommandé dermato', 'Pharmacie'];

export default function ProductsSection() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const [pRes, bRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
    ]);
    setProducts(pRes.data || []);
    setBrands(bRes.data || []);
    setLoading(false);
  };

  const handleSave = async (p) => {
    const payload = {
      name: p.name, brand: p.brand, category: p.category,
      price: parseInt(p.price), score: parseInt(p.score),
      rating: parseFloat(p.rating || 0),
      review_count: parseInt(p.review_count || 0),
      img: p.img, short_desc: p.short_desc, long_desc: p.long_desc,
      inci: p.inci, reason: p.reason, badges: p.badges || [],
      active: p.active,
    };
    if (p.id) {
      await supabase.from('products').update(payload).eq('id', p.id);
    } else {
      await supabase.from('products').insert(payload);
    }
    setEditing(null);
    refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await supabase.from('products').delete().eq('id', id);
    refresh();
  };

  const handleNew = () => {
    setEditing({
      name: '', brand: '', category: 'serum', price: 0, score: 70,
      rating: 0, review_count: 0, img: '',
      short_desc: '', long_desc: '', inci: '', reason: '',
      badges: [], active: true,
    });
  };

  let filtered = filterCat === 'all' ? products : products.filter(p => p.category === filterCat);
  if (search.trim()) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name?.toLowerCase().includes(s) ||
      p.brand?.toLowerCase().includes(s)
    );
  }

  if (editing) {
    return <ProductEditor product={editing} brands={brands} onSave={handleSave} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Catalogue produits</h1>
          <p>{products.length} produits dont {products.filter(p => p.active).length} actifs</p>
        </div>
        <button className="adm-btn-pri" onClick={handleNew}>+ Nouveau produit</button>
      </header>

      <input
        type="text"
        className="adm-search-input"
        placeholder="🔍 Rechercher..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="adm-filters">
        <button className={`adm-filter ${filterCat === 'all' ? 'active' : ''}`} onClick={() => setFilterCat('all')}>
          Toutes <span className="adm-filter-count">{products.length}</span>
        </button>
        {CATEGORIES.map(c => (
          <button key={c} className={`adm-filter ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}>
            {c} <span className="adm-filter-count">{products.filter(p => p.category === c).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="adm-empty">Chargement…</div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Marque</th>
              <th>Catégorie</th>
              <th>Prix</th>
              <th>Score</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.img && <img src={p.img} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />}
                    <div>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: 11, color: '#6B6B6B' }}>{p.short_desc?.slice(0, 50)}</div>
                    </div>
                  </div>
                </td>
                <td>{p.brand}</td>
                <td>{p.category}</td>
                <td>{p.price?.toLocaleString('fr-FR')} FCFA</td>
                <td><span className={`adm-badge ${p.score >= 80 ? 'excellent' : p.score >= 60 ? 'good' : 'medium'}`}>{p.score}</span></td>
                <td><span className={`adm-badge ${p.active ? 'good' : 'bad'}`}>{p.active ? '✓ Actif' : '× Inactif'}</span></td>
                <td>
                  <button className="adm-btn-sec" onClick={() => setEditing(p)}>✏️</button>
                  <button className="adm-btn-danger" onClick={() => handleDelete(p.id)} style={{ marginLeft: 4 }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProductEditor({ product, brands, onSave, onCancel }) {
  const [p, setP] = useState(product);
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setP({ ...p, [k]: v });

  const toggleBadge = (b) => {
    const cur = p.badges || [];
    upd('badges', cur.includes(b) ? cur.filter(x => x !== b) : [...cur, b]);
  };

  const handleSubmit = async () => {
    if (!p.name?.trim() || !p.brand?.trim()) {
      alert('Nom et marque requis');
      return;
    }
    setSaving(true);
    await onSave(p);
    setSaving(false);
  };

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <button className="adm-link" onClick={onCancel}>← Retour</button>
          <h1>{product.id ? 'Modifier' : 'Nouveau'} produit</h1>
        </div>
      </header>

      <div className="adm-form-grid">
        <div className="adm-form-section">
          <h3>Identité</h3>
          <label>Nom *<input value={p.name} onChange={e => upd('name', e.target.value)} placeholder="Niacinamide 10% + Zinc 1%" /></label>
          <label>Marque *<input list="brands-list" value={p.brand} onChange={e => upd('brand', e.target.value)} placeholder="The Ordinary" />
            <datalist id="brands-list">
              {brands.map(b => <option key={b.id} value={b.name} />)}
            </datalist>
          </label>
          <label>Catégorie<select value={p.category} onChange={e => upd('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <label className="adm-form-checkbox">
            <input type="checkbox" checked={p.active} onChange={e => upd('active', e.target.checked)} />
            <span>Produit actif (visible)</span>
          </label>
        </div>

        <div className="adm-form-section">
          <h3>Prix & Score</h3>
          <label>Prix (FCFA) *<input type="number" value={p.price} onChange={e => upd('price', e.target.value)} /></label>
          <label>Score Diaara (0-100)<input type="number" min="0" max="100" value={p.score} onChange={e => upd('score', e.target.value)} /></label>
          <label>Note moyenne<input type="number" step="0.1" min="0" max="5" value={p.rating} onChange={e => upd('rating', e.target.value)} /></label>
          <label>Nombre d'avis<input type="number" value={p.review_count} onChange={e => upd('review_count', e.target.value)} /></label>
        </div>

        <div className="adm-form-section" style={{ gridColumn: '1 / -1' }}>
          <h3>Description</h3>
          <label>URL Image<input value={p.img} onChange={e => upd('img', e.target.value)} placeholder="https://..." /></label>
          <label>Description courte<input value={p.short_desc} onChange={e => upd('short_desc', e.target.value)} placeholder="Sérum unifiant anti-imperfections" /></label>
          <label>Description longue<textarea value={p.long_desc} onChange={e => upd('long_desc', e.target.value)} rows={3} /></label>
          <label>Pourquoi recommandé<textarea value={p.reason} onChange={e => upd('reason', e.target.value)} rows={2} placeholder="Idéal pour les peaux mixtes phototype VI..." /></label>
          <label>INCI (liste ingrédients)<textarea value={p.inci} onChange={e => upd('inci', e.target.value)} rows={3} placeholder="Aqua, Niacinamide, Zinc PCA..." /></label>
        </div>

        <div className="adm-form-section" style={{ gridColumn: '1 / -1' }}>
          <h3>Badges</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COMMON_BADGES.map(b => (
              <button key={b} type="button"
                className={`adm-filter ${(p.badges || []).includes(b) ? 'active' : ''}`}
                onClick={() => toggleBadge(b)}>{b}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="adm-form-actions">
        <button className="adm-btn-sec" onClick={onCancel}>Annuler</button>
        <button className="adm-btn-pri" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
