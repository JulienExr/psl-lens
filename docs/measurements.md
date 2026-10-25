# Mesures apparentes

Toutes les mesures exigent un seul visage, 478 points finis et une géométrie
non dégénérée. Le mode strict demande aussi une capture de qualité suffisante
et une pose frontale (|yaw|, |pitch| ≤12°, |roll| ≤20°). Photo et Live utilisent
un mode approximatif explicite qui conserve les valeurs calculables malgré la
pose ou la qualité, en les marquant limitées. Les points sont
convertis en pixels et dérotés par l’angle 33→263. `d(a,b)` est la distance
euclidienne 2D, `W=d(234,454)`, `H=d(10,152)`. Un dénominateur nul rend la
mesure indisponible. Les dimensions, coordonnées x/y/z et horodatage doivent
être finis. En mode strict, les angles de pose doivent aussi être vérifiés. Largeur/hauteur faciale et lignes des yeux non dégénérées sont requises;
les canthi internes restent ordonnés entre les externes dans le repère des yeux.
Aucun ratio n’est une dimension physique.

## Indices et justification

La numérotation est vérifiée contre le [modèle canonique MediaPipe](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj),
la [carte officielle de repères](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models)
et les [connexions officielles](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py).
Dans le fichier OBJ, le sommet n° n+1 correspond à l’indice de landmark n.
L’iris ajoute les points 468–477 du modèle actuel; 468/473 sont ses centres,
explicitement identifiés dans le [graphe de raffinement officiel](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_landmark/tensors_to_face_landmarks_with_attention.pbtxt).
Droite/gauche désignent le côté anatomique du sujet : œil droit 33/133/159/145,
œil gauche 263/362/386/374. Le miroir d’affichage ne transforme pas les
coordonnées utilisées pour mesurer.

Les descriptions anatomiques sont des approximations des points de surface,
pas des céphalométries : 10 front haut visible, 152 menton, 234/454 contour
latéral, 168 racine nasale, 2 base nasale apparente, 98/327 repères basaux du nez
(pas une largeur alaire maximale), 61/291 commissures, 17 bord inférieur de la lèvre, 172/397 contour
mandibulaire, 105/334 sourcils, 107/336 extrémités médiales. Les points du
contour dépendent fortement des cheveux, barbe, tissus et angle de vue.

## Catalogue

| ID stable    | Mesure                                    | Formule                                                                                   | Unité / limite particulière                                          |
| ------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| face-ratio   | Largeur / hauteur du visage               | W/H                                                                                       | Ratio; front visible, pas ligne capillaire anatomique                |
| lower-face   | Part du bas du visage                     | d(2,152)/H                                                                                | Ratio; base nasale prédite                                           |
| eye-spacing  | Écartement relatif                        | d(133,362)/moyenne(d(33,133),d(263,362))                                                  | Ratio; canthi de surface                                             |
| interocular  | Distance interoculaire                    | d(468,473)/W                                                                              | Ratio; iris prédits, regard variable                                 |
| canthal-tilt | Inclinaison des yeux                      | moyenne(atan2(y133−y33,abs(x133−x33)),atan2(y362−y263,abs(x362−x263)))                    | Degrés; positif si commissure externe plus haute                     |
| eye-openness | Ouverture des yeux                        | moyenne(d(159,145)/d(33,133),d(386,374)/d(263,362))                                       | Ratio; dépend du clignement/expression                               |
| brow-height  | Séparation verticale sourcils–paupières   | moyenne(y159−y105,y386−y334)/W après dérotation                                           | Ratio; chaque séparation strictement positive; expression sensible   |
| brow-spacing | Espacement des sourcils                   | d(107,336)/W                                                                              | Ratio; repères du modèle, pas bord précis du poil                    |
| nose-width   | Largeur basale apparente du nez           | d(98,327)/W                                                                               | Ratio; pas une largeur alaire maximale                               |
| nose-ratio   | Largeur / hauteur visible du nez          | d(98,327)/d(168,2)                                                                        | Ratio; pas longueur de l’os nasal                                    |
| mouth-width  | Largeur de la bouche                      | d(61,291)/W                                                                               | Ratio; lèvres au repos                                               |
| mouth-angle  | Alignement de la bouche                   | angle(61→291) après dérotation                                                            | Degrés; mesuré relativement aux yeux                                 |
| jaw-ratio    | Largeur relative du contour inférieur     | d(172,397)/W                                                                              | Ratio; contour de peau, pas angle gonial osseux                      |
| chin-ratio   | Distance lèvre inférieure–menton relative | d(17,152)/H                                                                               | Ratio; ne délimite pas un menton osseux                              |
| symmetry     | Écart de symétrie apparent                | moyenne des écarts entre p et reflet(q) / W, paires (33,263),(133,362),(61,291),(172,397) | Ratio; plus faible = écart apparent moindre, sans équivalence beauté |

L’axe de réflexion de symmetry est la droite passant par 10 et 152 après
correction du roulis. Pour A=p10, u=(p152−A)/|p152−A|, le reflet de q est
`A + 2u·dot(u,q−A) − (q−A)`. Un axe dégénéré est indisponible.
La correction est limitée à l’image; aucune normalisation 3D ne prétend corriger
la rotation de tête ou une asymétrie due à l’objectif.

Les ratios, angles relatifs et réflexions sont invariants aux translations,
changements d’échelle uniformes et rotations dans le plan sous réserve d’une
construction non dégénérée. Changer le format du canevas en adaptant les coordonnées
normalisées préserve les mesures; étirer réellement l’image les modifie. La hauteur
des sourcils ne change pas sous un déplacement horizontal dans le repère déroté.

Le yaw/pitch n’est pas corrigé. Sur une projection orthographique synthétique du
modèle canonique, yaw=10° produit un écart de symétrie de 0,0397 au lieu de zéro;
pitch=10° fait passer l’inclinaison canthale de 1,74° à 3,96°. Ce test expose une
sensibilité à la pose, sans valider une précision sur des personnes. Le score
frontal recommande une pose plus stricte (±8°), désormais signalée par un avertissement
si elle est dépassée. Ce seuil reste empirique. Photo/Live peuvent demander des
mesures approximatives sans ce filtre, toujours de fiabilité limitée. Les
conditions de géométrie finie et non dégénérée restent obligatoires.

## Qualité calculée par l’application

- Taille verticale du visage ≥ 0,28 de l’image; marge sur tous les axes ≥ 0,025.
- |yaw| ≤ 35°, |pitch| ≤ 15°, |roll| ≤ 20° pour l’acquisition; frontal ≤ 12°.
- Luminance moyenne Rec.709 du crop facial 128×128 : entre 45 et 225 sur 255.
- Netteté : variance du Laplacien à quatre voisins ≥ 12 sur ce crop.
- Mouvement entre observations espacées de moins de 800 ms : déplacement de
  pointe nasale ≤ 0,018 dans l’image normalisée et variation yaw/pitch ≤ 4°.
- Coefficients blendshape : jawOpen ≤ 0,30, mouthSmileLeft/Right ≤ 0,55,
  eyeBlinkLeft/Right ≤ 0,65. Ce sont des coefficients d’expression du modèle,
  pas des probabilités de qualité ou de confiance morphométrique. Les cinq valeurs
  doivent être présentes, finies et entre 0 et 1. Une absence ne prouve pas la neutralité.

Les matrices sont décodées en ordre colonne, conformément à [MatrixData](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/framework/formats/matrix_data.proto)
et à sa [sérialisation officielle](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/framework/formats/matrix.cc).
Après suppression de l’échelle, les colonnes doivent être orthogonales à 0,02 près
avec déterminant proche de +1. Les matrices dégénérées, réfléchies ou cisaillées
ne certifient pas une orientation.

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
de 5 observations, rétention < 75 %, ou dispersion avant/après rejet supérieure à
max(10 % de |valeur|, 0,01 pour un ratio ou 0,75° pour un angle), sinon « modérée ».
Aucune confiance « élevée » n’est attribuée.

Cette dispersion n’est pas un intervalle statistique calibré. Une photo unique
ne permet pas de l’estimer; ses dispersions restent indisponibles plutôt que nulles au sens numérique de zéro. La précision absolue et l’absence de biais ne sont
pas garanties par une faible dispersion.

## Mesures latérales V2

Les 15 constructions frontales restent compatibles. Un moteur séparé `profile-2d-2.0.0` calcule jusqu’à sept indicateurs apparents à partir de points manuels confirmés : projection relative nez/menton, angle N–Sn–Pg, offsets des lèvres à la ligne nez–menton, part inférieure Sn–Me/N–Me et angle menton–cou facultatif. Les calculs convertissent d’abord les coordonnées normalisées en pixels, puis utilisent un repère local N–Me et une normale orientée vers le nez. Pas de mélange d’angles, de dimension physique ou de projection osseuse. Formules et conditions : [profil assisté](profile-analysis.md). Validation réalisable et jeux de données manquants : [validation V2](validation-v2.md).
