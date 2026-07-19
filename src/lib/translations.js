// ════════════════════════════════════════════════════════════════════
// YARAM — Dictionnaire i18n FR + EN
// ────────────────────────────────────────────────────────────────────
// Seulement les strings visibles principales (hero, nav, footer, CTAs
// core cart/checkout/product). Le reste tombe en fallback FR.
// Ajouter des cles ici plutot que de reecrire le texte en dur.
// ════════════════════════════════════════════════════════════════════

export const DEFAULT_LANG = 'fr';
export const SUPPORTED_LANGS = ['fr', 'en'];

export const LANG_LABELS = {
  fr: { code: 'FR', name: 'Français' },
  en: { code: 'EN', name: 'English' },
};

export const translations = {
  fr: {
    // ─── Nav / Header ─────────────────────────────────────────────
    'nav.catalogue': 'Catalogue',
    'nav.brands': 'Marques',
    'nav.international': 'International',
    'nav.pharmacies': 'Pharmacies',
    'nav.help': 'Aide',
    'nav.login': 'Se connecter',
    'nav.account': 'Mon compte',
    'nav.download': "Télécharger l'app",
    'nav.search': 'Rechercher',
    'nav.cart': 'Panier',
    'nav.menu': 'Menu',

    // ─── Landing hero ─────────────────────────────────────────────
    'landing.hero.title.line1': 'La beauté du Sénégal,',
    'landing.hero.title.line2': 'livrée chez toi.',
    'landing.hero.sub': "Plus de 5 000 produits cosmétiques et soins authentiques, sélectionnés par nos pharmaciens partenaires.",
    'landing.hero.cta.download': "Télécharger l'app",
    'landing.hero.cta.explore': 'Explorer le catalogue',
    'landing.hero.trust.appstore': 'App Store',
    'landing.hero.trust.products': 'Produits',
    'landing.hero.trust.pharmacies': 'Pharmacies',
    'landing.hero.brands.label': 'Nos marques partenaires',

    // ─── Landing sections ─────────────────────────────────────────
    'landing.how.title': 'Une expérience pensée pour toi',
    'landing.how.sub': 'Du catalogue à ta porte, tout est conçu pour te simplifier la vie.',
    'landing.how.step1.title': 'Tu choisis',
    'landing.how.step1.body': 'Plus de 5 000 produits beauté, soins et bien-être triés sur le volet par nos pharmaciens.',
    'landing.how.step2.title': 'On prépare',
    'landing.how.step2.body': 'Une pharmacie partenaire prépare ta commande avec des produits authentiques garantis.',
    'landing.how.step3.title': 'Tu reçois',
    'landing.how.step3.body': 'Livraison à domicile partout à Dakar, avec un suivi en temps réel sur l\'app.',

    'landing.brands.title': 'Les plus grandes marques',
    'landing.brands.sub': "Bioderma, La Roche-Posay, Caudalie, Vichy, Avène, Embryolisse et bien d'autres — toutes officielles, toutes garanties.",
    'landing.brands.seeAll': 'Voir toutes les marques',

    'landing.app.badge': "L'expérience complète",
    'landing.app.title': "L'app YARAM, le meilleur de la beauté à portée de main",

    'landing.partner.eyebrow': 'POUR LES PHARMACIES',
    'landing.partner.title': 'Booste tes ventes avec YARAM',
    'landing.partner.cta': 'Devenir pharmacie partenaire',

    'landing.driver.eyebrow': 'POUR LES LIVREURS',
    'landing.driver.title': 'Gagne ta journée avec YARAM',
    'landing.driver.cta': 'Devenir livreur YARAM',

    // ─── Shop home ────────────────────────────────────────────────
    'shop.brands.title': 'Marques',
    'shop.brands.sub': 'Sélection dermato reconnue par nos pharmaciens',
    'shop.brands.seeAll': 'Voir toutes les marques',
    'shop.categories.title': 'Catégories',
    'shop.categories.sub': 'Parcourir par univers',
    'shop.forYou.title': 'Pour toi',
    'shop.forYou.sub': 'Sélection personnalisée sur votre profil et vos favoris',
    'shop.trending.title': 'Tendances cette semaine',
    'shop.trending.sub': 'Les plus vus et achetés ces 7 derniers jours',
    'shop.new.title': 'Nouveautés',
    'shop.new.sub': 'Les dernières références ajoutées au catalogue',
    'shop.deals.title': 'Bons plans',
    'shop.deals.sub': 'Meilleures réductions du moment',
    'shop.bestSellers.title': 'Best-sellers Dakar',
    'shop.bestSellers.sub': 'Ce que Dakar achète cette semaine',
    'shop.reco.title': 'Recommandé pour vous',
    'shop.reco.sub': 'Sélection basée sur votre profil',
    'shop.lowStock.title': 'Fin de stock',
    'shop.lowStock.sub': 'Derniers exemplaires disponibles',
    'shop.all.title': 'Tous les produits',
    'shop.all.viewAll': 'Voir tous les produits',

    // ─── Product page ─────────────────────────────────────────────
    'product.addToCart': 'Ajouter au panier',
    'product.buyNow': 'Acheter maintenant',
    'product.outOfStock': 'Rupture de stock',
    'product.notifyMe': 'Prévenez-moi',
    'product.description': 'Description',
    'product.reviews': 'Avis',
    'product.details': 'Caractéristiques',
    'product.share': 'Partager',
    'product.favorite': 'Ajouter aux favoris',
    'product.quantity': 'Quantité',
    'product.price': 'Prix',

    // ─── Cart ─────────────────────────────────────────────────────
    'cart.title': 'Mon panier',
    'cart.empty': 'Votre panier est vide',
    'cart.emptyCta': 'Explorer le catalogue',
    'cart.subtotal': 'Sous-total',
    'cart.delivery': 'Livraison',
    'cart.total': 'Total',
    'cart.checkout': 'Passer commande',
    'cart.continueShopping': 'Continuer mes achats',
    'cart.remove': 'Retirer',

    // ─── Checkout ─────────────────────────────────────────────────
    'checkout.title': 'Commande',
    'checkout.deliveryAddress': 'Adresse de livraison',
    'checkout.deliveryMethod': 'Mode de livraison',
    'checkout.paymentMethod': 'Moyen de paiement',
    'checkout.orderSummary': 'Récapitulatif',
    'checkout.placeOrder': 'Confirmer la commande',
    'checkout.processing': 'Traitement en cours…',

    // ─── Auth ─────────────────────────────────────────────────────
    'auth.login': 'Connexion',
    'auth.signup': 'Créer un compte',
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'auth.forgot': 'Mot de passe oublié ?',
    'auth.continueWithGoogle': 'Continuer avec Google',
    'auth.continueWithApple': 'Continuer avec Apple',
    'auth.noAccount': "Pas de compte ?",
    'auth.haveAccount': 'Déjà un compte ?',

    // ─── Footer ───────────────────────────────────────────────────
    'footer.tagline': 'La première parapharmacie 100% digitale du Sénégal. Livraison express, produits authentiques.',
    'footer.product': 'Produit',
    'footer.forPros': 'Pour pros',
    'footer.pharmaciesPartners': 'Pharmacies partenaires',
    'footer.becomeDriver': 'Devenir livreur',
    'footer.distributors': 'Distributeurs',
    'footer.support': 'Support',
    'footer.helpFaq': 'Aide & FAQ',
    'footer.whatsapp': 'WhatsApp',
    'footer.privacy': 'Confidentialité',
    'footer.legal': 'Mentions légales',
    'footer.brand': 'YARAM',
    'footer.terms': 'CGV',
    'footer.contact': 'Nous contacter',
    'footer.copyright': '© 2026 Komunity SN — Dakar, Sénégal',

    // ─── Langue ───────────────────────────────────────────────────
    'lang.picker': 'Langue',
  },

  en: {
    // ─── Nav / Header ─────────────────────────────────────────────
    'nav.catalogue': 'Catalog',
    'nav.brands': 'Brands',
    'nav.international': 'International',
    'nav.pharmacies': 'Pharmacies',
    'nav.help': 'Help',
    'nav.login': 'Sign in',
    'nav.account': 'My account',
    'nav.download': 'Download the app',
    'nav.search': 'Search',
    'nav.cart': 'Cart',
    'nav.menu': 'Menu',

    // ─── Landing hero ─────────────────────────────────────────────
    'landing.hero.title.line1': "Senegal's beauty,",
    'landing.hero.title.line2': 'delivered to your door.',
    'landing.hero.sub': 'Over 5,000 authentic beauty and skincare products, curated by our partner pharmacists.',
    'landing.hero.cta.download': 'Download the app',
    'landing.hero.cta.explore': 'Browse catalog',
    'landing.hero.trust.appstore': 'App Store',
    'landing.hero.trust.products': 'Products',
    'landing.hero.trust.pharmacies': 'Pharmacies',
    'landing.hero.brands.label': 'Our partner brands',

    // ─── Landing sections ─────────────────────────────────────────
    'landing.how.title': 'An experience built for you',
    'landing.how.sub': 'From catalog to your doorstep — everything is designed to make life easier.',
    'landing.how.step1.title': 'You choose',
    'landing.how.step1.body': 'Over 5,000 beauty, skincare and wellness products handpicked by our pharmacists.',
    'landing.how.step2.title': 'We prepare',
    'landing.how.step2.body': 'A partner pharmacy prepares your order with guaranteed authentic products.',
    'landing.how.step3.title': 'You receive',
    'landing.how.step3.body': 'Home delivery across Dakar with real-time tracking in the app.',

    'landing.brands.title': 'The biggest brands',
    'landing.brands.sub': 'Bioderma, La Roche-Posay, Caudalie, Vichy, Avène, Embryolisse and many more — all official, all guaranteed.',
    'landing.brands.seeAll': 'View all brands',

    'landing.app.badge': 'The full experience',
    'landing.app.title': 'The YARAM app — the best of beauty at your fingertips',

    'landing.partner.eyebrow': 'FOR PHARMACIES',
    'landing.partner.title': 'Boost your sales with YARAM',
    'landing.partner.cta': 'Become a partner pharmacy',

    'landing.driver.eyebrow': 'FOR DRIVERS',
    'landing.driver.title': 'Earn your day with YARAM',
    'landing.driver.cta': 'Become a YARAM driver',

    // ─── Shop home ────────────────────────────────────────────────
    'shop.brands.title': 'Brands',
    'shop.brands.sub': 'Dermatologist-approved selection from our pharmacists',
    'shop.brands.seeAll': 'View all brands',
    'shop.categories.title': 'Categories',
    'shop.categories.sub': 'Browse by universe',
    'shop.forYou.title': 'For you',
    'shop.forYou.sub': 'Personalized picks based on your profile and favorites',
    'shop.trending.title': 'Trending this week',
    'shop.trending.sub': 'Most viewed and bought over the last 7 days',
    'shop.new.title': 'New arrivals',
    'shop.new.sub': 'Latest additions to the catalog',
    'shop.deals.title': 'Deals',
    'shop.deals.sub': 'Best discounts of the moment',
    'shop.bestSellers.title': 'Best-sellers in Dakar',
    'shop.bestSellers.sub': 'What Dakar is buying this week',
    'shop.reco.title': 'Recommended for you',
    'shop.reco.sub': 'Curated for your profile',
    'shop.lowStock.title': 'Low stock',
    'shop.lowStock.sub': 'Last units available',
    'shop.all.title': 'All products',
    'shop.all.viewAll': 'View all products',

    // ─── Product page ─────────────────────────────────────────────
    'product.addToCart': 'Add to cart',
    'product.buyNow': 'Buy now',
    'product.outOfStock': 'Out of stock',
    'product.notifyMe': 'Notify me',
    'product.description': 'Description',
    'product.reviews': 'Reviews',
    'product.details': 'Details',
    'product.share': 'Share',
    'product.favorite': 'Add to favorites',
    'product.quantity': 'Quantity',
    'product.price': 'Price',

    // ─── Cart ─────────────────────────────────────────────────────
    'cart.title': 'My cart',
    'cart.empty': 'Your cart is empty',
    'cart.emptyCta': 'Browse catalog',
    'cart.subtotal': 'Subtotal',
    'cart.delivery': 'Delivery',
    'cart.total': 'Total',
    'cart.checkout': 'Checkout',
    'cart.continueShopping': 'Continue shopping',
    'cart.remove': 'Remove',

    // ─── Checkout ─────────────────────────────────────────────────
    'checkout.title': 'Checkout',
    'checkout.deliveryAddress': 'Delivery address',
    'checkout.deliveryMethod': 'Delivery method',
    'checkout.paymentMethod': 'Payment method',
    'checkout.orderSummary': 'Summary',
    'checkout.placeOrder': 'Place order',
    'checkout.processing': 'Processing…',

    // ─── Auth ─────────────────────────────────────────────────────
    'auth.login': 'Sign in',
    'auth.signup': 'Create account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgot': 'Forgot password?',
    'auth.continueWithGoogle': 'Continue with Google',
    'auth.continueWithApple': 'Continue with Apple',
    'auth.noAccount': 'No account?',
    'auth.haveAccount': 'Already have an account?',

    // ─── Footer ───────────────────────────────────────────────────
    'footer.tagline': "Senegal's first 100% digital para-pharmacy. Express delivery, authentic products.",
    'footer.product': 'Product',
    'footer.forPros': 'For pros',
    'footer.pharmaciesPartners': 'Partner pharmacies',
    'footer.becomeDriver': 'Become a driver',
    'footer.distributors': 'Distributors',
    'footer.support': 'Support',
    'footer.helpFaq': 'Help & FAQ',
    'footer.whatsapp': 'WhatsApp',
    'footer.privacy': 'Privacy',
    'footer.legal': 'Legal notice',
    'footer.brand': 'YARAM',
    'footer.terms': 'Terms',
    'footer.contact': 'Contact us',
    'footer.copyright': '© 2026 Komunity SN — Dakar, Senegal',

    // ─── Langue ───────────────────────────────────────────────────
    'lang.picker': 'Language',
  },
};

export default translations;
