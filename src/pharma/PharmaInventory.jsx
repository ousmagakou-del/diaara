import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PharmaInventory({ pharmacy }) {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    (async () => {
      const [prodRes, invRes] = await Promise.all([
        supabase.from('products').select('*').eq('status', 'approved').eq('active', true).order('name'),
        supabase.from('inventory').select('*').eq('pharmacy_id', pharmacy.id),
      ]);
      setProducts(prodRes.data || []);
      const inv = {};
      (invRes.data || []).forEach(i => { inv[i.product_id] = { id: i.id, stock: i.stock, active: i.active }; });
      setInventory(inv);
      setLoading(false);
    })();
  }, [pharmacy.id]);

  const updateStock = (productId, stock) => {
    setInventory({
      ...inventory,
      [productId]: { ...(inventory[productId] || { active: true }), stock: parseInt(stock) || 0 },
    });
    setChanged(true);
  };

  const toggleActive = (productId) => {
    const cur = inventory[productId] || { stock: 0, active: false };
    setInventory({
      ...inventory,
      [productId]: { ...cur, active: !cur.active },
    });
    setChanged(true);
  };

  const handleSave = async () => {
    setSaving(true);
    for (const productId of Object.keys(inventory)) {
      const inv = inventory[productId];
      if (inv.id) {
        await supabase.from('inventory').update({
          stock: inv.stock, active: inv.active,
        }).eq('id', inv.id);
      } else if (inv.stock > 0 || inv.active) {
        await supabase.from('inventory').insert({
          pharmacy_id: pharmacy.id,
          product_id: productId,
          stock: inv.stock,
          active: inv.active,
        });
      }
    }
    setSaving(false);
    setChanged(false);
    alert('✅ Stock enregistré');
  };

  const filtered = search.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.brand?.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const activeCount = Object.values(inventory).filter(i => i.active).length;
  const totalUnits = Object.values(inventory).reduce((s, i) => s + (i.stock || 0), 0);

  return (
    <div className="ph-section">
      <header className="ph-header">
        <div>
          <h1>Mon stock</h1>
          <p>{activeCount} produits actifs · {totalUnits} unités au total</p>
        </div>
        {changed && (
          <button className="ph-btn-pri" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer les changements'}
          </button>
        )}
      </header>

      <div className="ph-info-banner">
        ℹ️ Coche les produits que tu as en stock, puis indique la quantité. Les clientes ne verront que tes produits actifs.
      </div>

      <input
        type="text"
        className="ph-search-input"
        placeholder="🔍 Rechercher un produit..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="ph-empty">Chargement…</div>
      ) : (
        <table className="ph-table">
          <thead>
            <tr>
              <th></th>
              <th>Produit</th>
              <th>Marque</th>
              <th>Prix</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const inv = inventory[p.id] || { stock: 0, active: false };
              return (
                <tr key={p.id} className={inv.active ? 'active' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={inv.active}
                      onChange={() => toggleActive(p.id)}
                      style={{ width: 18, height: 18 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {p.img && <img src={p.img} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />}
                      <div>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: 11, color: '#6B6B6B' }}>{p.category}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.brand}</td>
                  <td>{p.price?.toLocaleString('fr-FR')} FCFA</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={inv.stock}
                      onChange={e => updateStock(p.id, e.target.value)}
                      disabled={!inv.active}
                      style={{ width: 70, padding: '4px 8px', border: '1px solid #DDD', borderRadius: 4 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
