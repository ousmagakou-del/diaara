// src/lib/sentry.js
// Initialisation Sentry monitoring d'erreurs prod.
// Aucune dependance npm si VITE_SENTRY_DSN n'est pas defini → pas d'overhead.
//
// Pour activer en prod :
//   1. Crée un compte gratuit sur https://sentry.io (5000 événements/mois free)
//   2. Crée un projet React → copie le DSN (https://xxx@xxx.ingest.sentry.io/xxx)
//   3. Ajoute VITE_SENTRY_DSN=https://... dans Cloudflare Pages → Settings → Env vars
//   4. Redeploie
//
// Sans DSN, ce module ne fait rien (production-safe).

let initialized = false;
let SentrySDK = null;

export async function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // Pas de DSN configure : on skippe completement (pas d'import dynamique
    // donc le bundle Sentry n'est meme pas téléchargé).
    return;
  }

  try {
    // Import dynamique : Sentry ne s'ajoute au bundle que si DSN actif
    SentrySDK = await import('@sentry/browser');
    SentrySDK.init({
      dsn,
      environment: import.meta.env.MODE || 'production',
      // Sample 100% des erreurs (5000/mois suffisent pour debut)
      sampleRate: 1.0,
      // Traces : 10% pour pas spammer
      tracesSampleRate: 0.1,
      // Ne pas envoyer les erreurs en dev
      enabled: import.meta.env.MODE === 'production',
      // Filtre les erreurs benignes
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Erreurs reseau classiques utilisateur offline
        'NetworkError',
        'Failed to fetch',
        'Load failed',
        // Extensions navigateur
        'top.GLOBALS',
        // Bots
        /^Non-Error promise rejection captured/,
      ],
      // Anonymise les donnees sensibles avant envoi
      beforeSend(event) {
        // Strip toute donnee potentiellement PII des breadcrumbs
        if (event.request?.cookies) delete event.request.cookies;
        if (event.user) {
          // Garde juste l'id, vire email/ip
          event.user = { id: event.user.id };
        }
        return event;
      },
    });
    initialized = true;
    console.log('✓ Sentry initialise');
  } catch (e) {
    console.warn('Sentry init failed (ok en dev sans @sentry/browser):', e.message);
  }
}

// Helper pour logger manuellement
export function captureException(error, context = {}) {
  if (!SentrySDK) return;
  try {
    SentrySDK.captureException(error, { extra: context });
  } catch { /* ignore */ }
}

export function captureMessage(message, level = 'info') {
  if (!SentrySDK) return;
  try {
    SentrySDK.captureMessage(message, level);
  } catch { /* ignore */ }
}
