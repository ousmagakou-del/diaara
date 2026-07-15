# BRIEF — DASHBOARD MARQUE LOCALE YARAM
### Pour Claude Design · Juillet 2026

---

## 1. Contexte YARAM

YARAM est **la parapharmacie et cosmétique livrée à Dakar** (Sénégal). L'app cliente est **live sur l'App Store iOS** + web `yaram.app`, avec 3 tiers de partenaires B2B :

| Partenaire | Dashboard | Palette |
|---|---|---|
| **Pharmacies** (Yacine, Point E, etc.) | `/pharma` | Vert émeraude `#1F8B4C` |
| **Livreurs Pedalel** | `/driver` | Teal turquoise `#2AA5AC` |
| **Marques locales** (Berroy, Nafi, Xisel) | `/brand` ← **CE PROJET** | Violet `#7C3AED` |

L'objectif Marque Locale : **permettre aux marques sénégalaises artisanales de vendre en autonomie sur YARAM**, sans passer par une pharmacie. Modèle **Etsy / Ankorstore / Faire.com** — la marque expédie depuis son atelier, un livreur Pedalel passe la récupérer.

---

## 2. Cible utilisatrice

**Persona type : Aïcha, 32 ans, fondatrice de "Berroy Cosmétiques" à Yoff**
- Fabrique du savon noir + huile de baobab à la maison, 30-50 pots/semaine
- Vend actuellement via Instagram DM + WhatsApp
- Pas très à l'aise avec les outils tech complexes
- Utilise un iPhone 12, connexion 4G moyenne
- Veut faire grandir sa marque mais est **saturée par la logistique** (répondre aux DM, encaisser en cash, coordonner les livraisons)

**Ses attentes du dashboard** :
- Ajouter un produit **en moins de 2 minutes** (nom, photo, prix, stock)
- **Voir ses commandes en temps réel** — sonnerie quand ça tombe
- Gérer son **stock à chaud** (elle en produit peu, ça doit être précis)
- Savoir **combien elle a gagné** cette semaine
- Recevoir sa paye **sur Wave** (comme les livreurs Pedalel)

---

## 3. Ce qui existe déjà (à polir)

Le dashboard fonctionne — flow bout en bout opérationnel. Il y a 5 sections navigables :

1. **Vue d'ensemble** — KPI produits (en ligne / en attente / rejetés) + carte "comment ça marche"
2. **Commandes** — liste des courses avec tabs Nouvelles / En prépa / Prêtes / Livrées, actions Accepter / Refuser
3. **Mes produits** — grid avec ajout + edit + upload photo drag-drop
4. **Mon stock** — compteur -/+ par produit avec seuil d'alerte
5. **Paramètres** — profil + PIN + WhatsApp support

**Palette actuelle** :
- `--brand-violet: #7C3AED` (primaire)
- `--brand-violet-dark: #5B21B6` (hover, texts)
- `--brand-violet-soft: #F3E8FF` (backgrounds)
- `--brand-violet-tint: #A78BFA` (accents)
- `--black: #0F2224`
- Palette YARAM standard pour les neutres

---

## 4. Livrables attendus (Claude Design)

### 4.1 Identité visuelle Marque
- **Logo** "YARAM Marque" ou "YARAM Studio" (nom à valider avec Ousmane)
- **Icône PWA** 192×192 + 512×512 (violet)
- **Splash screen** iOS
- **Illustration héros** pour la landing signup (marque locale africaine + produits cosmétiques artisanaux)

### 4.2 Écrans clés à redesigner (Figma ou HTML/CSS)

**Écran 1 — Login PIN**
- Sélection de la marque (liste avec logos)
- Saisie PIN 6 chiffres
- Fond violet dégradé + logo Pedalel-like en haut
- Références : Instacart driver login, Uber Fleet
- **Contraintes** : mobile-first, touche haptic-like au tap chiffre

**Écran 2 — Vue d'ensemble (Home)**
- Hero card avec revenu de la semaine + prochaine paye
- 3 KPI colorés : Produits en ligne / Commandes en cours / Note moyenne
- Section "À faire aujourd'hui" (2-3 items priorisés)
- Section "Comment ça marche" (steps illustrés)
- Références : DoorDash Merchant, Shopify Home

**Écran 3 — Commandes (list + detail)**
- Style DoorDash Merchant : chaque commande = card avec photo cliente, items, prix
- Actions XL en bas : gros bouton violet "Accepter · 5 min" avec countdown
- Détail plein écran avec map de la cliente + WhatsApp
- Références : Uber Eats Merchant, DoorDash Tablet

**Écran 4 — Mes produits (grid + add)**
- Grid 2 colonnes mobile / 3 desktop
- Cards avec image cover + name + status (approved / pending / rejected)
- FAB `+` en bas à droite pour ajouter (comme Instagram post)
- Modal add = fullscreen mobile avec steps : Photo → Info → Prix → Stock
- Références : Shopify Admin mobile, Etsy Seller

**Écran 5 — Mon stock**
- Liste dense avec image thumbnail + nom + compteur XL
- Boutons **-** et **+** de 56×56 (facile à taper d'une main pendant qu'elle emballe)
- Slider ou input direct pour ajustements rapides
- Alerte rouge/amber visible si stock bas
- Références : Shopify POS inventory, Vend

**Écran 6 — Paramètres**
- Photo de la marque + nom + note
- Sections en cards : Profil / Livraison / PIN / Support / Déconnexion
- Toggle **"En vacances"** (auto-refuse toutes les nouvelles commandes)
- Références : DoorDash Merchant settings, Instagram Business profile

### 4.3 Composants réutilisables
- **BrandCard** (card produit avec status)
- **OrderCard** (card commande avec CTA)
- **StockCounter** (compteur -/+ tap-friendly)
- **StatusBadge** (approved/pending/rejected/flagged)
- **HeroBanner** (revenue + KPI hero)
- **EmptyState** (illustration + copy)
- **BottomSheet** (modal mobile)
- **BottomNav** (5 items avec icônes)

### 4.4 Tone of voice / Microcopy

**Sur mesure Sénégal** :
- Français simple, phrases courtes
- Tutoiement pour proximité
- Emojis modérés (🇸🇳 ✨ 💛)
- Ex empty state : "Aucune commande pour l'instant. Elles arriveront quand tu seras prête 🌱"
- Ex confirmation : "Ta candidature est envoyée ! On te contacte sous 24h sur WhatsApp 💛"

**À éviter** :
- Jargon techno ("dashboard", "onboarding", "queue")
- Anglicismes ("commit", "process")
- Ton corporate

### 4.5 États UX critiques à couvrir

Pour chaque écran, prévoir :
- État vide (empty state) — illustration + copy motivante
- État loading (skeleton)
- État error — clair mais pas anxiogène
- État succès — feedback visuel (checkmark animé)
- Modal confirmation destructive (supprimer un produit)

---

## 5. Références visuelles

| App | Ce qu'on emprunte |
|---|---|
| **Shopify Admin** (mobile) | Structure produits + gestion stock |
| **DoorDash Merchant** | Cards commande + actions XL + notif live |
| **Instacart Shopper** | Login PIN + navigation bottom |
| **Etsy Seller** | Feeling artisanal + storytelling |
| **Faire.com / Ankorstore** | Positionnement "marque locale premium" |
| **Instagram Business** | Feed produits + insights |
| **Notion / Linear** | Système de design cohérent + typographie premium |

---

## 6. Contraintes techniques

- **Mobile-first** — la plupart des marques travailleront depuis leur iPhone
- **PWA** (pas d'app store) — installable via "Ajouter à l'écran d'accueil"
- **Palette figée** : violet Pedalel-like non négociable (identité posée)
- **Fonts** : system-ui / SF Pro / Inter (déjà en place)
- **iOS Safari 15+** + Chrome Android 100+
- **Anti-zoom viewport** : `font-size: 16px` sur les inputs pour éviter le zoom auto Safari
- **Safe-area** iOS respectée partout (top et bottom notch)
- **Dark mode** : pas prioritaire (v1 uniquement light)

---

## 7. Livrable idéal

**En 1 fichier Figma** (ou HTML/CSS mobiles) :

1. **Cover / présentation** de l'identité + palette + fonts
2. **Style guide** (buttons, inputs, cards, badges — tous les états)
3. **6 écrans clés** (voir 4.2) en versions mobile 393×852 (iPhone 15)
4. **3 flows animés** (login → dashboard, ajout produit, nouvelle commande)
5. **Empty states + illustrations** pour toutes les sections
6. **Icônes personnalisées** si créativité (sinon Feather / Heroicons OK)
7. **Marketing snippet** — 1 slide de pitch marque locale (pour convaincre Berroy de s'inscrire)

**Bonus si tu as le temps** :
- Version tablette (iPad Pro)
- Micro-interactions (hover states, taps)
- Composant "Vacations mode" (marque en pause)

---

## 8. Contacts

**Owner projet** : Ousmane Gakou · WhatsApp `+221 77 760 89 83`
**Repo code** : `github.com/ousmagakou-del/diaara`
**Dashboard live** : `https://yaram.app/brand`
**Test account** : dis à Ousmane et il te génère un accès marque test

**Timeline** : v1 attendue en **10 jours ouvrés**, avec 2 rounds de feedback prévus.

---

## Annexe A — Screens actuels (état des lieux)

Les composants existants sont dans `/Users/ousmanegakou/Documents/diaara/src/brand/*` :
- `BrandOrders.jsx`
- `BrandInventory.jsx`
- `BrandProducts.jsx`
- `BrandDashboard.jsx`
- `BrandSettings.jsx`
- `BrandInstallCard.jsx`

Le CSS est dans `src/pages/Brand.css` (classes préfixées `.brnd-*`).

Palette CSS variables déjà en place :
```css
--brand-violet: #7C3AED;
--brand-violet-dark: #5B21B6;
--brand-violet-soft: #F3E8FF;
--brand-violet-tint: #A78BFA;
```

---

## Annexe B — Flow business Marque

1. Admin YARAM active le dashboard depuis Admin → Marques → 🚀 Activer
2. Admin envoie par WhatsApp : URL `yaram.app/brand` + téléphone + PIN provisoire `123456`
3. Marque se connecte, change son PIN, ajoute ses 1ers produits
4. Chaque nouveau produit passe en queue modération admin
5. Admin approuve → produit devient live sur YARAM (visible dans Home, Search, catalogue)
6. Cliente commande → notification push + son ding chez la marque
7. Marque accepte / prépare / marque prête
8. Livreur Pedalel dispatché → passe récupérer chez la marque
9. Livraison cliente → marque a gagné (85% après commission YARAM 15% par défaut, configurable par marque)

Modèle testé et fonctionnel — le design doit sublimer ce flow, pas le réinventer.

---

Bon design ✨

*— Brief rédigé pour Claude Design par l'équipe YARAM · Juillet 2026*
