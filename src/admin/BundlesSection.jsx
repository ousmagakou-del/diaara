// ════════════════════════════════════════════════════════════════════
// Admin — Section Bundles / Kits pre-composes + Cross-sell refresh
// ════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  adminListBundles,
  adminCreateBundle,
  adminUpdateBundle,
  adminDeleteBundle,
  adminRefreshFrequentlyBoughtWith,
} from '../lib/supabase';
import { adminLogAction } from '../lib/adminApi';
import { confirmDialog } from '../lib/toast';

const SKIN_TYPES = ['grasse', 'mixte', 'seche', 'sensible', 'normale', 'mature'];
const CONCERNS = ['acne', 'sebum', 'hyperpigmentation', 'taches', 'anti-age', 'hydratation', 'eclat', 'rougeurs', 'imperfections'];

const emptyForm = () => ({
  id: null,
  title: '',
  description: '',
  discount_pct: 10,
  cover_url: '',
  target_skin_types: [],
  target_concerns: [],
  active: true,
  featured: false,
  product_ids: [],
});

export default function BundlesSection() {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ text: '', kind: '' });
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { refresh(); loadProducts(); }, []);

  const flash = (text, kind = 'ok') => {
    setMsg({ text, kind });
    setTimeout(() => setMsg({ text: '', kind: '' }), 3000);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await adminListBundles();
      setBundles(list || []);
    } catch (e) {
      flash('Erreur chargement bundles : ' + e.message, 'err');
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, price, image_url, img, category')
      .eq('active', true)
      .eq('status', 'approved')
      .order('name')
      .limit(500);
    setProducts(data || []);
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 200);
    return products.filter((p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    ).slice(0, 200);
  }, [products, productSearch]);

  const productMap = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const openCreate = () => setForm(emptyForm());

  const openEdit = (b) => {
    setForm({
      id: b.id,
      title: b.title || '',
      description: b.description || '',
      discount_pct: Number(b.discount_pct) || 10,
      cover_url: b.cover_url || '',
      target_skin_types: b.target_skin_types || [],
      target_concerns: b.target_concerns || [],
      active: !!b.active,
      featured: !!b.featured,
      product_ids: b.product_ids || [],
    });
  };

  const closeForm = () => setForm(null);

  const toggleTag = (list, tag) => list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];

  const toggleProduct = (pid) => {
    setForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(pid)
        ? f.product_ids.filter((x) => x !== pid)
        : [...f.product_ids, pid],
    }));
  };

  const uploadCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `bundle-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('banners').upload(filename, file, {
        cacheControl: '3600', upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('banners').getPublicUrl(filename);
      setForm((f) => ({ ...f, cover_url: data?.publicUrl || '' }));
      flash('Image uploadee');
    } catch (err) {
      flash('Upload echoue : ' + err.message, 'err');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { flash('Titre requis', 'err'); return; }
    if (!form.product_ids.length) { flash('Selectionne au moins 1 produit', 'err'); return; }

    try {
      if (form.id) {
        await adminUpdateBundle(form.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          discountPct: Number(form.discount_pct) || 10,
          coverUrl: form.cover_url || null,
          targetSkinTypes: form.target_skin_types,
          targetConcerns: form.target_concerns,
          featured: form.featured,
          active: form.active,
          productIds: form.product_ids,
        });
        adminLogAction({ action: 'update_bundle', targetType: 'bundle', targetId: form.id, before: null, after: { title: form.title } }).catch(() => {});
        flash('Bundle modifie');
      } else {
        const id = await adminCreateBundle({
          title: form.title.trim(),
          description: form.description.trim() || null,
          productIds: form.product_ids,
          discountPct: Number(form.discount_pct) || 10,
          coverUrl: form.cover_url || null,
          targetSkinTypes: form.target_skin_types,
          targetConcerns: form.target_concerns,
          featured: form.featured,
        });
        adminLogAction({ action: 'create_bundle', targetType: 'bundle', targetId: id, before: null, after: { title: form.title } }).catch(() => {});
        flash('Bundle cree');
      }
      closeForm();
      refresh();
    } catch (e) {
      flash('Erreur : ' + e.message, 'err');
    }
  };

  const handleDelete = async (b) => {
    if (!await confirmDialog(`Supprimer le bundle "${b.title}" ?`)) return;
    try {
      await adminDeleteBundle(b.id);
      adminLogAction({ action: 'delete_bundle', targetType: 'bundle', targetId: b.id, before: { title: b.title }, after: null }).catch(() => {});
      flash('Bundle supprime');
      refresh();
    } catch (e) {
      flash('Erreur : ' + e.message, 'err');
    }
  };

  const handleRefreshCrossSell = async () => {
    if (!await confirmDialog('Recalculer le cross-sell (souvent achete avec) depuis les commandes livrees ?')) return;
    setRefreshing(true);
    try {
      const res = await adminRefreshFrequentlyBoughtWith();
      flash(`Cross-sell rafraichi (${res?.pairs_inserted || 0} paires)`);
    } catch (e) {
      flash('Erreur : ' + e.message, 'err');
    }
    setRefreshing(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Bundles / Kits pre-composes</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            Cree des routines completes avec remise pack. Les kits featured apparaissent sur la home.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleRefreshCrossSell}
            disabled={refreshing}
            style={btnGhost}
          >
            {refreshing ? 'Refresh...' : 'Refresh cross-sell'}
          </button>
          <button type="button" onClick={openCreate} style={btnPrimary}>
            + Nouveau bundle
          </button>
        </div>
      </div>

      {msg.text && (
        <div style={{
          padding: 12, marginBottom: 16, borderRadius: 8,
          background: msg.kind === 'err' ? '#fee' : '#efe',
          color: msg.kind === 'err' ? '#c00' : '#060',
          border: `1px solid ${msg.kind === 'err' ? '#fcc' : '#cec'}`,
        }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Chargement...</div>
      ) : bundles.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Aucun bundle. Crees ton premier kit.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {bundles.map((b) => (
            <article key={b.id} style={cardStyle}>
              {b.cover_url && (
                <div style={{ height: 120, background: '#f6f6f6', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  <img src={b.cover_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 15 }}>{b.title}</strong>
                <span style={{
                  background: '#7a5cff', color: '#fff',
                  padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                }}>-{b.discount_pct || 10}%</span>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                {b.items_count || 0} produit{(b.items_count || 0) > 1 ? 's' : ''}
                {b.featured && ' · Featured'}
                {!b.active && ' · Inactif'}
              </div>
              {b.description && <p style={{ fontSize: 13, color: '#555', margin: '4px 0 10px', lineHeight: 1.4 }}>{b.description.slice(0, 120)}{b.description.length > 120 ? '…' : ''}</p>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={btnGhostSm} onClick={() => openEdit(b)}>Modifier</button>
                <button type="button" style={btnDangerSm} onClick={() => handleDelete(b)}>Supprimer</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* MODAL FORM */}
      {form && (
        <div style={modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div style={modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{form.id ? 'Modifier bundle' : 'Nouveau bundle'}</h3>
              <button type="button" onClick={closeForm} style={btnClose}>×</button>
            </div>

            <div style={fieldRow}>
              <label style={label}>Titre *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={input}
                placeholder="Ex : Routine peau grasse debutante"
              />
            </div>

            <div style={fieldRow}>
              <label style={label}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ ...input, minHeight: 80, resize: 'vertical' }}
                placeholder="Le trio essentiel pour reguler..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={fieldRow}>
                <label style={label}>Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={form.discount_pct}
                  onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                  style={input}
                />
              </div>
              <div style={fieldRow}>
                <label style={label}>Image de couverture</label>
                <input type="file" accept="image/*" onChange={uploadCover} disabled={uploading} />
                {form.cover_url && (
                  <img src={form.cover_url} alt="" style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />
                )}
              </div>
            </div>

            <div style={fieldRow}>
              <label style={label}>Types de peau cibles</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SKIN_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, target_skin_types: toggleTag(form.target_skin_types, t) })}
                    style={{ ...chipStyle, ...(form.target_skin_types.includes(t) ? chipStyleActive : {}) }}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div style={fieldRow}>
              <label style={label}>Preoccupations ciblees</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CONCERNS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, target_concerns: toggleTag(form.target_concerns, t) })}
                    style={{ ...chipStyle, ...(form.target_concerns.includes(t) ? chipStyleActive : {}) }}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, margin: '10px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Actif
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                Featured (affiche sur home)
              </label>
            </div>

            <div style={fieldRow}>
              <label style={label}>Produits ({form.product_ids.length} selectionnes)</label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                style={input}
              />

              {form.product_ids.length > 0 && (
                <div style={{ background: '#f7f5ff', border: '1px solid #d8ceff', borderRadius: 8, padding: 10, margin: '8px 0', maxHeight: 140, overflow: 'auto' }}>
                  {form.product_ids.map((pid, i) => {
                    const p = productMap.get(pid);
                    return (
                      <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: '#7a5cff', fontWeight: 700 }}>{i + 1}.</span>
                        <span style={{ flex: 1 }}>{p ? `${p.brand ? p.brand + ' — ' : ''}${p.name}` : pid}</span>
                        <button type="button" style={btnRemove} onClick={() => toggleProduct(pid)}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #eee', borderRadius: 8, padding: 6 }}>
                {filteredProducts.map((p) => (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 6, borderRadius: 6, cursor: 'pointer',
                    background: form.product_ids.includes(p.id) ? '#f0ebff' : 'transparent',
                  }}>
                    <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                    <img src={p.image_url || p.img || ''} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: '#f6f6f6' }} />
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{p.brand} · {p.category} · {Number(p.price).toLocaleString('fr-FR')} FCFA</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={closeForm} style={btnGhost}>Annuler</button>
              <button type="button" onClick={handleSave} style={btnPrimary}>
                {form.id ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── styles inline ────
const btnPrimary = { background: '#7a5cff', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
const btnGhost = { background: '#fff', color: '#7a5cff', border: '1px solid #7a5cff', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
const btnGhostSm = { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnDangerSm = { background: '#fff', color: '#c00', border: '1px solid #fcc', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnClose = { background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#999' };
const btnRemove = { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#c00' };
const cardStyle = { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14 };
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 };
const modalBox = { background: '#fff', borderRadius: 14, padding: 24, maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto' };
const fieldRow = { marginBottom: 12 };
const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 };
const input = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
const chipStyle = { background: '#f2f2f2', color: '#555', border: '1px solid transparent', padding: '5px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer' };
const chipStyleActive = { background: '#7a5cff', color: '#fff', borderColor: '#7a5cff' };
