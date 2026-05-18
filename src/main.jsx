import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/theme'
import './index.css'
import App from './App.jsx'
import { loadSiteSettings, subscribeSettings } from './lib/supabase'

// ─── Splash inline : retire le bloc HTML pre-React avec un crossfade ───
// Le boot inline est defini dans index.html (#yaram-boot). On le marque .gone
// pour declencher le fade-out CSS (380ms), puis on le remove du DOM.
function hideBootSplash() {
  const el = document.getElementById('yaram-boot');
  if (!el) return;
  if (el.classList.contains('gone')) return;
  el.classList.add('gone');
  setTimeout(() => el.remove(), 400);
}
// Au cas où on veut le retirer manuellement plus tard
window.__yaramHideBoot = hideBootSplash;

// Load les site_settings en BG des le boot (commission, deliveryFee, couleurs…)
// Le rendu n'attend PAS : on a un fallback hardcode, donc l'app demarre instantanement
// et applique les vraies valeurs des qu'elles arrivent (via getCachedSetting).
loadSiteSettings().catch(() => { /* DB unavailable, keep fallback */ });

// Inject les couleurs en CSS variables des que les settings sont chargees.
// Cible les noms reels utilises dans src/index.css (--primary, --accent).
subscribeSettings((s) => {
  if (!s) return;
  const root = document.documentElement;
  if (s.primaryColor) root.style.setProperty('--primary', s.primaryColor);
  if (s.accentColor) root.style.setProperty('--accent', s.accentColor);
});

// Wrapper qui retire le splash inline une fois que l'app est montee.
// On attend 1 tick pour laisser React peindre le 1er frame puis on fade-out le boot.
function BootedApp() {
  useEffect(() => {
    // Si le splash React (SplashScreen) prend le relais, on retire l'inline tout de suite.
    // Si l'app affiche du contenu direct (user en cache, settings deja la), idem.
    const raf = requestAnimationFrame(() => {
      hideBootSplash();
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BootedApp />
  </StrictMode>,
)

// Fallback : si pour une raison X le wrapper ne se monte pas en 3s, on retire
// quand meme le splash pour ne pas bloquer l'utilisatrice.
setTimeout(hideBootSplash, 3000)