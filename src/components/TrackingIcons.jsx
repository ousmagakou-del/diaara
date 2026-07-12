/* ══════════════════════════════════════════════════════════════════
   YARAM — TrackingIcons
   Icones SVG dediees pour la timeline de OrderTracking.
   viewBox 64x64, stroke 2px, currentColor (pilotable via CSS color).
   ══════════════════════════════════════════════════════════════════ */

const baseProps = {
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: 32,
  height: 32,
};

/* ─── Sac de commande avec check (CONFIRMEE / COMMANDEE) ─── */
export function IconBagCheck({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <path d="M14 22 L20 14 H44 L50 22 V52 Q50 54 48 54 H16 Q14 54 14 52 Z" />
      <path d="M24 22 V16 Q24 10 32 10 Q40 10 40 16 V22" />
      <polyline points="24 36 30 42 42 30" />
    </svg>
  );
}

/* ─── Preparation pharmacie (flacon avec check) ─── */
export function IconPreparing({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <rect x="20" y="12" width="24" height="6" rx="1.5" />
      <path d="M22 18 H42 V50 Q42 54 38 54 H26 Q22 54 22 50 Z" />
      <line x1="28" y1="28" x2="36" y2="28" />
      <line x1="32" y1="24" x2="32" y2="32" />
      <polyline points="26 42 30 46 38 38" />
    </svg>
  );
}

/* ─── Colis scelle (PRETE) ─── */
export function IconPackage({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <path d="M12 20 L32 10 L52 20 V44 L32 54 L12 44 Z" />
      <line x1="12" y1="20" x2="32" y2="30" />
      <line x1="52" y1="20" x2="32" y2="30" />
      <line x1="32" y1="30" x2="32" y2="54" />
      <line x1="22" y1="15" x2="42" y2="25" />
    </svg>
  );
}

/* ─── Scooter livraison (EN LIVRAISON) ─── */
export function IconScooter({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <circle cx="18" cy="46" r="7" />
      <circle cx="48" cy="46" r="7" />
      <path d="M25 46 H41" />
      <path d="M18 39 V30 H30 L38 42" />
      <path d="M30 30 H40 L48 39" />
      <path d="M40 22 H46 L48 30" />
    </svg>
  );
}

/* ─── Batiment pharmacie (RETRAIT PHARMACIE) ─── */
export function IconPharmacy({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <path d="M10 24 L32 12 L54 24 V52 Q54 54 52 54 H12 Q10 54 10 52 Z" />
      <line x1="28" y1="34" x2="36" y2="34" />
      <line x1="32" y1="30" x2="32" y2="38" />
      <rect x="26" y="44" width="12" height="10" />
    </svg>
  );
}

/* ─── Main qui recoit un colis (LIVREE / RETIREE) ─── */
export function IconHandDelivery({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <rect x="20" y="14" width="24" height="18" rx="1.5" />
      <line x1="20" y1="22" x2="44" y2="22" />
      <line x1="32" y1="14" x2="32" y2="22" />
      <path d="M10 44 Q10 40 14 40 H26 L32 44 H46 Q52 44 52 50 V54" />
      <path d="M10 44 V54" />
    </svg>
  );
}

/* ─── Avion / cargo (EN TRANSIT INTERNATIONAL) ─── */
export function IconPlane({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <path d="M6 34 L28 30 L38 14 H42 L38 30 L54 26 V32 L38 38 L42 54 H38 L28 38 L6 40 Z" />
    </svg>
  );
}

/* ─── Aeroport / arrivee Dakar ─── */
export function IconArrival({ size = 32 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <path d="M8 48 H56" />
      <path d="M12 40 L28 34 L30 20 L34 20 L36 32 L52 28 Q56 27 56 32 Q56 34 52 35 L14 44 Q10 44 10 40 Z" />
      <line x1="20" y1="52" x2="44" y2="52" />
    </svg>
  );
}

/* ─── Facteur d icones : reutilisable par la timeline ─── */
export const TRACKING_ICONS = {
  bag: IconBagCheck,
  preparing: IconPreparing,
  package: IconPackage,
  scooter: IconScooter,
  pharmacy: IconPharmacy,
  hand: IconHandDelivery,
  plane: IconPlane,
  arrival: IconArrival,
};
