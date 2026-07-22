// ════════════════════════════════════════════════════════════════════
// YARAM — CategoryIcon
// Jeu d'illustrations premium cohérent (style flat "soft-pop"), une par
// catégorie, rendu inline en SVG. Remplace les icônes-images hétérogènes.
// Style unifié : formes rondes, aplats 2-3 tons, accent vert YARAM.
// viewBox 44×44, hérite de la taille du parent (width/height 100%).
// ════════════════════════════════════════════════════════════════════

const G = '#1F8B4C';   // vert YARAM
const GD = '#0E5B33';  // vert foncé
const A = '#EFB355';   // ambre accent

const ICONS = {
  // Visage — goutte de sérum
  visage: (
    <>
      <path d="M22 6c6 6.5 10.5 11.5 10.5 17.5A10.5 10.5 0 1 1 11.5 23.5C11.5 17.5 16 12.5 22 6z" fill="#F2A98C"/>
      <path d="M16.5 25.5a5.5 5.5 0 0 0 5.5 4.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
      <circle cx="17" cy="19" r="1.6" fill="#fff" opacity=".7"/>
    </>
  ),
  // Solaire — soleil + tube
  solaire: (
    <>
      <circle cx="22" cy="22" r="8.5" fill={A}/>
      <g stroke={A} strokeWidth="2.8" strokeLinecap="round">
        <path d="M22 4v4.5M22 35.5V40M4 22h4.5M35.5 22H40M9 9l3 3M32 32l3 3M35 9l-3 3M12 32l-3 3"/>
      </g>
      <circle cx="22" cy="22" r="4" fill="#fff" opacity=".55"/>
    </>
  ),
  // Cheveux — flacon shampoing
  cheveux: (
    <>
      <rect x="14" y="15" width="16" height="23" rx="4" fill={G}/>
      <rect x="17.5" y="9" width="9" height="7" rx="2.5" fill={GD}/>
      <rect x="17" y="22" width="10" height="10" rx="2" fill="#fff"/>
      <path d="M19 27h6" stroke={G} strokeWidth="2" strokeLinecap="round"/>
    </>
  ),
  // Maquillage — rouge à lèvres
  maquillage: (
    <>
      <rect x="16" y="20" width="12" height="18" rx="3" fill="#C9C7BF"/>
      <path d="M18 20v-6l6-4 2 3v7z" fill="#D4537E"/>
      <rect x="16" y="18" width="12" height="4" rx="1.5" fill="#9A9790"/>
    </>
  ),
  // Bébé — biberon
  bebe: (
    <>
      <rect x="14" y="16" width="16" height="20" rx="6" fill="#8FB8E8"/>
      <path d="M18 16v-3a4 4 0 0 1 8 0v3" fill="#5E90CF"/>
      <circle cx="22" cy="8" r="2.8" fill="#5E90CF"/>
      <rect x="16.5" y="23" width="11" height="8" rx="2" fill="#fff" opacity=".9"/>
      <path d="M19 26h6M19 29h4" stroke="#8FB8E8" strokeWidth="1.6" strokeLinecap="round"/>
    </>
  ),
  // Hygiène — savon + bulles
  hygiene: (
    <>
      <rect x="12" y="20" width="20" height="13" rx="5" fill="#7CC7E8"/>
      <circle cx="27" cy="13" r="3.2" fill="#B7E2F2"/>
      <circle cx="20" cy="10" r="2.2" fill="#B7E2F2"/>
      <circle cx="26" cy="18" r="1.6" fill="#fff" opacity=".8"/>
    </>
  ),
  // Compléments — gélule
  complement: (
    <>
      <rect x="9" y="17" width="26" height="11" rx="5.5" transform="rotate(-30 22 22)" fill="#B7B1EE"/>
      <path d="M13.6 29.6 24 15" stroke="#fff" strokeWidth="0"/>
      <g transform="rotate(-30 22 22)"><rect x="9" y="17" width="13" height="11" rx="5.5" fill={G}/></g>
    </>
  ),
  // Corps — flacon pompe
  corps: (
    <>
      <rect x="14" y="18" width="16" height="20" rx="4" fill="#EFB6A0"/>
      <rect x="19" y="8" width="6" height="7" rx="2" fill="#C97C63"/>
      <path d="M19 11h-5v3" stroke="#C97C63" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
      <rect x="17" y="24" width="10" height="9" rx="2" fill="#fff" opacity=".85"/>
    </>
  ),
  // Lèvres — baume/lèvres
  levres: (
    <>
      <path d="M11 22c3-3 6-1 11-1s8-2 11 1c-3 4-7 6-11 6s-8-2-11-6z" fill="#D4537E"/>
      <path d="M11 22c3 1 7 1.5 11 1.5S30 23 33 22" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </>
  ),
  // Bucco-dentaire — dent
  bouche: (
    <>
      <path d="M22 11c3.5-3.2 10-3 11 3.5 1 7.5-3.2 19.5-5.5 19.5s-2.2-6.5-5.5-6.5-3.2 6.5-5.5 6.5-6-12-5-19.5C12.5 8 18.5 7.8 22 11z" fill="#EAF0F6"/>
      <path d="M17 15c1.5-1.2 4-1.2 5.5 0" stroke="#8FB8E8" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </>
  ),
  // Pieds & mains — empreinte
  pieds_mains: (
    <>
      <ellipse cx="22" cy="26" rx="7" ry="9" fill="#F2A98C"/>
      <g fill="#F2A98C"><circle cx="15" cy="15" r="2.4"/><circle cx="20" cy="12" r="2.6"/><circle cx="25" cy="12" r="2.4"/><circle cx="29" cy="15.5" r="2.2"/></g>
    </>
  ),
  // Intime — coeur/goutte douce
  intime: (
    <>
      <path d="M22 34s-11-6.5-11-14a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 7.5-11 14-11 14z" fill="#ED93B1"/>
      <circle cx="18" cy="19" r="1.6" fill="#fff" opacity=".6"/>
    </>
  ),
  // Déodorants — spray
  deodorants: (
    <>
      <rect x="15" y="16" width="14" height="22" rx="4" fill="#9AA0A6"/>
      <rect x="18" y="9" width="8" height="7" rx="2" fill="#6B7178"/>
      <g fill="#C9CED3"><circle cx="31" cy="11" r="1.4"/><circle cx="34" cy="9" r="1.2"/><circle cx="33" cy="14" r="1.2"/></g>
      <rect x="18" y="22" width="8" height="8" rx="2" fill="#fff" opacity=".85"/>
    </>
  ),
  // Orthopédie — croix médicale / attelle
  orthopedie: (
    <>
      <rect x="8" y="17" width="28" height="10" rx="5" transform="rotate(45 22 22)" fill="#F09595"/>
      <rect x="18.5" y="18.5" width="7" height="7" rx="2" fill="#fff"/>
      <g fill="#A32D2D"><rect x="21" y="15.5" width="2" height="2.4" rx="1"/><rect x="21" y="26" width="2" height="2.4" rx="1"/><rect x="15.5" y="21" width="2.4" height="2" rx="1"/><rect x="26" y="21" width="2.4" height="2" rx="1"/></g>
    </>
  ),
  // Parfums — flacon
  parfums: (
    <>
      <rect x="15" y="15" width="14" height="21" rx="3" fill="#C9B7E0"/>
      <rect x="18.5" y="8" width="7" height="7" rx="1.5" fill="#8E77B5"/>
      <path d="M29 11h4l2 3-2 3h-4" fill="#B7A3D6"/>
      <rect x="17.5" y="21" width="9" height="10" rx="2" fill="#fff" opacity=".7"/>
    </>
  ),
};

// alias
ICONS.parfum = ICONS.parfums;

export default function CategoryIcon({ slug, size = '100%' }) {
  const art = ICONS[slug] || null;
  if (!art) return null;
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} role="img" aria-hidden="true" style={{ display: 'block' }}>
      {art}
    </svg>
  );
}

export function hasCategoryIcon(slug) {
  return !!ICONS[slug];
}
