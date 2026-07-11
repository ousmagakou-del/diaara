// ════════════════════════════════════════════════════════════════
// YARAM — Merchant Onboarding Wizard (Pharmacie 48h go-live)
// URL : /merchant/onboarding/:applicationId
// ════════════════════════════════════════════════════════════════
// Wizard multi-etapes public (aucune auth requise, indexe sur
// application_id UUID) qui pilote une pharmacie de la candidature
// signee jusqu au go-live.
// ════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import SiteLayout from '../components/SiteLayout';
import { toast } from '../lib/toast';
import './MerchantOnboarding.css';

const KYC_DOCS = [
  { key: 'ninea',             label: 'NINEA',                 desc: 'Numero d Identification National des Entreprises et Associations' },
  { key: 'rccm',              label: 'RCCM',                  desc: 'Registre du Commerce et du Credit Mobilier' },
  { key: 'id_gerant',         label: 'CNI du gerant',         desc: 'Piece d identite recto verso du pharmacien titulaire' },
  { key: 'licence_pharmacie', label: 'Licence pharmacie',     desc: 'Attestation Ordre des Pharmaciens du Senegal' },
];

const STEPS = [
  { id: 'welcome',        label: 'Bienvenue' },
  { id: 'kyc',            label: 'Documents' },
  { id: 'contract',       label: 'Contrat' },
  { id: 'catalogue',      label: 'Catalogue' },
  { id: 'payment',        label: 'Paiement' },
  { id: 'go_live',        label: 'Recap' },
];

export default function MerchantOnboarding({ applicationId: propId }) {
  const applicationId = useMemo(() => {
    if (propId) return propId;
    try {
      const path = window.location.pathname;
      const m = path.match(/\/merchant\/onboarding\/([^\/?#]+)/);
      return m ? m[1] : null;
    } catch { return null; }
  }, [propId]);

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('welcome');

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('merchant_get_onboarding_progress', {
      p_application_id: applicationId,
    });
    setLoading(false);
    if (error || !data?.success) {
      setError(data?.error || error?.message || 'Onboarding introuvable');
      return;
    }
    setError(null);
    setSnapshot(data);
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);

  // Auto-avance sur l etape suivante
  useEffect(() => {
    if (!snapshot) return;
    const p = snapshot.progress || {};
    if (p.step_live) { setCurrentStep('go_live'); return; }
    if (!p.step_kyc_uploaded) setCurrentStep('kyc');
    else if (!p.step_kyc_verified) setCurrentStep('kyc');
    else if (!p.step_contract_signed) setCurrentStep('contract');
    else if (!p.step_catalogue_approved) setCurrentStep('catalogue');
    else if (!p.step_payment_setup) setCurrentStep('payment');
    else setCurrentStep('go_live');
  }, [snapshot?.next_step]);

  if (!applicationId) {
    return (
      <SiteLayout>
        <div className="mo-error">
          <h1>Lien invalide</h1>
          <p>L identifiant de candidature est manquant. Contacte notre equipe commerciale via WhatsApp au <a href="https://wa.me/221774388766">+221 77 438 87 66</a>.</p>
        </div>
      </SiteLayout>
    );
  }

  if (loading && !snapshot) {
    return (
      <SiteLayout>
        <div className="mo-loading"><div className="mo-spinner" /> Chargement de ton dossier...</div>
      </SiteLayout>
    );
  }

  if (error) {
    return (
      <SiteLayout>
        <div className="mo-error">
          <h1>Onboarding introuvable</h1>
          <p>{error}. Contacte-nous : <a href="https://wa.me/221774388766">WhatsApp +221 77 438 87 66</a>.</p>
        </div>
      </SiteLayout>
    );
  }

  const progress = snapshot.progress || {};
  const doneCount = [
    progress.step_kyc_verified,
    progress.step_contract_signed,
    progress.step_catalogue_approved,
    progress.step_payment_setup,
    progress.step_live,
  ].filter(Boolean).length;
  const totalSteps = 5;
  const pct = Math.round((doneCount / totalSteps) * 100);

  return (
    <SiteLayout>
      <div className="mo-wrap">
        <header className="mo-hero">
          <div className="mo-eyebrow">Onboarding partenaire</div>
          <h1>{snapshot.application?.pharmacy_name || 'Bienvenue'}</h1>
          <p className="mo-lead">
            Suis les 5 etapes ci-dessous. Un commercial YARAM verifie chaque etape en moins de
            24h ouvrees. Objectif : ta premiere commande dans 48h.
          </p>

          <div className="mo-progress">
            <div className="mo-progress-bar">
              <div className="mo-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="mo-progress-label">{doneCount} / {totalSteps} etapes validees</div>
          </div>

          <nav className="mo-tabs">
            {STEPS.map(s => (
              <button
                key={s.id}
                className={`mo-tab ${currentStep === s.id ? 'is-active' : ''}`}
                onClick={() => setCurrentStep(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mo-main">
          {currentStep === 'welcome' && (
            <StepWelcome snapshot={snapshot} onNext={() => setCurrentStep('kyc')} />
          )}
          {currentStep === 'kyc' && (
            <StepKYC snapshot={snapshot} onReload={load} onNext={() => setCurrentStep('contract')} />
          )}
          {currentStep === 'contract' && (
            <StepContract snapshot={snapshot} onReload={load} onNext={() => setCurrentStep('catalogue')} />
          )}
          {currentStep === 'catalogue' && (
            <StepCatalogue snapshot={snapshot} onReload={load} onNext={() => setCurrentStep('payment')} />
          )}
          {currentStep === 'payment' && (
            <StepPayment snapshot={snapshot} onReload={load} onNext={() => setCurrentStep('go_live')} />
          )}
          {currentStep === 'go_live' && (
            <StepGoLive snapshot={snapshot} onReload={load} />
          )}
        </main>
      </div>
    </SiteLayout>
  );
}

// ─── STEP 1 : Welcome ──────────────────────────────────────────────
function StepWelcome({ snapshot, onNext }) {
  const app = snapshot.application || {};
  return (
    <div className="mo-card">
      <div className="mo-card-eyebrow">Etape 1 sur 5</div>
      <h2>Salut {app.owner_name || 'Docteur'} !</h2>
      <p>
        Bienvenue dans l espace d onboarding partenaire YARAM. Cette page te guide
        pas a pas jusqu au go-live de ta pharmacie sur la plateforme. Tu peux fermer
        cet onglet et revenir plus tard : ton avancement est sauvegarde
        automatiquement.
      </p>
      <ul className="mo-checklist">
        <li>1. Depose 4 documents KYC (NINEA, RCCM, CNI, licence)</li>
        <li>2. Signe le contrat de partenariat (envoye par email)</li>
        <li>3. Importe ton catalogue produit (CSV ou Excel)</li>
        <li>4. Renseigne ton numero Wave pour reception paiement</li>
        <li>5. Go live : ta pharmacie apparait dans l app YARAM</li>
      </ul>
      <button className="mo-btn-primary" onClick={onNext}>Demarrer</button>
    </div>
  );
}

// ─── STEP 2 : KYC ──────────────────────────────────────────────────
function StepKYC({ snapshot, onReload, onNext }) {
  const app = snapshot.application || {};
  const docs = snapshot.docs || [];
  const docByType = useMemo(() => {
    const m = {};
    for (const d of docs) {
      if (!m[d.doc_type] || new Date(d.uploaded_at) > new Date(m[d.doc_type].uploaded_at)) {
        m[d.doc_type] = d;
      }
    }
    return m;
  }, [docs]);

  const [uploading, setUploading] = useState(null);

  const uploadDoc = async (docType, file) => {
    if (!file) return;
    setUploading(docType);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${app.id}/${docType}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('merchant-kyc')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: rpc, error: rpcErr } = await supabase.rpc('merchant_upload_kyc', {
        p_application_id: app.id,
        p_doc_type: docType,
        p_file_url: path,
      });
      if (rpcErr || !rpc?.success) throw new Error(rpc?.error || rpcErr?.message);
      toast.success('Document televerse');
      onReload();
    } catch (e) {
      toast.error('Erreur : ' + (e.message || 'upload echoue'));
    } finally {
      setUploading(null);
    }
  };

  const allUploaded = KYC_DOCS.every(d => docByType[d.key]);
  const allApproved = KYC_DOCS.every(d => docByType[d.key]?.status === 'approved');

  return (
    <div className="mo-card">
      <div className="mo-card-eyebrow">Etape 2 sur 5</div>
      <h2>Documents KYC</h2>
      <p>Depose les 4 pieces suivantes. Formats acceptes : PDF, JPG, PNG (10 Mo max).</p>

      <div className="mo-docs">
        {KYC_DOCS.map(spec => {
          const doc = docByType[spec.key];
          const status = doc?.status;
          return (
            <div key={spec.key} className={`mo-doc-row status-${status || 'empty'}`}>
              <div className="mo-doc-info">
                <div className="mo-doc-title">{spec.label}</div>
                <div className="mo-doc-desc">{spec.desc}</div>
                {status === 'approved' && <div className="mo-badge mo-badge-ok">Approuve</div>}
                {status === 'pending_review' && <div className="mo-badge mo-badge-warn">En revue</div>}
                {status === 'rejected' && (
                  <div className="mo-badge mo-badge-err">
                    Rejete : {doc.rejection_reason || 'a refaire'}
                  </div>
                )}
              </div>
              <div className="mo-doc-action">
                <label className="mo-file-btn">
                  {uploading === spec.key ? 'Envoi...' : doc ? 'Remplacer' : 'Televerser'}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    hidden
                    disabled={uploading === spec.key}
                    onChange={e => uploadDoc(spec.key, e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {allUploaded && !allApproved && (
        <div className="mo-info-box">
          Documents recus. L equipe YARAM valide sous 24h ouvrees.
        </div>
      )}
      {allApproved && (
        <div className="mo-info-box mo-info-ok">
          Tous les documents sont approuves.
          <button className="mo-btn-primary" onClick={onNext}>Continuer</button>
        </div>
      )}
    </div>
  );
}

// ─── STEP 3 : Contrat ──────────────────────────────────────────────
function StepContract({ snapshot, onReload, onNext }) {
  const sig = snapshot.signature;
  const app = snapshot.application || {};
  const progress = snapshot.progress || {};

  if (!sig) {
    return (
      <div className="mo-card">
        <div className="mo-card-eyebrow">Etape 3 sur 5</div>
        <h2>Contrat de partenariat</h2>
        <p>
          Ton contrat n a pas encore ete envoye. Il est envoye automatiquement par l equipe
          YARAM des que les documents KYC sont valides. Reviens ici quand tu recois l email
          de signature.
        </p>
        {!progress.step_kyc_verified && (
          <div className="mo-info-box mo-info-warn">
            En attente de la validation KYC.
          </div>
        )}
      </div>
    );
  }

  const isSigned = sig.status === 'signed';
  const signUrl = `/sign/${sig.token}`;

  return (
    <div className="mo-card">
      <div className="mo-card-eyebrow">Etape 3 sur 5</div>
      <h2>Contrat de partenariat</h2>
      <p>Contrat : <strong>Contrat partenariat Pharmacie</strong></p>
      <p>Envoye a : <strong>{app.email || 'ton email'}</strong></p>

      {isSigned ? (
        <>
          <div className="mo-info-box mo-info-ok">
            Contrat signe le {new Date(sig.signed_at).toLocaleDateString('fr-FR')}.
          </div>
          <button className="mo-btn-primary" onClick={onNext}>Etape suivante</button>
        </>
      ) : (
        <>
          <div className="mo-info-box mo-info-warn">
            Statut : <strong>{sig.status || 'envoye'}</strong>. Signe le contrat en 2 minutes.
          </div>
          <a className="mo-btn-primary" href={signUrl} target="_blank" rel="noopener noreferrer">
            Signer maintenant
          </a>
          <button className="mo-btn-ghost" style={{ marginLeft: 12 }} onClick={onReload}>
            J ai signe - rafraichir
          </button>
        </>
      )}
    </div>
  );
}

// ─── STEP 4 : Catalogue ────────────────────────────────────────────
function StepCatalogue({ snapshot, onReload, onNext }) {
  const app = snapshot.application || {};
  const cat = snapshot.catalogue;
  const [uploading, setUploading] = useState(false);

  const uploadCatalogue = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${app.id}/catalogue-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('merchant-catalogue')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: rpc, error: rpcErr } = await supabase.rpc('merchant_upload_catalogue', {
        p_application_id: app.id,
        p_file_url: path,
      });
      if (rpcErr || !rpc?.success) throw new Error(rpc?.error || rpcErr?.message);

      // Trigger parse-catalogue edge function (fire-and-forget)
      supabase.functions.invoke('parse-catalogue', {
        body: { import_id: rpc.import_id, file_url: path },
      }).catch(() => {});

      toast.success('Catalogue televerse - analyse en cours');
      // Poll for status update
      setTimeout(onReload, 3000);
    } catch (e) {
      toast.error('Erreur : ' + (e.message || 'upload echoue'));
    } finally {
      setUploading(false);
    }
  };

  const isApproved = cat?.status === 'approved';
  const isReady    = cat?.status === 'ready_review' || cat?.status === 'partial';
  const isProcessing = cat?.status === 'processing';

  return (
    <div className="mo-card">
      <div className="mo-card-eyebrow">Etape 4 sur 5</div>
      <h2>Import catalogue produits</h2>
      <p>
        Depose ton catalogue au format CSV ou Excel. Colonnes attendues :
        <code> name, brand, category, price, description, image_url, stock</code>.
        Un modele est disponible sur demande.
      </p>

      <div className="mo-uploader">
        <label className="mo-file-drop">
          {uploading ? 'Envoi...' : cat ? 'Remplacer le fichier' : 'Choisir un fichier CSV ou Excel'}
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            disabled={uploading}
            onChange={e => uploadCatalogue(e.target.files?.[0])}
          />
        </label>
        <a
          className="mo-link"
          href="data:text/csv;charset=utf-8,name,brand,category,price,description,image_url,stock%0AParacetamol 500mg,UPSA,Douleur,1500,Boite 20 comprimes,,50"
          download="modele_catalogue_yaram.csv"
        >
          Telecharger le modele CSV
        </a>
      </div>

      {cat && (
        <div className="mo-catalogue-status">
          <div className="mo-catalogue-stats">
            <StatBlock label="Lignes total"    value={cat.rows_total || 0} />
            <StatBlock label="Lignes valides"  value={cat.rows_valid || 0} accent="ok" />
            <StatBlock label="Erreurs"         value={(cat.rows_errors?.length || 0)} accent={cat.rows_errors?.length ? 'err' : 'ok'} />
            <StatBlock label="Statut"          value={cat.status || 'processing'} />
          </div>

          {isProcessing && (
            <div className="mo-info-box mo-info-warn">
              Analyse en cours... <button className="mo-btn-ghost" onClick={onReload}>Rafraichir</button>
            </div>
          )}
          {isReady && (
            <div className="mo-info-box">
              Import pret pour revue. L equipe YARAM valide et publie le catalogue sous 24h.
            </div>
          )}
          {isApproved && (
            <div className="mo-info-box mo-info-ok">
              Catalogue publie. <button className="mo-btn-primary" onClick={onNext}>Continuer</button>
            </div>
          )}

          {Array.isArray(cat.rows_errors) && cat.rows_errors.length > 0 && (
            <details className="mo-details">
              <summary>Voir les {cat.rows_errors.length} erreur(s)</summary>
              <ul>
                {cat.rows_errors.slice(0, 30).map((e, i) => (
                  <li key={i}>
                    Ligne {e.row} {e.name ? `(${e.name})` : ''} : {(e.errors || []).join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STEP 5 : Paiement ─────────────────────────────────────────────
function StepPayment({ snapshot, onReload, onNext }) {
  const app = snapshot.application || {};
  const progress = snapshot.progress || {};
  const [wave, setWave] = useState(progress.payment_wave_number || app.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc('merchant_setup_payment', {
      p_application_id: app.id,
      p_wave_number: wave,
    });
    setSaving(false);
    if (error || !data?.success) {
      toast.error('Erreur : ' + (data?.error || error?.message || ''));
      return;
    }
    toast.success('Numero Wave enregistre');
    onReload();
  };

  return (
    <div className="mo-card">
      <div className="mo-card-eyebrow">Etape 5 sur 5</div>
      <h2>Reception paiement Wave</h2>
      <p>
        Renseigne le numero Wave sur lequel tu veux recevoir tes reglements chaque vendredi.
        Le paiement est verse net de la commission YARAM (5%).
      </p>

      <div className="mo-form-field">
        <label>Numero Wave receveur</label>
        <input
          type="tel"
          value={wave}
          onChange={e => setWave(e.target.value)}
          placeholder="+221 XX XXX XX XX"
        />
      </div>

      <button className="mo-btn-primary" onClick={save} disabled={saving || !wave}>
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>

      {progress.step_payment_setup && (
        <div className="mo-info-box mo-info-ok" style={{ marginTop: 20 }}>
          Numero Wave enregistre.
          <button className="mo-btn-primary" onClick={onNext}>Continuer</button>
        </div>
      )}
    </div>
  );
}

// ─── STEP 6 : Go Live ──────────────────────────────────────────────
function StepGoLive({ snapshot, onReload }) {
  const app = snapshot.application || {};
  const p = snapshot.progress || {};
  const [launching, setLaunching] = useState(false);

  const requirements = [
    { ok: p.step_kyc_verified,      label: 'Documents KYC approuves' },
    { ok: p.step_contract_signed,   label: 'Contrat signe' },
    { ok: p.step_catalogue_approved,label: 'Catalogue publie' },
    { ok: p.step_payment_setup,     label: 'Paiement Wave configure' },
  ];
  const allOk = requirements.every(r => r.ok);

  const goLive = async () => {
    setLaunching(true);
    const { data, error } = await supabase.rpc('merchant_go_live', {
      p_application_id: app.id,
    });
    setLaunching(false);
    if (error || !data?.success) {
      toast.error('Impossible : ' + (data?.error || error?.message || ''));
      return;
    }
    toast.success('Ta pharmacie est LIVE');
    onReload();
  };

  if (p.step_live) {
    return (
      <div className="mo-card mo-card-live">
        <div className="mo-live-badge">LIVE</div>
        <h2>Felicitations {app.pharmacy_name}</h2>
        <p>Ta pharmacie est en ligne sur YARAM. Les premieres commandes arrivent sous 48h.</p>
        <ul className="mo-checklist">
          <li>Tu recois les commandes par email et SMS (numero : {app.phone})</li>
          <li>Reglement chaque vendredi sur Wave</li>
          <li>Support commercial 7j/7 sur WhatsApp +221 77 438 87 66</li>
        </ul>
        <a className="mo-btn-primary" href="/">Retour a l accueil</a>
      </div>
    );
  }

  return (
    <div className="mo-card">
      <div className="mo-card-eyebrow">Recap final</div>
      <h2>Pret pour le go-live ?</h2>
      <p>Verifie que toutes les etapes sont completes puis clique sur GO LIVE.</p>

      <ul className="mo-checklist mo-req-list">
        {requirements.map((r, i) => (
          <li key={i} className={r.ok ? 'ok' : 'todo'}>
            <span className="mo-req-check">{r.ok ? 'OK' : 'TODO'}</span> {r.label}
          </li>
        ))}
      </ul>

      <button className="mo-btn-primary mo-btn-live" onClick={goLive} disabled={!allOk || launching}>
        {launching ? 'Lancement...' : 'GO LIVE'}
      </button>
      {!allOk && (
        <p className="mo-hint">Complete d abord les etapes restantes.</p>
      )}
    </div>
  );
}

function StatBlock({ label, value, accent }) {
  return (
    <div className={`mo-stat ${accent ? `mo-stat-${accent}` : ''}`}>
      <div className="mo-stat-val">{value}</div>
      <div className="mo-stat-lbl">{label}</div>
    </div>
  );
}
