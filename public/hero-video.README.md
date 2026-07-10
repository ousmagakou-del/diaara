# Video hero Landing

## Ou poser ta video

Depose ton fichier ici :

- `/Users/ousmanegakou/Documents/diaara/public/hero-video.mp4`

Et optionnellement une image de fallback (affichee pendant le chargement de la video) :

- `/Users/ousmanegakou/Documents/diaara/public/hero-poster.jpg`

## Recommandations techniques

Pour que la video se charge vite et joue en loop sans effort sur mobile Senegal (LTE parfois lent) :

- **Codec** : H.264 (mp4) — le plus universel iOS/Android/Chrome
- **Resolution** : 1920x1080 max (Full HD), 1280x720 est deja tres correct
- **Duree** : 8 a 15 secondes (elle boucle, l user ne remarque pas)
- **Bitrate** : 2 Mbps max — au dela c est du gaspillage
- **Poids** : ideal 2-4 MB, max 6 MB
- **Audio** : SUPPRIME (la video est mute de toute facon, l audio te fait perdre 300-500 KB inutiles)
- **Frame rate** : 24 ou 30 fps
- **Compression** : ffmpeg avec preset slow, tune film, CRF 26-28 pour un excellent ratio qualite/poids

Commande ffmpeg tout-en-un pour optimiser une video source lourde :

```bash
ffmpeg -i source.mov \
  -vf "scale=1920:-2" \
  -c:v libx264 -preset slow -crf 26 \
  -an \
  -movflags +faststart \
  -pix_fmt yuv420p \
  -profile:v main \
  -level 4.0 \
  hero-video.mp4
```

Le flag `-movflags +faststart` est **critique** : ca met le moov atom au debut du fichier pour que le browser puisse commencer a jouer avant d avoir tout telecharge.

## Comment desactiver la video

Si tu ne veux plus la video : soit tu supprimes `/public/hero-video.mp4` (le browser tombera sur le poster ou le background gradient), soit tu ajoutes la classe `lp-hero--no-video` sur la section hero dans Landing.jsx.

## Suggestions de contenu video

- Une main qui applique de la creme visage
- Zoom lent sur des produits YARAM en pharmacie
- Livreur qui arrive a moto devant une porte, remet le colis
- Sequence de scan peau IA (photo iPhone, analyse, resultat)
- Belle femme senegalaise qui sourit face camera (calque native onboarding slide 2)

Une video de belle qualite genre stock premium (Envato / Storyblocks / Artgrid) fait le taff parfaitement.
