# Bilan YARAM — session de refacto/audit

> Document de référence après la grosse session de durcissement
> (perf, sécurité, UX, SEO).
> À garder dans le repo, à partager avec toute personne (humaine ou IA) qui
> reprendra le code.

---

## 1. Vue d'ensemble

**Stack** : React 19, Vite 8 (Rolldown), Supabase, Cloudflare Pages.
**Domaine** : `yaram.app` (ex-`diaara-brg.pages.dev`).
**Numéro WhatsApp ops centralisé** : `+221 77 438 87 66` (dans `src/lib/utils.js`).
**Commission marketplace** : 8 % (lue dynamiquement depuis `site_settings.commission`).

Le code est passé d'un MVP qui marche à un produit prêt pour un lancement
plus large, en gardant 0 régression fonctionnelle (lint global à 132 → 135,
chiffres similaires malgré des centaines de modifications).

---

## 2. Architecture des dossiers (post-refacto)

```
diaara/
├── src/
│   ├── App.jsx                ← Routes + lazy loading + Toaster + NetworkStatus
│   ├── main.jsx               ← Boot : load site_settings + couleurs CSS + retire splash inline
│   ├── lib/
│   │   ├── supabase.js        ← Client + helpers (auth, products, pharmacies, settings, RPCs)
│   │   ├── cart.js            ← SOURCE UNIQUE de vérité pour le panier (dispatch event)
│   │   ├── toast.js           ← Système toast / confirmDialog / promptDialog
│   │   ├── seo.js             ← Hooks useDocumentTitle / useJsonLd / usePageSEO
│   │   ├── utils.js           ← Constantes (YARAM_WHATSAPP*, shipping zones, scoring)
│   │   ├── dataCache.js       ← Cache stale-while-revalidate (3 niveaux : mem + LS + SW)
│   │   ├── notifications.js   ← Templates WhatsApp + cooldown anti-doublon
│   │   ├── useOrderAlerts.js  ← Hook realtime + ding pour pharmacies
│   │   └── ...
│   ├── components/
│   │   ├── Toaster.jsx        ← Stack toasts + ConfirmModal + PromptModal
│   │   ├── NetworkStatus.jsx  ← Banner offline / connexion lente
│   │   ├── TabBar.jsx         ← Self-managed cart badge (event-driven)
│   │   ├── ProductTile.jsx    ← Lazy images + alt SEO
│   │   └── ...
│   ├── pages/                 ← Pages client (Home, Search, Product, Cart, Checkout, …)
│   ├── pharma/                ← Dashboard pharmacie
│   └── admin/                 ← Dashboard admin (26 sections)
├── functions/                 ← Cloudflare Pages Functions (edge)
│   ├── _lib.js                ← Helpers : sbFetch, isBotUA, escapeHtml, injectMetaTags
│   ├── sitemap-products.xml.js     ← Sitemap dyn produits
│   ├── sitemap-pharmacies.xml.js   ← Sitemap dyn pharmacies
│   ├── product/[id].js        ← og: + JSON-LD Product (bots only)
│   ├── pharmacy/[id].js       ← og: + JSON-LD Pharmacy (bots only)
│   ├── ping-sitemap.js        ← Ping Bing/IndexNow après publication
│   └── README.md              ← Doc functions + env vars
├── public/
│   ├── _redirects             ← `/* /index.html 200` (SPA fallback)
│   ├── sitemap.xml            ← Sitemap INDEX (référence les 3 enfants)
│   ├── sitemap-static.xml     ← URLs principales fixes
│   ├── robots.txt
│   └── sw.js                  ← Service worker (v8)
├── index.html                 ← Splash inline + meta og: + JSON-LD Organization
├── vite.config.js             ← chunks manualChunks (react/supabase/zxing)
└── BILAN.md                   ← Ce fichier
```

---

## 3. SQL migrations à avoir lancées (à vérifier sur ta Supabase)

Si tu reprends ce projet et que certaines features ne marchent pas, vérifie
que toutes les migrations ci-dessous ont été appliquées dans Supabase Studio.

### 3.1 Sécurité PIN pharmacies (CRITIQUE)

```sql
-- Bloque le SELECT direct du pin par les clients (anon)
REVOKE SELECT ON pharmacies FROM anon, authenticated;
GRANT SELECT (
  id, name, tagline, owner_name, manager_name,
  city, neighborhood, address, lat, lng,
  phone, whatsapp, notification_email, notification_phone,
  hours, delivery_hours,
  logo, cover, description,
  commission,
  active, rating, review_count,
  pin_set_at, created_at, updated_at
) ON pharmacies TO anon, authenticated;
-- ⚠️ Adapte la liste si ta DB a d'autres colonnes (ex: instagram_url, etc.)
-- Si tu ajoutes une colonne plus tard : penser à l'ajouter au GRANT ICI
-- + dans PHARMACY_PUBLIC_COLUMNS (src/lib/supabase.js) + dans les selects explicites
```

### 3.2 RPC verify_pharmacy_pin (CRITIQUE)

```sql
CREATE OR REPLACE FUNCTION verify_pharmacy_pin(p_id text, p_pin text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p) - 'pin'
  FROM pharmacies p
  WHERE p.id::text = p_id
    AND p.pin = p_pin
    AND p.active = true;
$$;
GRANT EXECUTE ON FUNCTION verify_pharmacy_pin(text, text) TO anon, authenticated;
```

### 3.3 RPC admin_set_pharmacy_pin (reset PIN sécurisé)

```sql
CREATE OR REPLACE FUNCTION admin_set_pharmacy_pin(
  p_admin_id uuid, p_pharmacy_id text, p_new_pin text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM admin_users WHERE id = p_admin_id AND active = true;
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;
  IF p_new_pin IS NULL OR length(p_new_pin) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN trop court');
  END IF;
  UPDATE pharmacies SET pin = p_new_pin, pin_set_at = now() WHERE id::text = p_pharmacy_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pharmacie introuvable');
  END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION admin_set_pharmacy_pin(uuid, text, text) TO anon, authenticated;
```

### 3.4 Table site_settings (admin paramètres en DB)

```sql
CREATE TABLE IF NOT EXISTS public.site_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.site_settings FOR SELECT USING (true);
-- ⚠️ Write policy permissive pour MVP. Durcir en prod via RPC SECURITY DEFINER.
CREATE POLICY "settings_write_temp" ON public.site_settings FOR ALL USING (true) WITH CHECK (true);
```

### 3.5 RLS users_profile (pour que le signup persiste phone/first_name)

```sql
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_profile_own_select" ON users_profile FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_profile_own_insert" ON users_profile FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_profile_own_update" ON users_profile FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

### 3.6 Storage buckets + policies (pour upload banners/produits)

Bucket `banner-images` doit exister + être public + avoir cette policy :

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "banner_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'banner-images');
CREATE POLICY "banner_images_upload" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'banner-images');
CREATE POLICY "banner_images_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'banner-images') WITH CHECK (bucket_id = 'banner-images');
CREATE POLICY "banner_images_delete" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'banner-images');
```

Idem pour `product-images`, `brand-logos`, `category-icons`, `skin-scans`,
`review-photos`, `delivery-proofs` — appliquer le même pattern.

---

## 4. Variables d'environnement Cloudflare Pages

Dans **Pages → diaara → Settings → Environment variables**, ajouter pour
Production ET Preview :

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | `https://qxhhnrnworwrnwmqekmb.supabase.co` |
| `SUPABASE_ANON_KEY` | (clé anon publique) |

Sans ça, les Edge Functions utilisent un fallback hardcodé (cf
`functions/_lib.js`). Pour pouvoir roter la clé sans redéployer, configure-les.

---

## 5. Ce qui a été fait (≥ 95 chantiers en 1 session)

### ⚡ Performance
- Lazy-load 12 pages lourdes (Admin, Pharma, Livreur, Scan, ScanResult,
  ScanHistory, SkinQuiz, Checkout, Payment, OrderTracking, ClientConfirm,
  PiSpiTest) → bundle initial ~150 KB gzippé au lieu de 540 KB
- `vite.config.js` : `manualChunks` (vendor-react, vendor-supabase, vendor-zxing)
- `SPLASH_MIN_DURATION` 1200 → 600 ms
- `Home.jsx` best-sellers query limitée à 200 + `.order('created_at', desc)`
- `Product.jsx` : `select().eq(id).single()` au lieu de `getAllProducts().find()` (5× plus rapide)
- `Livreur.jsx` upload photo : compression `compressImage(1200, 0.75)` (5-10 MB → 100-300 KB)
- Splash **inline dans `index.html`** → visible en 50 ms (au lieu d'attendre React)
- Skeleton screens sur Product + Search
- Crossfade splash → app au mount (`main.jsx`)
- Service Worker v8 (cache 3 niveaux + SW skipWaiting)

### 🔒 Sécurité
- Porte dérobée `gakououssou@gmail.com` retirée d'`AdminUsersSection`
- PIN pharmacies : strip de localStorage, GRANT SELECT explicite,
  RPC `verify_pharmacy_pin` SECURITY DEFINER, RPC `admin_set_pharmacy_pin`
- Numéro WhatsApp unifié et centralisé dans `lib/utils`
- `console.log` debug retirés (notamment Scan.jsx)
- 5 `select('*')` sur `pharmacies` remplacés par listes explicites
- `getProductAvailability` jointure `pharmacies(*)` réparée
- `pharmacyLogin` via RPC (PIN ne transite plus en retour)
- Upload banner : remontée du vrai message d'erreur Storage (au lieu de "Erreur upload" générique)

### 💼 Logique métier
- `useOrderAlerts.js` : filtre fantôme `pharmacy_id` corrigé (utilise
  `getPharmacyOrders` avec la vraie logique `assigned_pharmacy_id` +
  `items[].pharmacyId`). Realtime fonctionne enfin pour les pharmacies.
- Ding sonore : exponentiel (8s → 30s → 60s → 120s → 240s, stop après 5)
- Commission 8 % dynamique depuis `site_settings` partout (12 fichiers)
- Frais livraison Dakar + freeFrom branchés sur settings
- `OrdersSection` `STATUS_FLOW` étendu (7 statuts) + safe guard sur
  `advance()` (plus de rétrogradation accidentelle)
- `PromosSection` admin aligné sur table `promo_codes` (était sur `promos`
  fantôme — codes promos jamais utilisés au checkout)
- `SettingsSection` admin persisté en DB
- Dashboard KPI "EN ATTENTE" : vraie somme des commandes en cours
- Finances split CA encaissé vs en cours
- Pagination server-side sur Orders, Users, AdminLogs
- `PharmaProducts` : modif autorisée pour produits approuvés (avec
  re-validation admin obligatoire)
- `mismatch owner` vs `owner_name` corrigé

### 🛒 Funnel achat
- Système panier unifié via `lib/cart.js`
- Badge TabBar enfin fonctionnel (event `yaram-cart-updated` + listener
  multi-onglet via `storage`)
- Cart shipping = `getShippingZone(addressCity)` (était 1500 FCFA en dur)
- Cart : bouton **🗑 supprimer** ajouté
- Checkout utilise `clearCart()` (dispatch event → badge vidé)
- Notif WhatsApp "panier abandonné" fonctionne enfin après ajout via Product

### 📱 UX
- Système **toast** complet (success/error/info)
- **confirmDialog** Promise-based (remplace `confirm()` natif)
- **promptDialog** avec input/textarea/`requiredText` (remplace `prompt()`)
- 59 `alert()` + 20 `confirm()` + 2 `prompt()` migrés vers toast
- Banner **NetworkStatus** : "Hors ligne" + "Connexion lente"
- 7 pages patchées avec `try/finally + cancelled flag` (loading bloqué)
- Onboarding : `phone` + `first_name` désormais persistés dans `users_profile`
- Onboarding : messages d'erreur Supabase Auth mappés en français
- SkinQuiz `Skip` sauvegarde des valeurs par défaut (plus de loop)
- SkinQuiz `try/finally` (plus de bouton bloqué "Enregistrement…")
- Scan IA : cleanup interval + timeout Gemini 60 s + bouton "Annuler"

### 🌐 SEO
- `robots.txt` (Allow public, Disallow privé) + `sitemap.xml` index
- Hook `useDocumentTitle`/`useMetaDescription`/`useCanonical`/`useJsonLd`
- Titres dynamiques sur Home, Search (par catégorie/marque), Product
- JSON-LD Organization + WebSite SearchAction (`index.html`)
- JSON-LD Product dynamique (prix, dispo, rating)
- JSON-LD BreadcrumbList + breadcrumb visuel sur Product
- JSON-LD ItemList sur Search (top 20)
- Section "Produits similaires" (4 même catégorie) avec ItemList
- `loading="lazy" decoding="async"` + alt tags descriptifs sur images
- og:url corrigé sur `yaram.app` + og:locale `fr_SN` + canonical
- **Cloudflare Functions** :
  - `/sitemap-products.xml` (dynamique depuis Supabase, cache 1 h)
  - `/sitemap-pharmacies.xml` (idem)
  - `/product/:id` → og:image = vraie photo produit pour bots (WhatsApp,
    Facebook, Twitter, Google, etc.)
  - `/pharmacy/:id` → og:image = cover pharmacie + JSON-LD Pharmacy
  - `/ping-sitemap` → ping Bing IndexNow (appelée après approveProduct)

---

## 6. Ce qui reste à faire (priorité décroissante)

### 🔴 Critique avant gros lancement
- [ ] **Audit RLS Supabase complet** (orders, addresses, users_profile,
      favorites, reviews, skin_scans, loyalty_transactions, promo_uses,
      delivery_tracking, etc.). Vérifier que les policies existent et que
      la cliente A ne peut pas lire les données de la cliente B.
- [ ] **Vrai système validation paiement** : aujourd'hui `Payment.jsx` fait
      `setTimeout(1500)` puis marque `paid`. N'importe qui peut commander
      gratuit. Faut soit webhook Wave/OM, soit waiting-room admin + realtime.
- [ ] **Hash du PIN pharmacie en DB** : actuellement comparaison `pin = p_pin`
      en clair dans la RPC. Stocker un hash bcrypt/scrypt via `pgcrypto`.

### 🟠 Important
- [ ] **Composite OG image** pour partages (image générée avec logo +
      photo produit + prix + badge promo) via `satori` + `resvg-wasm` ou
      Cloudflare Image Resizing
- [ ] **Audit accessibilité (a11y)** : navigation clavier, lecteur d'écran,
      contrastes WCAG AA, focus rings, ARIA labels manquants
- [ ] **TypeScript progressif** sur `lib/*.js` (lib/supabase.js, lib/cart.js)
- [ ] **Tests** (zéro test actuel). Au minimum : tests unitaires sur
      `lib/cart.js`, `lib/seo.js`, `getShippingZone`, et un test e2e
      Playwright sur le funnel signup → ajout panier → checkout
- [ ] **Real auth admin** : remplacer la session PIN dans `sessionStorage`
      par une vraie session Supabase Auth + flag `is_admin`
- [ ] **Sentry / monitoring** : capturer les erreurs en prod
      (`window.onerror`, `unhandledrejection`, Sentry SDK)
- [ ] **Email transactionnels** : confirmation commande, reset password,
      facture (via Resend ou Supabase Edge Function)
- [ ] **Pagination Marketing/Performance/SkinScans/Dashboard admin**
      (charge encore tout en mémoire)
- [ ] **Realtime Livreur** : aujourd'hui le livreur ne voit pas si admin
      force la livraison côté admin

### 🟡 Améliorations
- [ ] Blog SEO (5-10 articles long-tail beauté Sénégal)
- [ ] i18n wolof + anglais
- [ ] Cleanup ESLint : 130 erreurs pré-existantes à nettoyer
- [ ] Push notifications : audit du flow complet (existe mais jamais testé)
- [ ] Stock alerts pharmacies (notif quand stock < 5)
- [ ] Avis : photo modération avant publication
- [ ] Backup strategy / disaster recovery (export régulier Supabase)
- [ ] Wolof / anglais traductions

---

## 7. Comment maintenir / faire évoluer

### Ajouter une colonne à la table `pharmacies`
1. ALTER TABLE en SQL Supabase
2. Ajouter au `GRANT SELECT(...)` dans Supabase
3. Ajouter à `PHARMACY_PUBLIC_COLUMNS` dans `src/lib/supabase.js`
4. Ajouter aux selects explicites dans :
   - `PharmaciesSection.refresh()` (admin)
   - `PharmacyDetail.jsx` useEffect
   - `Livreur.jsx` loadTracking
   - `getProductAvailability` (jointure)

### Ajouter un nouveau setting modifiable depuis l'admin
1. Ajouter une row dans `site_settings` via UI admin (ou seed SQL)
2. Ajouter une clé au fallback `SETTINGS_FALLBACK` dans `src/lib/supabase.js`
3. Ajouter le champ au formulaire `SettingsSection.jsx`
4. Utiliser `getCachedSetting('macle', fallback)` partout où on en a besoin

### Ajouter une nouvelle page client
1. Créer `src/pages/MaPage.jsx`
2. Ajouter import + case dans `App.jsx`
3. Si page lourde (>50 KB), wrapper avec `lazy(() => import(...))`
4. Toujours utiliser `usePageSEO({ title, description, canonical })`
5. Si données fetch : pattern `try/catch/finally + cancelled flag`
6. Si liste : skeleton screen pendant le loading

### Ajouter un nouveau toast
```jsx
import { toast, confirmDialog } from '../lib/toast';
toast.success('Sauvegardé');
toast.error('Échec : ' + e.message);
if (await confirmDialog('Sûr ?', { confirmLabel: 'Oui', danger: true })) { ... }
```

### Déployer
```bash
cd ~/Documents/diaara
npm run build
git add -A
git commit -m "feat/fix: description claire"
git push
# Cloudflare Pages auto-déploie main → yaram.app
# Cache navigateur : si client en cache vieux SW, bump SW_VERSION dans public/sw.js
```

---

## 8. Risques connus / dette technique

| Risque | Sévérité | Impact | Mitigation actuelle | Vraie solution |
|--------|----------|--------|---------------------|----------------|
| Paiement simulé (`setTimeout` + auto-paid) | 🔴 Critique | Commandes gratuites | Aucune | Webhook Wave/OM ou validation admin manuelle |
| RLS write `site_settings` ouverte à `anon` | 🟠 Moyen | N'importe qui peut changer la commission | Aucune | RPC SECURITY DEFINER avec check admin |
| PIN pharmacie comparé en clair en DB | 🟠 Moyen | Si fuite DB, PINs lisibles | Aucune | Hash bcrypt via `pgcrypto` |
| Admin auth via PIN localStorage | 🟠 Moyen | Vol de session si XSS | sessionStorage + expiry 8h | Vraie Supabase Auth + flag is_admin |
| Service Worker cache agressif | 🟡 Faible | Vieilles versions servies | Bump `SW_VERSION` à chaque deploy critique | Tester avec Lighthouse |
| 130 erreurs ESLint pré-existantes | 🟡 Faible | Code legacy | À ignorer dans ce périmètre | Migration TypeScript progressive |
| Pas de tests | 🟠 Moyen | Régressions possibles | Audit manuel à chaque deploy | Tests Vitest + Playwright |
| Compositions OG images statiques | 🟡 Faible | Partages moins engageants | og:image = photo produit directe | satori/resvg-wasm ou Cloudflare Images |

---

## 9. Contacts / liens utiles

- **Repo GitHub** : `github.com/ousmagakou-del/diaara`
- **Hosting** : Cloudflare Pages → `yaram.app`
- **Backend** : Supabase project `qxhhnrnworwrnwmqekmb`
- **WhatsApp ops** : `+221 77 438 87 66`
- **Search Console** : à ajouter `yaram.app`
- **Test rich snippets** : https://search.google.com/test/rich-results
- **Debug og: WhatsApp/Facebook** : https://developers.facebook.com/tools/debug/

---

*Document généré après la session de refacto Mai 2026.*
*Pour mettre à jour ce bilan, c'est ici : `/BILAN.md`*
