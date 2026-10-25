# Score PSL expérimental

Protocole complet historique : `psl-heuristic-1.0.0`. Implémentation pure dans `src/scoring/index.ts`.
Pas de GPT, nombre aléatoire, percentile ou comparaison à une population.

Pour chaque mesure x, cible t et tolérance d :

`contribution(x,t,d) = 8 × max(0, 1 − abs(x−t)/d)`.

Le sous-score est la moyenne arithmétique des contributions requises. Il n’est
disponible que si toutes ses mesures sont finies et disponibles. Les références
ci-dessous sont des **choix arbitraires de produit**, sans norme esthétique ou
anatomique scientifiquement validée.

| Catégorie          | Poids | Entrées (cible ; tolérance)                        |
| ------------------ | ----- | -------------------------------------------------- |
| Proportions        | 25 %  | face-ratio (0,78 ; 0,35), lower-face (0,40 ; 0,25) |
| Yeux               | 20 %  | eye-spacing (1 ; 0,8), canthal-tilt (4° ; 20°)     |
| Symétrie apparente | 20 %  | symmetry (0 ; 0,15)                                |
| Mâchoire / menton  | 20 %  | jaw-ratio (0,78 ; 0,35), chin-ratio (0,20 ; 0,18)  |
| Profil             | 15 %  | Aucune mesure validée en V1                        |

Le score global serait la somme des sous-scores pondérés si toutes les
catégories étaient disponibles. **Il reste null**, puisque le profil ne
peut pas être calculé de manière techniquement justifiée. Importer une photo
de profil ne change pas cela. Aucun remplacement par zéro ou redistribution
des poids n’a lieu. Les contributions pondérées sont inspectables, sans total.

La configuration accepte une version et cinq poids strictement positifs
totalisant 1. Une configuration invalide provoque une erreur. Modifier les
références exige de versionner le protocole et de mettre à jour les tests.

Le rapport peut masquer les sous-scores. L’export respecte ce choix et reste
descriptif lorsque l’affichage expérimental est désactivé. Le score est calculé
dans le rapport, sur une capture ou une série, sans animation aléatoire du score.

Texte affiché systématiquement :

> Experimental PSL estimate — not a scientific beauty rating.

La symétrie ou une cible numérique ne définit pas l’attractivité. Le produit ne
propose aucun diagnostic, traitement, procédure chirurgicale ou conseil corporel
dangereux et n’infère ni origine, identité, santé ou orientation sexuelle.

## Protocole frontal indépendant

Version courante : **`psl-frontal-1.1.0`**, dans `src/scoring/frontal.ts`.
Cette version remplace les refus de qualité de `psl-frontal-1.0.0` par des
avertissements : une capture mesurable garde sa note, même floue, sombre,
oblique, avec expression, pose inconnue ou série courte/instable.
Le protocole complet historique reste séparé et inchangé.

| Catégorie          | Poids nominal | Mesures configurées       |
| ------------------ | ------------: | ------------------------- |
| Proportions        |          30 % | face-ratio, lower-face    |
| Yeux               |          25 % | eye-spacing, canthal-tilt |
| Symétrie apparente |          20 % | symmetry                  |
| Mâchoire / menton  |          25 % | jaw-ratio, chin-ratio     |

Les cibles et tolérances restent celles du tableau historique. La note d’une
mesure est `8 × max(0,1−abs(x−t)/d)`. Aucun ajustement de la valeur ou pénalité
numérique n’est appliqué pour compenser la qualité.

### Mesures manquantes et couverture explicite

Une entrée doit avoir une valeur finie, un identifiant unique et une géométrie
possible : ratios positifs, symétrie positive ou nulle, angle entre −90° et 90°.
Une valeur absente/invalide/ambiguë est **exclue**, jamais remplacée par zéro
ni par une cible. Une catégorie peut utiliser une partie de ses mesures.

Pour chaque catégorie `c` :

- `couverture_c = nombre de mesures utilisables / nombre de mesures configurées`;
- `poids_mesuré_c = poids_nominal_c × couverture_c`;
- `sous_score_c = moyenne des notes utilisables`, ou null si aucune;
- `couverture_totale = somme(poids_mesuré_c)`;
- `score = somme(sous_score_c × poids_mesuré_c) / couverture_totale`;
- `contribution_c = sous_score_c × poids_mesuré_c / couverture_totale`.

La note est bornée entre 0 et 8. Les contributions affichées totalisent la note.
Le rapport et le JSON exposent couverture totale et par catégorie, poids
nominaux, poids utilisés affichés si incomplets, entrées et avertissements.
**La couverture est une part pondérée du protocole calculée, pas une précision
ni une confiance statistique.** Toute couverture partielle impose une fiabilité
limitée avec explication de la normalisation. Par exemple, sans symétrie,
80 % du protocole est calculé; les trois catégories restantes sont normalisées
sur ces 80 %, sans inventer la symétrie.

### Qualité et répétabilité

Les anciens seuils deviennent des recommandations : luminosité 45–225,
netteté ≥12, taille faciale ≥0,28, stabilité ≤1 si connue, expression neutre,
pose finie de matrice avec yaw/pitch ≤8° et roulis ≤20°. Leur non-respect
ajoute un avertissement et limite la fiabilité, sans effacer une note calculable.
Ils ne corrigent pas la perspective ou les occlusions et restent empiriques.

Une photo est toujours de fiabilité **limitée**, sa répétabilité étant inconnue.
Une série reçoit au maximum une fiabilité **modérée** si toutes les mesures
configurées sont présentes, la capture est satisfaisante et chaque entrée a
au moins cinq observations, une rétention ≥75 % et des dispersions robustes
avant/après rejet finies et ≤`max(10 % de abs(valeur), 0,01 ratio ou 0,75°)`.
Sinon, elle reste **limitée** avec une note indicative. Les problèmes de pose
sur les observations utilisées et une continuité multi-angle incomplète ou
incohérente sont également des avertissements.

### Accès au rapport

Photo et Live calculent les projections apparentes en mode approximatif si la
géométrie est mesurable. Le mode strict de `measure()` est conservé pour la
capture guidée stabilisée. Les mesures approximatives sont marquées limitées.
Le Live autorise le rapport dès une observation mesurable. Le scan guidé
propose « Voir mon estimation maintenant » : ce choix crée un rapport Live
indicatif et ne valide pas les étapes multi-angle.

Aucun/deux visages, repères non finis ou géométrie effondrée restent des erreurs
d’acquisition, car aucun calcul réel n’est alors possible. Si aucune entrée de
scoring n’est utilisable, le résultat interne reste null; l’interface invite à
reprendre la capture. Aucune note fictive n’est fournie pour ce cas.

Le masquage volontaire de la notation s’applique aussi au JSON. Pas de
percentile, diagnostic ou prédiction scientifique de l’attractivité.
