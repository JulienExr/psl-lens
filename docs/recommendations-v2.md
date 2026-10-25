# Recommandations V2

`recommendV2(frontal, profiles, preferences)` dans `src/recommendations/v2.ts` est une fonction pure et locale. Elle renvoie des objets `Recommendation` contenant un identifiant stable, une catégorie, un titre, un objectif, les éléments utilisés, une justification et les limites. Aucun appel réseau, tirage aléatoire, score esthétique ou service génératif n’intervient.

`DEFAULT_PREFERENCES` désactive tous les thèmes de présentation et laisse la longueur de cheveux, la barbe et le style non précisés. Les entrées ne sont pas modifiées. L’ordre des règles est fixe ; les profils sont parcourus par identifiant. Un thème dupliqué ne duplique pas son conseil.

## Conseils de capture

Les seuils de lumière, netteté, stabilité et frontalité suivent les contrôles existants. Une valeur absente ou non finie n’est jamais interprétée comme une mauvaise mesure.

| Élément disponible            | Déclencheur                                                                            | Piste proposée                                            |
| ----------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Luminosité                    | < 45 ou > 225 sur l’échelle 0–255                                                      | Lumière diffuse ou réduction de la lumière directe        |
| Netteté                       | Variance du Laplacien < 12                                                             | Stabilisation et vérification de la mise au point         |
| Taille du visage              | Hauteur relative > 0 et < 0,28, ou > 0,8                                               | Ajustement de distance et marge dans le cadre             |
| Stabilité                     | Indice de mouvement > 1                                                                | Caméra stable et immobilité pendant l’acquisition         |
| Orientation mesurée           | Rotation ou inclinaison verticale > 12° en valeur absolue ; inclinaison latérale > 20° | Nouvelle vue frontale                                     |
| Orientation indisponible      | Source absente ou angles non finis                                                     | Vérification de l’orientation, sans affirmer une rotation |
| Problème explicite de capture | Message connu issu du contrôle de qualité                                              | Action correspondant au problème réellement signalé       |
| Répétabilité                  | Moins de cinq observations frontales mesurées                                          | Quick Scan stabilisé                                      |
| Cohérence du scan             | Statut `inconsistent`                                                                  | Distance et cadrage comparables                           |
| Profil assisté                | Validation non valide ou vue strictement latérale non confirmée                        | Vérification des repères et confirmation de l’orientation |

Les messages de qualité vérifiés et les problèmes rencontrés pendant un scan sont conservés comme preuves, même si l’image représentative est ensuite satisfaisante. Les messages inconnus ne sont pas interprétés par des correspondances vagues telles que « lumière ». Le manque d’une vérification ne prouve pas l’existence d’un problème. Un profil validé ne reçoit pas de conseil correctif pour ses seules incertitudes usuelles liées au repérage manuel.

En l’absence de problème observé, le moteur n’invente pas de défaut et peut renvoyer une liste vide. Sans analyse, les suggestions de présentation explicitement activées restent possibles.

## Présentation facultative

Les thèmes `hair`, `beard` et `photo` nécessitent chacun une activation explicite. Le thème coiffure demande aussi une longueur souhaitée ; le thème barbe demande une préférence avec ou sans barbe. Le style déclaré change les variantes proposées. Les pistes sont des essais facultatifs et réversibles à comparer dans des conditions photographiques constantes.

La géométrie faciale et les scores ne déclenchent aucune suggestion de coupe, de barbe ou de style idéal. Le moteur ne déduit ni genre, ni identité, ni goûts, ni santé, ni texture capillaire ou capacité de pousse de barbe. Il ne présente pas de caractéristique physique comme un défaut et ne propose ni chirurgie ni transformation corporelle. Ces règles ne prédisent pas un bénéfice esthétique et ne constituent pas une validation scientifique des préférences.

## Panneau contrôlé

`RecommendationsPanel({ frontal, profiles, preferences, onPreferencesChange })` affiche les recommandations et les trois champs de préférence. Le parent possède l’état ; le panneau transmet un nouvel objet complet à chaque modification et préserve les autres champs. Il ne conserve aucune préférence privée et ne persiste aucune donnée.

Les libellés, cases à cocher, sélecteurs, groupe de préférences et listes de preuves sont accessibles par leur sémantique native. Les cibles tactiles des contrôles mesurent au moins 44 px ; les champs se réorganisent selon la largeur disponible. Les suggestions mises à jour utilisent une région d’annonce polie. Les classes visuelles réutilisent le panneau, les sélecteurs et la typographie existants.

## Vérification

Les tests dédiés couvrent les déclencheurs et limites numériques, les données absentes ou non finies, les problèmes historiques du scan, l’orientation mesurée et indisponible, la répétabilité, la cohérence, la validation du profil, l’activation volontaire des thèmes, les préférences déclarées, l’absence d’inférence depuis la géométrie, le déterminisme et l’absence de mutation. Les tests du panneau utilisent un vrai parent React pour vérifier les mises à jour contrôlées, la préservation des champs et la suppression d’un thème.

Le module V1 `src/recommendations.ts` conserve ses conseils de capture existants.
