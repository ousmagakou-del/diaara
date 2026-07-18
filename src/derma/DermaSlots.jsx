// ════════════════════════════════════════════════════════════════
// DermaSlots — gestion des créneaux visio du dermato
//  Ajout bulk (pick day + heures multiselect) + delete
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { dermaGetSlots, dermaSetSlots, dermaDeleteSlot, formatDateTimeFr } from '../lib/dermato';

const HOURS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];

export default function DermaSlots() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedHours, setSelectedHours] = useState([]);
  const [duration, setDuration] = useState(15);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await dermaGetSlots();
      const list = res?.slots || (Array.isArray(res) ? res : []);
      setSlots(list.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
    } catch (e) {
      console.warn('[DermaSlots] load', e?.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleHour = (h) => {
    setSelectedHours((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  };

  const submit = async () => {
    if (!day || selectedHours.length === 0) return;
    setSaving(true);
    try {
      const newSlots = selectedHours.map((h) => {
        const startsAt = new Date(`${day}T${h}:00`);
        const endsAt = new Date(startsAt.getTime() + duration * 60000);
        return {
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_min: duration,
          slot_type: 'video',
        };
      });
      await dermaSetSlots(newSlots);
      setSelectedHours([]);
      await load();
    } catch (e) {
      alert('Erreur : ' + (e?.message || ''));
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce créneau ?')) return;
    try {
      await dermaDeleteSlot(id);
      await load();
    } catch (e) {
      alert('Erreur : ' + (e?.message || ''));
    }
  };

  const futureSlots = slots.filter((s) => new Date(s.starts_at).getTime() > Date.now());
  const groups = {};
  futureSlots.forEach((s) => {
    const key = new Date(s.starts_at).toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return (
    <>
      <div className="drm-page-h">
        <div>
          <h1>Créneaux visio</h1>
          <p>{futureSlots.length} créneau{futureSlots.length > 1 ? 'x' : ''} à venir · Ajoute ou supprime en un clic</p>
        </div>
      </div>

      <div className="drm-card">
        <h2>Ajouter des créneaux</h2>
        <p className="sub">Choisis un jour puis clique sur les heures à ouvrir. Durée = temps standard visio.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 12 }}>
          <div className="drm-field" style={{ marginBottom: 0 }}>
            <label>Jour</label>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="drm-field" style={{ marginBottom: 0 }}>
            <label>Durée</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Heures ({selectedHours.length} sélectionnées)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
            {HOURS.map((h) => {
              const sel = selectedHours.includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHour(h)}
                  style={{
                    padding: '10px 6px',
                    border: `1.5px solid ${sel ? '#1F8B4C' : 'var(--y-n-300)'}`,
                    background: sel ? '#1F8B4C' : 'white',
                    color: sel ? 'white' : 'var(--y-n-800)',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        <button
          className="drm-btn drm-btn-primary"
          disabled={saving || selectedHours.length === 0}
          onClick={submit}
        >
          {saving ? 'Enregistrement…' : `Créer ${selectedHours.length} créneau${selectedHours.length > 1 ? 'x' : ''}`}
        </button>
      </div>

      <div className="drm-card">
        <h2>Mes créneaux à venir</h2>
        {loading ? (
          <p style={{ color: 'var(--y-n-600)' }}>Chargement…</p>
        ) : Object.keys(groups).length === 0 ? (
          <p style={{ color: 'var(--y-n-600)', fontSize: 13 }}>Aucun créneau. Ajoute-en pour permettre aux patients de réserver une visio.</p>
        ) : (
          Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => (
            <div key={date} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--y-n-800)' }}>
                {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="drm-slots-cal">
                {list.map((s) => (
                  <div key={s.id} className="drm-slot-cell">
                    <div>
                      <strong>{new Date(s.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
                      <span>{s.duration_min || 15} min · {s.is_booked ? 'Réservé' : 'Libre'}</span>
                    </div>
                    {!s.is_booked && (
                      <button onClick={() => remove(s.id)}>Suppr.</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
