# Mesures apparentes

Toutes les mesures exigent : un seul visage, 478 points finis, capture de
qualité suffisante et pose frontale (|yaw|, |pitch| ≤ 12°). Les points sont
convertis en pixels et dérotés par l’angle 33→263. `d(a,b)` est la distance
euclidienne 2D, `W=d(234,454)`, `H=d(10,152)`. Un dénominateur nul rend la
mesure indisponible. Aucun ratio n’est une dimension physique.

## Indices et justification

La numérotation est vérifiée contre le [modèle canonique MediaPipe](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj),
la [carte officielle de repères](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models)
et les [connexions officielles](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py).
Dans le fichier OBJ, le sommet n° n+1 correspond à l’indice de landmark n.
L’iris ajoute les points 468–477 du modèle actuel; 468/473 sont ses centres.

Les descriptions anatomiques sont des approximations des points de surface,
pas des céphalométries : 10 front haut visible, 152 menton, 234/454 contour
latéral, 168 racine nasale, 2 base nasale apparente, 98/327 bords alaires
apparents, 61/291 commissures, 17 bord inférieur de la lèvre, 172/397 contour
mandibulaire, 105/334 sourcils, 107/336 extrémités médiales. Les points du
contour dépendent fortement des cheveux, barbe, tissus et angle de vue.

## Catalogue

| ID stable    | Mesure                           | Formule                                                                                   | Unité / limite particulière                                          |
| ------------ | -------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| face-ratio   | Largeur / hauteur du visage      | W/H                                                                                       | Ratio; front visible, pas ligne capillaire anatomique                |
| lower-face   | Part du bas du visage            | d(2,152)/H                                                                                | Ratio; base nasale prédite                                           |
| eye-spacing  | Écartement relatif               | d(133,362)/moyenne(d(33,133),d(263,362))                                                  | Ratio; canthi de surface                                             |
| interocular  | Distance interoculaire           | d(468,473)/W                                                                              | Ratio; iris prédits, regard variable                                 |
| canthal-tilt | Inclinaison des yeux             | moyenne(atan2(y133−y33,abs(x133−x33)),atan2(y362−y263,abs(x362−x263)))                    | Degrés; positif si commissure externe plus haute                     |
| eye-openness | Ouverture des yeux               | moyenne(d(159,145)/d(33,133),d(386,374)/d(263,362))                                       | Ratio; dépend du clignement/expression                               |
| brow-height  | Position relative des sourcils   | moyenne(d(105,159),d(334,386))/W                                                          | Ratio; pilosité et mouvement des sourcils                            |
| brow-spacing | Espacement des sourcils          | d(107,336)/W                                                                              | Ratio; repères du modèle, pas bord précis du poil                    |
| nose-width   | Largeur du nez                   | d(98,327)/W                                                                               | Ratio; perspective et alaires apparents                              |
| nose-ratio   | Largeur / hauteur visible du nez | d(98,327)/d(168,2)                                                                        | Ratio; pas longueur de l’os nasal                                    |
| mouth-width  | Largeur de la bouche             | d(61,291)/W                                                                               | Ratio; lèvres au repos                                               |
| mouth-angle  | Alignement de la bouche          | angle(61→291) après dérotation                                                            | Degrés; mesuré relativement aux yeux                                 |
| jaw-ratio    | Contour mandibulaire             | d(172,397)/W                                                                              | Ratio; contour de peau, pas angle gonial osseux                      |
| chin-ratio   | Part apparente du menton         | d(17,152)/H                                                                               | Ratio; inclut la zone sous la lèvre                                  |
| symmetry     | Écart de symétrie apparent       | moyenne des écarts entre p et reflet(q) / W, paires (33,263),(133,362),(61,291),(172,397) | Ratio; plus faible = écart apparent moindre, sans équivalence beauté |

L’axe de réflexion de symmetry est x=(x10+x152)/2 après correction du roulis.
La correction est limitée à l’image; aucune normalisation 3D ne prétend corriger
la rotation de tête ou une asymétrie due à l’objectif.

## Qualité calculée par l’application

- Taille verticale du visage ≥ 0,28 de l’image; marge sur tous les axes ≥ 0,025.
- |yaw| ≤ 35°, |pitch| ≤ 15°, |roll| ≤ 20° pour l’acquisition; frontal ≤ 12°.
- Luminance moyenne Rec.709 du crop facial 128×128 : entre 45 et 225 sur 255.
- Netteté : variance du Laplacien à quatre voisins ≥ 12 sur ce crop.
- Mouvement entre observations espacées de moins de 800 ms : déplacement de
  pointe nasale ≤ 0,018 dans l’image normalisée et variation yaw/pitch ≤ 4°.
- Coefficients blendshape : jawOpen ≤ 0,30, mouthSmileLeft/Right ≤ 0,55,
  eyeBlinkLeft/Right ≤ 0,65. Ce sont des coefficients d’expression du modèle,
  pas des probabilités de qualité ou de confiance morphométrique.

Les seuils sont empiriques et documentés, pas validés scientifiquement. Les
lunettes, cheveux ou autres occlusions peuvent échapper aux vérifications.

## Agrégation et incertitude

Acquisition guidée : frontal 16 frames, gauche +22°±8° 8 frames, droite
−22°±8° 8 frames. Minimum 100 ms entre observations. Une frame invalide remet
à zéro la série de la pose actuelle, sans détruire les étapes précédentes.
Les rotations servent uniquement à vérifier le suivi et la pose.

Chaque mesure frontale est agrégée par médiane. Rejet si l’écart au centre est
supérieur à max(3×1,4826×MAD, 2 % de |médiane|, 0,00001). Le plancher résout le
cas MAD=0. Le rapport affiche la médiane, l’effectif conservé et 1,4826×MAD sur
les valeurs conservées. Une confiance descriptive « limitée » s’applique à moins
de 5 observations ou dispersion > max(10 % de |valeur|, 0,01), sinon « modérée ».
Aucune confiance « élevée » n’est attribuée.

Cette dispersion n’est pas un intervalle statistique calibré. Une photo unique
ne permet pas de l’estimer. La précision absolue et l’absence de biais ne sont
pas garanties par une faible dispersion.
