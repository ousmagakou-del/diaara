// ════════════════════════════════════════════════════════════════════
// YARAM Admin — Blog SEO (blog_articles + blog_categories)
// ────────────────────────────────────────────────────────────────────
// CRUD editorial pour le blog magazine yaram.app/blog.
// Le user rédigera les articles ; ici on offre l'infra complète : upload
// cover, editor markdown live preview, seo fields, linked_products picker,
// publish/featured toggles, category picker.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast, confirmDialog } from '../lib/toast';
import { slugifyTitle } from '../lib/supabase/blog';

const emptyArticle = () => ({
  id: null,
  slug: '',
  title: '',
  subtitle: '',
  content_md: '',
  cover_url: '',
  category_id: '',
  tags: '',
  author_name: '',
  author_avatar_url: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  linked_product_ids: [],
  read_time_min: 5,
  published: false,
  featured: false,
});

// ─── Minimal markdown preview parser ───────────────────────────
function mdPreview(md) {
  if (!md) return <p style={{ color: '#9AA3A0' }}>(Corps vide)</p>;
  const blocks = md.split(/\n{2,}/);
  return blocks.map((rawBlock, i) => {
    const block = rawBlock.trim();
    if (!block) return null;
    if (block.startsWith('### ')) return <h3 key={i} style={{ fontSize: 16, fontWeight: 800, margin: '12px 0 6px' }}>{block.slice(4)}</h3>;
    if (block.startsWith('## ')) return <h2 key={i} style={{ fontSize: 19, fontWeight: 800, margin: '16px 0 8px' }}>{block.slice(3)}</h2>;
    if (block.startsWith('# ')) return <h1 key={i} style={{ fontSize: 22, fontWeight: 900, margin: '18px 0 10px' }}>{block.slice(2)}</h1>;
    if (/^[-*]\s/.test(block)) {
      const items = block.split('\n').filter(l => /^[-*]\s/.test(l)).map(l => l.replace(/^[-*]\s/, ''));
      return (
        <ul key={i} style={{ marginLeft: 20, marginBottom: 10 }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{it}</li>)}
        </ul>
      );
    }
    if (block.startsWith('> ')) return <blockquote key={i} style={{ borderLeft: '3px solid #1F8B4C', padding: '4px 12px', color: '#6B7570', margin: '12px 0', fontStyle: 'italic' }}>{block.replace(/^>\s?/gm, '')}</blockquote>;
    return <p key={i} style={{ marginBottom: 12, lineHeight: 1.55 }}>{block}</p>;
  });
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #DDE3DF',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#4A5450', textTransform: 'uppercase', letterSpacing: '0.04em' };
const rowStyle = { marginBottom: 14 };
const btnPrimary = {
  padding: '10px 18px',
  background: '#1F8B4C',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};
const btnGhost = {
  padding: '10px 18px',
  background: '#F4F6F3',
  color: '#0F1A16',
  border: '1px solid #DDE3DF',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

export default function BlogSection() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all'); // all | published | draft | featured
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [productPicker, setProductPicker] = useState(false);

  // ─── Data loading ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await Promise.all([refresh(), loadCategories(), loadProducts()]);
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*, blog_categories(id,slug,name)')
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('Erreur chargement articles : ' + error.message);
        setArticles([]);
      } else {
        setArticles(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('blog_categories')
      .select('*')
      .order('display_order', { ascending: true });
    setCategories(Array.isArray(data) ? data : []);
  };

  const loadProducts = async () => {
    // On charge les 500 derniers produits approuvés pour le picker
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, image_url, img')
      .eq('status', 'approved')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(500);
    setProducts(Array.isArray(data) ? data : []);
  };

  // ─── Handlers ───────────────────────────────────────────────
  const handleEdit = (a) => {
    setEditing({
      ...emptyArticle(),
      ...a,
      tags: Array.isArray(a.tags) ? a.tags.join(', ') : (a.tags || ''),
      seo_keywords: Array.isArray(a.seo_keywords) ? a.seo_keywords.join(', ') : (a.seo_keywords || ''),
      linked_product_ids: Array.isArray(a.linked_product_ids) ? a.linked_product_ids : [],
    });
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditing(emptyArticle());
    setShowEditor(true);
  };

  const handleDelete = async (a) => {
    const ok = await confirmDialog({
      title: 'Supprimer cet article ?',
      message: `"${a.title}" sera supprimé définitivement.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('blog_articles').delete().eq('id', a.id);
    if (error) {
      toast.error('Erreur suppression : ' + error.message);
      return;
    }
    toast.success('Article supprimé');
    refresh();
  };

  const uploadCover = async (file) => {
    if (!file) return null;
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `blog/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('article-covers').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('article-covers').getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (e) {
      toast.error('Upload échoué : ' + (e.message || 'erreur'));
      return null;
    }
  };

  const handleSave = async (form) => {
    const tagsArr = String(form.tags || '')
      .split(',').map(t => t.trim()).filter(Boolean);
    const kwArr = String(form.seo_keywords || '')
      .split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
      slug: (form.slug || slugifyTitle(form.title || '')).trim(),
      title: (form.title || '').trim(),
      subtitle: form.subtitle?.trim() || null,
      content_md: form.content_md || '',
      cover_url: form.cover_url?.trim() || null,
      category_id: form.category_id || null,
      tags: tagsArr,
      author_name: form.author_name?.trim() || null,
      author_avatar_url: form.author_avatar_url?.trim() || null,
      seo_title: form.seo_title?.trim() || null,
      seo_description: form.seo_description?.trim() || null,
      seo_keywords: kwArr,
      linked_product_ids: form.linked_product_ids || [],
      read_time_min: parseInt(form.read_time_min, 10) || 5,
      published: !!form.published,
      featured: !!form.featured,
    };

    if (!payload.title) { toast.error('Titre requis'); return; }
    if (!payload.slug)  { toast.error('Slug requis');  return; }

    try {
      let error;
      if (form.id) {
        ({ error } = await supabase.from('blog_articles')
          .update(payload).eq('id', form.id));
      } else {
        // Set published_at si publie directement des la creation
        if (payload.published) payload.published_at = new Date().toISOString();
        ({ error } = await supabase.from('blog_articles').insert(payload));
      }
      if (error) throw error;
      toast.success(form.id ? 'Article mis à jour' : 'Article créé');
      setShowEditor(false);
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error('Erreur enregistrement : ' + e.message);
    }
  };

  // ─── Filter + search ────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = articles;
    if (filter === 'published') list = list.filter(a => a.published);
    else if (filter === 'draft') list = list.filter(a => !a.published);
    else if (filter === 'featured') list = list.filter(a => a.featured);
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(k) ||
        (a.slug || '').toLowerCase().includes(k) ||
        (Array.isArray(a.tags) ? a.tags.join(' ').toLowerCase().includes(k) : false)
      );
    }
    return list;
  }, [articles, filter, q]);

  const productsById = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.id] = p; });
    return map;
  }, [products]);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Blog SEO</h1>
          <p style={{ margin: '4px 0 0', color: '#6B7570', fontSize: 13 }}>
            {articles.length} article{articles.length > 1 ? 's' : ''} · {categories.length} catégories
          </p>
        </div>
        <button style={btnPrimary} onClick={handleNew}>+ Nouvel article</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'published', 'draft', 'featured'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid #DDE3DF',
              background: filter === f ? '#0F1A16' : '#fff',
              color: filter === f ? '#fff' : '#0F1A16',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'Tous' : f === 'published' ? 'Publiés' : f === 'draft' ? 'Brouillons' : 'À la une'}
          </button>
        ))}
        <input
          placeholder="Rechercher…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ ...inputStyle, maxWidth: 280, marginLeft: 'auto' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7570' }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7570', border: '1px dashed #DDE3DF', borderRadius: 12 }}>
          Aucun article. Clique sur "+ Nouvel article" pour commencer.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(a => {
            const cat = a.blog_categories || categories.find(c => c.id === a.category_id) || null;
            return (
              <div
                key={a.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr auto',
                  gap: 14,
                  padding: 12,
                  border: '1px solid #E5E9E6',
                  borderRadius: 12,
                  background: '#fff',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 60,
                    borderRadius: 8,
                    background: a.cover_url
                      ? `url(${a.cover_url}) center/cover`
                      : 'linear-gradient(135deg, #E5EFE9, #C9DDD1)',
                  }}
                  aria-hidden="true"
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 15 }}>{a.title || '(sans titre)'}</strong>
                    {a.featured && <span style={{ fontSize: 11, background: '#FFF3D6', color: '#8A6100', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>À la une</span>}
                    {!a.published && <span style={{ fontSize: 11, background: '#FEE', color: '#B00', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>Brouillon</span>}
                    {a.published  && <span style={{ fontSize: 11, background: '#E5F5EA', color: '#1F8B4C', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>Publié</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7570', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    /{a.slug} · {cat?.name || '—'} · {a.views_count || 0} vues
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={btnGhost} onClick={() => handleEdit(a)}>Éditer</button>
                  <button
                    style={{ ...btnGhost, color: '#B00', borderColor: '#F3D6D6' }}
                    onClick={() => handleDelete(a)}
                  >
                    Suppr.
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showEditor && editing && (
        <ArticleEditor
          value={editing}
          setValue={setEditing}
          categories={categories}
          products={products}
          productsById={productsById}
          uploadCover={uploadCover}
          onCancel={() => { setShowEditor(false); setEditing(null); }}
          onSave={handleSave}
          openProductPicker={() => setProductPicker(true)}
          closeProductPicker={() => setProductPicker(false)}
          productPickerOpen={productPicker}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Editor modal
// ═══════════════════════════════════════════════════════════════════
function ArticleEditor({
  value, setValue, categories, products, productsById,
  uploadCover, onCancel, onSave,
  openProductPicker, closeProductPicker, productPickerOpen,
}) {
  const set = (patch) => setValue(v => ({ ...v, ...patch }));

  const linkedProducts = (value.linked_product_ids || [])
    .map(id => productsById[id])
    .filter(Boolean);

  const [pickerSearch, setPickerSearch] = useState('');
  const filteredProducts = useMemo(() => {
    if (!pickerSearch.trim()) return products.slice(0, 60);
    const k = pickerSearch.toLowerCase();
    return products
      .filter(p => (p.name || '').toLowerCase().includes(k) || (p.brand || '').toLowerCase().includes(k))
      .slice(0, 60);
  }, [pickerSearch, products]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24,
        maxWidth: 1100, width: '100%',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            {value.id ? 'Éditer l\'article' : 'Nouvel article'}
          </h2>
          <button style={btnGhost} onClick={onCancel}>Fermer</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* ── Colonne gauche : édition ────────────────────── */}
          <div>
            <div style={rowStyle}>
              <label style={labelStyle}>Titre *</label>
              <input
                style={inputStyle}
                value={value.title}
                onChange={(e) => {
                  const t = e.target.value;
                  set({ title: t, slug: value.slug || slugifyTitle(t) });
                }}
              />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Slug (URL) *</label>
              <input
                style={inputStyle}
                value={value.slug}
                onChange={(e) => set({ slug: e.target.value.trim() })}
                placeholder="hyperpigmentation-peau-noire-guide"
              />
              <div style={{ fontSize: 11, color: '#6B7570', marginTop: 4 }}>
                URL finale : yaram.app/blog/{value.slug || '…'}
              </div>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Sous-titre</label>
              <input style={inputStyle} value={value.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Catégorie</label>
              <select
                style={inputStyle}
                value={value.category_id || ''}
                onChange={(e) => set({ category_id: e.target.value })}
              >
                <option value="">— Sans catégorie —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Cover (image)</label>
              <input
                style={inputStyle}
                value={value.cover_url}
                onChange={(e) => set({ cover_url: e.target.value })}
                placeholder="https://…"
              />
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await uploadCover(f);
                  if (url) set({ cover_url: url });
                }}
                style={{ marginTop: 8, fontSize: 12 }}
              />
              {value.cover_url && (
                <img
                  src={value.cover_url}
                  alt="cover"
                  style={{ marginTop: 10, maxWidth: '100%', maxHeight: 160, borderRadius: 8, objectFit: 'cover' }}
                />
              )}
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Auteur</label>
              <input style={inputStyle} value={value.author_name} onChange={(e) => set({ author_name: e.target.value })} placeholder="Rédaction YARAM" />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Avatar auteur (URL)</label>
              <input style={inputStyle} value={value.author_avatar_url} onChange={(e) => set({ author_avatar_url: e.target.value })} />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Temps de lecture (min)</label>
              <input
                type="number"
                style={{ ...inputStyle, maxWidth: 120 }}
                value={value.read_time_min}
                min={1}
                max={60}
                onChange={(e) => set({ read_time_min: e.target.value })}
              />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Tags (virgule)</label>
              <input style={inputStyle} value={value.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="peau noire, hyperpigmentation, vitamin c" />
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #E5E9E6' }} />

            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#4A5450', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              SEO
            </h3>

            <div style={rowStyle}>
              <label style={labelStyle}>Meta title</label>
              <input style={inputStyle} value={value.seo_title} onChange={(e) => set({ seo_title: e.target.value })} placeholder="≤ 60 caractères" />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Meta description</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, fontFamily: 'inherit' }}
                value={value.seo_description}
                onChange={(e) => set({ seo_description: e.target.value })}
                placeholder="≤ 155 caractères"
              />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Mots-clés SEO (virgule)</label>
              <input style={inputStyle} value={value.seo_keywords} onChange={(e) => set({ seo_keywords: e.target.value })} />
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #E5E9E6' }} />

            {/* Linked products */}
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#4A5450', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Produits recommandés
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {linkedProducts.length === 0 && (
                <span style={{ fontSize: 12, color: '#6B7570' }}>Aucun produit lié</span>
              )}
              {linkedProducts.map(p => (
                <span key={p.id} style={{
                  display: 'inline-flex', gap: 6, alignItems: 'center',
                  background: '#F4F6F3', padding: '6px 10px', borderRadius: 999, fontSize: 12,
                }}>
                  {p.name}
                  <button
                    type="button"
                    onClick={() => set({ linked_product_ids: value.linked_product_ids.filter(id => id !== p.id) })}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#B00' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button type="button" style={btnGhost} onClick={openProductPicker}>+ Ajouter un produit</button>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #E5E9E6' }} />

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!value.published}
                  onChange={(e) => set({ published: e.target.checked })}
                />
                <span><b>Publié</b> — visible sur yaram.app/blog</span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!value.featured}
                  onChange={(e) => set({ featured: e.target.checked })}
                />
                <span><b>À la une</b> — hero /blog</span>
              </label>
            </div>
          </div>

          {/* ── Colonne droite : markdown editor + preview ─── */}
          <div>
            <label style={labelStyle}>Contenu (Markdown)</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: 380,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                lineHeight: 1.55,
              }}
              value={value.content_md}
              onChange={(e) => set({ content_md: e.target.value })}
              placeholder="## Introduction

Écris ton article en Markdown.

## Sous-partie

- Point 1
- Point 2

**Astuce** : les headings `##` génèrent la table des matières côté lecteur."
            />

            <label style={{ ...labelStyle, marginTop: 16 }}>Prévisualisation</label>
            <div style={{
              border: '1px solid #E5E9E6',
              borderRadius: 10,
              padding: 16,
              background: '#FAFBF9',
              minHeight: 200,
              fontSize: 14,
              lineHeight: 1.6,
            }}>
              {mdPreview(value.content_md)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button style={btnGhost} onClick={onCancel}>Annuler</button>
          <button style={btnPrimary} onClick={() => onSave(value)}>
            {value.id ? 'Enregistrer' : 'Créer l\'article'}
          </button>
        </div>

        {/* Product picker overlay */}
        {productPickerOpen && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20,
          }}>
            <div style={{
              background: '#fff', borderRadius: 14, padding: 20,
              maxWidth: 600, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Choisir un produit</h3>
                <button style={btnGhost} onClick={closeProductPicker}>Fermer</button>
              </div>
              <input
                style={inputStyle}
                placeholder="Rechercher…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
              />
              <div style={{ overflowY: 'auto', marginTop: 12, display: 'grid', gap: 6 }}>
                {filteredProducts.length === 0 && (
                  <div style={{ color: '#6B7570', fontSize: 13, padding: 20, textAlign: 'center' }}>
                    Aucun produit trouvé.
                  </div>
                )}
                {filteredProducts.map(p => {
                  const already = value.linked_product_ids.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (!already) set({ linked_product_ids: [...value.linked_product_ids, p.id] });
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr auto',
                        gap: 10,
                        padding: 8,
                        border: '1px solid #E5E9E6',
                        borderRadius: 8,
                        background: already ? '#F4F6F3' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 6,
                        background: (p.image_url || p.img) ? `url(${p.image_url || p.img}) center/cover` : '#EEE',
                      }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#6B7570' }}>{p.brand || '—'}</div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        color: already ? '#1F8B4C' : '#4A5450',
                        fontWeight: 700,
                      }}>{already ? 'Ajouté ✓' : '+ Ajouter'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
