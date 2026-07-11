// ════════════════════════════════════════════════════════════════════
// PremiumConcierge.jsx — Personal Shopper Premium (route /premium/concierge)
// ════════════════════════════════════════════════════════════════════
// Abonnement 25 000 FCFA / mois. Pharmacien attitre, priorite livraison,
// echantillons mensuels, WhatsApp dedie, +10% de reduction.
// - Landing marketing si non abonne
// - Dashboard concierge + formulaire de requete si abonne
// Le paiement passe par le flow "subscribe & save" existant.
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav, useUser } from '../App';
import { toast } from '../lib/toast';
import { haptic } from '../lib/haptic';
import {
  CONCIERGE_MONTHLY_FEE_FCFA,
  CONCIERGE_PERKS,
  conciergeSubscribe,
  conciergeSendRequest,
  conciergeGetMyStatus,
} from '../lib/supabase';
import './PremiumConcierge.css';

const REQUEST_TYPES = [
  { value: 'product_recommendation', label: 'Reco produit' },
  { value: 'routine_custom', label: 'Routine sur mesure' },
  { value: 'samples', label: 'Echantillons ciblees' },
  { value: 'other', label: 'Autre demande' },
];

function BackButton({ onClick }) {
  return (
    <button type="button" className="pcc-back" onClick={onClick} aria-label="Retour">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      <span>Retour</span>
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

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

export default function PremiumConcierge() {
  const { navigate, goBack } = useNav();
  const { user } = useUser();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  const [reqType, setReqType] = useState('product_recommendation');
  const [reqMessage, setReqMessage] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus({ subscription: null, pharmacist: null, recent_requests: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const s = await conciergeGetMyStatus();
    setStatus(s);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const isSubscribed = useMemo(() => {
    const s = status?.subscription;
    if (!s) return false;
    if (s.status !== 'active') return false;
    // paid_until en future
    if (s.paid_until) {
      const until = new Date(s.paid_until + 'T23:59:59').getTime();
      if (Number.isFinite(until) && until < Date.now()) return false;
    }
    return true;
  }, [status]);

  const handleSubscribe = async () => {
    if (!user) {
      toast('Connecte-toi pour activer le concierge', 'info');
      navigate('auth');
      return;
    }
    setSubscribing(true);
    try {
      haptic('medium');
      const { data, error } = await conciergeSubscribe();
      if (error) throw new Error(error);
      toast('Abonnement Concierge active pour 30 jours');
      // Nota : ici on active immediatement en mode "scaffold". Le paiement
      // reel (25k FCFA) passera par le flow subscribe & save en integration
      // future avec un mode = 'concierge_subscription'.
      await refresh();
    } catch (e) {
      toast(e?.message || 'Impossible de souscrire', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  const handleSendRequest = async (e) => {
    e?.preventDefault?.();
    if (!reqMessage || reqMessage.trim().length < 3) {
      toast('Ecris un message plus detaille', 'error');
      return;
    }
    setSending(true);
    try {
      haptic('light');
      const { id, error } = await conciergeSendRequest(reqType, reqMessage.trim());
      if (error) throw new Error(error);
      setReqMessage('');
      toast('Demande envoyee au pharmacien');
      await refresh();
    } catch (e2) {
      toast(e2?.message || 'Erreur envoi', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pcc-page">
      <header className="pcc-topbar">
        <BackButton onClick={() => goBack('shop')} />
        <span className="pcc-topbar__title">Concierge Premium</span>
        <span className="pcc-topbar__spacer" />
      </header>

      {loading ? (
        <div className="pcc-loading">Chargement...</div>
      ) : isSubscribed ? (
        <SubscribedDashboard
          status={status}
          reqType={reqType}
          setReqType={setReqType}
          reqMessage={reqMessage}
          setReqMessage={setReqMessage}
          onSubmit={handleSendRequest}
          sending={sending}
        />
      ) : (
        <MarketingLanding
          onSubscribe={handleSubscribe}
          subscribing={subscribing}
        />
      )}
    </div>
  );
}

function MarketingLanding({ onSubscribe, subscribing }) {
  return (
    <>
      <section className="pcc-hero">
        <span className="pcc-hero__eyebrow">YARAM PREMIUM</span>
        <h1 className="pcc-hero__title">Ton pharmacien-conseil,<br />rien qu a toi.</h1>
        <p className="pcc-hero__lead">
          Un abonnement mensuel qui te connecte a un pharmacien attitre,
          te livre des echantillons chaque mois et te donne la priorite absolue.
        </p>
        <div className="pcc-hero__priceRow">
          <span className="pcc-hero__price">{fmtPrice(CONCIERGE_MONTHLY_FEE_FCFA)}</span>
          <span className="pcc-hero__priceUnit">/ mois</span>
        </div>
        <button
          type="button"
          className="pcc-cta"
          onClick={onSubscribe}
          disabled={subscribing}
        >
          {subscribing ? 'Activation...' : 'Activer mon Concierge'}
        </button>
        <p className="pcc-hero__note">Sans engagement. Resiliation en 1 clic.</p>
      </section>

      <section className="pcc-perks">
        <h2 className="pcc-section__title">Ce qui est inclus</h2>
        <ul className="pcc-perks__list">
          {CONCIERGE_PERKS.map((p) => (
            <li key={p.key} className="pcc-perk">
              <span className="pcc-perk__check"><CheckIcon /></span>
              <span>{p.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pcc-how">
        <h2 className="pcc-section__title">Comment ca marche</h2>
        <ol className="pcc-how__steps">
          <li>
            <span className="pcc-how__step">1</span>
            <div>
              <h3>Tu t abonnes en 1 clic</h3>
              <p>25 000 FCFA / mois. Prelevement automatique.</p>
            </div>
          </li>
          <li>
            <span className="pcc-how__step">2</span>
            <div>
              <h3>On t assigne un pharmacien</h3>
              <p>Ton pharmacien-conseil te contacte sur WhatsApp sous 24h.</p>
            </div>
          </li>
          <li>
            <span className="pcc-how__step">3</span>
            <div>
              <h3>Tu profites de tous les avantages</h3>
              <p>Priorite livraison, kit echantillons mensuel, reduction supplementaire.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="pcc-cta-final">
        <button type="button" className="pcc-cta pcc-cta--wide" onClick={onSubscribe} disabled={subscribing}>
          {subscribing ? 'Activation...' : `Activer pour ${fmtPrice(CONCIERGE_MONTHLY_FEE_FCFA)} / mois`}
        </button>
      </section>
    </>
  );
}

function SubscribedDashboard({ status, reqType, setReqType, reqMessage, setReqMessage, onSubmit, sending }) {
  const sub = status?.subscription;
  const pharm = status?.pharmacist;
  const requests = status?.recent_requests || [];

  return (
    <>
      <section className="pcc-dash__hero">
        <span className="pcc-badge pcc-badge--active">Concierge actif</span>
        <h1 className="pcc-dash__title">Bienvenue dans ton experience Premium</h1>
        <p className="pcc-dash__lead">
          Prolonge jusqu au <strong>{fmtDate(sub?.paid_until)}</strong>. Ton pharmacien-conseil est joignable a tout moment.
        </p>
      </section>

      {pharm ? (
        <section className="pcc-card">
          <h2 className="pcc-section__title">Ton pharmacien attitre</h2>
          <div className="pcc-pharm">
            <div className="pcc-pharm__avatar">{(pharm.name || 'P').slice(0, 1)}</div>
            <div className="pcc-pharm__info">
              <div className="pcc-pharm__name">{pharm.name || 'Pharmacien YARAM'}</div>
              {pharm.address ? <div className="pcc-pharm__meta">{pharm.address}</div> : null}
              {pharm.phone ? (
                <a
                  className="pcc-pharm__phone"
                  href={`tel:${pharm.phone}`}
                >
                  Appeler {pharm.phone}
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="pcc-card">
          <p>Ton pharmacien-conseil te sera assigne sous 24h.</p>
        </section>
      )}

      <section className="pcc-card">
        <h2 className="pcc-section__title">Nouvelle demande</h2>
        <form className="pcc-form" onSubmit={onSubmit}>
          <label className="pcc-label">
            <span>Type de demande</span>
            <select
              className="pcc-input"
              value={reqType}
              onChange={(e) => setReqType(e.target.value)}
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="pcc-label">
            <span>Message</span>
            <textarea
              className="pcc-input pcc-input--textarea"
              rows={4}
              value={reqMessage}
              onChange={(e) => setReqMessage(e.target.value)}
              placeholder="Ex: Je cherche une creme pour peau sensible sujette aux rougeurs"
            />
          </label>
          <button type="submit" className="pcc-cta pcc-cta--wide" disabled={sending}>
            {sending ? 'Envoi...' : 'Envoyer au pharmacien'}
          </button>
        </form>
      </section>

      <section className="pcc-card">
        <h2 className="pcc-section__title">Historique des demandes</h2>
        {requests.length === 0 ? (
          <p className="pcc-empty">Pas encore de demande envoyee.</p>
        ) : (
          <ul className="pcc-req-list">
            {requests.map((r) => (
              <li key={r.id} className="pcc-req">
                <div className="pcc-req__head">
                  <span className={`pcc-req__badge pcc-req__badge--${r.status}`}>
                    {r.status === 'open' ? 'En attente' : r.status === 'answered' ? 'Repondue' : r.status}
                  </span>
                  <span className="pcc-req__date">{fmtDate(r.created_at)}</span>
                </div>
                <p className="pcc-req__msg">{r.message}</p>
                {r.pharmacist_response ? (
                  <div className="pcc-req__answer">
                    <strong>Pharmacien :</strong> {r.pharmacist_response}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
