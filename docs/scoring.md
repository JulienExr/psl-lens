# Score PSL expérimental

Version : `psl-heuristic-1.0.0`. Implémentation pure dans `src/scoring/index.ts`.
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
catégories étaient disponibles. **Il reste null en V1**, puisque le profil ne
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
