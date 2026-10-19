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
descriptif lorsque l’affichage expérimental est désactivé. Aucun score Live
n’oscille avec les frames : seuls les rapports d’acquisitions stabilisées
peuvent afficher les catégories disponibles.

Texte affiché systématiquement :

> Experimental PSL estimate — not a scientific beauty rating.

La symétrie ou une cible numérique ne définit pas l’attractivité. Le produit ne
propose aucun diagnostic, traitement, procédure chirurgicale ou conseil corporel
dangereux et n’infère ni origine, identité, santé ou orientation sexuelle.

## Protocole frontal indépendant

`psl-frontal-1.0.0` est implémenté séparément dans `src/scoring/frontal.ts` et
exporté par `scoreFrontal(measurements, {source, quality, pose})`. Le rapport peut
afficher **PSL frontal expérimental /8** avec une fiabilité descriptive. Ce score
ne remplace pas le protocole complet historique et ne réattribue pas ses poids.
Ses cibles sont les mêmes choix subjectifs de produit que ceux du tableau précédent.

| Catégorie          | Poids frontal | Mesures obligatoires      |
| ------------------ | ------------- | ------------------------- |
| Proportions        | 30 %          | face-ratio, lower-face    |
| Yeux               | 25 %          | eye-spacing, canthal-tilt |
| Symétrie apparente | 20 %          | symmetry                  |
| Mâchoire / menton  | 25 %          | jaw-ratio, chin-ratio     |

La formule par mesure reste `8 × max(0,1−abs(x−t)/d)`, puis moyenne des règles
obligatoires par catégorie et somme des quatre contributions pondérées. Les
contributions individuelles et raisons de refus sont exportées. Chaque ID requis
doit apparaître exactement une fois; les autres mesures descriptives sont indépendantes.
Les ratios sont strictement positifs, l’écart de symétrie positif ou nul et
l’inclinaison strictement comprise entre −90° et +90°.

La capture doit être valide, frontale, marquée prête, sans problème relevé, avec
expression neutre vérifiée explicitement. Les éléments numériques de qualité
doivent être finis : luminosité 45–225, netteté ≥12, taille faciale ≥0,28 et
stabilité connue ≤1 si disponible. La pose issue de la matrice doit être finie,
|yaw| et |pitch| ≤8° et |roll| ≤20°. Ces seuils sont empiriques; ils ne compensent
ni la perspective, ni une déformation d’objectif, ni une occlusion non détectée.

Une photo unique peut produire un score avec fiabilité **limitée**. Chaque entrée
requise porte `samples=1`, `confidence=low`, `reliabilityReason=single-photo`.
Sa dispersion est inconnue et n’est pas présentée comme une stabilité démontrée.
Une dispersion fournie contradictoire ou non finie fait refuser la note.

Une série Live ou guidée exige, pour chaque mesure requise : au moins cinq
observations conservées, confiance modérée, aucun motif de fiabilité dégradée,
rétention ≥75 %, dispersions robustes avant et après rejet finies et inférieures
ou égales à `max(10 % de abs(valeur), 0,01 pour ratio ou 0,75° pour angle)`.
Ces seuils sont des critères empiriques de stabilité. Une série stable reçoit une
fiabilité **modérée**, jamais élevée. La fiabilité n’est pas convertie en pénalité
numérique sur le score.

Une entrée obligatoire absente, invalide, insuffisante ou instable rend le total
indisponible, sans remplacer la valeur par zéro ni redistribuer un poids. Les
catégories utilisables restent inspectables si la capture satisfait les conditions.
La commande de masquage de la notation esthétique reste applicable aux deux protocoles.
Aucun percentile, diagnostic ou prédiction scientifique de l’attractivité n’est produit.
