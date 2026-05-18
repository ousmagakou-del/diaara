// src/lib/useOrderAlerts.js
// Écoute en temps réel les nouvelles commandes pour une pharmacie,
// joue un son ding (decroissant, pas en continu) et affiche une notif
// navigateur tant qu'il y a des commandes en attente non traitees.

import { useEffect, useRef, useState, useCallback } from 'react';
import { getPharmacyOrders } from './supabase';

const PENDING_STATUSES = ['paid', 'awaiting_confirm', 'awaiting_cash', 'pending'];

// URL d'un son court "ding" en base64 (Web Audio) — on génère un beep doux 880Hz
// Pour éviter une dépendance externe, on synthétise via AudioContext
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Bip à 2 tons (ding-dong) pour être reconnaissable
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.18);
    });
    // Ferme le context après pour libérer
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch (e) {
    // pas critique, juste pas de son
  }
}

function showSystemNotification(pendingCount) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification('🔔 Commande YARAM en attente', {
      body: `${pendingCount} commande${pendingCount > 1 ? 's' : ''} à traiter`,
      tag: 'yaram-pending', // remplace l'ancienne si déjà affichée
      requireInteraction: false,
    });
    setTimeout(() => n.close(), 6000);
  } catch (e) {
    // ignore
  }
}

export function useOrderAlerts(pharmacyId) {
  const [pendingCount, setPendingCount] = useState(0);
  // Mute initial depuis localStorage
  const [muted, setMutedState] = useState(() => {
    try { return localStorage.getItem('yaram-pharma-mute') === '1'; } catch { return false; }
  });
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const knownIdsRef = useRef(new Set());
  // Ref sur muted pour eviter de resubscribe a chaque toggle
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Persistance mute
  const setMuted = useCallback((v) => {
    setMutedState(v);
    try { localStorage.setItem('yaram-pharma-mute', v ? '1' : '0'); } catch {}
  }, []);

  // Demande la permission pour les notifs navigateur (à appeler depuis un onClick)
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const p = await Notification.requestPermission();
    setNotifPermission(p);
    return p;
  }, []);

  // Charge le nombre initial de commandes en attente
  // -> on utilise getPharmacyOrders qui filtre correctement (assigned + items)
  const refresh = useCallback(async () => {
    if (!pharmacyId) return;
    try {
      const orders = await getPharmacyOrders(pharmacyId, PENDING_STATUSES);
      const ids = (orders || []).map(o => o.id);
      knownIdsRef.current = new Set(ids);
      setPendingCount(ids.length);
    } catch (e) {
      // silencieux : la pharmacie n'est juste pas mise a jour cette fois
    }
  }, [pharmacyId]);

  // Polling 10s (vague 12 RLS : le realtime sur orders ne fonctionne plus
  // car la policy SELECT a ete restreinte. On detecte les nouvelles commandes
  // via diff entre le snapshot precedent et le nouveau snapshot).
  useEffect(() => {
    if (!pharmacyId) return;

    refresh();

    const tick = async () => {
      try {
        const orders = await getPharmacyOrders(pharmacyId, PENDING_STATUSES);
        const newIds = new Set((orders || []).map(o => o.id));
        // Detecter nouveaux ids non vus avant
        let appeared = 0;
        newIds.forEach(id => { if (!knownIdsRef.current.has(id)) appeared++; });
        knownIdsRef.current = newIds;
        setPendingCount(newIds.size);
        if (appeared > 0 && !mutedRef.current) {
          playDing();
          showSystemNotification(newIds.size);
        }
      } catch { /* silencieux */ }
    };

    const poll = setInterval(tick, 10000);
    return () => clearInterval(poll);
  }, [pharmacyId, refresh]);

  // Ding decroissant tant qu'il y a des commandes en attente et non mute.
  // Schedule : 8s, 30s, 60s, 120s, 240s puis stop (max 5 rappels apres le 1er).
  // Si une nouvelle commande arrive, le schedule reset automatiquement (effet relance).
  useEffect(() => {
    if (pendingCount <= 0 || muted) return;

    const SCHEDULE = [8000, 30000, 60000, 120000, 240000]; // ms
    let reminderCount = 0;
    let timeoutId = null;

    const scheduleNext = () => {
      if (reminderCount >= SCHEDULE.length) return; // stop apres 5 rappels
      const delay = SCHEDULE[reminderCount];
      timeoutId = setTimeout(() => {
        // Re-check au moment du tick au cas ou le state a change
        if (!mutedRef.current) {
          playDing();
        }
        reminderCount++;
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pendingCount, muted]);

  return {
    pendingCount,
    muted,
    setMuted,
    notifPermission,
    requestNotificationPermission,
    testDing: playDing,
  };
}
