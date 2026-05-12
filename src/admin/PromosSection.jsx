import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PromosSection() {
  const [promos, setPromos] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const { data } = await supabase.from('promos').select('*').order('created_at', { ascending: false });
    setPromos(data || []);
    setLoading(false);
  };

  const handleSave = async (p) => {
    const payload = {
      code: p.code.toUpperCase(),
      type: p.type, value: parseFloat(p.value),
      min_order: parseFloat(p.min_order || 0),
      max_uses: p.max_uses ? parseInt(p.max_uses) : null,
      active: p.active,
      expires_at: p.expires_at || null,
    };
    if (p.id) {
      await supabase.from('promos').update(payload).eq('id', p.id);
    } else {
      await supabase.from('promos').insert(payload);
    }
    setEditing(null);
    refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce code promo ?')) return;
    await supabase.from('promos').delete().eq('id', id);
    refresh();
  };

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Codes promo</h1>
          <p>{promos.length} codes · {promos.filter(p => p.active).length} actifs</p>
        </div>
        <button className="adm-btn-pri" onClick={() => setEditing({
          code: '', type: 'percent', value: 10, min_order: 0,
          max_uses: 100, active: true, expires_at: '',
        })}>+ Nouveau code</button>
      </header>

      {editing && (
        <div className="adm-form-overlay" onClick={() => setEditing(null)}>
          <div className="adm-form-card" onClick={e => e.stopPropagation()}>
            <h3>{editing.id ? 'Modifier' : 'Nouveau'} code</h3>
            <label>Code (UPPERCASE)<input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" /></label>
            <label>Type<select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}>
              <option value="percent">Pourcentage (%)</option>
              <option value="amount">Montant fixe (FCFA)</option>
            </select></label>
            <label>Valeur<input type="number" value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} /></label>
            <label>Commande minimum<input type="number" value={editing.min_order} onChange={e => setEditing({ ...editing, min_order: e.target.value })} placeholder="0 = pas de minimum" /></label>
            <label>Max utilisations<input type="number" value={editing.max_uses} onChange={e => setEditing({ ...editing, max_uses: e.target.value })} placeholder="Vide = illimité" /></label>
            <label>Expire le<input type="date" value={editing.expires_at?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, expires_at: e.target.value })} /></label>
            <label className="adm-form-checkbox">
              <input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
              <span>Code actif</span>
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
              <th>Code</th>
              <th>Réduction</th>
              <th>Min</th>
              <th>Utilisations</th>
              <th>Expire</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {promos.map(p => (
              <tr key={p.id}>
                <td><code style={{ fontSize: 13, fontWeight: 700 }}>{p.code}</code></td>
                <td>
                  <strong style={{ color: '#1F8B4C' }}>
                    -{p.value}{p.type === 'percent' ? '%' : ' FCFA'}
                  </strong>
                </td>
                <td>{p.min_order > 0 ? `${p.min_order.toLocaleString('fr-FR')} FCFA` : '—'}</td>
                <td>{p.uses || 0}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                <td>{p.expires_at ? new Date(p.expires_at).toLocaleDateString('fr-FR') : 'Jamais'}</td>
                <td><span className={`adm-badge ${p.active ? 'good' : 'bad'}`}>{p.active ? 'Actif' : 'Inactif'}</span></td>
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
