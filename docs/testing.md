# Vérification

## Commandes

```sh
npm ci
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run test:pwa
npm run test:pwa-update
npm run test:performance
npx playwright install firefox webkit
npm run test:compat
npm run format:check
npm audit --omit=dev
```

`test:pwa` reconstruit le produit puis sert `dist/` sur le port 4173. Les tests
applicatifs utilisent le serveur de développement sur 5173. Les sorties des
deux suites sont séparées (`test-results/`, `test-results-pwa/`). Aucun test
n’effectue un déploiement ou un push.

## Couverture

### Vitest / Testing Library

- Distances, angles, dérotation, ratios et dénominateurs nuls/non finis.
- Les 15 mesures sur géométrie synthétique; symétrie; correction d’aspect.
- Mesures absentes, coordonnées invalides et vues obliques.
- Qualité : aucun/deux visages, petite taille, visage coupé, pose excessive,
  mouvement, luminance, netteté, expression et pose indisponible.
- Analyse réelle des pixels par luminance et variance du Laplacien.
- Scan : pose incorrecte, timestamps dupliqués, rupture de stabilité et
  acquisition complète; convention de yaw non nulle sur matrice connue.
- Médiane, MAD=0, valeurs aberrantes, effectifs et exclusion des rotations
  des mesures frontales.
- Score déterministe, configuration invalide et refus d’un total incomplet.
- Navigation sans demande caméra automatique, permission refusée, mauvais
  fichier, rapport partiel, masquage du score et effacement de session.
- Permission caméra obtenue après annulation/démontage : tracks arrêtées.
- Initialisation du worker annulée pendant un redémarrage : nouvelle session
  préservée; récupération après crash; nettoyage des timers après postMessage
  refusé.

### Playwright Chromium

1. Navigation et absence de débordement horizontal sur 320, 390, 768, 1024 et 1440 px.
2. Vraie photo → vrai worker MediaPipe → mesures → rapport → export → effacement.
   Les boîtes du SVG et de l’image sont comparées pour déceler les décalages.
   Toutes les requêtes sont de même origine et GET pendant ce parcours.
3. Mauvais format et image sans visage : rejet explicite du véritable moteur.
4. Image contenant deux visages : rejet par le vrai modèle.
5. Caméra simulée du navigateur avec inférence réelle, pause, miroir et tracks
   arrêtées après navigation (assertion asynchrone sur readyState).
6. Scan guidé complet avec worker synthétique **réservé au test**. Qualité,
   changement d’étape, agrégation et rapport utilisent les moteurs de production.
   Les poses sont maintenues suffisamment longtemps pour traverser les critères
   réels de stabilité et d’espacement temporel.
7. Caméra `canvas.captureStream` montrant la photographie de test : vraies
   frames vidéo, vraie inférence MediaPipe, maillage puis rapport Live.
8. Pause pendant une inférence retardée : l’observation en vol est ignorée.
9. Build de production : CSP fourni appliqué au document, vraie détection,
   inspection de la liste du cache, puis rechargement et analyse hors connexion.
10. Annulation en pleine inférence, stop/start immédiat, périphérique changé,
    navigation Live → Photo et Live → Scan, effacement pendant initialisation,
    reprise après panne worker : anciennes pistes arrêtées, nouvelle session
    préservée, absence d’alerte pour une annulation volontaire.
11. Effacement réel des pixels Canvas après arrêt et changement de couche.
12. Photo frontale synthétique : score limité; Quick Scan : 16 observations,
    score stabilisé. Le portrait réel dépasse ±8° et conserve désormais une note
    indicative avec avertissement. Les captures floues/sombres/obliques accèdent
    au rapport; le Live et le scan guidé offrent une estimation immédiate.
13. Sources vidéo synthétiques portrait et paysage, cinq largeurs et changement
    d’orientation du viewport : rapport d’aspect source, boîtes et miroir
    communs au Canvas et à la vidéo. Ceci ne simule pas un capteur physique.

La suite PWA de mise à jour utilise le véritable générateur de service worker,
de petits assets synthétiques et un serveur temporaire A/B. Elle vérifie le
cache progressif, les erreurs de téléchargement, l’activation explicite, l’absence de
mélange de révisions et le remplacement sans conservation d’anciens assets.
Le composant réel du bandeau de mise à jour est exercé avec deux onglets.

Le benchmark `test:performance` compare les composants réels Mesh et LiveMesh
sur les mêmes 240 frames synthétiques, avec 20 échauffements par passage et un
ordre alterné SVG/Canvas/Canvas/SVG. Il mesure l’actualisation CPU et le layout
forcé sous Chromium, en build de développement; ni l’inférence, ni le temps GPU,
ni un appareil mobile ne sont inclus. Les résultats sont dans
`artifacts/overlay-performance.json` (ignoré). Aucune assertion de vitesse
fragile : seules l’exécution et la réduction des nœuds DOM sont exigées.

### Firefox et WebKit

`test:compat` exécute l’import d’une vraie photo, MediaPipe, le rapport, le
redimensionnement mobile et l’effacement sous les deux moteurs. WebKit utilise
le repli principal lorsque WebGL n’est pas disponible dans OffscreenCanvas
au sein du worker. La disponibilité d’OffscreenCanvas seule ne suffit pas : le
contexte WebGL 2 est vérifié avant l’initialisation du modèle.

Firefox sur un runner GitHub sans GPU refusait WebGL2 (`AllowWebgl2:false`),
alors que le même parcours passait localement. Le projet Playwright Firefox en
CI autorise explicitement WebGL via `webgl.force-enabled` et s’exécute avec
Mesa (`LIBGL_ALWAYS_SOFTWARE=1`) sous Xvfb en mode headed. Le drapeau seul ne
suffisait pas au runner : son navigateur headless épuisait les pilotes GL.
Le moteur et les contrôles de production restent réels. Le test vérifie WebGL2 avant l’inférence pour rendre ce défaut
d’infrastructure immédiatement visible. Contexte :
[rapport Mozilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1970486) et
[mode headed Linux de Playwright](https://playwright.dev/docs/ci#running-headed).

Les mocks ne remplacent jamais le moteur dans le produit. Les fixtures sont
sous `tests/`, sans import depuis `src/`. L’image historique est attribuée dans
`THIRD_PARTY_NOTICES.md`; aucun visage privé n’est nécessaire aux tests.

## Régressions découvertes et corrigées

- Portrait haut : le conteneur était plafonné en hauteur tandis que l’image
  conservait sa hauteur naturelle. Il est maintenant contraint par largeur,
  proportionnellement, dans le repère partagé avec son overlay.
- Initialisation obsolète : le catch pouvait fermer le worker de la nouvelle
  session. Vérification de génération avant toute mutation; callbacks obsolètes
  ignorés et tokens d’opération indépendants.
- Worker crashé : invalidation du moteur pour permettre un véritable nouvel essai.
- Pause : une réponse déjà en vol ne doit pas alimenter l’acquisition.
- Conventions gauche/droite : yaw positif = gauche anatomique dans la matrice
  canonique, indépendamment du miroir d’affichage.
- PWA : une même version sert sa coquille et ses assets; aucune nouvelle UI ne
  doit utiliser un ancien worker. Les correspondances du cache statique ignorent
  `Vary: Origin`, puisque les fichiers autorisés de même origine ont une unique
  représentation; cela permet le chargement des modules en mode hors connexion.
- WebKit : le SDK peut initialiser un graphe sans contexte WebGL de worker
  exploitable, puis échouer à l’inférence. La vérification WebGL 2 préalable
  active le repli DOM testé, même pour une inférence CPU.

## Validation manuelle et limites

Les captures desktop et mobile sont générées dans `artifacts/` (ignoré par Git)
et ont été inspectées, ainsi que le maillage réel sur photo. Ne pas confondre
une réussite des moteurs de bureau avec une certification de tous les appareils. Les vrais
Safari iOS/Chrome Android, la rotation physique d’écran, plusieurs webcams
matérielles et les conditions d’éclairage variées restent des vérifications
matérielles à réaliser. Les tests E2E utilisent des périphériques simulés.

Checklist manuelle : refus puis autorisation, caméra occupée/inexistante,
débranchement, changement de périphérique, caméra arrière, portrait/paysage,
miroir, pause/reprise, navigation durant chargement/inférence, effacement,
lunettes/cheveux, image EXIF tournée, très grande image, luminosité extrême,
expression non neutre et update PWA après fermeture des anciens onglets.

La grille détaillée et son statut sont dans [la checklist physique](mobile-checklist.md).
Le bilan chiffré des validations V1.1 est dans [le suivi](v1.1-progress.md).
