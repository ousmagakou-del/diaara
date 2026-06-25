import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import Livreur from '../Livreur';

/**
 * DriverDelivery
 * ---------------
 * Vue détail d'une livraison depuis l'app driver authentifiée.
 *
 * Stratégie : on récupère le delivery_token de l'order via la RPC
 * `driver_get_order` (gatée par le session token), puis on monte le
 * composant <Livreur /> existant (2700 LOC de UX premium DoorDash-style
 * avec pickup card, delivery card, sourcing Instacart, signature, PIN,
 * timeline, GPS, etc.) en y attachant le token comme query param.
 *
 * Avantage : 100% de réutilisation de la logique Livreur, aucun fork.
 * Toute amélioration future sur Livreur.jsx bénéficie automatiquement
 * au driver flow.
 */
export default function DriverDelivery({ session, orderId, onBack }) {
  const [resolvedToken, setResolvedToken] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.token || !orderId) {
        setErr('Paramètres manquants');
        return;
      }
      try {
        const { data, error } = await supabase.rpc('driver_get_order', {
          p_token: session.token,
          p_order_id: orderId,
        });
        if (cancelled) return;
        if (error) {
          console.error('[DriverDelivery] RPC error:', error);
          setErr('Erreur réseau. Réessaie.');
          return;
        }
        if (!data?.success) {
          const code = data?.error || 'unknown';
          if (code === 'not_assigned') setErr('Cette commande ne t\'est pas assignée.');
          else if (code === 'order_not_found') setErr('Commande introuvable.');
          else if (code === 'invalid_session') setErr('Session expirée.');
          else setErr('Impossible de charger cette livraison.');
          return;
        }
        const tk = data.tracking?.delivery_token;
        if (!tk) {
          setErr('Lien de livraison absent — contacte l\'admin.');
          return;
        }
        // Injecte ?livreur=TOKEN dans l'URL et monte Livreur en remount complet.
        const newUrl = `${window.location.pathname}?livreur=${tk}`;
        window.history.replaceState({}, '', newUrl);
        setResolvedToken(tk);
      } catch (e) {
        console.error('[DriverDelivery] fatal:', e);
        if (!cancelled) setErr('Erreur inattendue.');
      }
    })();
    return () => { cancelled = true; };
  }, [session?.token, orderId]);

  if (err) {
    return (
      <div className="dvr-page">
        <div className="dvr-card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{err}</div>
          <button className="dvr-btn dvr-btn-ghost" onClick={onBack} style={{ marginTop: 20 }}>
            ← Retour au dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!resolvedToken) {
    return (
      <div className="dvr-page">
        <div className="dvr-skel" style={{ height: 200, marginBottom: 12 }} />
        <div className="dvr-skel" style={{ height: 160, marginBottom: 12 }} />
        <div className="dvr-skel" style={{ height: 240 }} />
      </div>
    );
  }

  return (
    <div className="dvr-detail-frame" key={resolvedToken}>
      {/* Bouton retour flottant en haut à gauche, par-dessus Livreur */}
      <button
        onClick={() => {
          // Nettoie l'URL pour ne pas rester sur le token
          window.history.replaceState({}, '', '/driver');
          onBack?.();
        }}
        aria-label="Retour"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: 12,
          zIndex: 100,
          width: 40,
          height: 40,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.96)',
          border: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <Livreur />
    </div>
  );
}
