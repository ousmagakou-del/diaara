// ════════════════════════════════════════════════════════════════════
// Subscriptions.jsx — routines Subscribe & Save (route /subscriptions)
// ════════════════════════════════════════════════════════════════════
// Liste des abonnements de l utilisateur, actions Pause / Skip / Modifier
// items / Annuler, CTA "Nouvel abonnement".
// ════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { useNav, useUser } from '../App';
import SiteLayout from '../components/SiteLayout';
import {
  listMySubscriptions,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  updateSubscriptionNextDelivery,
  computeSubscriptionTotal,
  FREQUENCY_OPTIONS,
  SUB_DISCOUNT_PCT,
} from '../lib/supabase';
import { toast, confirmDialog } from '../lib/toast';
import { haptic } from '../lib/haptic';
import SubscribeWizard from '../components/SubscribeWizard';
import './Subscriptions.css';

const fmtPrice = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};

function StatusBadge({ status }) {
  const label = status === 'active' ? 'Actif' : status === 'paused' ? 'En pause' : 'Annule';
  const cls = `sub-card__badge sub-card__badge--${status}`;
  return <span className={cls}>{label}</span>;
}

function frequencyLabel(days) {
  const opt = FREQUENCY_OPTIONS.find((o) => o.value === days);
  if (opt) return opt.label;
  return `Tous les ${days} jours`;
}

export default function Subscriptions() {
  const { navigate, route } = useNav();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listMySubscriptions();
    setSubs(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('auth');
      return;
    }
    refresh();
  }, [user, refresh, navigate]);

  // Open wizard automatique si route params.newFor
  useEffect(() => {
    if (route?.params?.new) setWizardOpen(true);
  }, [route?.params?.new]);

  const handlePause = async (sub) => {
    try {
      haptic('light');
      await pauseSubscription(sub.id);
      toast('Abonnement mis en pause');
      refresh();
    } catch (e) {
      toast(e?.message || 'Erreur pause', 'error');
    }
  };

  const handleResume = async (sub) => {
    try {
      haptic('light');
      await resumeSubscription(sub.id);
      toast('Abonnement repris');
      refresh();
    } catch (e) {
      toast(e?.message || 'Erreur reprise', 'error');
    }
  };

  const handleSkip = async (sub) => {
    try {
      haptic('light');
      const newDate = await updateSubscriptionNextDelivery(sub.id, sub.frequency_days);
      toast(`Prochaine livraison : ${fmtDate(newDate)}`);
      refresh();
    } catch (e) {
      toast(e?.message || 'Erreur skip', 'error');
    }
  };

  const handleCancel = async (sub) => {
    const ok = await confirmDialog({
      title: 'Annuler cet abonnement ?',
      message: `${sub.name} ne sera plus livre automatiquement.`,
      confirmLabel: 'Annuler',
      cancelLabel: 'Retour',
      danger: true,
    });
    if (!ok) return;
    try {
      await cancelSubscription(sub.id);
      toast('Abonnement annule');
      refresh();
    } catch (e) {
      toast(e?.message || 'Erreur annulation', 'error');
    }
  };

  return (
    <SiteLayout>
      <div className="subs-page">
        <div className="subs-header">
          <div>
            <h1>Mes abonnements</h1>
            <p>Routines livrees automatiquement avec {SUB_DISCOUNT_PCT}% de reduction</p>
          </div>
          <button
            className="subs-cta-new"
            onClick={() => { haptic('light'); setWizardOpen(true); }}
          >
            Nouvel abonnement
          </button>
        </div>

        <div className="subs-hero-pitch">
          <h2>Subscribe &amp; Save</h2>
          <p>
            Recois ta routine automatiquement tous les 30, 60 ou 90 jours.
            {' '}Economise {SUB_DISCOUNT_PCT}% sur chaque livraison et modifie ou pause en 1 clic.
          </p>
        </div>

        {loading ? (
          <div className="subs-empty">
            <p>Chargement...</p>
          </div>
        ) : subs.length === 0 ? (
          <div className="subs-empty">
            <h2>Aucun abonnement</h2>
            <p>Commence par creer une routine que tu recevras automatiquement.</p>
            <button className="subs-cta-new" onClick={() => setWizardOpen(true)}>
              Creer ma routine
            </button>
          </div>
        ) : (
          <div className="subs-list">
            {subs.map((sub) => {
              const items = sub.items || [];
              const { raw, discount, total } = computeSubscriptionTotal(items, sub.discount_pct || SUB_DISCOUNT_PCT);
              const isActive = sub.status === 'active';
              const isPaused = sub.status === 'paused';
              const isCancelled = sub.status === 'cancelled';
              return (
                <div key={sub.id} className="sub-card">
                  <div className="sub-card__head">
                    <div>
                      <h3 className="sub-card__title">{sub.name}</h3>
                      <div className="sub-card__meta">
                        {frequencyLabel(sub.frequency_days)}
                        {' · '}
                        Prochaine livraison : {fmtDate(sub.next_delivery_at)}
                      </div>
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>

                  <div className="sub-card__items">
                    {items.slice(0, 6).map((it, i) => (
                      <div key={i} className="sub-card__item">
                        <span>{it.name} x{it.qty || 1}</span>
                        <span>{fmtPrice(Number(it.price || 0) * Number(it.qty || 1))}</span>
                      </div>
                    ))}
                    {items.length > 6 && (
                      <div className="sub-card__item"><span>+ {items.length - 6} autres produits</span></div>
                    )}
                  </div>

                  <div className="sub-card__totals">
                    <div>
                      <div className="sub-card__save">Economie : {fmtPrice(discount)}</div>
                      <div className="sub-card__meta">Sans reduction : {fmtPrice(raw)}</div>
                    </div>
                    <div className="sub-card__total">{fmtPrice(total)}</div>
                  </div>

                  {!isCancelled && (
                    <div className="sub-card__actions">
                      {isActive && (
                        <>
                          <button onClick={() => handleSkip(sub)}>Sauter la prochaine</button>
                          <button onClick={() => handlePause(sub)}>Mettre en pause</button>
                        </>
                      )}
                      {isPaused && (
                        <button className="primary" onClick={() => handleResume(sub)}>Reprendre</button>
                      )}
                      <button className="danger" onClick={() => handleCancel(sub)}>Annuler</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {wizardOpen && (
          <SubscribeWizard
            onClose={() => setWizardOpen(false)}
            onSuccess={() => { setWizardOpen(false); refresh(); }}
            initialItems={route?.params?.items || null}
            initialName={route?.params?.name || null}
          />
        )}
      </div>
    </SiteLayout>
  );
}
