import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function BrandsSection() {
  const [brands, setBrands] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const { data } = await supabase.from('brands').select('*').order('name');
    setBrands(data || []);
    setLoading(false);
  };

  const handleSave = async (b) => {
    const payload = {
      name: b.name, country: b.country, logo: b.logo,
      description: b.description, local: b.local,
    };
    if (b.id) {
      await supabase.from('brands').update(payload).eq('id', b.id);
    } else {
      await supabase.from('brands').insert(payload);
    }
    setEditing(null);
    refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette marque ?')) return;
    await supabase.from('brands').delete().eq('id', id);
    refresh();
  };

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Marques</h1>
          <p>{brands.length} marques · {brands.filter(b => b.local).length} sénégalaises 🇸🇳</p>
        </div>
        <button className="adm-btn-pri" onClick={() => setEditing({ name: '', country: '', logo: '', description: '', local: false })}>
          + Nouvelle marque
        </button>
      </header>

      {editing && (
        <div className="adm-form-overlay" onClick={() => setEditing(null)}>
          <div className="adm-form-card" onClick={e => e.stopPropagation()}>
            <h3>{editing.id ? 'Modifier' : 'Nouvelle'} marque</h3>
            <label>Nom<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            <label>Pays<input value={editing.country} onChange={e => setEditing({ ...editing, country: e.target.value })} placeholder="Sénégal, France, Corée..." /></label>
            <label>Logo URL<input value={editing.logo} onChange={e => setEditing({ ...editing, logo: e.target.value })} /></label>
            <label>Description<textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={3} /></label>
            <label className="adm-form-checkbox">
              <input type="checkbox" checked={editing.local} onChange={e => setEditing({ ...editing, local: e.target.checked })} />
              <span>🇸🇳 Marque locale (Made in Sénégal)</span>
            </label>
            <div className="adm-form-actions">
              <button className="adm-btn-sec" onClick={() => setEditing(null)}>Annuler</button>
              <button className="adm-btn-pri" onClick={() => handleSave(editing)}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="adm-empty">Chargement…</div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Marque</th>
              <th>Pays</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {brands.map(b => (
              <tr key={b.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {b.logo && <img src={b.logo} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />}
                    <div>
                      <strong>{b.name}</strong>
                      <div style={{ fontSize: 11, color: '#6B6B6B' }}>{b.description?.slice(0, 60)}</div>
                    </div>
                  </div>
                </td>
                <td>{b.country || '—'}</td>
                <td>{b.local ? <span className="adm-badge good">🇸🇳 Locale</span> : <span className="adm-badge">International</span>}</td>
                <td>
                  <button className="adm-btn-sec" onClick={() => setEditing(b)}>✏️</button>
                  <button className="adm-btn-danger" onClick={() => handleDelete(b.id)} style={{ marginLeft: 4 }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
