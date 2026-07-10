# YARAM World-Class Roadmap

Recap complet du programme d executiondemande par Ousmane. Un commit par
phase, migrations SQL versionnees avec rollback, tokens design partages
web / native. Cette session couvre le Chantier 1 et les Lots A / B / C / D / E
de la roadmap. Le Lot F (Merchant + Driver polish) reste a executer
lors d une prochaine session (session limit API atteinte pendant le lancement
des agents Phase F).

## Historique des commits par phase

Web (repo `~/Documents/diaara`, branche `main`) :

| Phase | Hash | Titre |
|---|---|---|
| 0 | `513c463` | Admin candidatures partenaires et livreurs |
| A | `0cd7955` | Design tokens partages web et native |
| B | `0032d5c` | Home Search Categories world-class |
| C | `eaf86fd` | Product Cart Checkout world-class |
| D | `1ee46cf` | Tracking Account world-class |

Native (repo `~/Documents/yaram-native`, branche `main`) :

| Phase | Hash | Titre |
|---|---|---|
| E | `54f5578` | App native cliente alignee tokens |

Phase F (Merchant Pharma polish + Driver PWA polish) : non demarree.

## Phase 0 - Sections admin candidatures

Sections livrees dans `src/admin/` :
- `PartnerApplicationsSection.jsx` - table complete (Date, Pharmacie,
  Gerant, Ville, NINEA, Cmdes/mois, Statut, Actions), filtres statut /
  ville / periode + search, drawer detail avec notes editables, bouton
  "Envoyer contrat a signer" qui pre-remplit un `signature_request`
  pharmacy_v1 et invoque `send-signature-email`, statuts inline, export
  CSV, `adminLogAction` sur chaque action.
- `DriverApplicationsSection.jsx` - meme pattern, filtre vehicule en
  plus, drawer affiche revenu potentiel estime (4500 FCFA/h x heures
  declarees x 4), bouton "Approuver et onboarder" passe statut a
  `hired` et envoie un mail de bienvenue via `send-email` edge
  function.

Backend (deploye via MCP + fichier migration `supabase/migrations/20260710_admin_applications_rpcs.sql`) :
- `admin_update_partner_application(token, id, status, notes)`
- `admin_update_driver_application(token, id, status, notes)`
- `admin_applications_counts(token)` pour badges NAV

Roles autorises : super_admin, admin, commercial.

Nav `src/pages/Admin.jsx` :
- Entrees `partner_apps` et `driver_apps`
- Compteurs Nouveau poll toutes les 45s via `admin_applications_counts`
- Emojis retires des labels signatures / partner_apps / driver_apps

Rollback SQL Phase 0 :
```sql
DROP FUNCTION public.admin_update_partner_application(text, uuid, text, text);
DROP FUNCTION public.admin_update_driver_application(text, uuid, text, text);
DROP FUNCTION public.admin_applications_counts(text);
```

## Phase A - Design tokens partages

Source unique de couleurs / typo / spacing / radius / ombres / motion :
- `packages/design-tokens/tokens.js` (JS objects consommables par les
  React SFCs si besoin runtime)
- `packages/design-tokens/tokens.css` (CSS variables `--y-*` chargees
  dans `src/main.jsx` avant `index.css`)

Miroir cote native :
- `~/Documents/yaram-native/design-tokens/tokens.js` (RN shadows
  compatibles elevation Android + shadowColor/Offset/Opacity/Radius iOS)

CSS variables exposees :
- `--y-brand`, `--y-brand-dark`, `--y-brand-light`, `--y-brand-soft`
- `--y-accent`, `--y-accent-dark`, `--y-accent-light`, `--y-accent-soft`
- `--y-n-0` a `--y-n-900` (neutrals)
- `--y-success`, `--y-warning`, `--y-danger`, `--y-info` (+ soft variantes)
- `--y-font-sans`, `--y-font-mono`
- `--y-fs-xs` a `--y-fs-8xl` (typo scale)
- `--y-fw-normal` a `--y-fw-black`
- `--y-sp-1` a `--y-sp-24` (spacing scale)
- `--y-rad-sm` a `--y-rad-pill`
- `--y-shadow-xs` a `--y-shadow-2xl`, plus `--y-shadow-brand`, `--y-shadow-accent`, `--y-focus-ring`
- `--y-dur-fast/medium/slow`, `--y-ease-out`, `--y-ease-in-out`, `--y-ease-spring`

Composants alignes documentes : ProductTile, BrandTile, PriceTag,
Button, Chip, Input, Modal, Sheet, Skeleton, EmptyState, Toast,
Stepper, RatingStars, Avatar, ProgressBar, Timeline.

Aucune migration SQL en Phase A.

## Phase B - Home + Search + Categories web

Nouveaux composants (`src/components/`) :
- `Skeleton.jsx` + `.css` avec presets `SkeletonProductCard`, `SkeletonBrandCard`
- `tiles/ProductTile.jsx` + `.css` (variantes md/sm, badges promo/import/stock, add-to-cart au hover)
- `tiles/BrandTile.jsx` + `.css` (logo rond, ville, tagline, count)
- `tiles/index.js`
- `HeaderSearch.jsx` + `.css` (autocomplete debounce 200 ms, dropdown 3 sections Produits / Marques / Categories, highlight du terme)

Refactor pages :
- `src/pages/ShopHome.jsx` + `.css` - 7 sections curatorielles (Hero,
  Nouveautes, Marques, Recos personnalisees, Best-sellers Dakar, Fin
  de stock, Bons plans) + bloc B2B
- `src/pages/Search.jsx` + `.css` - layout 2 col desktop, filtres
  avances (marque multi + search, prix min/max + slider, peau,
  ingredients, note min, en stock, livrable demain, promo), tri
  6 modes, URL sync (`?q&marque&prix_min&prix_max&peau&tri`), chips
  actifs, FAB + bottom sheet mobile, skeletons
- `src/pages/Categories.jsx` + `.css` - wrap SiteLayout, hero +
  featured + grid + rail marques BrandTile

Adjacents :
- `src/components/SiteLayout.jsx` + `.css` - HeaderSearch integree,
  emojis retires
- `src/App.jsx` - `routeToPath` / `pathToRoute` supportent `q`,
  `marque`, `tri`, `promo`

Aucune migration SQL en Phase B. Autocomplete Supabase cote client
(requetes paralleles `.from('products')`, `.from('brands')`,
`.from('categories')`).

## Phase C - Product page + Cart + Checkout

Composants extraits (`src/components/`) :
- `ImageZoom.jsx` + `.css` - hover mouse-move background-position
  desktop, pinch touch mobile
- `Accordion.jsx` + `.css` - premium mono ou multi-open
- `ReviewCard.jsx` + `.css` - avatar, stars, verify badge, photos,
  votes utile / pas utile
- `Stepper.jsx` + `.css` - qty +/- 3 tailles
- `ProgressBar.jsx` + `.css` - etapes numerotees + connecteurs remplis

`src/pages/ProductPage.jsx` :
- Galerie hero v2, thumbs verticaux desktop / horizontal scroll mobile,
  ImageZoom, video preview si `product.video_url`, badge -X% sur promo
- Buy box sticky, Stepper, Ajouter au panier, Acheter maintenant
  (direct checkout), livraison estimee (cutoff 16h), retour 14j
- Badges qualite : Vegan, Bio, Certifie, Fabrication SN
- Stock : "Plus que N en stock" (<5) ou "Rupture prevue" (0)
- Accordion 5 sections : Description, Composition (chips + tooltip),
  Mode d emploi, Precautions, Specs techniques
- Reviews : rating global + repartition cliquable + filtres chips + lazy load +4
- Bundle "Souvent achete ensemble", carousel "Produits similaires"

`src/pages/CartPage.jsx` :
- Save-for-later (`yaram-cart-v2-saved` localStorage)
- Sub-total par pharmacie si multi-pharmacie
- Promo inline (YARAM10 / YARAM5 / BIENVENUE) + persist sessionStorage
- Empty state premium

`src/pages/CheckoutPage.jsx` :
- Wizard 4 etapes avec ProgressBar
- Persist `yaram-checkout-progress` sessionStorage
- Etape 1 : adresses radio + nouvelle adresse + geolocation
- Etape 2 : livraison Aujourd hui / Express / Standard + notes
- Etape 3 : Wave, Orange Money, Free Money, PayTech, Carte bancaire,
  Cash + promo + gift card best-effort RPC `public_check_gift_card` +
  slider points fidelite
- Etape 4 : recap edit-inline + CGV / RGPD + submit lock

Aucune migration SQL en Phase C. Calls `public_check_gift_card` et
`client_place_order` wraps dans try/catch pour ne pas casser si RPCs
absentes en DB.

## Phase D - Order tracking + Account

Nouveaux composants (`src/components/`) :
- `Timeline.jsx` + `.css` - timeline vertical reutilisable
- `ProgressRing.jsx` - anneau progression pour metriques
- `TierRing.jsx` - anneau tier Bronze / Argent / Or / Platine

`src/pages/OrderTracking.jsx` :
- Handlers `handleCancelOrder` (UPDATE direct RLS-guarded avec
  fallback WhatsApp), `handleReportIssue` (RPC
  `client_dispute_delivery` si livre, sinon WA)
- Snackbar rappel de notation 24h+ apres livraison (localStorage dismiss)
- Section "Aide sur cette commande" avec 3 boutons contextualises

`src/pages/Profile.jsx` :
- Sidebar nav 7 sections + logout
- Section "Historique commandes" avec preview 3 dernieres via `useMyOrders`
- Section "Cartes cadeaux MySargal" placeholder (table pas encore posee)
- Section "Reglages compte" (upload photo Supabase Storage `avatars`,
  prenom, nom, phone, reset mot de passe, email)

Aucune migration SQL en Phase D. RPC `client_cancel_order` absente ->
UPDATE direct filtre par statuts autorises avec fallback WA. Table
`mysargal_gift_cards` absente -> placeholder.

## Phase E - App native cliente

Repo `~/Documents/yaram-native`, commit `54f5578`.

Nouveaux composants (`src/design/components/`) - tous alignes sur
`design-tokens/tokens.js`, 100 pourcent RN primitives, zero dep npm :
- `Button.jsx` - 5 variants (primary/accent/ghost/outline/danger) x 3 sizes (sm/md/lg)
- `PriceTag.jsx` - prix + old_price barre + badge -X%
- `ProductTile.jsx` - carte photo 1:1, badge promo, marque, titre, rating, PriceTag
- `BrandTile.jsx` - cercle logo + fallback initiale + nom + ville
- `Skeleton.jsx` - `Animated.timing` opacity loop 700ms + presets
- `EmptyState.jsx` - cercle iconique + titre + sous-titre + CTA
- `Chip.jsx` - default / outline / selected / onDismiss
- `RatingStars.jsx` - 5 etoiles + mode compact
- `Stepper.jsx` - `- valeur +`, borne min>=1 / max=99, 3 sizes
- `index.js` barrel export

`app/(tabs)/index.jsx` :
- 4 sections curatorielles avant "Tous les produits" (Bons plans,
  Best-sellers Dakar, Recommande pour vous, Fin de stock)
- Chaque section navigue vers `/search` avec params filter / sort
- Skeleton pendant chargement initial

Search et Product natifs non refactores dans cette passe (raisons
listees dans le report Phase E : deja en TestFlight prod avec state
cart / reviews / carousel, rewrite complet aurait viole la contrainte
"ne pas casser Push notifs / Sticky session / Sign in with Apple /
Refund"). Les nouveaux composants sont prets a etre adoptes
progressivement.

Aucune migration SQL en Phase E.

## Phase F - Merchant + Driver polish

**Non demarree** (session limit API atteinte pendant le lancement des
2 agents Phase F). A executer en prochaine passe :

- Merchant `src/pages/Pharma.jsx` : remplacer hex hardcodes par
  variables `--y-*`, uniformiser radius pill / cards xl / shadow sm,
  ajouter skeleton fetch initial, retirer emojis, verifier full-width
  desktop.
- Driver `src/pages/driver/*.jsx` : meme polish tokens + ajouter dans
  `DriverDelivery.jsx` :
  - Timeline vertical waypoints pickup pharmacie -> livraison client
  - Bouton "Ouvrir dans Maps" (deep link Google Maps / Apple Maps)
  - Section "Code de remise" 4 chiffres visibles gros
  - Sticky bottom bar contextuel selon etape

## Migrations SQL

Deux migrations posees cette session, deployees en prod via MCP
`execute_sql`, fichiers versionnes dans `supabase/migrations/` :

1. `20260710_partner_driver_applications.sql`
   - Tables `partner_applications`, `driver_applications`
   - RLS block-all
   - RPCs publics `public_submit_partner_application`, `public_submit_driver_application`
   - RPCs admin `admin_list_partner_applications`, `admin_list_driver_applications`

2. `20260710_admin_applications_rpcs.sql`
   - `admin_update_partner_application(token, id, status, notes)`
   - `admin_update_driver_application(token, id, status, notes)`
   - `admin_applications_counts(token)`

Rollback global des deux migrations :
```sql
DROP FUNCTION public.admin_update_partner_application(text, uuid, text, text);
DROP FUNCTION public.admin_update_driver_application(text, uuid, text, text);
DROP FUNCTION public.admin_applications_counts(text);
DROP FUNCTION public.admin_list_partner_applications(text, text);
DROP FUNCTION public.admin_list_driver_applications(text, text);
DROP FUNCTION public.public_submit_partner_application(text, text, text, text, text, text, text, int, text, text);
DROP FUNCTION public.public_submit_driver_application(text, text, text, text, text, date, text, text, text, text, int, text, boolean, text);
DROP TABLE public.driver_applications;
DROP TABLE public.partner_applications;
```

## Deploiements a faire

Web (diaara -> Cloudflare Pages) :
```bash
cd ~/Documents/diaara
git push origin main
```
Cloudflare rebuild automatique depuis la branche `main` (2 a 4
minutes). Attendre statut `Success` sur le dernier deployment avant de
tester la prod.

Native (yaram-native -> EAS) :
```bash
cd ~/Documents/yaram-native
git push origin main
eas update --channel production --message "Phase E - design tokens + curated sections home"
```
OTA immediat sur les installations existantes une fois la commande
executee. Pour une build native complete (nouveaux composants
compiles) :
```bash
eas build --platform ios --profile preview
```

Migrations SQL : deja deployees en prod via MCP execute_sql, aucune
action manuelle requise.

## Contraintes respectees

- Pas d emoji dans le code, UI, ni messages de commit des phases 0 / A / B / C / D / E.
- Ton pro sobre partout.
- Commits distincts par phase, messages factuels.
- Migrations SQL versionnees avec rollback documente ci-dessus.
- Aucune dep npm ajoutee sur les 6 phases.
- Vite build valide (les agents ont confirme la compilation).
- Fonctionnalites existantes preservees (Newsletter, Admin, Sticky
  session, Push, Refund, Sign in with Apple).

## Etat des lieux et suite

Chantier 1 : livre et deploye en prod (SQL + code).
Lots A, B, C, D, E : livres, en attente de `git push` cote web pour
Cloudflare rebuild et cote native pour EAS update.
Lot F : non demarre, a executer en prochaine passe.

Pas de blocage bloquant a signaler. Le seul point d attention est
l API session limit qui a interrompu le lancement des agents Phase F.
Les agents web ont tous confirme que `vite build` passe.
