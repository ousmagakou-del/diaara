// ════════════════════════════════════════════════════════════════════
// YARAM — HeaderSearch (autocomplete)
// ────────────────────────────────────────────────────────────────────
// Champ de recherche du header desktop avec dropdown 3 sections :
// Produits / Marques / Categories. Debounce 200 ms. Requêtes côté
// client agrégeant .from('products') / .from('brands') / .from('categories').
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNav } from '../App';
import { supabase } from '../lib/supabase/client';
import { imgSrc } from '../lib/imgSrc';
import './HeaderSearch.css';

const DEBOUNCE_MS = 200;
const MAX_PRODUCTS = 5;
const MAX_BRANDS = 3;
const MAX_CATEGORIES = 3;

// Highlight le texte matchant dans une string
function highlight(text, term) {
  if (!term || !text) return text;
  const t = String(text);
  const s = String(term).trim();
  if (!s) return t;
  const i = t.toLowerCase().indexOf(s.toLowerCase());
  if (i < 0) return t;
  return (
    <>
      {t.slice(0, i)}
      <mark className="y-hsearch__mark">{t.slice(i, i + s.length)}</mark>
      {t.slice(i + s.length)}
    </>
  );
}

async function fetchAutocomplete(term) {
  const q = term.trim();
  if (q.length < 2) return { products: [], brands: [], categories: [] };
  const like = `%${q}%`;

  const [prodR, brandR, catR] = await Promise.allSettled([
    supabase
      .from('products')
      .select('id, name, brand, image_url, img, price')
      .eq('active', true)
      .ilike('name', like)
      .limit(MAX_PRODUCTS),
    supabase
      .from('brands')
      .select('id, name, img, city')
      .ilike('name', like)
      .limit(MAX_BRANDS),
    supabase
      .from('categories')
      .select('id, slug, name')
      .eq('active', true)
      .ilike('name', like)
      .limit(MAX_CATEGORIES),
  ]);

  return {
    products: prodR.status === 'fulfilled' ? (prodR.value?.data || []) : [],
    brands: brandR.status === 'fulfilled' ? (brandR.value?.data || []) : [],
    categories: catR.status === 'fulfilled' ? (catR.value?.data || []) : [],
  };
}

export default function HeaderSearch({ variant = 'header' }) {
  const { navigate } = useNav();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ products: [], brands: [], categories: [] });
  const inputRef = useRef(null);
  const rootRef = useRef(null);

  // Fermer le dropdown au click extérieur
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Debounce fetch
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults({ products: [], brands: [], categories: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetchAutocomplete(q);
      setResults(res);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const submit = useCallback(() => {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    navigate({ name: 'search', params: { q: term } });
  }, [q, navigate]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const clear = () => {
    setQ('');
    setResults({ products: [], brands: [], categories: [] });
    inputRef.current?.focus();
  };

  const goProduct = (p) => {
    setOpen(false);
    setQ('');
    navigate({ name: 'product', id: p.id, params: { id: p.id } });
  };

  const goBrand = (b) => {
    setOpen(false);
    setQ('');
    if (b.id) navigate({ name: 'brand', id: b.id, params: { id: b.id } });
    else navigate({ name: 'search', params: { brand: b.name } });
  };

  const goCategory = (c) => {
    setOpen(false);
    setQ('');
    navigate({ name: 'search', params: { category: c.slug || c.id } });
  };

  const total = results.products.length + results.brands.length + results.categories.length;
  const showDropdown = open && q.trim().length >= 2;

  return (
    <div ref={rootRef} className={`y-hsearch y-hsearch--${variant}`}>
      <div className="y-hsearch__box" onClick={() => inputRef.current?.focus()}>
        <svg className="y-hsearch__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="y-hsearch__input"
          placeholder="Chercher un produit, une marque, une categorie"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck="false"
          aria-label="Recherche"
        />
        {q && (
          <button
            type="button"
            className="y-hsearch__clear"
            onClick={clear}
            aria-label="Effacer la recherche"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="y-hsearch__submit"
          onClick={submit}
          aria-label="Lancer la recherche"
        >
          Rechercher
        </button>
      </div>

      {showDropdown && (
        <div className="y-hsearch__dropdown" role="listbox">
          {loading && total === 0 && (
            <div className="y-hsearch__empty">Recherche en cours...</div>
          )}

          {!loading && total === 0 && (
            <div className="y-hsearch__empty">
              Aucun resultat direct. Appuie sur Entree pour lancer la recherche complete.
            </div>
          )}

          {results.products.length > 0 && (
            <div className="y-hsearch__section">
              <div className="y-hsearch__section-title">Produits</div>
              {results.products.map((p) => {
                const image = p.image_url || p.img;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="y-hsearch__row"
                    onClick={() => goProduct(p)}
                    role="option"
                  >
                    <div className="y-hsearch__thumb">
                      {image ? (
                        <img src={imgSrc(image, { w: 96, q: 80 })} alt="" loading="lazy" />
                      ) : (
                        <span>{(p.name || '?').slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="y-hsearch__meta">
                      <div className="y-hsearch__name">{highlight(p.name, q)}</div>
                      {p.brand && <div className="y-hsearch__sub">{p.brand}</div>}
                    </div>
                    {p.price ? (
                      <div className="y-hsearch__price">
                        {Number(p.price).toLocaleString('fr-FR')} F
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {results.brands.length > 0 && (
            <div className="y-hsearch__section">
              <div className="y-hsearch__section-title">Marques</div>
              {results.brands.map((b) => (
                <button
                  key={b.id || b.name}
                  type="button"
                  className="y-hsearch__row"
                  onClick={() => goBrand(b)}
                  role="option"
                >
                  <div className="y-hsearch__thumb y-hsearch__thumb--brand">
                    {b.img ? (
                      <img src={imgSrc(b.img, { w: 96, q: 80 })} alt="" loading="lazy" />
                    ) : (
                      <span>{(b.name || '?').slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="y-hsearch__meta">
                    <div className="y-hsearch__name">{highlight(b.name, q)}</div>
                    <div className="y-hsearch__sub">
                      Marque{b.city ? ` · ${b.city}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.categories.length > 0 && (
            <div className="y-hsearch__section">
              <div className="y-hsearch__section-title">Categories</div>
              {results.categories.map((c) => (
                <button
                  key={c.id || c.slug}
                  type="button"
                  className="y-hsearch__row"
                  onClick={() => goCategory(c)}
                  role="option"
                >
                  <div className="y-hsearch__thumb y-hsearch__thumb--cat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <div className="y-hsearch__meta">
                    <div className="y-hsearch__name">{highlight(c.name, q)}</div>
                    <div className="y-hsearch__sub">Categorie</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="y-hsearch__all"
            onClick={submit}
          >
            Voir tous les resultats pour "{q}"
          </button>
        </div>
      )}
    </div>
  );
}
