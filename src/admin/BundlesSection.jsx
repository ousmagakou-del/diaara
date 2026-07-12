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
    <div style={{ padding: 28, background: YARAM_BG, minHeight: '100vh' }}>
      {/* Header premium avec compteur + CTAs */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 24 }}>📦</span>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: YARAM_TEXT, letterSpacing: -0.3 }}>
              Bundles & Kits
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', color: YARAM_MUTED, fontSize: 13, maxWidth: 520, lineHeight: 1.5 }}>
            Cree des routines pre-composees avec remise pack. Les kits <strong style={{ color: YARAM_GREEN }}>featured</strong> apparaissent dans la section &laquo;&nbsp;Routines completes&nbsp;&raquo; de la home YARAM.
          </p>
          {bundles.length > 0 && (
            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: YARAM_MUTED, fontWeight: 600 }}>
              <span>Total <strong style={{ color: YARAM_TEXT }}>{bundles.length}</strong></span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Featured <strong style={{ color: YARAM_GREEN }}>{bundles.filter(b => b.featured).length}</strong></span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Actifs <strong style={{ color: YARAM_TEXT }}>{bundles.filter(b => b.active).length}</strong></span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleRefreshCrossSell}
            disabled={refreshing}
            style={{ ...btnGhost, opacity: refreshing ? 0.5 : 1 }}
          >
            {refreshing ? 'Rafraichissement...' : '🔄 Cross-sell'}
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
        <div style={{ padding: 60, textAlign: 'center', color: YARAM_MUTED, fontSize: 14 }}>Chargement…</div>
      ) : bundles.length === 0 ? (
        <div style={{
          padding: 60, textAlign: 'center', background: '#fff',
          border: `2px dashed ${YARAM_BORDER}`, borderRadius: 16,
        }}>
          <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.3 }}>📦</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: YARAM_TEXT, marginBottom: 6 }}>
            Aucun bundle pour l'instant
          </div>
          <p style={{ fontSize: 13, color: YARAM_MUTED, margin: '0 auto 16px', maxWidth: 360, lineHeight: 1.5 }}>
            Cree ton premier kit pre-compose pour offrir a tes clientes une routine complete avec remise.
          </p>
          <button type="button" style={btnPrimary} onClick={openCreate}>
            + Creer le premier bundle
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {bundles.map((b) => (
            <article
              key={b.id}
              style={{
                ...cardStyle,
                borderColor: b.featured ? YARAM_GREEN_SOFT : YARAM_BORDER,
                opacity: b.active ? 1 : 0.6,
              }}
            >
              {/* Cover avec badges superposes */}
              <div style={{
                height: 140, background: '#F4F4F2', borderRadius: 12, overflow: 'hidden',
                marginBottom: 12, position: 'relative',
              }}>
                {b.cover_url ? (
                  <img src={b.cover_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: YARAM_MUTED, fontSize: 12, fontWeight: 600,
                  }}>Pas d'image</div>
                )}

                {/* Badge remise en haut a gauche */}
                <div style={{
                  position: 'absolute', top: 10, left: 10,
                  background: YARAM_YELLOW, color: '#4A2D0B',
                  padding: '4px 10px', borderRadius: 999,
                  fontSize: 11, fontWeight: 900, letterSpacing: 0.3,
                  boxShadow: '0 2px 6px rgba(244,181,58,0.4)',
                }}>
                  -{b.discount_pct || 10}%
                </div>

                {/* Badge Featured en haut a droite */}
                {b.featured && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: YARAM_GREEN, color: '#fff',
                    padding: '4px 10px', borderRadius: 999,
                    fontSize: 10, fontWeight: 900, letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 6px rgba(31,139,76,0.4)',
                  }}>
                    ★ Featured
                  </div>
                )}

                {/* Badge inactif */}
                {!b.active && (
                  <div style={{
                    position: 'absolute', bottom: 10, right: 10,
                    background: 'rgba(15,20,25,0.75)', color: '#fff',
                    padding: '3px 10px', borderRadius: 999,
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                  }}>
                    INACTIF
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: YARAM_TEXT, marginBottom: 4, letterSpacing: -0.2 }}>
                  {b.title}
                </div>
                <div style={{ fontSize: 12, color: YARAM_MUTED, fontWeight: 600 }}>
                  {b.items_count || 0} produit{(b.items_count || 0) > 1 ? 's' : ''} inclus
                </div>
              </div>

              {b.description && (
                <p style={{
                  fontSize: 13, color: '#4B4B4B', margin: '4px 0 12px',
                  lineHeight: 1.5, minHeight: 40,
                }}>
                  {b.description.slice(0, 110)}{b.description.length > 110 ? '…' : ''}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: `1px solid ${YARAM_BORDER}` }}>
                <button type="button" style={{ ...btnGhostSm, flex: 1 }} onClick={() => openEdit(b)}>Modifier</button>
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

            {/* Image cover en pleine largeur + preview grand format */}
            <div style={fieldRow}>
              <label style={label}>Image de couverture (banner Home)</label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: form.cover_url ? '#fff' : YARAM_GREEN_SOFT,
                border: `2px dashed ${form.cover_url ? YARAM_BORDER : YARAM_GREEN}`,
                borderRadius: 12, padding: 12, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
                {form.cover_url ? (
                  <img
                    src={form.cover_url}
                    alt=""
                    style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 8 }}
                  />
                ) : (
                  <div style={{
                    width: 140, height: 90, borderRadius: 8,
                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: YARAM_GREEN, fontSize: 30, fontWeight: 900,
                  }}>+</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: YARAM_TEXT, marginBottom: 4 }}>
                    {form.cover_url ? 'Remplacer l\'image' : 'Clique pour uploader'}
                  </div>
                  <div style={{ fontSize: 11, color: YARAM_MUTED }}>
                    {uploading ? 'Upload en cours…' : 'JPG / PNG · 800×500 recommande · 2 Mo max'}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadCover}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <div style={fieldRow}>
              <label style={label}>Reduction pack (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={form.discount_pct}
                  onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                  style={{ ...input, maxWidth: 140 }}
                />
                <div style={{
                  padding: '10px 16px', background: YARAM_YELLOW,
                  color: '#4A2D0B', borderRadius: 10,
                  fontSize: 14, fontWeight: 900, letterSpacing: 0.3,
                }}>
                  -{form.discount_pct || 0}% affichee sur la card
                </div>
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

            {/* Toggles premium avec explications */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: 14, background: form.active ? YARAM_GREEN_SOFT : '#F4F4F2',
                border: `1.5px solid ${form.active ? YARAM_GREEN : YARAM_BORDER}`,
                borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  style={{ marginTop: 3, accentColor: YARAM_GREEN, transform: 'scale(1.2)' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: YARAM_TEXT }}>Actif</div>
                  <div style={{ fontSize: 11, color: YARAM_MUTED, marginTop: 2 }}>
                    Visible dans le catalogue YARAM
                  </div>
                </div>
              </label>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: 14, background: form.featured ? YARAM_GREEN_SOFT : '#F4F4F2',
                border: `1.5px solid ${form.featured ? YARAM_GREEN : YARAM_BORDER}`,
                borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  style={{ marginTop: 3, accentColor: YARAM_GREEN, transform: 'scale(1.2)' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: YARAM_TEXT }}>
                    ★ Featured
                  </div>
                  <div style={{ fontSize: 11, color: YARAM_MUTED, marginTop: 2 }}>
                    Apparait sur la Home &laquo;&nbsp;Routines completes&nbsp;&raquo;
                  </div>
                </div>
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

// ─── Charte YARAM (vert primary + jaune accent) ────
const YARAM_GREEN = '#1F8B4C';
const YARAM_GREEN_SOFT = '#E8F5E9';
const YARAM_GREEN_DARK = '#166a3a';
const YARAM_YELLOW = '#F4B53A';
const YARAM_TEXT = '#0F1419';
const YARAM_MUTED = '#6B6B6B';
const YARAM_BORDER = '#EEEEEE';
const YARAM_BG = '#FAFAF7';

const btnPrimary = {
  background: YARAM_GREEN, color: '#fff', border: 'none',
  padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
  cursor: 'pointer', letterSpacing: 0.2,
  boxShadow: '0 4px 12px rgba(31,139,76,0.25)',
  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
};
const btnGhost = {
  background: '#fff', color: YARAM_GREEN, border: `1.5px solid ${YARAM_GREEN}`,
  padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13,
  cursor: 'pointer', letterSpacing: 0.2,
};
const btnGhostSm = {
  background: '#fff', color: YARAM_TEXT, border: '1px solid #E5E5E5',
  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const btnDangerSm = {
  background: '#fff', color: '#D9342B', border: '1px solid #F5C1BD',
  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const btnClose = { background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: '#9B9B9B', lineHeight: 1 };
const btnRemove = { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#D9342B' };
const cardStyle = {
  background: '#fff', border: `1px solid ${YARAM_BORDER}`, borderRadius: 16, padding: 16,
  boxShadow: '0 2px 8px rgba(15, 20, 25, 0.04)',
  transition: 'box-shadow 0.15s ease, transform 0.12s ease',
};
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(15, 20, 25, 0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
  backdropFilter: 'blur(4px)',
};
const modalBox = {
  background: '#fff', borderRadius: 20, padding: 32,
  maxWidth: 820, width: '100%', maxHeight: '90vh', overflow: 'auto',
  boxShadow: '0 24px 60px rgba(15, 20, 25, 0.25)',
};
const fieldRow = { marginBottom: 16 };
const label = {
  display: 'block', fontSize: 11, fontWeight: 800, color: YARAM_MUTED,
  marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6,
};
const input = {
  width: '100%', padding: '11px 14px', border: `1.5px solid ${YARAM_BORDER}`,
  borderRadius: 10, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none', transition: 'border-color 0.15s ease',
};
const chipStyle = {
  background: '#F4F4F2', color: YARAM_TEXT, border: '1px solid transparent',
  padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const chipStyleActive = {
  background: YARAM_GREEN, color: '#fff', borderColor: YARAM_GREEN,
  boxShadow: '0 2px 6px rgba(31,139,76,0.3)',
};
