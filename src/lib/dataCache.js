// ═══════════════════════════════════════════════════
// YARAM — Cache léger pour données Supabase
// ═══════════════════════════════════════════════════
// Stratégie : stale-while-revalidate
//   1. Si data en cache et fresh (<TTL) → renvoie tout de suite
//   2. Si data en cache mais stale → renvoie le stale + fetch en BG
//   3. Si pas de cache → fetch
//
// Cache : Map en mémoire (rapide) + localStorage (persiste après reload)
// ═══════════════════════════════════════════════════

const memCache = new Map(); // { key: { data, time } }

const LS_PREFIX = 'yaram_cache_';

// Default TTL = 5 minutes (le temps de la pause typique)
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Wrapper autour d'une fonction async qui ajoute un cache stale-while-revalidate
 *
 * @param {string} key - identifiant unique du cache
 * @param {Function} fetchFn - fonction async qui charge la data (ex: getAllProducts)
 * @param {Object} opts
 * @param {number} opts.ttl - durée de fraîcheur en ms (défaut 5min)
 * @param {boolean} opts.persistLS - sauve aussi dans localStorage (défaut true)
 *
 * @returns {Promise<any>} data fraîche ou stale (instantané si cache hit)
 */
export async function cachedFetch(key, fetchFn, opts = {}) {
  const ttl = opts.ttl ?? DEFAULT_TTL;
  const persistLS = opts.persistLS !== false;

  // 1. Check memory cache
  const memHit = memCache.get(key);
  if (memHit && (Date.now() - memHit.time) < ttl) {
    return memHit.data;
  }

  // 2. Check localStorage cache (si persist activé)
  if (persistLS && !memHit) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (Date.now() - parsed.time) < ttl) {
          // Hydrate la memCache + renvoie
          memCache.set(key, parsed);
          // Fire-and-forget : refresh en BG pour la prochaine fois
          refreshInBackground(key, fetchFn, persistLS);
          return parsed.data;
        }
      }
    } catch {}
  }

  // 3. Si stale mais on a du data → renvoie le stale + refresh BG
  if (memHit) {
    refreshInBackground(key, fetchFn, persistLS);
    return memHit.data;
  }

  // 4. Pas de cache du tout → fetch direct (premier load)
  const data = await fetchFn();
  saveToCache(key, data, persistLS);
  return data;
}

function refreshInBackground(key, fetchFn, persistLS) {
  // Async, ne bloque pas
  setTimeout(() => {
    fetchFn().then(data => saveToCache(key, data, persistLS)).catch(() => {});
  }, 100);
}

function saveToCache(key, data, persistLS) {
  const entry = { data, time: Date.now() };
  memCache.set(key, entry);
  if (persistLS) {
    try {
      const json = JSON.stringify(entry);
      // Limite à 1 MB par entrée pour éviter de saturer localStorage
      if (json.length < 1024 * 1024) {
        localStorage.setItem(LS_PREFIX + key, json);
      }
    } catch (e) {
      // localStorage plein ou erreur → ignore silencieusement
    }
  }
}

/** Invalide une clé de cache spécifique (à appeler après mutation) */
export function invalidateCache(key) {
  memCache.delete(key);
  try { localStorage.removeItem(LS_PREFIX + key); } catch {}
}

/** Vide tout le cache YARAM */
export function clearAllCache() {
  memCache.clear();
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
    });
  } catch {}
}

/** Version sans cache, force fetch frais */
export async function freshFetch(key, fetchFn, opts = {}) {
  const persistLS = opts.persistLS !== false;
  const data = await fetchFn();
  saveToCache(key, data, persistLS);
  return data;
}
