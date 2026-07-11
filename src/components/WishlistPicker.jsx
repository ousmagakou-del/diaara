import { useEffect, useState } from 'react';
import {
  listMyWishlists,
  createWishlist,
  addItemToWishlist,
} from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════
// YARAM — WishlistPicker (bottom sheet)
//   - Charge les wishlists du user
//   - Permet d'ajouter le produit à une liste existante
//   - Ou de créer une nouvelle liste directement depuis ce dropdown
// ═══════════════════════════════════════════════════════════════

export default function WishlistPicker({ open, onClose, productId, onAdded }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr('');
    listMyWishlists()
      .then(rows => { if (!cancelled) setLists(rows); })
      .catch(e => { if (!cancelled) setErr(e?.message || 'Erreur'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const handleAdd = async (wl) => {
    if (!productId) return;
    setBusyId(wl.id);
    try {
      await addItemToWishlist(wl.id, productId);
      onAdded?.(wl);
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Erreur ajout');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newName.trim() || !productId) return;
    setBusyId('new');
    try {
      const res = await createWishlist(newName.trim());
      if (res?.id) {
        await addItemToWishlist(res.id, productId);
        onAdded?.({ id: res.id, name: newName.trim(), slug: res.slug });
        onClose?.();
      }
    } catch (e) {
      setErr(e?.message || 'Erreur création');
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 3000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '22px 22px 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '18px 18px 24px',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{
          width: 40, height: 4, background: '#DDD',
          borderRadius: 999, margin: '0 auto 14px',
        }} />
        <h3 style={{
          fontSize: 16, fontWeight: 800,
          color: '#1A1A1A', margin: '0 0 14px',
        }}>
          Ajouter à une liste
        </h3>

        {err && (
          <div style={{
            padding: 10, background: '#FFF6F5', color: '#B02020',
            borderRadius: 10, fontSize: 12, marginBottom: 10,
          }}>
            {err}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#6B6B6B' }}>
            Chargement...
          </div>
        ) : (
          <>
            {lists.map(wl => (
              <button
                key={wl.id}
                onClick={() => handleAdd(wl)}
                disabled={busyId === wl.id}
                style={{
                  width: '100%',
                  background: 'transparent', border: 'none',
                  textAlign: 'left', fontFamily: 'inherit',
                  padding: '14px 12px',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', transition: 'background 0.15s',
                  opacity: busyId === wl.id ? 0.5 : 1,
                }}
                onMouseOver={e => e.currentTarget.style.background = '#F4F4F2'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                    {wl.name}
                    {wl.is_default && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 999,
                        background: '#E8F5EC', color: '#1F8B4C',
                      }}>par défaut</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>
                    {wl.item_count ?? 0} produit{(wl.item_count ?? 0) > 1 ? 's' : ''}
                    {wl.is_public && ' · Publique'}
                  </div>
                </div>
                <span style={{ color: '#1F8B4C', fontSize: 20, fontWeight: 700 }}>+</span>
              </button>
            ))}
          </>
        )}

        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              width: '100%', background: '#F4F4F2', border: 'none',
              padding: '13px 14px', borderRadius: 12, marginTop: 8,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              color: '#1A1A1A', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Créer une nouvelle liste
          </button>
        ) : (
          <div style={{ marginTop: 14 }}>
            <input
              autoFocus
              placeholder="Nom de la liste"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', fontSize: 14,
                border: '1px solid #EDEDEB', borderRadius: 12,
                fontFamily: 'inherit', background: '#F8F8F6',
                outline: 'none', color: '#1A1A1A',
              }}
            />
            <button
              onClick={handleCreateAndAdd}
              disabled={!newName.trim() || busyId === 'new'}
              style={{
                width: '100%', marginTop: 10,
                background: '#1F8B4C', color: 'white', border: 'none',
                padding: '13px 22px', borderRadius: 999,
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                opacity: newName.trim() ? 1 : 0.5,
              }}
            >
              Créer + ajouter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
