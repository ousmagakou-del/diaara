import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['serum', 'solaire', 'nettoyant', 'hydratant', 'masque', 'corps', 'levres', 'maquillage', 'cheveux', 'huile'];
const COMMON_BADGES = ['Made in Sénégal', 'Bio', 'Vegan', 'Sans parfum', 'Sans alcool'];

export default function PharmaProducts({ pharmacy }) {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('submitted_by_pharmacy_id', pharmacy.id)
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const handleSave = async (p) => {
    const payload = {
      name: p.name, brand: p.brand, category: p.category,
      price: parseInt(p.price), score: 70,
      img: p.img, short_desc: p.short_desc, long_desc: p.long_desc,
      inci: p.inci, badges: p.badges || [],
      status: 'pending',
      submitted_by_pharmacy_id: pharmacy.id,
      active: true,
    };
    if (p.id) {
      await supabase.from('products').update(payload).eq('id', p.id);
    } else {
      const { data: newProd } = await supabase.from('products').insert(payload).select().single();
      // Créer automatiquement un inventaire pour cette pharmacie
      if (newProd) {
        await supabase.from('inventory').insert({
          pharmacy_id: pharmacy.id,
          product_id: newProd.id,
          stock: p.initialStock || 5,
          active: true,
        });
      }
    }
    setEditing(null);
    refresh();
    alert('✅ Produit envoyé à Diaara pour validation. Tu seras notifié(e) sous 24h.');
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await supabase.from('products').delete().eq('id', id);
    refresh();
  };

  const filtered = filter === 'all' ? products : products.filter(p => p.status === filter);

  if (editing) {
    return <ProductForm product={editing} onSave={handleSave} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="ph-section">
      <header className="ph-header">
        <div>
          <h1>Mes produits proposés</h1>
          <p>{products.length} produits · {products.filter(p => p.status === 'approved').length} validés par Diaara</p>
        </div>
        <button className="ph-btn-pri" onClick={() => setEditing({
          name: '', brand: '', category: 'serum', price: 0, img: '',
          short_desc: '', long_desc: '', inci: '', badges: [], initialStock: 5,
        })}>+ Nouveau produit</button>
      </header>

      <div className="ph-info-banner">
        ℹ️ Propose tes produits beauté à Diaara. Une fois validé par notre équipe, ton produit sera visible pour toutes les clientes Diaara.
      </div>

      <div className="ph-filters">
        {[
          { id: 'all', label: 'Tous', count: products.length },
          { id: 'pending', label: '⏳ En attente', count: products.filter(p => p.status === 'pending').length },
          { id: 'approved', label: '✅ Validés', count: products.filter(p => p.status === 'approved').length },
          { id: 'rejected', label: '❌ Rejetés', count: products.filter(p => p.status === 'rejected').length },
        ].map(f => (
          <button key={f.id} className={`ph-filter ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label} <span className="ph-filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ph-empty">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="ph-empty">
          <div style={{ fontSize: 48, opacity: 0.2 }}>✨</div>
          <p>Aucun produit proposé</p>
          <button className="ph-btn-pri" onClick={() => setEditing({
            name: '', brand: '', category: 'serum', price: 0, img: '',
            short_desc: '', long_desc: '', inci: '', badges: [], initialStock: 5,
          })} style={{ marginTop: 12 }}>+ Proposer mon premier produit</button>
        </div>
      ) : (
        <div className="ph-product-grid">
          {filtered.map(p => (
            <div key={p.id} className="ph-product-card">
              {p.img && <img src={p.img} alt="" />}
              <div className="ph-product-body">
                <div className="ph-product-head">
                  <strong>{p.name}</strong>
                  <span className={`ph-badge ${p.status === 'approved' ? 'good' : p.status === 'rejected' ? 'bad' : 'medium'}`}>
                    {p.status === 'pending' && '⏳'}
                    {p.status === 'approved' && '✅'}
                    {p.status === 'rejected' && '❌'}
                    {' ' + p.status}
                  </span>
                </div>
                <p className="ph-product-meta">{p.brand} · {p.category}</p>
                <p className="ph-product-price">{p.price?.toLocaleString('fr-FR')} FCFA</p>
                {p.rejection_reason && (
                  <div className="ph-rejection-note">
                    ⚠️ Motif rejet : {p.rejection_reason}
                  </div>
                )}
                <div className="ph-product-actions">
                  <button className="ph-btn-sec" onClick={() => setEditing(p)}>✏️ Modifier</button>
                  <button className="ph-btn-danger" onClick={() => handleDelete(p.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductForm({ product, onSave, onCancel }) {
  const [p, setP] = useState(product);
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setP({ ...p, [k]: v });

  const toggleBadge = (b) => {
    const cur = p.badges || [];
    upd('badges', cur.includes(b) ? cur.filter(x => x !== b) : [...cur, b]);
  };

  const handleSubmit = async () => {
    if (!p.name?.trim() || !p.brand?.trim() || !p.price) {
      alert('Nom, marque et prix requis');
      return;
    }
    setSaving(true);
    await onSave(p);
    setSaving(false);
  };

  return (
    <div className="ph-section">
      <header className="ph-header">
        <div>
          <button className="ph-link" onClick={onCancel}>← Retour</button>
          <h1>{product.id ? 'Modifier' : 'Proposer'} un produit</h1>
          <p>Diaara validera ton produit sous 24h</p>
        </div>
      </header>

      <div className="ph-form-grid">
        <div className="ph-form-section">
          <h3>📦 Informations</h3>
          <label>Nom du produit *<input value={p.name} onChange={e => upd('name', e.target.value)} placeholder="ex: Beurre de karité pur" /></label>
          <label>Marque *<input value={p.brand} onChange={e => upd('brand', e.target.value)} placeholder="ex: Kheweul SN" /></label>
          <label>Catégorie<select value={p.category} onChange={e => upd('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <label>Prix (FCFA) *<input type="number" value={p.price} onChange={e => upd('price', e.target.value)} /></label>
          {!p.id && (
            <label>Stock initial<input type="number" value={p.initialStock} onChange={e => upd('initialStock', parseInt(e.target.value) || 0)} placeholder="Quantité disponible" /></label>
          )}
        </div>

        <div className="ph-form-section">
          <h3>📸 Visuel</h3>
          <label>URL de l'image *<input value={p.img} onChange={e => upd('img', e.target.value)} placeholder="https://..." /></label>
          <p style={{ fontSize: 11, color: '#6B6B6B' }}>Astuce : upload ta photo sur imgur.com et colle le lien ici</p>
          {p.img && <img src={p.img} alt="" style={{ width: '100%', maxWidth: 200, borderRadius: 8, marginTop: 10 }} />}
        </div>

        <div className="ph-form-section" style={{ gridColumn: '1 / -1' }}>
          <h3>📝 Description</h3>
          <label>Description courte<input value={p.short_desc} onChange={e => upd('short_desc', e.target.value)} placeholder="Une phrase qui résume le produit" /></label>
          <label>Description détaillée<textarea value={p.long_desc} onChange={e => upd('long_desc', e.target.value)} rows={3} placeholder="Bienfaits, utilisation, public visé..." /></label>
          <label>Ingrédients (INCI)<textarea value={p.inci} onChange={e => upd('inci', e.target.value)} rows={3} placeholder="Aqua, Glycerin, Butyrospermum Parkii..." /></label>
        </div>

        <div className="ph-form-section" style={{ gridColumn: '1 / -1' }}>
          <h3>🏷️ Badges</h3>
          <p style={{ fontSize: 11, color: '#6B6B6B', marginBottom: 8 }}>Coche les caractéristiques qui s'appliquent</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COMMON_BADGES.map(b => (
              <button key={b} type="button"
                className={`ph-filter ${(p.badges || []).includes(b) ? 'active' : ''}`}
                onClick={() => toggleBadge(b)}>{b}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="ph-form-actions">
        <button className="ph-btn-sec" onClick={onCancel}>Annuler</button>
        <button className="ph-btn-pri" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Envoi...' : '✨ Envoyer pour validation'}
        </button>
      </div>
    </div>
  );
}
