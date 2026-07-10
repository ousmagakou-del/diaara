// ═══════════════════════════════════════════════════════════════
// YARAM — Design Tokens partages web et native
// ═══════════════════════════════════════════════════════════════
//
// Source de verite unique pour couleurs, typo, spacing, radius,
// ombres, easings. Consomme par:
//   - Web (diaara) via `src/tokens.js` qui re-exporte + tokens.css
//   - Native RN (yaram-native) via un import direct
//
// Toute modification ici doit etre revue par les deux equipes.
// ═══════════════════════════════════════════════════════════════

// ─── COULEURS ───
export const colors = {
  // Brand
  brand: {
    primary: '#1F8B4C',      // Vert YARAM principal
    primaryDark: '#166635',
    primaryLight: '#2DAA5E',
    primarySoft: '#EAF7F0',  // Fond doux vert
    primarySofter: '#F5FBF7',
    accent: '#E94E1B',       // Orange complementaire
    accentDark: '#C43E11',
    accentLight: '#FF7A4C',
    accentSoft: '#FFF3EE',
  },

  // Neutres
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAF7',
    100: '#F4F4F2',
    200: '#EEEDE8',
    300: '#E5E4DC',
    400: '#C0C0B8',
    500: '#9CA3AF',
    600: '#6B7280',
    700: '#4B5563',
    800: '#1F2937',
    900: '#0A0A0A',
  },

  // Semantic
  semantic: {
    success: '#1F8B4C',
    successSoft: '#EAF7F0',
    warning: '#F4B53A',
    warningSoft: '#FFF9E6',
    warningText: '#B78B00',
    danger: '#D9342B',
    dangerSoft: '#FDECEA',
    info: '#0066CC',
    infoSoft: '#EAF3FE',
    infoText: '#0066CC',
  },

  // Overlays
  overlay: {
    light: 'rgba(0,0,0,0.04)',
    medium: 'rgba(0,0,0,0.15)',
    heavy: 'rgba(0,0,0,0.4)',
    modal: 'rgba(0,0,0,0.6)',
  },
};

// ─── TYPOGRAPHIE ───
export const typography = {
  fontFamily: {
    sans: `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif`,
    mono: `'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace`,
  },
  weight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  size: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 40,
    '7xl': 48,
    '8xl': 56,
    '9xl': 72,
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 1.75,
  },
  letterSpacing: {
    tight: '-2px',
    tightMd: '-1px',
    tightSm: '-0.5px',
    tightXs: '-0.2px',
    normal: '0',
    wide: '0.3px',
    wider: '1px',
    widest: '2px',
  },
};

// ─── ESPACEMENT ───
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
};

// ─── RADIUS ───
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  pill: 999,
};

// ─── OMBRES ───
export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(0,0,0,0.03)',
  sm: '0 2px 8px rgba(0,0,0,0.06)',
  md: '0 4px 16px rgba(0,0,0,0.08)',
  lg: '0 10px 30px rgba(0,0,0,0.10)',
  xl: '0 20px 50px rgba(0,0,0,0.10)',
  '2xl': '0 30px 80px rgba(0,0,0,0.12)',
  brand: '0 10px 30px rgba(31,139,76,0.25)',
  brandLg: '0 14px 40px rgba(31,139,76,0.35)',
  accent: '0 10px 30px rgba(233,78,27,0.30)',
  accentLg: '0 14px 40px rgba(233,78,27,0.45)',
  focus: '0 0 0 3px rgba(31,139,76,0.10)',
};

// ─── BREAKPOINTS ───
export const breakpoints = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 900,
  xl: 1024,
  '2xl': 1280,
  '3xl': 1440,
};

// ─── ANIMATIONS ───
export const motion = {
  duration: {
    instant: 100,
    fast: 150,
    medium: 200,
    slow: 300,
    slower: 500,
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

// ─── COMPOSANTS - VALEURS PARTAGEES ───
export const components = {
  button: {
    heightSm: 36,
    heightMd: 44,
    heightLg: 52,
    padXSm: 14,
    padXMd: 22,
    padXLg: 32,
  },
  input: {
    height: 44,
    padX: 14,
    borderWidth: 1,
  },
  card: {
    padX: 24,
    padY: 20,
    padXLg: 32,
    padYLg: 28,
  },
  tile: {
    // ProductTile / BrandTile aligned across web and native
    imageAspect: 1,      // 1:1
    imageBg: '#FAFAF7',
    priceSize: 15,
    titleSize: 13.5,
    brandSize: 11,
    radius: 14,
  },
  badge: {
    padX: 10,
    padY: 4,
    fontSize: 11,
  },
};

// ─── COMPOSANTS ALIGNES (docs / recensement) ───
// Ceux qui DOIVENT avoir la meme apparence entre web et native.
export const alignedComponents = [
  'ProductTile',    // Photo, badge, marque, titre, prix, rating
  'BrandTile',      // Logo, nom, tagline, ville
  'PriceTag',       // Prix + prix barre + badge promo
  'Button',         // Primary, ghost, outline, danger
  'Chip',           // Filtre, tag, categorie
  'Input',          // Text, number, search, textarea
  'Modal',          // Desktop
  'Sheet',          // Mobile bottom sheet
  'Skeleton',       // Placeholder chargement
  'EmptyState',     // Icon + titre + sous-titre + CTA
  'Toast',          // Notification transitoire
  'Stepper',        // Quantite +/-
  'RatingStars',    // Note produit
  'Avatar',         // User / driver / commercant
  'ProgressBar',    // Quiz, checkout, loyalty
  'Timeline',       // Statut commande, evolution
];
