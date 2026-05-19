// src/components/SignedImage.jsx
// Wrapper <img> qui resout les URLs des buckets prives (skin-scans, delivery-proofs)
// vers des signed URLs valides 7 jours via getSignedStorageUrl().
//
// Usage : <SignedImage src={scan.image_url} alt="..." className="..." />
// Pour les URLs publiques classiques, comportement identique a un <img> normal.

import { useState, useEffect } from 'react';
import { getSignedStorageUrl } from '../lib/supabase';

export default function SignedImage({ src, alt = '', fallback = null, ...rest }) {
  const [resolvedSrc, setResolvedSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    if (!src) { setResolvedSrc(null); return; }
    (async () => {
      try {
        const url = await getSignedStorageUrl(src);
        if (!cancelled) setResolvedSrc(url || src);
      } catch {
        if (!cancelled) { setResolvedSrc(src); setError(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (error || !resolvedSrc) {
    if (fallback) return fallback;
    return null;
  }

  return <img src={resolvedSrc} alt={alt} onError={() => setError(true)} {...rest} />;
}
