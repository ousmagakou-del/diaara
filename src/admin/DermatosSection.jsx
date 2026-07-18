// ════════════════════════════════════════════════════════════════
// Admin — DermatosSection : CRUD dermatologues
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { getAdminToken } from '../lib/adminAuth';
import {
  adminListDermatologists,
  adminCreateDermatologist,
  adminUpdateDermatologist,
  formatFcfa,
} from '../lib/dermato';

const EMPTY = {
  full_name: '',
  email: '',
  phone: '',
  whatsapp: '',
  photo_url: '',
  bio: '',
  speciality: 'Dermatologie & Vénérologie',
  ordre_num: '',
  ninea: '',
  clinic_name: '',
  clinic_address: '',
  city: 'Dakar',
  years_exp: '',
  price_async_fcfa: 3000,
  price_video_fcfa: 10000,
  video_duration_min: 15,
  commission_pct: 20,
  is_verified: false,
  is_active: true,
};

export default function DermatosSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [pin, setPin] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      if (!token) { setError('Session admin requise'); setLoading(false); return; }
      const res = await adminListDermatologists(token);
      const list = res?.dermatologists || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (e) {
      setError('Erreur : ' + (e?.message || ''));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setEditing({ ...EMPTY });
    setPin('');
    setCreating(true);
    setError('');
  };
  const startEdit = (d) => {
    setEditing({ ...d });
    setResetPin('');
    setCreating(false);
    setError('');
  };
  const cancel = () => { setEditing(null); setCreating(false); setPin(''); setResetPin(''); setError(''); };

  const save = async () => {
    if (!editing) return;
    setError('');
    if (!editing.full_name || !editing.email || !editing.phone) {
      setError('Nom, email et téléphone requis');
      return;
    }
    if (creating && (!pin || pin.length < 4)) {
      setError('PIN 4-6 chiffres requis pour un nouveau dermato');
      return;
    }
    setSaving(true);
    try {
      const token = getAdminToken();
      const payload = { ...editing };
      // Cast numériques
      ['price_async_fcfa', 'price_video_fcfa', 'video_duration_min', 'commission_pct', 'years_exp'].forEach((k) => {
        if (payload[k] !== '' && payload[k] != null) payload[k] = Number(payload[k]);
      });

      if (creating) {
        const res = await adminCreateDermatologist(token, payload, pin);
        if (res?.success === false) throw new Error(res.error || 'Échec création');
      } else {
        const res = await adminUpdateDermatologist(token, editing.id, payload, resetPin || null);
        if (res?.success === false) throw new Error(res.error || 'Échec update');
      }
      await load();
      cancel();
    } catch (e) {
      setError('Erreur : ' + (e?.message || ''));
    }
    setSaving(false);
  };

  const toggleActive = async (d) => {
    try {
      const token = getAdminToken();
      await adminUpdateDermatologist(token, d.id, { is_active: !d.is_active });
      await load();
    } catch (e) {
      alert('Erreur : ' + (e?.message || ''));
    }
  };
  const toggleVerified = async (d) => {
    try {
      const token = getAdminToken();
      await adminUpdateDermatologist(token, d.id, { is_verified: !d.is_verified });
      await load();
    } catch (e) {
      alert('Erreur : ' + (e?.message || ''));
    }
  };

  return (
    <div className="adm-section">
      <div className="adm-section-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Dermatologues</h1>
          <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>{items.length} dermatologues enregistrés · gère les profils et les tarifs</p>
        </div>
        <button
          onClick={startCreate}
          style={{ padding: '10px 18px', background: '#1F8B4C', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
        >
          + Nouveau dermato
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#FDECEA', color: '#D9342B', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7280' }}>Chargement…</p>
      ) : items.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#FAFAF7', borderRadius: 12, color: '#6B7280' }}>
          Aucun dermatologue. Clique "+ Nouveau dermato" pour commencer.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {items.map((d) => (
            <div key={d.id} style={{ background: 'white', border: '1px solid #EEEDE8', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                {d.photo_url ? (
                  <img src={d.photo_url} alt={d.full_name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #1F8B4C, #0E5B33)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>
                    {(d.full_name || 'D').charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Dr {d.full_name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ padding: '3px 9px', background: d.is_active ? '#EAF7F0' : '#FDECEA', color: d.is_active ? '#1F8B4C' : '#D9342B', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                  {d.is_active ? 'Actif' : 'Inactif'}
                </span>
                {d.is_verified && (
                  <span style={{ padding: '3px 9px', background: '#EAF3FE', color: '#0066CC', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                    Vérifié
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 10 }}>
                Chat {formatFcfa(d.price_async_fcfa)} · Visio {formatFcfa(d.price_video_fcfa)}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => startEdit(d)} style={{ flex: 1, padding: '8px 12px', background: '#1F8B4C', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Modifier
                </button>
                <button onClick={() => toggleActive(d)} style={{ padding: '8px 12px', background: 'white', border: '1px solid #EEEDE8', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {d.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => toggleVerified(d)} style={{ padding: '8px 12px', background: 'white', border: '1px solid #EEEDE8', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {d.is_verified ? 'Retirer vérif' : 'Vérifier'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL create/edit */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 16, maxWidth: 720, width: '100%', padding: 24, margin: '40px 0' }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{creating ? 'Nouveau dermatologue' : `Modifier ${editing.full_name}`}</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Remplis les infos, tarifs et statut du profil.</p>

            {error && (
              <div style={{ padding: 10, background: '#FDECEA', color: '#D9342B', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <FormField label="Nom complet *"        value={editing.full_name}      onChange={(v) => setEditing({ ...editing, full_name: v })} />
              <FormField label="Email *"              value={editing.email}          onChange={(v) => setEditing({ ...editing, email: v })} />
              <FormField label="Téléphone *"          value={editing.phone}          onChange={(v) => setEditing({ ...editing, phone: v })} />
              <FormField label="WhatsApp"             value={editing.whatsapp}       onChange={(v) => setEditing({ ...editing, whatsapp: v })} />
              <FormField label="Photo URL"            value={editing.photo_url}      onChange={(v) => setEditing({ ...editing, photo_url: v })} />
              <FormField label="Spécialité"           value={editing.speciality}     onChange={(v) => setEditing({ ...editing, speciality: v })} />
              <FormField label="N° Ordre des Médecins" value={editing.ordre_num}     onChange={(v) => setEditing({ ...editing, ordre_num: v })} />
              <FormField label="NINEA"                value={editing.ninea}          onChange={(v) => setEditing({ ...editing, ninea: v })} />
              <FormField label="Cabinet"              value={editing.clinic_name}    onChange={(v) => setEditing({ ...editing, clinic_name: v })} />
              <FormField label="Adresse cabinet"      value={editing.clinic_address} onChange={(v) => setEditing({ ...editing, clinic_address: v })} />
              <FormField label="Ville"                value={editing.city}           onChange={(v) => setEditing({ ...editing, city: v })} />
              <FormField label="Années d'expérience"  value={editing.years_exp}      onChange={(v) => setEditing({ ...editing, years_exp: v })} type="number" />
              <FormField label="Prix chat async (F)"  value={editing.price_async_fcfa} onChange={(v) => setEditing({ ...editing, price_async_fcfa: v })} type="number" />
              <FormField label="Prix visio (F)"       value={editing.price_video_fcfa} onChange={(v) => setEditing({ ...editing, price_video_fcfa: v })} type="number" />
              <FormField label="Durée visio (min)"    value={editing.video_duration_min} onChange={(v) => setEditing({ ...editing, video_duration_min: v })} type="number" />
              <FormField label="Commission YARAM (%)" value={editing.commission_pct} onChange={(v) => setEditing({ ...editing, commission_pct: v })} type="number" />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', display: 'block', marginBottom: 6 }}>Bio</label>
              <textarea
                value={editing.bio || ''}
                onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                style={{ width: '100%', padding: 10, border: '1.5px solid #E5E4DC', borderRadius: 10, minHeight: 80, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Actif (visible côté patient)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={!!editing.is_verified} onChange={(e) => setEditing({ ...editing, is_verified: e.target.checked })} />
                Vérifié
              </label>
            </div>

            {creating ? (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', display: 'block', marginBottom: 6 }}>PIN initial (4-6 chiffres) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  style={{ width: 180, padding: 10, border: '1.5px solid #E5E4DC', borderRadius: 10, letterSpacing: '0.15em', textAlign: 'center', fontSize: 15 }}
                />
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', display: 'block', marginBottom: 6 }}>Reset PIN (optionnel)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Nouveau PIN"
                  style={{ width: 180, padding: 10, border: '1.5px solid #E5E4DC', borderRadius: 10, letterSpacing: '0.15em', textAlign: 'center', fontSize: 15 }}
                />
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Laisse vide pour ne pas changer.</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={cancel} style={{ flex: 1, padding: 12, background: 'white', border: '1.5px solid #E5E4DC', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: 12, background: '#1F8B4C', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Enregistrement…' : creating ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: 10, border: '1.5px solid #E5E4DC', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
      />
    </div>
  );
}
