import { useState, useRef, useEffect } from 'react';
import { useNav } from '../App';
import { haptic } from '../lib/haptic';
import { scoreClass } from '../lib/utils';
import './Scan.css';

const SKIN_DIAGNOSTICS = [
  { skinType: 'mixte', score: 78, concerns: ['Brillance zone T', 'Quelques imperfections'], recommendations: 'Sérum niacinamide + nettoyant doux' },
  { skinType: 'sèche', score: 72, concerns: ['Déshydratation', 'Tiraillements'], recommendations: 'Acide hyaluronique + crème riche' },
  { skinType: 'grasse', score: 75, concerns: ['Pores dilatés', 'Acné légère'], recommendations: 'BHA + niacinamide' },
  { skinType: 'normale', score: 88, concerns: ['Bonne hydratation'], recommendations: 'Routine maintenance + SPF' },
];

export default function Scan() {
  const { navigate } = useNav();
  const [mode, setMode] = useState('choice'); // choice | face | barcode | result
  const [stream, setStream] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [barcodeResult, setBarcodeResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const startCamera = async (facingMode = 'user') => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch (err) {
      alert('Caméra non disponible : ' + err.message);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const startFaceScan = async () => {
    setMode('face');
    await startCamera('user');
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;
    haptic('medium');
    setAnalyzing(true);

    // Capture frame
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    // Simulation IA (3 sec)
    await new Promise(r => setTimeout(r, 2500));

    const diag = SKIN_DIAGNOSTICS[Math.floor(Math.random() * SKIN_DIAGNOSTICS.length)];
    setResult(diag);
    stopCamera();
    setAnalyzing(false);
    setMode('result');
    haptic('success');
  };

  const startBarcodeScan = async () => {
    if (!('BarcodeDetector' in window)) {
      alert('Scanner code-barres non supporté sur ce navigateur. Utilise Chrome ou un mobile récent.');
      return;
    }
    setMode('barcode');
    await startCamera('environment');

    const detector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'],
    });

    const scan = async () => {
      if (!videoRef.current || mode !== 'barcode') return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          haptic('success');
          setBarcodeResult(codes[0].rawValue);
          stopCamera();
          return;
        }
      } catch (e) {}
      requestAnimationFrame(scan);
    };

    setTimeout(scan, 500);
  };

  const reset = () => {
    stopCamera();
    setMode('choice');
    setResult(null);
    setBarcodeResult(null);
    setAnalyzing(false);
  };

  // ─────────────────────── RENDER

  if (mode === 'choice') {
    return (
      <div className="scan-screen page-anim">
        <div className="scan-header">
          <button className="icon-back-btn" onClick={() => navigate('/')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <h1>Scanner</h1>
        </div>
        <div className="scan-choice-content">
          <button className="scan-choice-card" onClick={startFaceScan}>
            <div className="scan-choice-icon">✨</div>
            <h3>Analyse IA de ta peau</h3>
            <p>Prends-toi en selfie, l'IA détecte ton type de peau et te recommande des produits</p>
          </button>

          <button className="scan-choice-card" onClick={startBarcodeScan}>
            <div className="scan-choice-icon">📷</div>
            <h3>Scanner un code-barres</h3>
            <p>Pointe vers un produit pour voir son score et savoir s'il te convient</p>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'face') {
    return (
      <div className="scan-camera-screen">
        <video ref={videoRef} className="scan-video" autoPlay playsInline muted />
        <canvas ref={canvasRef} style={{display: 'none'}} />

        {analyzing ? (
          <div className="scan-analyzing">
            <div className="scan-spinner" />
            <h2>Analyse en cours...</h2>
            <p>L'IA évalue ton type de peau, ton phototype et tes préoccupations</p>
          </div>
        ) : (
          <>
            <div className="scan-overlay">
              <div className="scan-circle" />
              <p>Centre ton visage dans le cercle</p>
            </div>
            <div className="scan-controls">
              <button className="scan-cancel" onClick={reset}>Annuler</button>
              <button className="scan-capture" onClick={captureAndAnalyze} />
              <div style={{width: 70}} />
            </div>
          </>
        )}
      </div>
    );
  }

  if (mode === 'barcode') {
    return (
      <div className="scan-camera-screen">
        <video ref={videoRef} className="scan-video" autoPlay playsInline muted />
        {barcodeResult ? (
          <div className="scan-result-overlay">
            <h2>📦 Code détecté</h2>
            <p style={{fontFamily: 'monospace', fontSize: 18, margin: '12px 0'}}>{barcodeResult}</p>
            <p style={{fontSize: 13, opacity: 0.8}}>Produit non trouvé dans notre base. Demande-le à une pharmacie partenaire !</p>
            <button className="btn-primary" onClick={reset} style={{marginTop: 20, maxWidth: 260}}>Scanner un autre →</button>
          </div>
        ) : (
          <>
            <div className="scan-overlay">
              <div className="scan-barcode-frame" />
              <p>Pointe vers le code-barres</p>
            </div>
            <div className="scan-controls">
              <button className="scan-cancel" onClick={reset}>Annuler</button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (mode === 'result' && result) {
    const sc = scoreClass(result.score);
    return (
      <div className="scan-screen page-anim">
        <div className="scan-header">
          <button className="icon-back-btn" onClick={reset}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <h1>Diagnostic peau</h1>
        </div>

        <div className="scan-result-content">
          <div className={'scan-result-score ' + sc}>
            <div className="scan-score-num">{result.score}</div>
            <div className="scan-score-lbl">/100</div>
          </div>

          <h2>Peau {result.skinType}</h2>
          <p className="scan-result-desc">Voici ce que notre IA a détecté :</p>

          <div className="scan-result-section">
            <h3>🔍 Préoccupations détectées</h3>
            {result.concerns.map((c, i) => (
              <div key={i} className="scan-concern">• {c}</div>
            ))}
          </div>

          <div className="scan-result-section">
            <h3>💡 Recommandations</h3>
            <p>{result.recommendations}</p>
          </div>

          <button className="btn-primary" onClick={() => navigate('/')} style={{marginTop: 24}}>
            Voir les produits adaptés →
          </button>
        </div>
      </div>
    );
  }

  return null;
}