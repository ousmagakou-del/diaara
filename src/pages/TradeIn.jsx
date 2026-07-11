// ════════════════════════════════════════════════════════════════════
// TradeIn.jsx — Rachat cosmetiques (route /trade-in)
// ════════════════════════════════════════════════════════════════════
// Scaffold : l utilisateur soumet une liste de produits usages avec
// marque + etat + photo. L admin valide et credite le compte YARAM.
// L estimation est calculee cote serveur pour eviter la fraude.
// ════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { useNav, useUser } from '../App';
import { toast } from '../lib/toast';
import { haptic } from '../lib/haptic';
import { TRADE_IN_CONDITIONS, tradeInSubmit, tradeInListMine } from '../lib/supabase';
import './TradeIn.css';

const STATUS_LABELS = {
  pending_review: { label: 'En cours d examen', color: '#F59E0B', bg: '#FEF3C7' },
  accepted: { label: 'Accepte', color: '#0F5132', bg: '#D1FAE5' },
  rejected: { label: 'Refuse', color: '#DC2626', bg: '#FEE2E2' },
  received: { label: 'Recu en pharmacie', color: '#0F5132', bg: '#DBEAFE' },
  credited: { label: 'Credite', color: '#065F46', bg: '#D1FAE5' },
};

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
}

function fmtPrice(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';
}

const EMPTY_ITEM = { name: '', brand: '', condition: 'good', photo_url: '', estimated_value: '' };

export default function TradeIn() {
  const { navigate, goBack } = useNav();
  const { user } = useUser();

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await tradeInListMine();
    setHistory(list);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  };

  const removeItem = (idx) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!user) {
      toast('Connecte-toi pour envoyer une demande', 'info');
      navigate('auth');
      return;
    }
    const cleaned = items
      .map((it) => ({
        name: (it.name || '').trim(),
        brand: (it.brand || '').trim(),
        condition: it.condition || 'good',
        photo_url: (it.photo_url || '').trim() || null,
        estimated_value: it.estimated_value ? Number(it.estimated_value) : null,
      }))
      .filter((it) => it.name.length > 0);

    if (cleaned.length === 0) {
      toast('Ajoute au moins un produit avec son nom', 'error');
      return;
    }

    const pickup = pickupAddress || pickupPhone ? {
      address: pickupAddress || null,
      phone: pickupPhone || null,
    } : null;

    setSubmitting(true);
    try {
      haptic('medium');
      const { data, error } = await tradeInSubmit(cleaned, pickup);
      if (error) throw new Error(error);
      toast(`Demande envoyee. Estimation : ${fmtPrice(data?.estimated_credit_fcfa || 0)}`);
      setItems([{ ...EMPTY_ITEM }]);
      setPickupAddress('');
      setPickupPhone('');
      await refresh();
    } catch (err) {
      toast(err?.message || 'Erreur envoi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ti-page">
      <header className="ti-topbar">
        <button className="ti-back" type="button" onClick={() => goBack('shop')} aria-label="Retour">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Retour</span>
        </button>
        <span className="ti-topbar__title">Trade-In</span>
        <span className="ti-topbar__spacer" />
      </header>

      <section className="ti-hero">
        <span className="ti-hero__eyebrow">GESTE ECO YARAM</span>
        <h1 className="ti-hero__title">Recycle tes cosmetiques,<br />gagne du credit YARAM.</h1>
        <p className="ti-hero__lead">
          Depose tes produits semi-neufs (parfums, cremes, maquillage) et recois
          un credit YARAM utilisable dans toute l app.
        </p>
        <ul className="ti-hero__perks">
          <li>Estimation immediate</li>
          <li>Collecte a domicile ou depot pharmacie</li>
          <li>Credit YARAM sous 5 jours</li>
        </ul>
      </section>

      <section className="ti-card">
        <h2 className="ti-section__title">Tes produits</h2>
        <form onSubmit={handleSubmit} className="ti-form">
          {items.map((it, idx) => (
            <div className="ti-item" key={idx}>
              <div className="ti-item__head">
                <span className="ti-item__count">Produit {idx + 1}</span>
                {items.length > 1 ? (
                  <button
                    type="button"
                    className="ti-item__remove"
                    onClick={() => removeItem(idx)}
                    aria-label="Supprimer"
                  >
                    Retirer
                  </button>
                ) : null}
              </div>
              <div className="ti-grid">
                <label className="ti-label">
                  <span>Nom du produit</span>
                  <input
                    className="ti-input"
                    type="text"
                    value={it.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    placeholder="Ex: Rouge a levres Mat 218"
                  />
                </label>
                <label className="ti-label">
                  <span>Marque</span>
                  <input
                    className="ti-input"
                    type="text"
                    value={it.brand}
                    onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                    placeholder="Ex: MAC, La Roche-Posay"
                  />
                </label>
                <label className="ti-label">
                  <span>Etat</span>
                  <select
                    className="ti-input"
                    value={it.condition}
                    onChange={(e) => updateItem(idx, 'condition', e.target.value)}
                  >
                    {TRADE_IN_CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label className="ti-label">
                  <span>Estimation (FCFA)</span>
                  <input
                    className="ti-input"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={it.estimated_value}
                    onChange={(e) => updateItem(idx, 'estimated_value', e.target.value)}
                    placeholder="Ex: 2500"
                  />
                </label>
                <label className="ti-label ti-label--full">
                  <span>Lien photo (facultatif)</span>
                  <input
                    className="ti-input"
                    type="url"
                    value={it.photo_url}
                    onChange={(e) => updateItem(idx, 'photo_url', e.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </div>
            </div>
          ))}

          <button type="button" className="ti-add" onClick={addItem}>
            + Ajouter un autre produit
          </button>

          <div className="ti-pickup">
            <h3>Collecte (facultatif)</h3>
            <div className="ti-grid">
              <label className="ti-label">
                <span>Telephone</span>
                <input
                  className="ti-input"
                  type="tel"
                  value={pickupPhone}
                  onChange={(e) => setPickupPhone(e.target.value)}
                  placeholder="77 000 00 00"
                />
              </label>
              <label className="ti-label">
                <span>Adresse</span>
                <input
                  className="ti-input"
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Quartier, ville"
                />
              </label>
            </div>
          </div>

          <button type="submit" className="ti-cta" disabled={submitting}>
            {submitting ? 'Envoi...' : 'Envoyer ma demande'}
          </button>
        </form>
      </section>

      <section className="ti-card">
        <h2 className="ti-section__title">Mes demandes</h2>
        {loading ? (
          <p className="ti-empty">Chargement...</p>
        ) : history.length === 0 ? (
          <p className="ti-empty">Aucune demande envoyee pour l instant.</p>
        ) : (
          <ul className="ti-history">
            {history.map((h) => {
              const st = STATUS_LABELS[h.status] || { label: h.status, color: '#4B5B52', bg: '#F1F5F3' };
              return (
                <li className="ti-history__row" key={h.id}>
                  <div className="ti-history__head">
                    <span
                      className="ti-history__badge"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                    <span className="ti-history__date">{fmtDate(h.created_at)}</span>
                  </div>
                  <div className="ti-history__meta">
                    <span>{(h.items || []).length} produit(s)</span>
                    <span>
                      Estimation : <strong>{fmtPrice(h.estimated_credit_fcfa)}</strong>
                    </span>
                    {h.yaram_credit_issued_fcfa ? (
                      <span className="ti-history__credit">
                        Credit : {fmtPrice(h.yaram_credit_issued_fcfa)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
