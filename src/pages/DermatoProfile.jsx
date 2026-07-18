// ════════════════════════════════════════════════════════════════
// DermatoProfile — /dermato/:slug
// Profil détaillé d'un dermatologue + créneaux + CTA
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNav } from '../App';
import { getDermatologistDetail, formatFcfa, formatTimeFr } from '../lib/dermato';
import './Dermato.css';

function groupSlotsByDay(slots) {
  const groups = {};
  for (const s of slots || []) {
    if (!s.starts_at) continue;
    const d = new Date(s.starts_at);
    const key = d.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      label: new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      slots: list.sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at)),
    }));
}

function Star({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#F4B53A' : 'none'} stroke={filled ? '#F4B53A' : 'var(--y-n-400, #C0C0B8)'} strokeWidth="1.5">
      <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5 12 2"/>
    </svg>
  );
}

export default function DermatoProfile() {
  const { navigate, goBack, route } = useNav();
  const slug = route?.params?.slug;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      try {
        const d = await getDermatologistDetail(slug);
        // La RPC peut retourner { dermatologist, slots } ou l'objet direct
        setData(d?.dermatologist ? d : { dermatologist: d, slots: d?.slots || [] });
      } catch (e) {
        setError(e?.message || 'Erreur de chargement');
      }
      setLoading(false);
    })();
  }, [slug]);

  const derm = data?.dermatologist || null;
  const slots = data?.slots || derm?.slots || [];
  const daysGroups = useMemo(() => groupSlotsByDay(slots.filter(s => !s.is_booked)), [slots]);

  const bookAsync = () => navigate({ name: 'dermato_book', params: { slug, type: 'async' } });
  const bookVideo = (slotId) => navigate({ name: 'dermato_book', params: { slug, type: 'video', slot_id: slotId } });

  if (loading) {
    return (
      <div className="derm-page">
        <div className="derm-topbar">
          <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="derm-topbar-title">Chargement…</div>
        </div>
      </div>
    );
  }

  if (error || !derm) {
    return (
      <div className="derm-page">
        <div className="derm-topbar">
          <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="derm-topbar-title">Dermatologue introuvable</div>
        </div>
        <div className="derm-empty">
          <h3>Nous n'avons pas trouvé ce dermatologue</h3>
          <p>{error || 'Ce profil n\'existe pas ou n\'est plus disponible.'}</p>
          <button className="derm-btn-primary" style={{ maxWidth: 260, margin: '0 auto' }} onClick={() => navigate({ name: 'dermato_landing' })}>
            Voir tous les dermatologues
          </button>
        </div>
      </div>
    );
  }

  const rating = Number(derm.rating || derm.avg_rating || 0);
  const nReviews = Number(derm.review_count || derm.n_reviews || 0);

  return (
    <div className="derm-page">
      <div className="derm-topbar">
        <button className="derm-topbar-back" onClick={goBack} aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="derm-topbar-title">Dr {derm.full_name}</div>
      </div>

      {/* HERO */}
      <div className="derm-profile-hero">
        <div className="derm-profile-hero-inner">
          {derm.photo_url ? (
            <img src={derm.photo_url} alt={derm.full_name} className="derm-profile-photo" />
          ) : (
            <div className="derm-doc-photo-fallback" style={{ width: 200, height: 200, fontSize: 80, borderRadius: 24, margin: 0 }}>
              {(derm.full_name || 'D').charAt(0)}
            </div>
          )}
          <div>
            <div className="derm-profile-name">Dr {derm.full_name}</div>
            <div className="derm-profile-spec">{derm.speciality || 'Dermatologie & Vénérologie'}</div>
            {rating > 0 && (
              <div className="derm-profile-rating">
                {[1,2,3,4,5].map(i => <Star key={i} filled={i <= Math.round(rating)} />)}
                <span style={{ marginLeft: 6, fontWeight: 700 }}>{rating.toFixed(1)}</span>
                <span style={{ marginLeft: 4, color: 'var(--y-n-600)' }}>({nReviews} avis)</span>
              </div>
            )}
            <div className="derm-profile-meta">
              {derm.years_exp ? `${derm.years_exp} ans d'expérience` : 'Dermatologue diplômée'} · {derm.city || 'Dakar, Sénégal'}
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="derm-profile-body">
        {/* MAIN */}
        <div className="derm-profile-main">
          <h3>À propos</h3>
          <p>{derm.bio || 'Dermatologue diplômée avec plusieurs années d\'expérience en dermatologie clinique et esthétique. Prise en charge de l\'acné, eczéma, taches, chute de cheveux et pathologies de la peau noire.'}</p>

          {derm.clinic_name && (
            <div className="derm-profile-clinic">
              <strong>Cabinet — {derm.clinic_name}</strong>
              <span>{derm.clinic_address || derm.city || 'Dakar'}</span>
            </div>
          )}

          <h3>Choisis ton type de consultation</h3>
          <div className="derm-price-cards">
            <button className="derm-price-card" onClick={bookAsync}>
              <div className="derm-price-card-tag">Envoi photos</div>
              <h4>Consultation express</h4>
              <div className="derm-price-value">{formatFcfa(derm.price_async_fcfa || 3000)}</div>
              <p>Envoie tes photos + description. Réponse et ordonnance en moins de 2h.</p>
            </button>
            <button className="derm-price-card" onClick={() => {
              // Scroll to slots
              document.getElementById('derm-slots-side')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              <div className="derm-price-card-tag">Consultation vidéo</div>
              <h4>Visio 20 min</h4>
              <div className="derm-price-value">{formatFcfa(derm.price_video_fcfa || 10000)}</div>
              <p>Rendez-vous en visio à l'horaire de ton choix. Écran partagé + ordonnance.</p>
            </button>
          </div>
        </div>

        {/* SIDE : SLOTS */}
        <aside id="derm-slots-side" className="derm-slots-side">
          <h3>Créneaux visio disponibles</h3>
          {daysGroups.length === 0 ? (
            <div className="derm-slot-empty">
              Aucun créneau visio pour l'instant. Choisis la consultation express.
            </div>
          ) : (
            daysGroups.slice(0, 5).map(g => (
              <div key={g.date} className="derm-slots-day">
                <div className="derm-slots-day-label">{g.label}</div>
                <div className="derm-slots-grid">
                  {g.slots.map(s => (
                    <button
                      key={s.id}
                      className="derm-slot-btn"
                      onClick={() => bookVideo(s.id)}
                      title={formatTimeFr(s.starts_at)}
                    >
                      {formatTimeFr(s.starts_at)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </aside>
      </div>
    </div>
  );
}
