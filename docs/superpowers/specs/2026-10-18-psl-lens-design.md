# PSL Lens — conception

Application statique adulte, React/TypeScript/Vite/Tailwind v4, sans backend,
compte, télémétrie ou stockage facial persistant. Le cahier des charges fourni
par l’utilisateur fait autorité et autorise l’exécution directe sans validations
intermédiaires. Travail dans le dépôt demandé, sur `codex/build-psl-lens`.

## Parcours

Accueil laboratoire bleu nuit/menthe avec illustration vectorielle explicitement
schématique, Live, photo et scan guidé, puis rapport en mémoire. Navigation
accessible, responsive, score masquable et suppression de session.

## Pipeline

Assets MediaPipe et WASM servis sur la même origine. Worker dédié avec bitmap
transférable, une inférence à la fois, cadence adaptative; repli CPU sur le thread
principal limité. IMAGE pour photo, VIDEO pour caméra. Deux visages maximum
détectés afin de rejeter explicitement les scènes multiples; un seul accepté.
La contrepartie est l’absence de smoothing natif, remplacé par agrégation.
Caméra autorisée seulement par clic, audio false, arrêt au démontage et pagehide.
Overlay partage le repère intrinsèque et la transformation miroir de l’image.

## Calculs

Coordonnées converties en pixels avant les distances; rotation dans le plan
normalisée par la ligne des yeux, poses obliques exclues des mesures frontales.
15 mesures descriptives documentées, sans unités physiques ni reconstruction
osseuse. Orientation approximative issue de matrice de transformation.
Qualité = critères calculés (cadrage, pose, stabilité, luminance, netteté,
expression); aucune confiance MediaPipe inventée. Profil 90° non pris en charge.
Scan: positionnement, frontal, rotations ±15–30°, plusieurs frames stables par
étape; seules observations frontales servent aux mesures. Médiane et MAD,
dispersion et effectif par mesure. Le nombre d’observations de pose est distinct
du nombre d’observations morphométriques.

## Score et limites

Heuristique versionnée et configurable, contributions explicites sur 8.
Poids 25/20/20/20/15. Aucun total si une catégorie manque; profil indisponible
en V1, donc rapport partiel et sous-scores seulement. Pas de renormalisation
silencieuse. Références de conception arbitraires, sans norme populationnelle.

## Vérification

Tests purs géométrie/qualité/scan/agrégation/scoring, composants pour erreurs,
rapport et suppression, E2E navigation/import et caméra simulée. Test réel
MediaPipe sur fixture publique identifiée, mocks explicitement réservés aux tests.
Build, lint, typecheck, tests, audit réseau local, captures mobile/desktop.
PWA avec cache statique borné/versionné, aucune donnée utilisateur en cache.
