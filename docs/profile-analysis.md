# Profil assisté V2

Le moteur `profile-2d-2.0.0`, dans `src/morphometry/profile/index.ts`, calcule
sept constructions sur des repères de surface placés et confirmés par
l’utilisateur. Il travaille sur une photographie latérale ou une image capturée
localement. Il ne détecte pas automatiquement les repères du profil et ne
certifie pas un angle de prise de vue de 90°.

## Choix de méthode

| Approche                                                | Intérêt                                                                         | Limites et décision V2                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Réutiliser directement les points automatiques frontaux | Placement rapide et continuité avec Photo/Live                                  | Pas de validation locale des points homologues à 90°. Les points cachés peuvent être estimés. Conservé pour les vues frontales et obliques, pas présenté comme une mesure latérale validée.                                                       |
| Contour/silhouette sans repères                         | Peut suivre un bord visible sans gros modèle                                    | Le bord dépend du fond, des cheveux et des occlusions; il ne nomme pas automatiquement N/Sn/Pg de façon vérifiée. Pas de segmentation/annotation validée disponible. Non retenu comme mesure automatique.                                         |
| Modèle spécialisé de profil                             | Pourrait proposer des repères latéraux                                          | Aucun modèle local et jeu annoté n’a été qualifié ici pour précision, licence, taille et compatibilité mobile. Ajouter une dépendance non évaluée n’apporterait pas une exactitude démontrée. Reporté, points manuels transparents dans cette V2. |
| Repères latéraux assistés en 2D                         | Repères visibles, nommés, modifiables et confirmés ; calculs inspectables       | Dépend de l’opérateur, du contour visible, de la perspective et de la pose. Méthode retenue, avec résultats toujours limités.                                                                                                                     |
| Reconstruction anatomique ou acquisition 3D étalonnée   | Pourrait fournir d’autres informations avec un protocole et un matériel adaptés | Nécessiterait une acquisition, une calibration et une validation absentes du projet. Non implémentée. L’explorateur de profondeur relative n’en constitue pas une.                                                                                |

Ce choix concerne la traçabilité de la géométrie visible. Il ne valide ni la
précision anatomique, ni une note d’attractivité, ni un usage médical.

## Repères et coordonnées

Les huit identifiants sont `nasion` (N), `pronasale` (Prn), `subnasale` (Sn),
`upperLip` (Ls), `lowerLip` (Li), `pogonion` (Pg), `menton` (Me) et `cervical`
(C). Il s’agit de repères cutanés approximatifs. Le moteur demande N, Prn, Sn,
Pg et Me comme références communes. Les lèvres et la transition du cou sont
facultatives ; une occlusion laisse les mesures correspondantes indisponibles.

Chaque point contient `x`, `y` dans `[0,1]`, `confirmed` et sa provenance
`manual` ou `automatic-proposal`. Une proposition automatique non confirmée
ne devient pas une mesure disponible. Les coordonnées sont converties en
pixels par `X=x×largeur`, `Y=y×hauteur` ; le rapport d’aspect n’est pas étiré.

On définit `h=|Me−N|`, `v=(Me−N)/h` et `u=(v.y,−v.x)`. Le signe de `u` est
choisi pour que `dot(Prn−N,u)>0` : positif signifie vers l’avant apparent du
profil, indépendamment d’un miroir de l’image. L’axe N→Me sert de référence
géométrique dans l’image ; ce n’est pas un plan anatomique de Francfort.

Le côté anatomique `left`, `right` ou `unknown` est déclaré par l’utilisateur.
Le sens `image-left` ou `image-right` est calculé séparément. Une image miroir
ne permet pas à elle seule d’identifier le côté anatomique.

## Formules

| Identifiant           | Construction      | Convention                                                               |
| --------------------- | ----------------- | ------------------------------------------------------------------------ |
| `nose-projection`     | `dot(Prn−Sn,u)/h` | Projection apparente du nez ; ratio signé.                               |
| `chin-projection`     | `dot(Pg−Sn,u)/h`  | Projection apparente du menton ; ratio signé.                            |
| `profile-angle`       | `angle(N,Sn,Pg)`  | Angle intérieur en Sn, en degrés, entre 0° et 180°.                      |
| `upper-lip-offset`    | `dot(Ls−Prn,n)/h` | `n` est la normale unitaire à Prn→Pg orientée vers `u`.                  |
| `lower-lip-offset`    | `dot(Li−Prn,n)/h` | Même ligne apparente nez–menton ; un signe positif pointe vers l’avant.  |
| `lower-profile-share` | `                 | Me−Sn                                                                    | /h` | Distance euclidienne relative, pas la projection verticale d’une hauteur. |
| `chin-neck-angle`     | `angle(Pg,Me,C)`  | Angle intérieur en Me ; dépend fortement du contour et de son occlusion. |

Pour un angle en B :
`atan2(abs(cross(A−B,C−B)),dot(A−B,C−B))×180/π`.
Les ratios n’ont pas d’unité physique. La ligne Prn–Pg utilise des points
cutanés visibles ; elle n’est pas une céphalométrie osseuse et aucune norme
clinique n’est appliquée.

## Disponibilité et orientation

Les dimensions doivent être finies et positives ; les références communes
doivent être confirmées, finies et dans l’image. Le moteur vérifie :

- `h > 0,05 × hypot(largeur,hauteur)` ;
- la projection de Sn sur N→Me, divisée par h, strictement entre 0 et 1 ;
- la projection de Pg après Sn et au plus à 1,2 ;
- la distance transverse apparente de Prn à N→Me supérieure à `0,01×h`.

Ces contrôles détectent certains placements incohérents ou effondrés. Ils ne
prouvent pas un profil strict. `strictProfileConfirmed` est une **déclaration
manuelle**, enregistrée avec `orientation.method="user-declared"`. Sans cette
déclaration, toutes les mesures restent indisponibles. Une déclaration vraie
ne signifie pas que le logiciel a estimé ou vérifié le yaw à 90°.

Les valeurs disponibles ont `quality="limited"` et `samples=1`. Une référence
nécessaire absente, une construction dégénérée ou une orientation non confirmée
donne `value=null`, `quality="unavailable"`, `samples=0`. Aucun remplissage
statistique n’est effectué. Des mesures frontales et latérales distinctes
restent associées à leur vue et à la version de leur moteur.

## Ce qui a été vérifié

Les tests du moteur vérifient les formules, les transformations de similarité
dans le plan, le miroir, les dimensions non carrées, les points manquants et
les géométries invalides. Une invariance numérique à une rotation dans le plan
ne valide pas une rotation réelle de tête hors du plan.

Le [protocole de validation V2](validation-v2.md) fournit l’import JSON,
l’évaluation des points visibles et la sensibilité à leur placement. Le jeu
fourni contient une seule image historique et une seule annotation manuelle.
Il ne mesure ni une précision experte, ni une répétabilité d’acquisition, ni
une robustesse réelle au miroir, à l’éclairage ou à l’expression.

## Sources du choix de coordonnées

Les conventions du modèle sont décrites dans la [documentation officielle MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) et la [géométrie Face Mesh](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md). La profondeur relative sous perspective faible ne fournit pas une dimension physique; elle n’est pas utilisée par ce moteur latéral. L’absence de validation du profil strict est une limite du présent produit, pas une garantie de précision pour les autres poses.
