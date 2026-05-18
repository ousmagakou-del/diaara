import { useState } from 'react';
import { updateProfile } from '../lib/supabase';
import { haptic } from '../lib/haptic';
import { toast } from '../lib/toast';
import './SkinQuiz.css';

const STEPS = [
  {
    id: 'skin_type',
    question: 'Comment qualifierais-tu ta peau ?',
    sub: 'Au quotidien, comment elle se comporte',
    options: [
      { value: 'mixte', label: 'Mixte', icon: '🌗', desc: 'Brille zone T, normale sur joues' },
      { value: 'grasse', label: 'Grasse', icon: '✨', desc: 'Brillante, pores visibles' },
      { value: 'sèche', label: 'Sèche', icon: '🌵', desc: 'Tire, parfois rugueuse' },
      { value: 'normale', label: 'Normale', icon: '🌟', desc: 'Équilibrée, peu de soucis' },
      { value: 'sensible', label: 'Sensible', icon: '🌸', desc: 'Rougit, réagit aux produits' },
    ],
  },
  {
    id: 'skin_phototype',
    question: 'Quelle est ta carnation ?',
    sub: 'Pour adapter les SPF et les couleurs',
    options: [
      { value: 'VI', label: 'Peau noire profonde', icon: '🌑', desc: 'Ne brûle jamais au soleil' },
      { value: 'V', label: 'Peau brun foncé', icon: '☀️', desc: 'Bronze profondément, rarement brûlée' },
      { value: 'IV', label: 'Peau mate', icon: '🌤️', desc: 'Bronze facilement, peu de coups de soleil' },
      { value: 'III', label: 'Peau claire mate', icon: '🌥️', desc: 'Bronze progressivement' },
    ],
  },
  {
    id: 'skin_concerns',
    question: 'Quelles sont tes préoccupations ?',
    sub: 'Tu peux en choisir plusieurs',
    multi: true,
    options: [
      { value: 'taches', label: 'Taches pigmentaires', icon: '🟤', desc: 'Hyperpigmentation, post-acné' },
      { value: 'acne', label: 'Acné & boutons', icon: '🔴', desc: 'Imperfections, points noirs' },
      { value: 'brillance', label: 'Brillance', icon: '✨', desc: 'Excès de sébum, peau qui brille' },
      { value: 'deshydratation', label: 'Déshydratation', icon: '💧', desc: 'Peau tiraille, manque d\'eau' },
      { value: 'rides', label: 'Rides & âge', icon: '⏳', desc: 'Premiers signes, fermeté' },
      { value: 'sensibilite', label: 'Rougeurs', icon: '🌹', desc: 'Sensibilité, rougeurs' },
      { value: 'pores', label: 'Pores dilatés', icon: '🔍', desc: 'Texture irrégulière' },
      { value: 'cernes', label: 'Cernes', icon: '👁️', desc: 'Sous les yeux' },
    ],
  },
  {
    id: 'skin_sensitivity',
    question: 'Ta peau est-elle réactive ?',
    sub: 'Tendance à rougir, picoter, irriter',
    options: [
      { value: 'aucune', label: 'Aucune sensibilité', icon: '💪', desc: 'Je supporte tout' },
      { value: 'légère', label: 'Légèrement', icon: '🍃', desc: 'Parfois réactive' },
      { value: 'modérée', label: 'Modérément', icon: '🌸', desc: 'Souvent réactive' },
      { value: 'forte', label: 'Très réactive', icon: '🔥', desc: 'Très sensible, eczéma...' },
    ],
  },
  {
    id: 'budget',
    question: 'Quel est ton budget mensuel skincare ?',
    sub: 'Pour adapter les recommandations',
    options: [
      { value: 'eco', label: 'Petit budget', icon: '💰', desc: 'Moins de 15 000 FCFA' },
      { value: 'medium', label: 'Confortable', icon: '💸', desc: '15 000 - 40 000 FCFA' },
      { value: 'premium', label: 'Premium', icon: '✨', desc: '40 000 - 100 000 FCFA' },
      { value: 'luxe', label: 'Luxe', icon: '👑', desc: 'Plus de 100 000 FCFA' },
    ],
  },
];

export default function SkinQuiz({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);

  const currentStep = STEPS[step];
  const isMulti = currentStep.multi;
  const currentValue = answers[currentStep.id];
  const canContinue = isMulti
    ? Array.isArray(currentValue) && currentValue.length > 0
    : currentValue !== undefined;

  const selectOption = (val) => {
    haptic('light');
    if (isMulti) {
      const prev = Array.isArray(currentValue) ? currentValue : [];
      const next = prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val];
      setAnswers({ ...answers, [currentStep.id]: next });
    } else {
      setAnswers({ ...answers, [currentStep.id]: val });
    }
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      haptic('medium');
      return;
    }
    setSaving(true);
    haptic('success');
    try {
      await updateProfile({
        skin_type: answers.skin_type,
        skin_phototype: answers.skin_phototype,
        skin_concerns: answers.skin_concerns,
        skin_sensitivity: answers.skin_sensitivity,
        budget: answers.budget,
      });
      if (onComplete) await onComplete();
    } catch (e) {
      // Si la sauvegarde DB rate, on debloque le bouton + on previent
      toast.error('Échec sauvegarde : ' + (e?.message || 'Réessaie'));
    } finally {
      setSaving(false);
    }
  };

  // Skip = sauvegarde des valeurs minimales pour ne pas re-trigger le quiz
  // (sinon App.jsx voit user.skin_type === null et re-route ici en boucle).
  const handleSkip = async () => {
    setSaving(true);
    try {
      await updateProfile({
        skin_type: 'normale',          // defaut neutre
        skin_phototype: 'V',           // phototype median pour Senegal
        skin_concerns: [],
        skin_sensitivity: 'aucune',
        budget: 'medium',
      });
      if (onComplete) await onComplete();
    } catch (e) {
      toast.error('Erreur : ' + (e?.message || 'Réessaie'));
    } finally {
      setSaving(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="quiz-screen page-anim">
      <div className="quiz-top">
        <button className="quiz-skip" onClick={handleSkip}>Passer</button>
        <div className="quiz-progress">
          <div className="quiz-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="quiz-step-num">{step + 1} / {STEPS.length}</div>
      </div>

      <div className="quiz-content">
        <h1 className="quiz-question">{currentStep.question}</h1>
        <p className="quiz-sub">{currentStep.sub}{isMulti && ' (plusieurs choix)'}</p>

        <div className="quiz-options">
          {currentStep.options.map(opt => {
            const isSelected = isMulti
              ? Array.isArray(currentValue) && currentValue.includes(opt.value)
              : currentValue === opt.value;
            return (
              <button
                key={opt.value}
                className={`quiz-option ${isSelected ? 'selected' : ''}`}
                onClick={() => selectOption(opt.value)}
              >
                <span className="quiz-option-icon">{opt.icon}</span>
                <div className="quiz-option-text">
                  <strong>{opt.label}</strong>
                  <span>{opt.desc}</span>
                </div>
                <div className="quiz-option-radio">
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="quiz-bottom">
        {step > 0 && (
          <button className="quiz-back" onClick={() => setStep(step - 1)}>
            ← Retour
          </button>
        )}
        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={!canContinue || saving}
        >
          {saving ? 'Enregistrement...' : (step < STEPS.length - 1 ? 'Suivant →' : 'Terminer ✨')}
        </button>
      </div>
    </div>
  );
}