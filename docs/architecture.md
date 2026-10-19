# Architecture

## Responsabilités

`App` conserve le rapport en mémoire et route vers accueil, Live, scan, photo,
rapport et méthode. Aucune persistance de données faciales. Les vues reçoivent
un callback `onReport`; les moteurs ne dépendent pas de React.

`useCamera` gère la permission explicite, les périphériques, le flux, la pause
et la boucle adaptative. Les tokens de génération invalident les continuations
après arrêt/démontage. Chaque stream obtenu après annulation est immédiatement
arrêté. `pagehide` et passage en arrière-plan coupent les tracks. Les mesures
Live ne sont affichées que sur une observation frontale exploitable.

`VisionClient` initialise une seule session de vision, interdit les inférences
concurrentes et choisit le worker classique (`/vision-worker.js`). Un bitmap
transférable est fermé après chaque traitement. Le worker est compilé par
esbuild en IIFE : le chargeur WASM MediaPipe peut ainsi utiliser `importScripts`,
incompatible avec les workers ES modules. En cas d’incompatibilité à
l’initialisation, le même `VisionEngine` fonctionne dans le thread principal.
La caméra limite alors la cadence à environ 5,5 inférences/s maximum, moins si
le matériel est lent. Les erreurs d’exécution sont exposées à l’utilisateur.
Même en délégation CPU, MediaPipe utilise WebGL pour le transport d’images.
Le contexte WebGL 2 est donc vérifié avant initialisation, avec un canvas DOM
sur le thread principal. La présence d’OffscreenCanvas dans WebKit ne garantit
pas son support WebGL dans un worker; ce cas déclenche le repli prévu.

`VisionEngine` utilise le mode IMAGE ou VIDEO approprié, des timestamps
monotones et `setOptions` uniquement lors des changements de mode. Le CPU
WASM assure un comportement portable sans imposer un contexte GPU. Deux visages
peuvent être détectés afin de rejeter une scène multiple; un seul est accepté.
Ce choix remplace la configuration initialement envisagée à un visage, qui ne
permettrait pas de vérifier cette condition. Le lissage MediaPipe natif n’est
donc pas actif. Les mesures finales sont stabilisées par médiane/MAD.

## Coordonnées

Les inférences utilisent l’image **non réfléchie**. Gauche et droite sont celles
du sujet. Les yeux droits anatomiques ont notamment les indices 33/133, les
gauches 263/362. L’interface peut réfléchir ensemble la vidéo et son SVG,
sans changer les calculs ou les consignes anatomiques.

Les landmarks x/y normalisés sont convertis par largeur/hauteur respectives
avant les calculs. Le z prédit n’est pas utilisé comme distance physique.
SVG et média partagent le même conteneur de rapport d’aspect intrinsèque et
le SVG a un viewBox correspondant aux dimensions de l’inférence. Aucun recadrage
`object-fit: cover` n’introduit de décalage.

Les matrices MediaPipe `MatrixData` sont aplaties par colonnes. Après retrait
du facteur d’échelle des axes, les angles XYZ sont extraits par atan2/asin.
Ce sont des angles approximatifs, sans calibration individuelle. La ligne des
yeux corrige séparément le roulis des mesures 2D. Les rotations hors du plan
supérieures à 12° sont exclues des mesures frontales.

## Assets et PWA

`npm ci`, `predev` et `prebuild` préparent les assets. Le modèle est téléchargé
depuis un chemin Google versionné, contrôlé par SHA-256. Les WASM viennent de
la version verrouillée du package. Ces binaires générés ne sont pas versionnés.
Le JSON des connexions provient des constantes officielles du SDK. Le dessin
d’accueil vient du modèle canonique officiel, sans lien avec les résultats.

Le service worker ne traite que les requêtes GET de même origine et met en
cache une liste explicite de fichiers du build. Les navigations sont servies par la même coquille index.html mise en cache. Le cache porte l’empreinte du contenu du build;
un nouveau worker attend la fin des anciens onglets avant activation.

## Décisions de portée

Ni backend, ni authentification, ni variables secrètes. Pas de profil 3D, pas
de détection d’identité, pas de prédiction démographique. Le profil facultatif
sert uniquement de prévisualisation. Les conseils sont locaux, neutres et
concernent les conditions de capture et la présentation.
