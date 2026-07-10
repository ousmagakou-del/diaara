// ════════════════════════════════════════════════════════════════════
// YARAM — HeroVideo
// ════════════════════════════════════════════════════════════════════
// Rend une video de fond editable depuis l admin. Lit une cle
// site_settings (ex: 'hero_video_url'), detecte le type d URL
// (YouTube ou fichier direct mp4/webm/mov) et rend l element correspondant.
// Fallback silencieux vers un fichier statique en cas d URL absente,
// invalide, ou d erreur de chargement.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSiteSettings } from '../lib/supabase';

// ─── Helpers de detection URL ────────────────────────────────────────
function detectVideoType(url) {
  if (!url) return 'none';
  if (/youtu\.be\/|youtube\.com\/(watch|embed|shorts)/i.test(url)) return 'youtube';
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return 'file';
  return 'file'; // par defaut on tente file (CDN sans extension explicite, etc.)
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&\?#\s\/]+)/i);
  return m ? m[1] : null;
}

// ─── Composant ───────────────────────────────────────────────────────
export default function HeroVideo({
  settingKey,
  fallbackSrc = '/hero-video.mp4',
  poster,
  className,
  directUrl,   // override facultatif (admin preview live sans passer par la DB)
}) {
  const [url, setUrl] = useState(() => {
    const d = typeof directUrl === 'string' ? directUrl.trim() : '';
    return d || fallbackSrc;
  });
  const [failed, setFailed] = useState(false);

  // Reset l etat d erreur si l URL fournie change
  useEffect(() => { setFailed(false); }, [directUrl, settingKey]);

  // Mode override direct : on suit le prop
  useEffect(() => {
    if (typeof directUrl === 'string') {
      const trimmed = directUrl.trim();
      setUrl(trimmed || fallbackSrc);
    }
  }, [directUrl, fallbackSrc]);

  // Mode DB : lecture site_settings via settingKey
  useEffect(() => {
    if (typeof directUrl === 'string' || !settingKey) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await getSiteSettings();
        if (cancelled) return;
        const raw = remote?.[settingKey];
        // Les valeurs sont stockees en JSONB - getSiteSettings les retourne
        // deja parsees. On accepte string ou tolere autre type.
        const candidate = typeof raw === 'string' ? raw.trim() : '';
        if (candidate && candidate !== fallbackSrc) {
          setUrl(candidate);
        }
      } catch {
        // silencieux : on garde le fallback
      }
    })();
    return () => { cancelled = true; };
  }, [settingKey, fallbackSrc, directUrl]);

  const type = useMemo(() => detectVideoType(failed ? fallbackSrc : url), [url, failed, fallbackSrc]);
  const ytId = useMemo(() => (type === 'youtube' ? extractYouTubeId(url) : null), [type, url]);

  const containerStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
  };

  // Sizing du iframe YouTube en effet cover base sur les dimensions du conteneur
  // (fonctionne aussi en preview 300x170 dans l admin).
  const wrapRef = useRef(null);
  const [ytDims, setYtDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (type !== 'youtube' || failed) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const compute = (cw, ch) => {
      if (!cw || !ch) return;
      const targetAr = 16 / 9;
      const cAr = cw / ch;
      if (cAr > targetAr) {
        // conteneur plus large : la largeur pilote
        setYtDims({ w: cw, h: cw / targetAr });
      } else {
        // conteneur plus haut : la hauteur pilote
        setYtDims({ w: ch * targetAr, h: ch });
      }
    };
    compute(el.offsetWidth, el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) compute(e.contentRect.width, e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [type, failed]);

  // YouTube iframe cover : iframe centre, dimensionne pour couvrir le conteneur
  if (type === 'youtube' && ytId && !failed) {
    const src =
      `https://www.youtube-nocookie.com/embed/${ytId}` +
      `?autoplay=1&mute=1&loop=1&playlist=${ytId}` +
      `&controls=0&modestbranding=1&playsinline=1` +
      `&showinfo=0&disablekb=1&rel=0&iv_load_policy=3&fs=0`;
    return (
      <div ref={wrapRef} className={className} style={containerStyle} aria-hidden="true">
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width:  ytDims.w ? `${ytDims.w}px` : '100%',
            height: ytDims.h ? `${ytDims.h}px` : '100%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <iframe
            src={src}
            title="Hero video"
            frameBorder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen={false}
            onError={() => setFailed(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  // Fichier direct (ou fallback apres erreur)
  const fileSrc = failed ? fallbackSrc : url;
  return (
    <div ref={wrapRef} className={className} style={containerStyle} aria-hidden="true">
      <video
        key={fileSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        onError={() => {
          if (fileSrc !== fallbackSrc) setFailed(true);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      >
        <source src={fileSrc} />
      </video>
    </div>
  );
}
