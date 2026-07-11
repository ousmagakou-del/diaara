import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNav } from '../App';
import {
  listMyWishlists,
  createWishlist,
  renameWishlist,
  deleteWishlist,
  getWishlistItems,
  removeItemFromWishlist,
  setWishlistPublic,
  buildWishlistShareUrl,
  buildWhatsappShare,
} from '../lib/supabase';
import { haptic } from '../lib/haptic';
import { ProductTile } from '../components/tiles';
import TabBar from '../components/TabBar';
import './Favorites.css';

// ═══════════════════════════════════════════════════════════════
// YARAM — Mes listes (wishlists multi-listes + partage)
// ═══════════════════════════════════════════════════════════════
// - Chaque wishlist devient un tab ("Mes favoris" par défaut).
// - Tab "+" pour créer une nouvelle liste.
// - Actions par liste : share, rename, delete, toggle public.
// - Bouton "Ajouter tout au panier".
// ═══════════════════════════════════════════════════════════════

export default function Favorites() {
  const { navigate } = useNav();

  const [wishlists, setWishlists] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameDesc, setRenameDesc] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const activeList = useMemo(
    () => wishlists.find(w => w.id === activeId) || null,
    [wishlists, activeId],
  );

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2500);
  };

  const reloadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const lists = await listMyWishlists();
      setWishlists(lists);
      setActiveId(prev => {
        if (prev && lists.some(l => l.id === prev)) return prev;
        const def = lists.find(l => l.is_default) || lists[0];
        return def?.id || null;
      });
    } catch (e) {
      console.warn('[favorites] listMyWishlists:', e?.message);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => { reloadLists(); }, [reloadLists]);

  const reloadItems = useCallback(async (id) => {
    if (!id) { setItems([]); return; }
    setLoadingItems(true);
    try {
      const rows = await getWishlistItems(id);
      setItems(rows);
    } catch (e) {
      console.warn('[favorites] getWishlistItems:', e?.message);
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => { reloadItems(activeId); }, [activeId, reloadItems]);

  // ─── Actions ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await createWishlist(newName.trim(), newDesc.trim());
      haptic('medium');
      showToast('Liste créée');
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      await reloadLists();
      if (res?.id) setActiveId(res.id);
    } catch (e) {
      showToast('Erreur création');
    }
  };

  const handleRename = async () => {
    if (!activeList || !renameName.trim()) return;
    try {
      await renameWishlist(activeList.id, renameName.trim(), renameDesc.trim());
      haptic('light');
      showToast('Renommée');
      setRenameOpen(false);
      await reloadLists();
    } catch (e) { showToast('Erreur'); }
  };

  const handleDelete = async () => {
    if (!activeList) return;
    if (activeList.is_default) {
      showToast('Impossible de supprimer la liste par défaut');
      return;
    }
    if (!window.confirm(`Supprimer "${activeList.name}" ?`)) return;
    try {
      await deleteWishlist(activeList.id);
      haptic('heavy');
      showToast('Liste supprimée');
      setMenuOpen(false);
      setActiveId(null);
      await reloadLists();
    } catch (e) { showToast('Erreur'); }
  };

  const handleTogglePublic = async () => {
    if (!activeList) return;
    try {
      await setWishlistPublic(activeList.id, !activeList.is_public);
      haptic('light');
      showToast(activeList.is_public ? 'Liste privée' : 'Liste publique');
      await reloadLists();
    } catch (e) { showToast('Erreur'); }
  };

  const handleShare = async () => {
    if (!activeList) return;
    if (!activeList.is_public) {
      const ok = window.confirm(
        `"${activeList.name}" est privée. La rendre publique pour partager ?`,
      );
      if (!ok) return;
      try {
        await setWishlistPublic(activeList.id, true);
        await reloadLists();
      } catch (e) { showToast('Erreur'); return; }
    }
    const url = buildWishlistShareUrl(activeList.slug);
    // Copie URL + ouvre WhatsApp
    try {
      if (navigator.share) {
        await navigator.share({
          title: activeList.name,
          text: `Regarde ma liste "${activeList.name}" sur YARAM`,
          url,
        });
        showToast('Partagée !');
        return;
      }
    } catch { /* fall through */ }
    try {
      await navigator.clipboard?.writeText(url);
      showToast('Lien copié');
    } catch {}
    // Ouvre WhatsApp Web/App
    try {
      window.open(buildWhatsappShare(activeList.slug, activeList.name), '_blank');
    } catch {}
  };

  const handleRemoveItem = async (productId) => {
    if (!activeList) return;
    try {
      await removeItemFromWishlist(activeList.id, productId);
      setItems(prev => prev.filter(p => p.id !== productId));
      haptic('medium');
      showToast('Retiré');
    } catch (e) { showToast('Erreur'); }
  };

  const handleAddAllToCart = () => {
    if (!items.length) return;
    haptic('medium');
    try {
      const cart = JSON.parse(localStorage.getItem('yaram_cart') || '[]');
      items.forEach(p => {
        cart.push({ id: p.id, name: p.name, brand: p.brand, price: p.price, img: p.img, qty: 1 });
      });
      localStorage.setItem('yaram_cart', JSON.stringify(cart));
    } catch {}
    showToast(`${items.length} produit${items.length > 1 ? 's' : ''} ajouté${items.length > 1 ? 's' : ''}`);
    setTimeout(() => navigate('/cart'), 500);
  };

  const openRename = () => {
    if (!activeList) return;
    setRenameName(activeList.name || '');
    setRenameDesc(activeList.description || '');
    setRenameOpen(true);
    setMenuOpen(false);
  };

  // ─── Render ──────────────────────────────────────────────────────
  const currentCount = items.length;

  return (
    <div className="yfav-screen page-anim">
      <header className="yfav-header">
        <button className="yfav-back" onClick={() => navigate(-1)} aria-label="Retour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div className="yfav-title-wrap">
          <h1 className="yfav-title">Mes listes</h1>
          <p className="yfav-sub">
            {wishlists.length} liste{wishlists.length > 1 ? 's' : ''}
          </p>
        </div>
        {activeList && (
          <button className="yfav-sort-btn" onClick={() => setMenuOpen(true)} aria-label="Options">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>
            </svg>
            Options
          </button>
        )}
      </header>

      {/* Tabs wishlists */}
      <div className="yfav-tabs">
        {wishlists.map(w => (
          <button
            key={w.id}
            className={`yfav-tab ${activeId === w.id ? 'active' : ''}`}
            onClick={() => { haptic('light'); setActiveId(w.id); }}
          >
            <span>{w.name}</span>
            <span className="yfav-tab-count">{w.item_count ?? 0}</span>
          </button>
        ))}
        <button
          className="yfav-tab"
          onClick={() => setCreateOpen(true)}
          aria-label="Créer une nouvelle liste"
          style={{ paddingInline: 14 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Nouvelle</span>
        </button>
      </div>

      {/* Barre actions liste active */}
      {activeList && (
        <div style={{
          display: 'flex', gap: 8, padding: '4px 14px 8px', flexWrap: 'wrap',
        }}>
          <button
            className="yfav-sort-btn"
            onClick={handleShare}
            style={{ background: '#1F8B4C', color: 'white' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>
            </svg>
            Partager
          </button>
          <button className="yfav-sort-btn" onClick={handleTogglePublic}>
            {activeList.is_public ? 'Public' : 'Privé'}
          </button>
          {items.length > 0 && (
            <button
              className="yfav-sort-btn"
              onClick={handleAddAllToCart}
              style={{ background: '#1A1A1A', color: 'white' }}
            >
              Ajouter tout au panier
            </button>
          )}
        </div>
      )}

      <div className="yfav-scroll">
        {loadingLists || loadingItems ? (
          <div className="yfav-skel-grid">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="yfav-skel" />)}
          </div>
        ) : !activeList ? (
          <div className="yfav-empty">
            <h3 className="yfav-empty-title">Aucune liste</h3>
            <p className="yfav-empty-sub">Crée une liste pour commencer à sauvegarder tes produits préférés.</p>
            <button className="yfav-empty-cta" onClick={() => setCreateOpen(true)}>
              Créer une liste
            </button>
          </div>
        ) : currentCount === 0 ? (
          <div className="yfav-empty">
            <div className="yfav-empty-illu">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </div>
            <h3 className="yfav-empty-title">Liste vide</h3>
            <p className="yfav-empty-sub">Tape le cœur sur tes produits préférés pour les ajouter à cette liste.</p>
            <button className="yfav-empty-cta" onClick={() => navigate('/shop')}>
              Explorer la boutique
            </button>
          </div>
        ) : (
          <div className="yfav-grid">
            {items.map((p, i) => (
              <div
                key={p.id}
                className="yfav-cell"
                style={{ animationDelay: `${Math.min(i * 35, 600)}ms`, position: 'relative' }}
              >
                <ProductTile product={p} />
                <button
                  onClick={() => handleRemoveItem(p.id)}
                  aria-label="Retirer"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 28, height: 28, borderRadius: 999,
                    background: 'rgba(255,255,255,0.92)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)', cursor: 'pointer',
                    zIndex: 5,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#F8463A" strokeWidth="2.4" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu options */}
      {menuOpen && activeList && (
        <div className="yfav-modal-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="yfav-modal" onClick={e => e.stopPropagation()}>
            <div className="yfav-modal-handle" />
            <h3 className="yfav-modal-title">{activeList.name}</h3>
            <button className="yfav-modal-option" onClick={() => { handleShare(); setMenuOpen(false); }}>
              <span>Partager</span>
            </button>
            <button className="yfav-modal-option" onClick={openRename}>
              <span>Renommer</span>
            </button>
            <button className="yfav-modal-option" onClick={() => { handleTogglePublic(); }}>
              <span>{activeList.is_public ? 'Rendre privée' : 'Rendre publique'}</span>
            </button>
            {!activeList.is_default && (
              <button className="yfav-modal-option" onClick={handleDelete} style={{ color: '#F8463A' }}>
                <span>Supprimer</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal création */}
      {createOpen && (
        <div className="yfav-modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="yfav-modal" onClick={e => e.stopPropagation()}>
            <div className="yfav-modal-handle" />
            <h3 className="yfav-modal-title">Nouvelle liste</h3>
            <input
              autoFocus
              className="yfav-input"
              placeholder="Nom (ex. Cadeaux, Soins visage...)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={inputStyle}
            />
            <textarea
              className="yfav-input"
              placeholder="Description (optionnel)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', marginTop: 10 }}
            />
            <button
              className="yfav-empty-cta"
              onClick={handleCreate}
              disabled={!newName.trim()}
              style={{ width: '100%', marginTop: 14, opacity: newName.trim() ? 1 : 0.5 }}
            >
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Modal rename */}
      {renameOpen && activeList && (
        <div className="yfav-modal-backdrop" onClick={() => setRenameOpen(false)}>
          <div className="yfav-modal" onClick={e => e.stopPropagation()}>
            <div className="yfav-modal-handle" />
            <h3 className="yfav-modal-title">Renommer</h3>
            <input
              autoFocus
              className="yfav-input"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              style={inputStyle}
            />
            <textarea
              className="yfav-input"
              placeholder="Description"
              value={renameDesc}
              onChange={e => setRenameDesc(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', marginTop: 10 }}
            />
            <button
              className="yfav-empty-cta"
              onClick={handleRename}
              disabled={!renameName.trim()}
              style={{ width: '100%', marginTop: 14, opacity: renameName.trim() ? 1 : 0.5 }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {toast && <div className="yfav-toast">{toast}</div>}

      <TabBar />
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  fontSize: 14,
  border: '1px solid #EDEDEB',
  borderRadius: 12,
  fontFamily: 'inherit',
  background: '#F8F8F6',
  outline: 'none',
  color: '#1A1A1A',
};
