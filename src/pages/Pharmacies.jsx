import { useState, useEffect, useMemo } from 'react';
import { useNav } from '../App';
import { getAllPharmacies } from '../lib/supabase';
import { usePersistedData } from '../lib/usePersistedData';
import { getUserPosition, sortByDistance, formatDistance } from '../lib/geo';
import TabBar from '../components/TabBar';
import './Pharmacies.css';

export default function Pharmacies() {
  const { navigate } = useNav();
  const [filter, setFilter] = useState('all');
  const [userPos, setUserPos] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | asking | granted | denied

  // FIX juin 2026 : usePersistedData → hydrate depuis cache module au remount,
  // évite le skeleton 1-3s au retour de navigation / foreground.
  const { data: pharmaciesData, loading } = usePersistedData(
    'pharmacies-all',
    async () => {
      const all = await getAllPharmacies();
      return all || [];
    },
    { ttl: 5 * 60 * 1000 }
  );
  const rawPharmacies = pharmaciesData || [];

  // ─── Géolocalisation silencieuse pour trier par distance (calque native) ───
  useEffect(() => {
    let cancelled = false;
    setGeoStatus('asking');
    getUserPosition(6000).then((pos) => {
      if (cancelled) return;
      if (pos) {
        setUserPos(pos);
        setGeoStatus('granted');
      } else {
        setGeoStatus('denied');
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Tri par distance + injection du label _distance sur chaque card (calque native)
  const pharmacies = useMemo(() => {
    if (!userPos || !rawPharmacies.length) return rawPharmacies;
    const enriched = rawPharmacies.map((p) => {
      if (!p.lat || !p.lng) return p;
      const km = sortByDistance([p], userPos.lat, userPos.lng)[0]?.distance;
      return { ...p, _distance: km != null && isFinite(km) ? formatDistance(km) : null };
    });
    return sortByDistance(enriched, userPos.lat, userPos.lng);
  }, [rawPharmacies, userPos]);

  // Status label (calque native : "Triées par distance · GPS actif" / "Localisation…" / etc.)
  const statusLabel =
    geoStatus === 'granted'  ? 'Triées par distance · GPS actif' :
    geoStatus === 'asking'   ? 'Localisation…' :
    geoStatus === 'denied'   ? 'Centre Dakar · localisation refusée' :
    `${pharmacies.length} partenaire${pharmacies.length > 1 ? 's' : ''}`;

  const cities = ['all', ...Array.from(new Set(pharmacies.map(p => p.city).filter(Boolean)))];
  const filtered = filter === 'all' ? pharmacies : pharmacies.filter(p => p.city === filter);

  const openDetail = (id) => {
    navigate({ name: 'pharmacy_detail', params: { id } });
  };

  return (
    <div className="ph-screen page-anim">
      <div className="ph-header">
        <button className="icon-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div>
          <h1>Pharmacies</h1>
          <p className={geoStatus === 'granted' ? 'ph-status ok' : 'ph-status'}>{statusLabel}</p>
        </div>
      </div>

      <div className="ph-filters">
        {cities.map(c => (
          <button
            key={c}
            className={'ph-filter ' + (filter === c ? 'active' : '')}
            onClick={() => setFilter(c)}
          >
            {c === 'all' ? 'Toutes' : c}
          </button>
        ))}
      </div>

      <div className="ph-scroll">
        {loading ? (
          /* PERF : skeleton qui simule 4 pharmacy cards au lieu d'un texte plat —
             réduit la perception du wait sur LTE Sénégal */
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={'sk-' + i} className="ph-card" style={{ opacity: 0.6 }}>
                <div className="ph-cover" style={{ background: 'linear-gradient(90deg, #eef3f0 0%, #f7faf8 50%, #eef3f0 100%)', backgroundSize: '200% 100%', animation: 'yaramShimmer 1.4s linear infinite' }} />
                <div className="ph-body">
                  <div style={{ width: '60%', height: 16, background: '#eef3f0', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ width: '40%', height: 12, background: '#eef3f0', borderRadius: 4 }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes yaramShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
          </>
        ) : (
          filtered.map(p => {
            const waUrl = p.whatsapp ? 'https://wa.me/' + p.whatsapp.replace(/\D/g, '') : null;
            return (
              <div 
                key={p.id} 
                className="ph-card" 
                onClick={() => openDetail(p.id)}
                style={{ cursor: 'pointer' }}
              >
                {p.cover && (
                  <div className="ph-cover" style={{backgroundImage: 'url(' + p.cover + ')'}}>
                    {p._distance && (
                      <span className="ph-distance-badge">{p._distance}</span>
                    )}
                    {Number(p.rating) > 0 && (
                      <span className="ph-rating-badge">
                        {Number(p.rating).toFixed(1)}
                        {p.review_count > 0 && <span className="rc"> ({p.review_count})</span>}
                      </span>
                    )}
                  </div>
                )}
                <div className="ph-body">
                  <div className="ph-head">
                    {p.logo && <img src={p.logo} alt={`Logo ${p.name}`} loading="lazy" decoding="async" className="ph-logo" />}
                    <div style={{flex: 1}}>
                      <h3>{p.name}</h3>
                      {p.tagline && <p className="ph-tagline">{p.tagline}</p>}
                      <div className="ph-meta">
                        {[p.neighborhood, p.city].filter(Boolean).join(' · ') || p.address || 'Sénégal'}
                      </div>
                      {p.hours && (
                        <div className="ph-hours">Ouvert {p.hours}</div>
                      )}
                    </div>
                  </div>

                  <div className="ph-cta-row">
                    {waUrl && (
                      <a
                        className="ph-wa"
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      className="ph-detail-cta"
                      onClick={(e) => { e.stopPropagation(); openDetail(p.id); }}
                    >
                      Voir détails
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div style={{height: 40}} />
      </div>
      <TabBar active="pharmacies" />
    </div>
  );
}