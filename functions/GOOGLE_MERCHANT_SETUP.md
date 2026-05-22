# Setup Google Merchant Center pour YARAM

Le feed `/google-feed.xml` est en place. Voilà comment le connecter à Google
Merchant Center pour faire apparaître tes produits gratuitement dans Google
Shopping (en plus des annonces payantes plus tard).

## Pourquoi c'est puissant

- **Gratuit** : Google affiche tes produits dans l'onglet Shopping (free listings)
  sans payer un centime depuis 2020. Tu paies seulement si tu fais des Shopping
  Ads (payant, mais optionnel).
- **SEO boosté** : Google indexe tes fiches produits plus vite et mieux.
- **Future-proof** : Quand tu voudras lancer Google Ads Shopping, le feed est
  déjà prêt — tu actives juste les campagnes en 1 click.

## 1. Crée un compte Google Merchant Center (10 min)

1. Va sur https://merchants.google.com
2. Connecte-toi avec **le même compte Google** que ton Google Search Console et
   GA4 (sinon tu vas devoir tout re-vérifier)
3. Pays cible : **Sénégal**
4. Devise : **XOF (Franc CFA Ouest-africain)**
5. Nom de l'entreprise : **YARAM**
6. Adresse : ton adresse de domiciliation au Sénégal
7. Site web : `https://yaram.app`

## 2. Vérifie ton domaine yaram.app (5 min)

Méthode recommandée : **HTML tag**

1. Dans Merchant Center → ⚙ → Préférences du compte → Identifiant Business →
   **Site web** → **Vérifier l'URL**
2. Choisis "Balise HTML" → Google te donne un truc du style :
   ```html
   <meta name="google-site-verification" content="ABCD1234..." />
   ```
3. Ajoute cette balise dans `index.html` au YARAM (dans `<head>`)
4. Push sur Cloudflare → attends 2 min que ça se propage
5. Retourne sur Merchant Center → **Vérifier**

Si tu as déjà vérifié yaram.app sur Google Search Console, la vérification est
**héritée automatiquement** → pas besoin de refaire.

## 3. Configure les Shipping (5 min)

Avant d'uploader le feed, Google demande tes politiques de livraison.

1. Menu gauche → **Outils et paramètres** → **Livraison et retours**
2. **Ajouter un service** :
   - Nom : `Standard Sénégal`
   - Pays : `Sénégal`
   - Tarif : `1500 XOF` (frais fixe Dakar)
   - Délai : `1-3 jours ouvrés`
3. Save

⚠️ Le feed contient déjà le tag `<g:shipping>` à 1500 XOF, mais Google veut aussi
les politiques globales dans le dashboard.

## 4. Configure les Retours (3 min)

Même menu → **Politique de retour** :
- Acceptes-tu les retours ? **Oui** (au moins pour les produits scellés/non ouverts)
- Délai : **7 jours**
- Frais de retour : **Gratuit** (ou à charge du client selon ta politique)

## 5. Connecte le feed produits (5 min)

1. Menu gauche → **Produits** → **Sources** (Source tabs)
2. **Ajouter un flux principal**
3. Pays : **Sénégal**
4. Langue : **Français**
5. Destination : **Annonces Shopping + Fiches produit gratuites** (coche les 2)
6. Continue
7. Type d'entrée : **Flux planifié**
8. Nom du flux : `YARAM Catalog`
9. **URL du flux** :
   ```
   https://yaram.app/google-feed.xml
   ```
10. **Fréquence** : Tous les jours (recommandé)
11. **Heure** : 03h00 GMT (la nuit en Afrique de l'Ouest, peu de trafic)
12. **Téléverser le flux**

Google va fetch immédiatement le feed. Après quelques minutes :

- Tu verras le nombre de produits chargés
- Les éventuels **warnings** ou **errors** par produit (à corriger)
- Le statut de chaque produit : "Actif" / "Refusé" / "En attente"

## 6. Vérifier que ton feed marche (1 min)

Avant même de configurer Merchant Center, teste ton feed depuis le terminal :

```bash
curl -s "https://yaram.app/google-feed.xml" | head -50
```

Tu dois voir le XML avec tes premiers produits. Si tu vois un `<description>`
avec "Error", regarde les logs Cloudflare Pages.

Tu peux aussi valider la structure avec :

```bash
curl -s "https://yaram.app/google-feed.xml" | xmllint --noout - && echo "XML valide"
```

## 7. Résoudre les warnings typiques

Quand Google a parsé ton feed, va dans **Diagnostics**. Warnings courants :

### "Identifier exists not set"
→ Déjà géré (`g:identifier_exists = no`).

### "Image too small"
→ Google veut des images **≥ 800×800 px**. Si tes images produits sont en 400×400,
augmente la résolution dans Supabase Storage.

### "Missing GTIN"
→ Pas grave car tu déclares `identifier_exists=no`, mais à long terme rajoute
les GTIN/EAN (codes-barres officiels) sur tes fiches produit. Avantage : Google
te montre dans plus de résultats.

### "Description too short"
→ Au moins 50 caractères. Mon feed met un fallback si `short_desc` est vide,
mais pense à remplir `long_desc` dans l'admin pour les produits importants.

### "Price suspended"
→ Si Google détecte que le prix sur ta page ≠ prix dans le feed (parsing
schema.org sur la page Product). Vérifie que `JSON-LD Product.offers.price`
matche le feed.

## 8. Bonus : Google Shopping Ads (payant, plus tard)

Quand le feed est actif et que tous les produits sont approuvés :

1. **Google Ads** → Crée un compte (si pas déjà)
2. Lie ton compte Google Ads à ton Merchant Center
3. Lance une **campagne Performance Max** avec budget de 5000-10000 FCFA/jour
   pour tester
4. Google va auto-optimiser : Shopping + Search + YouTube + Display

ROI typique au Sénégal pour le beauté : 2-5x return on ad spend après 2 semaines
d'apprentissage.

## 9. Suivi

Une fois actif :
- **Merchant Center → Performance** : impressions, clicks, CTR par produit
- **Google Search Console** : tes produits commencent à apparaître dans la
  section "Shopping results" des résultats organiques

Compte 2-7 jours pour que les premiers produits soient approuvés et visibles.
