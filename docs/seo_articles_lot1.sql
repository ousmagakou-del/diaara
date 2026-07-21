-- Lot 1 : 6 articles SEO ciblés requêtes Sénégal (bench juillet 2026)
-- Idempotent : ON CONFLICT (slug) DO NOTHING

INSERT INTO blog_articles (slug, title, subtitle, content_md, tags, author_name, seo_title, seo_description, seo_keywords, read_time_min, published, featured, published_at)
VALUES
(
  'creme-solaire-peau-noire-senegal',
  'Crème solaire pour peau noire au Sénégal : le guide complet',
  'Non, la peau noire n''est pas naturellement protégée du soleil. Voici comment choisir ta protection solaire à Dakar.',
  $md$## Pourquoi la peau noire a besoin de crème solaire

C'est le mythe le plus répandu au Sénégal : « la peau noire ne craint pas le soleil ». En réalité, la mélanine offre une protection naturelle équivalente à un SPF 13 environ — très loin du SPF 30 minimum recommandé par les dermatologues. Résultat : taches d'hyperpigmentation, vieillissement prématuré, et un risque de cancer cutané souvent diagnostiqué trop tard sur peau foncée.

## Le vrai problème : les traces blanches

Si tu as abandonné la crème solaire, c'est probablement à cause du film blanc que laissent les filtres minéraux classiques. Bonne nouvelle : les formules récentes dites « invisibles » ou « no white cast » sont conçues pour les peaux mélaninées et pénètrent sans trace.

## Comment choisir à Dakar

- **SPF 30 minimum, SPF 50 si tu travailles dehors** ou si tu traites des taches
- **Large spectre (UVA + UVB)** : les UVA aggravent l'hyperpigmentation, même à travers les vitres
- **Texture gel ou fluide** pour le climat humide de Dakar — évite les crèmes épaisses qui brillent
- **Non comédogène** si tu as la peau grasse ou de l'acné

## Quand et comment l'appliquer

Chaque matin, en dernière étape de ta routine, même par temps nuageux — les UV traversent les nuages. La bonne dose : deux phalanges de doigt pour le visage et le cou. Renouvelle toutes les 2-3 heures si tu restes dehors.

## L'erreur qui ruine tout

Utiliser une crème solaire pendant un traitement anti-taches puis l'arrêter : les taches reviennent en quelques semaines. La protection solaire n'est pas une option, c'est le socle de tout traitement d'hyperpigmentation.

## Trouver la bonne crème solaire au Sénégal

Sur YARAM, les crèmes solaires adaptées aux peaux mélaninées sont sélectionnées par nos pharmaciens partenaires et livrées en 1h30 à Dakar. En cas de doute sur ton type de peau, fais le scan de peau IA gratuit dans l'app, ou consulte un dermatologue certifié en ligne dès 3 000 F CFA.$md$,
  ARRAY['solaire','peau noire','SPF','hyperpigmentation'],
  'Équipe YARAM',
  'Crème solaire peau noire Sénégal : guide 2026 | YARAM',
  'La peau noire a besoin de protection solaire. SPF conseillé, textures sans traces blanches, erreurs à éviter : le guide complet pour Dakar, par YARAM.',
  ARRAY['crème solaire peau noire','crème solaire Sénégal','SPF peau noire','protection solaire Dakar'],
  6, true, true, now()
),
(
  'parapharmacie-en-ligne-dakar',
  'Parapharmacie en ligne à Dakar : comment ça marche et laquelle choisir',
  'Produits authentiques, livraison en 1h30, paiement Wave : ce qui a changé en 2026.',
  $md$## La parapharmacie passe en ligne au Sénégal

Trouver le bon produit de soin à Dakar ressemblait longtemps à un parcours du combattant : pharmacies en rupture, contrefaçons au marché, prix qui varient du simple au triple. Les parapharmacies en ligne ont changé la donne — à condition de savoir les choisir.

## Les 4 critères qui comptent

- **L'authenticité** : le site s'approvisionne-t-il auprès de pharmacies agréées ? C'est LE critère. Les contrefaçons de cosmétiques sont courantes et peuvent être dangereuses (dépigmentants cachés, corticoïdes).
- **La rapidité de livraison** : entre 24h et 48h chez la plupart des acteurs. YARAM livre en 1h30 à Dakar depuis la pharmacie partenaire la plus proche de chez toi.
- **Le paiement local** : Wave ou Orange Money, sans carte bancaire obligatoire.
- **Le conseil** : un produit mal choisi est un produit gaspillé. Privilégie les plateformes qui offrent un vrai accompagnement.

## Ce que seul YARAM propose

YARAM n'est pas une simple boutique en ligne : c'est la première parapharmacie du Sénégal avec un **scan de peau par intelligence artificielle** (gratuit, dans l'app) et une **consultation dermatologue en ligne** dès 3 000 F CFA. Concrètement : tu scannes ta peau, l'IA analyse ton type de peau et tes besoins, et si nécessaire un dermatologue certifié inscrit à l'Ordre des Médecins du Sénégal te répond en moins de 2h avec une ordonnance signée. Les produits prescrits sont ensuite livrés chez toi en 1h30.

## Les prix

Les produits en parapharmacie en ligne sont généralement au même prix qu'en officine, parfois moins chers grâce aux promotions. Sur YARAM il n'y a aucun frais de service — tu paies le prix pharmacie + la livraison.

## Comment commander sur YARAM

1. Va sur yaram.app ou télécharge l'app YARAM
2. Cherche ton produit ou explore par catégorie (solaire, anti-taches, cheveux, bébé…)
3. Paye par Wave, Orange Money ou carte
4. Reçois ta commande en 1h30 à Dakar$md$,
  ARRAY['parapharmacie','Dakar','livraison','Wave'],
  'Équipe YARAM',
  'Parapharmacie en ligne Dakar : guide 2026 | YARAM',
  'Comment choisir sa parapharmacie en ligne à Dakar : authenticité, livraison 1h30, paiement Wave, conseil dermatologique. Le guide YARAM.',
  ARRAY['parapharmacie en ligne Dakar','parapharmacie Sénégal','acheter cosmétiques Dakar','pharmacie en ligne Sénégal'],
  5, true, true, now()
),
(
  'dermatologue-en-ligne-senegal',
  'Consulter un dermatologue en ligne au Sénégal : prix, délais, comment faire',
  'Fini les semaines d''attente : un dermatologue certifié te répond en moins de 2h depuis ton téléphone.',
  $md$## Le problème de l'accès au dermatologue au Sénégal

Le Sénégal compte très peu de dermatologues pour 18 millions d'habitants, concentrés à Dakar. Conséquence : plusieurs semaines d'attente pour un rendez-vous, une consultation entre 15 000 et 25 000 F CFA, et des trajets impossibles depuis les régions. Beaucoup renoncent — ou pire, s'automédiquent avec des produits inadaptés.

## La téléconsultation dermatologique : comment ça marche

La dermatologie est la spécialité qui se prête le mieux à la consultation à distance : la plupart des diagnostics se font à l'œil. Sur YARAM, deux formules :

- **Consultation express — 3 000 F CFA** : tu envoies 1 à 3 photos de ton problème (acné, boutons, taches, eczéma, mycose, chute de cheveux…) avec une description. Un dermatologue certifié te répond en moins de 2h avec un diagnostic et une ordonnance signée.
- **Téléconsultation vidéo — 10 000 F CFA** : 20 minutes en face-à-face vidéo avec le spécialiste, au créneau de ton choix.

## Est-ce fiable ?

Les dermatologues YARAM sont inscrits à l'Ordre des Médecins du Sénégal. L'ordonnance délivrée est signée et valable en pharmacie. Et si le médecin estime que ton cas nécessite un examen physique, il te le dira et t'orientera — la téléconsultation ne remplace pas l'hôpital pour les cas graves.

## Le plus YARAM : du diagnostic au traitement livré

C'est le seul service au Sénégal où tout est intégré : ton scan de peau IA gratuit est transmis au médecin, l'ordonnance arrive dans l'app, et les produits prescrits disponibles en pharmacie partenaire sont livrés chez toi en 1h30 à Dakar. Tu passes du bouton au traitement en une après-midi.

## Quand consulter

Consulte sans attendre si : une tache change de couleur ou de taille, une plaie ne cicatrise pas, des démangeaisons persistent plus de 2 semaines, ou une éruption s'étend. Pour l'acné et les taches, plus tu consultes tôt, plus le traitement est simple.$md$,
  ARRAY['dermatologue','téléconsultation','acné','santé peau'],
  'Équipe YARAM',
  'Dermatologue en ligne Sénégal : dès 3 000 F CFA | YARAM',
  'Consulte un dermatologue certifié en ligne au Sénégal : photos + réponse en 2h dès 3 000 F CFA, ou visio 20 min. Ordonnance signée, produits livrés à Dakar.',
  ARRAY['dermatologue en ligne Sénégal','dermatologue Dakar','téléconsultation dermatologie','consultation dermatologue prix'],
  6, true, true, now()
),
(
  'routine-peau-grasse-acne-dakar',
  'Peau grasse et acné à Dakar : la routine qui marche sous notre climat',
  'Chaleur, humidité, poussière : le climat dakarois met la peau grasse à rude épreuve. Voici la routine adaptée.',
  $md$## Pourquoi ta peau brille plus à Dakar

Chaleur + humidité = production de sébum en surrégime. Ajoute la poussière de l'harmattan et la sueur, et tu obtiens le cocktail parfait pour les pores bouchés et les boutons. Une routine pensée pour un climat européen ne marche pas ici.

## La routine matin (4 étapes, 5 minutes)

- **Nettoyant doux sans savon** : un gel purifiant au pH physiologique. Évite les savons antiseptiques agressifs qui font produire encore plus de sébum en réaction.
- **Hydratant léger non comédogène** : oui, même la peau grasse doit s'hydrater — une peau déshydratée surproduit du sébum. Choisis un gel ou une émulsion, pas une crème riche.
- **Crème solaire SPF 30+ toucher sec** : indispensable, surtout si tu as des marques d'acné (elles foncent au soleil).
- Le soir : renettoie et applique ton traitement ciblé si tu en as un.

## Les 3 erreurs qui aggravent tout

1. **Frotter et décaper** : gommages quotidiens, citron, bicarbonate… la peau agressée se défend en produisant plus de gras.
2. **Percer les boutons** : sur peau mélaninée, chaque bouton percé laisse une tache sombre qui met des mois à partir.
3. **Multiplier les produits** : plus de 4-5 produits, c'est l'irritation garantie. La constance bat la quantité.

## Quand l'acné nécessite un médecin

Si ton acné est douloureuse, kystique, étendue au dos et au torse, ou qu'elle laisse des cicatrices, les cosmétiques ne suffiront pas : il faut une ordonnance. Sur YARAM tu peux consulter un dermatologue certifié en ligne dès 3 000 F CFA avec une réponse en moins de 2h — et recevoir les produits prescrits en 1h30 à Dakar.

## Par où commencer

Fais le scan de peau IA gratuit dans l'app YARAM : il évalue ton niveau de sébum, tes zones à problème et te recommande une routine avec des produits disponibles en pharmacie partenaire.$md$,
  ARRAY['acné','peau grasse','routine','Dakar'],
  'Équipe YARAM',
  'Peau grasse et acné à Dakar : routine efficace | YARAM',
  'La routine anti-acné adaptée au climat de Dakar : nettoyage doux, hydratation légère, SPF, erreurs à éviter. Et quand consulter un dermatologue.',
  ARRAY['acné peau noire','routine peau grasse','bouton visage traitement','soin visage Dakar'],
  6, true, false, now()
),
(
  'taches-hyperpigmentation-peau-noire',
  'Taches sombres et hyperpigmentation sur peau noire : que faire (et ne pas faire)',
  'Taches d''acné, masque de grossesse, cicatrices qui foncent : comprendre et traiter l''hyperpigmentation.',
  $md$## Pourquoi la peau noire marque plus

La peau riche en mélanine réagit à la moindre agression — bouton, coupure, frottement, piqûre — en produisant un excès de pigment : c'est l'hyperpigmentation post-inflammatoire. C'est le motif n°1 de consultation dermatologique chez les peaux foncées, au Sénégal comme ailleurs.

## Les 3 types de taches les plus courants

- **Taches post-acné** : marques sombres laissées par les boutons, surtout s'ils ont été percés
- **Mélasma (masque de grossesse)** : plaques symétriques sur les joues et le front, hormonodépendantes, aggravées par le soleil
- **Taches de frottement** : coudes, genoux, aisselles, entre les cuisses

## Ce qui marche vraiment

- **La protection solaire quotidienne SPF 30-50** : sans elle, aucun traitement ne tient. Les UV réactivent la production de pigment en permanence.
- **Les actifs éclaircissants sûrs** : vitamine C, niacinamide, acide azélaïque, alpha-arbutine — ils régulent la production de mélanine sans détruire la peau.
- **La patience** : une tache récente part en 2-3 mois ; une tache ancienne peut demander 6-12 mois de constance.

## Ce qu'il ne faut JAMAIS faire

Les produits dépigmentants agressifs (hydroquinone à forte dose non encadrée, corticoïdes détournés, mélanges artisanaux « khessal ») éclaircissent d'abord… puis détruisent la barrière cutanée : vergetures, acné cortisonique, taches rebond encore plus foncées, infections. Si un produit éclaircit en quelques jours, c'est un signal d'alarme, pas un miracle.

## Quand consulter

Si tes taches s'étendent, résistent après 3 mois de routine adaptée, ou si tu suspectes un mélasma, consulte un dermatologue. Sur YARAM, envoie simplement 1 à 3 photos de tes taches : un dermatologue certifié te répond en moins de 2h dès 3 000 F CFA, avec une ordonnance adaptée à ta peau — et les produits livrés en 1h30 à Dakar.$md$,
  ARRAY['hyperpigmentation','taches','peau noire','mélasma'],
  'Équipe YARAM',
  'Taches sur peau noire : traiter l''hyperpigmentation | YARAM',
  'Taches post-acné, mélasma, cicatrices foncées : ce qui marche vraiment sur peau noire, les dangers des dépigmentants, et quand consulter un dermatologue.',
  ARRAY['taches noires visage','hyperpigmentation peau noire','enlever taches visage','mélasma traitement'],
  7, true, true, now()
),
(
  'depigmentation-xessal-dangers-alternatives',
  'Dépigmentation (xessal) : ce que ta peau paie vraiment, et les alternatives sûres',
  'Parler du xessal sans juger : comprendre les risques réels et comment retrouver un teint uniforme sans danger.',
  $md$## Un sujet de santé publique au Sénégal

La dépigmentation volontaire — xessal — concernerait selon les études entre 25 et 60 % des femmes à Dakar. Cet article ne juge personne : il explique ce que contiennent réellement ces produits et ce qu'ils font à la peau, pour que chacune décide en connaissance de cause.

## Ce que contiennent les produits dépigmentants

La plupart des produits éclaircissants vendus hors pharmacie contiennent de l'hydroquinone surdosée, des corticoïdes puissants détournés de leur usage médical, ou des sels de mercure — parfois les trois. Ces substances ne « clarifient » pas le teint : elles détruisent la production de mélanine, la protection naturelle de la peau.

## Les conséquences, dans l'ordre d'apparition

- **Premiers mois** : teint plus clair mais fragile, vergetures qui apparaissent
- **6-12 mois** : acné cortisonique, peau qui s'affine, cicatrisation difficile, odeur caractéristique
- **Long terme** : taches rebond très foncées (ochronose) quasi impossibles à traiter, infections cutanées, hypertension et diabète liés aux corticoïdes absorbés, risques graves pendant la grossesse

Le paradoxe cruel : la peau dépigmentée finit tachée, irrégulière et abîmée — l'inverse du teint uniforme recherché.

## Retrouver un teint uniforme SANS danger

Ce que la plupart des femmes cherchent, ce n'est pas être claire : c'est un teint **uniforme et lumineux**. Et ça, c'est possible sans détruire sa peau :

- **Traiter les vraies taches** avec des actifs sûrs : vitamine C, niacinamide, acide azélaïque
- **Protéger du soleil** (SPF 30+) : 80 % de l'assombrissement irrégulier vient des UV
- **Exfolier en douceur** 1-2 fois par semaine pour la luminosité
- **Consulter un dermatologue** pour un protocole personnalisé et encadré

## Arrêter le xessal : ne le fais pas seule

Arrêter brutalement des corticoïdes cutanés provoque un effet rebond violent. Un sevrage doit être progressif et accompagné par un médecin. Sur YARAM, tu peux en parler en toute confidentialité avec un dermatologue certifié dès 3 000 F CFA, depuis ton téléphone — sans salle d'attente ni regard des autres.$md$,
  ARRAY['dépigmentation','xessal','santé peau','prévention'],
  'Équipe YARAM',
  'Xessal / dépigmentation : dangers et alternatives sûres | YARAM',
  'Ce que contiennent vraiment les produits dépigmentants, leurs conséquences sur la peau, et comment obtenir un teint uniforme sans danger. Sans jugement.',
  ARRAY['xessal danger','dépigmentation peau','produit éclaircissant danger','teint uniforme peau noire'],
  8, true, false, now()
)
ON CONFLICT (slug) DO NOTHING;
