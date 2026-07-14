// ════════════════════════════════════════════════════════════════
// BrandProducts — Gestion des produits marque
// ────────────────────────────────────────────────────────────────
// Liste + Add/Edit produit. Upload photo vers bucket 'products'
// path 'brand-uploads/{brand_id}/{timestamp}-{filename}'.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getAllCategories } from '../lib/supabase/categories';
import { toast, confirmDialog } from '../lib/toast';
import { getBrandToken } from '../pages/Brand';

// SVG icons
const Icon = ({ name, ...props }) => {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...props };
  switch (name) {
    case 'plus': return (<svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
    case 'edit': return (<svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
    case 'trash': return (<svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>);
    case 'close': return (<svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
    case 'camera': return (<svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>);
    case 'image': return (<svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>);
    case 'box': return (<svg {...p}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>);
    default: return null;
  }
};

const STATUS_LABELS = {
  approved: 'Validé',
  pending: 'En attente',
  rejected: 'Rejeté',
};

// ═══ Upload dans bucket products (path brand-uploads/{brand_id}/...) ═══
async function uploadBrandProductImage(file, brandId) {
  if (!file || !brandId) return null;
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const cleanName = (file.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-40);
  const path = `brand-uploads/${brandId}/${Date.now()}-${cleanName}`;

  // Compression legere pour eviter les gros fichiers (>5MB)
  let uploadable = file;
  try {
    if (file.size > 2 * 1024 * 1024) {
      uploadable = await compressImage(file, 1000, 0.8);
    }
  } catch { /* fallback: garde l'original */ }

  const { error } = await supabase.storage.from('products').upload(path, uploadable, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });
  if (error) {
    // Retry avec bucket product-images (fallback historique)
    const { error: err2 } = await supabase.storage.from('product-images').upload(path, uploadable, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });
    if (err2) throw new Error(error.message);
    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
    return pub?.publicUrl || null;
  }
  const { data } = supabase.storage.from('products').getPublicUrl(path);
  return data?.publicUrl || null;
}

async function compressImage(file, maxDim = 1000, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else { width = Math.round(width * (maxDim / height)); height = maxDim; }
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(new File([b], file.name, { type: 'image/jpeg' })) : reject(new Error('canvas empty')), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('load'));
    img.src = URL.createObjectURL(file);
  });
}

// ═══ Main component ═══
export default function BrandProducts({ brand, onStatsChange }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    const token = getBrandToken();
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('brand_list_products', { p_token: token });
      if (error) {
        console.error('[BrandProducts] list error:', error.message);
        toast.error('Erreur chargement produits');
      } else {
        const prods = data?.products || [];
        setProducts(prods);
        // Recompute local stats to update badge parent
        if (onStatsChange) {
          onStatsChange({
            total_products: prods.filter(p => p.status === 'approved').length,
            pending_products: prods.filter(p => p.status === 'pending').length,
            rejected_products: prods.filter(p => p.status === 'rejected').length,
          });
        }
      }
    } catch (e) {
      console.error('[BrandProducts] error:', e?.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const cats = await getAllCategories();
      setCategories(cats || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.id]);

  const handleSave = async (payload, id) => {
    const token = getBrandToken();
    if (!token) { toast.error('Session expirée'); return { success: false }; }

    let rpcName = 'brand_add_product';
    let rpcArgs = { p_token: token, p_payload: payload };
    if (id) {
      rpcName = 'brand_update_product';
      rpcArgs = { p_token: token, p_product_id: id, p_payload: payload };
    }

    const { data, error } = await supabase.rpc(rpcName, rpcArgs);
    if (error) {
      toast.error('Erreur : ' + error.message);
      return { success: false };
    }
    if (data?.success === false) {
      toast.error(data?.error || 'Erreur inconnue');
      return { success: false };
    }
    toast.success(id ? 'Modifications enregistrées' : 'Produit envoyé pour validation', { duration: 3500 });
    await load();
    return { success: true };
  };

  const handleDelete = async (product) => {
    if (product.status === 'approved') {
      toast.error("Ce produit est en ligne — contacte Ousmane pour le retirer.");
      return;
    }
    if (!(await confirmDialog(`Supprimer "${product.name}" ?`, { confirmLabel: 'Supprimer', danger: true }))) return;
    const token = getBrandToken();
    // Tentative RPC dedicated si dispo, sinon soft-delete via update
    const { data, error } = await supabase.rpc('brand_update_product', {
      p_token: token,
      p_product_id: product.id,
      p_payload: { deleted: true, active: false },
    });
    if (error) {
      toast.error('Suppression échouée : ' + error.message);
      return;
    }
    if (data?.success === false) {
      toast.error(data?.error || 'Erreur');
      return;
    }
    toast.success('Produit supprimé');
    load();
  };

  const filtered = filter === 'all'
    ? products
    : products.filter(p => p.status === filter);

  const counts = {
    all: products.length,
    approved: products.filter(p => p.status === 'approved').length,
    pending: products.filter(p => p.status === 'pending').length,
    rejected: products.filter(p => p.status === 'rejected').length,
  };

  return (
    <div className="brnd-section">
      <div className="brnd-header">
        <div>
          <h1>Mes produits</h1>
          <p>Ajoute, modifie et gère ton catalogue en autonomie.</p>
        </div>
        <button
          className="brnd-btn-primary"
          onClick={() => { setEditing(null); setShowForm(true); }}
        >
          <Icon name="plus" />
          Nouveau produit
        </button>
      </div>

      <div className="brnd-filters">
        <button className={`brnd-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Tous <span className="brnd-filter-count">{counts.all}</span>
        </button>
        <button className={`brnd-filter ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>
          En ligne <span className="brnd-filter-count">{counts.approved}</span>
        </button>
        <button className={`brnd-filter ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          En attente <span className="brnd-filter-count">{counts.pending}</span>
        </button>
        <button className={`brnd-filter ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>
          Rejetés <span className="brnd-filter-count">{counts.rejected}</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--y-n-600)' }}>
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="brnd-empty">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          <h3>
            {filter === 'all' ? 'Aucun produit pour le moment' : 'Aucun produit dans cette catégorie'}
          </h3>
          <p>Commence par ajouter ton premier produit — validation sous 24-48h.</p>
          <button className="brnd-btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Icon name="plus" />
            Ajouter un produit
          </button>
        </div>
      ) : (
        <div className="brnd-products-grid">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => { setEditing(p); setShowForm(true); }}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          brand={brand}
          categories={categories}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ═══ Product card ═══
function ProductCard({ product, onEdit, onDelete }) {
  const canDelete = product.status !== 'approved';
  const status = product.status || 'pending';
  const price = Number(product.price || 0);
  const oldPrice = Number(product.old_price || product.compare_at_price || 0);
  return (
    <div className="brnd-product-card">
      <div className="brnd-product-photo">
        {product.image_url || product.img ? (
          <img
            src={product.image_url || product.img}
            alt={product.name}
            loading="lazy"
            onError={(e) => { e.target.parentElement.classList.add('brnd-product-photo-empty'); e.target.remove(); }}
          />
        ) : (
          <div className="brnd-product-photo-empty">
            <Icon name="box" width={40} height={40} />
          </div>
        )}
        <div className={`brnd-product-badge ${status}`}>{STATUS_LABELS[status]}</div>
      </div>
      <div className="brnd-product-body">
        <h3 className="brnd-product-name">{product.name}</h3>
        {product.tagline && (
          <p className="brnd-product-meta">{product.tagline}</p>
        )}
        <div className="brnd-product-price">
          <strong>{price.toLocaleString('fr-FR')} FCFA</strong>
          {oldPrice > price && <s>{oldPrice.toLocaleString('fr-FR')}</s>}
        </div>
        {status === 'rejected' && product.moderation_notes && (
          <div className="brnd-product-reject">
            <strong>Note YARAM :</strong> {product.moderation_notes}
          </div>
        )}
        <div className="brnd-product-actions">
          <button className="brnd-mini-btn" onClick={onEdit}>
            <Icon name="edit" width={14} height={14} />
            Modifier
          </button>
          {canDelete && (
            <button className="brnd-mini-btn danger" onClick={onDelete}>
              <Icon name="trash" width={14} height={14} />
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ Product form modal ═══
function ProductForm({ product, brand, categories, onCancel, onSave }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState({
    name: product?.name || '',
    tagline: product?.tagline || product?.short_desc || '',
    description: product?.description || product?.long_desc || '',
    price: product?.price || '',
    old_price: product?.old_price || product?.compare_at_price || '',
    category: product?.category || product?.category_slug || (categories[0]?.slug || categories[0]?.id || ''),
    image_url: product?.image_url || product?.img || '',
    stock: product?.initial_stock ?? product?.stock ?? 10,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const dropRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target?.files?.[0] || e;
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBrandProductImage(file, brand?.id);
      if (!url) { toast.error('Upload échoué'); return; }
      setForm(f => ({ ...f, image_url: url }));
    } catch (err) {
      console.error(err);
      toast.error('Erreur upload : ' + (err?.message || 'inconnue'));
    } finally {
      setUploading(false);
    }
  };

  // Drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDrag = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    const onDrop = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const file = ev.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) handleFile(file);
    };
    ['dragenter','dragover','dragleave'].forEach(evt => el.addEventListener(evt, onDrag));
    el.addEventListener('drop', onDrop);
    return () => {
      ['dragenter','dragover','dragleave'].forEach(evt => el.removeEventListener(evt, onDrag));
      el.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) { toast.error('Nom du produit requis'); return; }
    if (!form.price || Number(form.price) <= 0) { toast.error('Prix requis'); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      old_price: form.old_price ? Number(form.old_price) : null,
      category: form.category || null,
      category_slug: form.category || null,
      image_url: form.image_url || null,
      stock: form.stock ? Number(form.stock) : 10,
      img: form.image_url || null,
      brand_id: brand?.id,
    };
    const res = await onSave(payload, product?.id || null);
    setSaving(false);
    if (res?.success) {
      onCancel();
    }
  };

  return (
    <div className="brnd-modal-overlay" onClick={onCancel}>
      <div className="brnd-modal" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button className="brnd-modal-close" onClick={onCancel} aria-label="Fermer">
          <Icon name="close" width={16} height={16} />
        </button>
        <h3>{isEdit ? 'Modifier le produit' : 'Nouveau produit'}</h3>
        <p className="brnd-modal-sub">
          {isEdit
            ? 'Modifie les infos — YARAM re-valide sous 24-48h.'
            : 'Ajoute les infos de ton produit — validation sous 24-48h.'}
        </p>

        {product?.status === 'rejected' && product?.moderation_notes && (
          <div className="brnd-reject-notes">
            <strong>Note de modération YARAM</strong>
            <p>{product.moderation_notes}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* PHOTO */}
          <div className="brnd-photo-section" ref={dropRef}>
            {form.image_url ? (
              <div className="brnd-photo-preview">
                <img src={form.image_url} alt="Aperçu" />
                <button
                  type="button"
                  className="brnd-photo-remove"
                  onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                  aria-label="Retirer la photo"
                >
                  <Icon name="close" width={14} height={14} />
                </button>
              </div>
            ) : (
              <div className="brnd-photo-empty">
                <Icon name="camera" width={38} height={38} />
                <p>Glisse une photo ici ou clique pour choisir</p>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
            <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <div className="brnd-photo-buttons">
              <button type="button" className="brnd-photo-btn" onClick={() => cameraRef.current?.click()} disabled={uploading}>
                <Icon name="camera" width={14} height={14} />
                {' '}Prendre photo
              </button>
              <button type="button" className="brnd-photo-btn" onClick={() => galleryRef.current?.click()} disabled={uploading}>
                <Icon name="image" width={14} height={14} />
                {' '}Choisir dans galerie
              </button>
            </div>
            {uploading && (
              <p style={{ fontSize: 11, color: 'var(--brand-violet-dark)', textAlign: 'center', marginTop: 8, fontWeight: 600 }}>
                Upload en cours…
              </p>
            )}
          </div>

          <div className="brnd-field">
            <label className="brnd-label">Nom du produit <span className="req">*</span></label>
            <input
              className="brnd-input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Beurre de karité pur bio 250g"
              maxLength={120}
              autoFocus={!isEdit}
            />
          </div>

          <div className="brnd-field">
            <label className="brnd-label">Tagline courte</label>
            <input
              className="brnd-input"
              value={form.tagline}
              onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              placeholder="Ex: 100% naturel, made in Sénégal"
              maxLength={100}
            />
            <p className="brnd-hint">Petite phrase d'accroche affichée sous le nom (max 100 caractères).</p>
          </div>

          <div className="brnd-row">
            <div className="brnd-field">
              <label className="brnd-label">Prix (FCFA) <span className="req">*</span></label>
              <input
                className="brnd-input"
                type="number"
                inputMode="numeric"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="8500"
                min="0"
              />
            </div>
            <div className="brnd-field">
              <label className="brnd-label">Prix barré (promo)</label>
              <input
                className="brnd-input"
                type="number"
                inputMode="numeric"
                value={form.old_price}
                onChange={e => setForm(f => ({ ...f, old_price: e.target.value }))}
                placeholder="10000"
                min="0"
              />
              <p className="brnd-hint">Optionnel — affiché barré si supérieur au prix.</p>
            </div>
          </div>

          <div className="brnd-row">
            <div className="brnd-field">
              <label className="brnd-label">Catégorie</label>
              <select
                className="brnd-select"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">— Choisir —</option>
                {categories.map(c => (
                  <option key={c.id || c.slug} value={c.slug || c.id}>
                    {c.name || c.label || c.slug || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="brnd-field">
              <label className="brnd-label">Stock initial <span className="req">*</span></label>
              <input
                className="brnd-input"
                type="number"
                inputMode="numeric"
                value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                placeholder="10"
                min="0"
              />
              <p className="brnd-hint">
                Combien d'unités tu peux livrer maintenant. Ajustable ensuite depuis "Mon stock".
              </p>
            </div>
          </div>

          <div className="brnd-field">
            <label className="brnd-label">Description longue</label>
            <textarea
              className="brnd-textarea"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ingrédients, bienfaits, mode d'emploi, contenance…"
              rows={5}
            />
            <p className="brnd-hint">Plus tu détailles, mieux les clientes comprennent ton produit.</p>
          </div>

          <div className="brnd-modal-actions">
            <button type="button" className="brnd-btn-sec" onClick={onCancel} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="brnd-btn-primary" disabled={saving || uploading}>
              {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer les modifications' : 'Envoyer pour validation')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
