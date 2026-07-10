// ============================================================
// YARAM — TierRing
// Ring de progression fidelite avec libelle de palier au centre.
// Uses ProgressRing + design tokens uniquement.
// ============================================================
import ProgressRing from './ProgressRing';

const TIER_COLORS = {
  bronze:   'linear-gradient(135deg, #C8956A 0%, #8C5A2C 100%)',
  silver:   'linear-gradient(135deg, #BBC5CB 0%, #6B7780 100%)',
  gold:     'linear-gradient(135deg, #F6D365 0%, #BF9B25 100%)',
  platinum: 'linear-gradient(135deg, #B4E0E8 0%, #4A90A8 100%)',
};

const TIER_RING_COLOR = {
  bronze:   '#B47843',
  silver:   '#8592A0',
  gold:     '#C9A31C',
  platinum: '#4A90A8',
};

/**
 * @param {object} props
 * @param {string} props.tierId - bronze | silver | gold | platinum
 * @param {string} props.tierName - libelle affiche
 * @param {number} props.points - points actuels (affiches au centre)
 * @param {number} props.progressPct - 0..100 progression vers palier suivant
 * @param {number} [props.size=148]
 */
export default function TierRing({
  tierId = 'bronze',
  tierName = 'Bronze',
  points = 0,
  progressPct = 0,
  size = 148,
}) {
  const ringColor = TIER_RING_COLOR[tierId] || 'var(--y-brand)';
  const badgeBg = TIER_COLORS[tierId] || 'var(--y-brand)';
  return (
    <ProgressRing
      size={size}
      stroke={10}
      value={progressPct}
      color={ringColor}
      trackColor="var(--y-n-200)"
      ariaLabel={`Palier ${tierName}, ${Math.round(progressPct)}%`}
    >
      <div
        style={{
          width: size * 0.38,
          height: size * 0.38,
          borderRadius: '50%',
          background: badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--y-n-0)',
          fontWeight: 700,
          fontSize: 'var(--y-fs-sm)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          boxShadow: 'var(--y-shadow-sm)',
        }}
      >
        {tierName}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 'var(--y-fs-2xl)',
          fontWeight: 'var(--y-fw-bold)',
          color: 'var(--y-n-900)',
          letterSpacing: '-0.5px',
        }}
      >
        {Number(points).toLocaleString('fr-FR')}
      </div>
      <div
        style={{
          fontSize: 'var(--y-fs-xs)',
          fontWeight: 'var(--y-fw-semibold)',
          color: 'var(--y-n-600)',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
        }}
      >
        points
      </div>
    </ProgressRing>
  );
}
