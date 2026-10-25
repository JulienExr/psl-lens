# Explorateur de géométrie relative estimée

`src/components/GeometryExplorer.tsx` exporte par défaut le composant
`GeometryExplorer({ result }: { result: FaceDetectionResult | null })`.
Le parent peut le charger avec `React.lazy` et le monter uniquement après une
action explicite. Il ne démarre ni caméra, ni détection, ni téléchargement de
modèle. Aucun moteur WebGL, dépendance supplémentaire, service ou police externe
n’est nécessaire.

## Interprétation

La vue explore les repères MediaPipe et leur profondeur relative estimée. Elle
ne représente ni un scan anatomique ni une reconstruction métrique du visage.
La rotation ne révèle pas de données observées sur les parties cachées. Le
maillage utilise exclusivement la topologie `TESSELATION` déjà incluse dans
`src/vision/connections.json`, sans création de surface ou de texture.

L’orientation initiale, appelée « orientation canonique de la caméra » dans
l’interface, est simplement une rotation de caméra nulle. Réinitialiser remet
les rotations à zéro et le zoom à un. Cela ne corrige pas la pose de la tête et
ne transforme pas les repères en modèle anatomique canonique.

## Coordonnées et projection

`normalizeFaceGeometry` convertit les repères en coordonnées de l’image source :
`X = x × largeur`, `Y = y × hauteur`, `Z = z × largeur`. Cette convention conserve
le rapport largeur/hauteur et l’échelle relative de profondeur MediaPipe. Le
centre de la boîte englobante est soustrait, puis les trois axes sont divisés
par **le même rayon**. Aucune normalisation indépendante par axe n’est appliquée.

`projectGeometry` applique les rotations horizontale et verticale, puis une
projection orthographique et une échelle d’affichage uniforme. Le zoom est borné
entre 0,5 et 2. La vue 2D ignore les rotations et la profondeur ; elle conserve
le plan source. Aucun étalonnage métrique, correction de perspective ou correction
anatomique n’est inféré.

Une seule face et des dimensions d’image finies et positives sont nécessaires.
Les repères absents ou non finis sont conservés sous forme de cases nulles, pour
ne pas décaler les indices du maillage ; les connexions correspondantes sont
omises. Moins de deux points valides ou une étendue dégénérée rendent la vue
indisponible. Les données entrantes ne sont jamais modifiées.

## Interaction et ressources

- Une souris ou un doigt fait tourner la vue ; deux doigts modifient le zoom.
- Les curseurs natifs permettent la rotation et le zoom au clavier.
- Les modes points, maillage et points avec maillage utilisent les mêmes repères.
- La vue plane 2D est sélectionnable à tout moment et devient automatiquement le
  rendu de secours si `getContext('2d')` échoue ou retourne `null`. Elle utilise
  un SVG local, avec le zoom et le choix d’affichage conservés.
- Canvas2D est redessiné sur modification des données, contrôles ou dimensions.
  Aucune boucle d’animation ni `requestAnimationFrame` n’est créée. Le ratio de
  pixels est plafonné à deux. `ResizeObserver` est déconnecté au démontage ; le
  gestionnaire `resize` de secours est également retiré.

## Vérification

`tests/unit/explorer-geometry.test.ts` vérifie les proportions sur une image non
carrée, l’échelle de profondeur, le centrage uniforme, les indices manquants,
les entrées invalides, la rotation et le mode plan.

`tests/components/geometry-explorer.test.tsx` vérifie le rendu de secours réel en
SVG, les contrôles accessibles, le changement des tracés, la remise à zéro,
le glissement et le pincement, le passage 2D/3D, l’absence de boucle d’animation
et le nettoyage des observateurs. Le contexte raster est simulé uniquement à
la frontière Canvas2D car jsdom ne possède pas de moteur raster.

Ces tests ne constituent pas une mesure de fluidité sur téléphone physique.

Un microbenchmark local sous Node 22.23.0, avec 478 repères synthétiques,
500 itérations de préparation puis 10 000 conversions et projections, a mesuré
une médiane de 0,41 ms et un 95e percentile de 0,65 ms par itération. Il exclut
le dessin raster, React, le navigateur et les performances des appareils réels.
Ces chiffres ne décrivent donc pas la fluidité de l’interface sur mobile.
