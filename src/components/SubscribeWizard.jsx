// ════════════════════════════════════════════════════════════════════
// SubscribeWizard.jsx — modal wizard 3 etapes pour creer un abonnement
// ════════════════════════════════════════════════════════════════════
// Etape 1 : nom + items (pre-remplis si initialItems)
// Etape 2 : frequence (30/60/90 j)
// Etape 3 : adresse + paiement + confirmation
// ════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../App';
import {
  createSubscription,
  computeSubscriptionTotal,
  FREQUENCY_OPTIONS,
  SUB_DISCOUNT_PCT,
  getMyAddresses,
} from '../lib/supabase';
import { toast } from '../lib/toast';

const fmtPrice = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';

/**
 * Props:
 *  - onClose(): fermer sans succes
 *  - onSuccess(id): abonnement cree
 *  - initialItems: [{id, name, price, qty, img?, brand?}]  (depuis Product/Bundle CTA)
 *  - initialName: string
 */
export default function SubscribeWizard({ onClose, onSuccess, initialItems, initialName }) {
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialName || 'Ma routine');
  const [items, setItems] = useState(() =>
    Array.isArray(initialItems) && initialItems.length
      ? initialItems.map((it) => ({
          id: it.id,
          name: it.name,
          price: Number(it.price || 0),
          qty: Number(it.qty || 1),
          img: it.img || it.image_url || null,
          brand: it.brand || null,
        }))
      : [],
  );
  const [frequency, setFrequency] = useState(30);
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [addresses, setAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [customAddr, setCustomAddr] = useState({ label: 'Domicile', address: '', city: 'Dakar', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const list = await getMyAddresses();
        setAddresses(list || []);
        const def = (list || []).find((a) => a.is_default) || (list || [])[0];
        if (def) setSelectedAddrId(def.id);
      } catch { /* ignore */ }
    })();
  }, [user]);

  const totals = useMemo(() => computeSubscriptionTotal(items, SUB_DISCOUNT_PCT), [items]);

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const incItem = (idx) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, qty: (it.qty || 1) + 1 } : it));
  const decItem = (idx) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(1, (it.qty || 1) - 1) } : it));

  const canNext1 = name.trim().length > 0 && items.length > 0;
  const canNext2 = FREQUENCY_OPTIONS.some((o) => o.value === frequency);

  const activeAddress = useMemo(() => {
    if (selectedAddrId === '__custom__') return customAddr;
    const found = addresses.find((a) => a.id === selectedAddrId);
    if (!found) return null;
    return {
      label: found.label || 'Domicile',
      address: found.address || found.street || '',
      city: found.city || '',
      phone: found.phone || '',
    };
  }, [selectedAddrId, addresses, customAddr]);

  const canSubmit = !!activeAddress && (activeAddress.address || '').trim().length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { id, error: err } = await createSubscription({
        name: name.trim(),
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          price: Number(it.price || 0),
          qty: Number(it.qty || 1),
          img: it.img || null,
          brand: it.brand || null,
        })),
        frequencyDays: frequency,
        address: activeAddress,
        paymentMethod,
      });
      if (err || !id) {
        if (String(err).includes('imported_products_not_allowed_in_subscription')) {
          setError('Les produits Import ne peuvent pas etre inclus dans un abonnement recurrent. Retire-les et reessaie.');
        } else {
          setError(err || 'Erreur creation abonnement');
        }
        return;
      }
      toast('Abonnement cree', 'success');
      onSuccess?.(id);
    } catch (e) {
      setError(e?.message || 'Erreur inattendue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="subs-modal-back" onClick={onClose}>
      <div className="subs-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nouvel abonnement</h2>
        <p className="subtitle">Recois ta routine automatiquement avec -{SUB_DISCOUNT_PCT}%</p>

        <div className="subs-modal__steps">
          <div className={`subs-modal__step ${step >= 1 ? 'active' : ''}`} />
          <div className={`subs-modal__step ${step >= 2 ? 'active' : ''}`} />
          <div className={`subs-modal__step ${step >= 3 ? 'active' : ''}`} />
        </div>

        {step === 1 && (
          <div>
            <div className="subs-modal__field">
              <label>Nom de la routine</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ma routine soir"
                maxLength={80}
              />
            </div>

            <div className="subs-modal__field">
              <label>Produits ({items.length})</label>
              {items.length === 0 && (
                <div className="subs-error">
                  Aucun produit. Ferme et clique "S abonner et economiser 15%" sur une fiche produit ou un bundle.
                </div>
              )}
              {items.map((it, i) => (
                <div key={`${it.id}-${i}`} className="subs-item-chip">
                  <span>{it.name}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => decItem(i)} aria-label="moins">-</button>
                    <span>x{it.qty || 1}</span>
                    <button onClick={() => incItem(i)} aria-label="plus">+</button>
                    <button onClick={() => removeItem(i)} aria-label="supprimer">Retirer</button>
                  </span>
                </div>
              ))}
            </div>

            <div className="subs-recap">
              Total sans reduction : {fmtPrice(totals.raw)}<br />
              Economie {SUB_DISCOUNT_PCT}% : -{fmtPrice(totals.discount)}<br />
              <strong>A payer par livraison : {fmtPrice(totals.total)}</strong>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="subs-modal__field">
              <label>Frequence de livraison</label>
              <div className="subs-freq-grid">
                {FREQUENCY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`subs-freq-opt ${frequency === o.value ? 'active' : ''}`}
                    onClick={() => setFrequency(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="subs-recap">
              Premiere livraison dans {frequency} jours. Tu peux mettre en pause, sauter ou annuler a tout moment.
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="subs-modal__field">
              <label>Adresse de livraison</label>
              {addresses.length > 0 && (
                <select
                  value={selectedAddrId || ''}
                  onChange={(e) => setSelectedAddrId(e.target.value)}
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label || 'Adresse'} — {a.address || a.street || ''}
                    </option>
                  ))}
                  <option value="__custom__">Autre adresse...</option>
                </select>
              )}
              {(addresses.length === 0 || selectedAddrId === '__custom__') && (
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  <input
                    placeholder="Adresse complete"
                    value={customAddr.address}
                    onChange={(e) => setCustomAddr({ ...customAddr, address: e.target.value })}
                  />
                  <input
                    placeholder="Ville"
                    value={customAddr.city}
                    onChange={(e) => setCustomAddr({ ...customAddr, city: e.target.value })}
                  />
                  <input
                    placeholder="Telephone"
                    value={customAddr.phone}
                    onChange={(e) => setCustomAddr({ ...customAddr, phone: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="subs-modal__field">
              <label>Moyen de paiement</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="wave">Wave</option>
                <option value="orange_money">Orange Money</option>
                <option value="cash">Especes a la livraison</option>
              </select>
            </div>

            <div className="subs-recap">
              <strong>{name}</strong> — {items.length} produit(s)<br />
              Tous les {frequency} jours · -{SUB_DISCOUNT_PCT}%<br />
              A payer par livraison : <strong>{fmtPrice(totals.total)}</strong>
            </div>

            {error && <div className="subs-error">{error}</div>}
          </div>
        )}

        <div className="subs-modal__foot">
          {step === 1 && (
            <>
              <button className="ghost" onClick={onClose}>Annuler</button>
              <button className="primary" disabled={!canNext1} onClick={() => setStep(2)}>Suivant</button>
            </>
          )}
          {step === 2 && (
            <>
              <button className="ghost" onClick={() => setStep(1)}>Retour</button>
              <button className="primary" disabled={!canNext2} onClick={() => setStep(3)}>Suivant</button>
            </>
          )}
          {step === 3 && (
            <>
              <button className="ghost" onClick={() => setStep(2)}>Retour</button>
              <button className="primary" disabled={!canSubmit || submitting} onClick={handleSubmit}>
                {submitting ? 'Creation...' : 'Confirmer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
