# Corrections de revue finale — 25 octobre 2026

PR existante : [#3](https://github.com/JulienExr/psl-lens/pull/3), branche `codex/v2-advanced-analysis`. Correction limitée aux quatre points de revue, sans refonte, nouvelle dépendance, reconnaissance biométrique, nouvelle PR, fusion ou déploiement.

## PDF et confidentialité

Le bloc de provenance ajoutait systématiquement x/y normalisés. Ces valeurs numériques détaillées sont maintenant réservées à `includeTechnical=true`. Mesures descriptives, origine des points et diagrammes vectoriels restent disponibles sans annexe. Les photographies restent exclues par défaut et les scores ne sont jamais inclus si leur option est désactivée.

Les tests décodent le texte et inspectent les objets/tracés de vrais PDF pour les huit combinaisons photos/scores/technique. Les quatre cas sans option technique reproduisaient la fuite avant correction. Les diagrammes continuent de représenter la géométrie : exclure les valeurs détaillées ne rend pas une forme anonyme.

## Éditeur de profil

Le pointerdown appelait la sauvegarde avant de distinguer le pan d’une modification de repère. Le pan, le zoom et le recentrage préservent maintenant la confirmation et l’historique. Les modifications réelles de points et le changement du côté anatomique révoquent la confirmation. Un glissement effectif crée une seule entrée undo; clic stationnaire, saisie inchangée et mouvement sans changement final ne créent pas d’entrée vide. Undo annule une modification et exige une nouvelle validation.

Treize tests de composant et un parcours navigateur couvrent le comportement, dont les gestes sur une image réellement affichée et contrainte par le viewport.

## Association volontaire des vues

L’application demande une attestation explicite que les vues représentent la même personne avant le calcul multi-vues. Le moteur vérifie qu’elle correspond exactement à l’identifiant de l’analyse automatique et à tous les profils présents. Sans attestation, le total combiné et ses contributions sont indisponibles, mais les analyses individuelles restent consultables. Les vues peuvent être retirées séparément.

L’attestation reste en mémoire, sans stockage ni export/réimport de cette confirmation. Remplacement, ajout, retrait, effacement ou rechargement l’invalident. Remplacer l’analyse automatique conserve les profils individuels, mais demande de confirmer à nouveau leur association. Un export PDF encore en cours sur l’ancien état est abandonné. Un test différé passant par le vrai composant Report vérifie cette annulation; il échoue si la clé de session des contrôles PDF est neutralisée.

Le couple Einstein/Capone est désormais un test négatif d’analyses individuelles non associées. Une fixture publique de face de Capone, associée à la fixture latérale existante du même sujet selon leurs notices, permet un test positif honnête. L’ajout est limité aux tests et justifié par cette exigence; licence et source dans `THIRD_PARTY_NOTICES.md`. Aucun modèle d’identité ni garantie automatique d’identité commune n’est introduit.

## Provenance réelle

Le nom interne d’étape `front` ne détermine plus l’étiquette d’une observation. `classifyObservedView` lit la pose de matrice : yaw supérieur à8° ou inférieur à−8° devient oblique gauche/droite; pitch hors ±8° sans ces rotations devient non frontal; source absente ou non finie devient orientation inconnue. Ces plages décrivent les prédictions pour la provenance, sans exactitude anatomique garantie.

Les mesures gardent les vues réellement observées, la pose représentative et un indicateur distinct de validation frontale. Une acquisition frontale stabilisée exige le parcours guidé et au moins16 observations frontales acceptées. La transition Advanced sans frontal accepté conserve une seule observation indicative et son orientation, sans la présenter comme Quick Scan. Une pose inconnue affiche « orientation indisponible », sans transformer les zéros de remplacement en angles mesurés, y compris dans le PDF. Les formules et les scores individuels indicatifs restent compatibles.

## Validation

| Suite                        | Résultat local           |
| ---------------------------- | ------------------------ |
| Lint / TypeScript / format   | Réussite                 |
| Vitest, unités et composants | 254 tests, 28 fichiers   |
| Chromium E2E                 | 29 tests                 |
| Firefox / WebKit             | 4 tests                  |
| PWA production               | 2 tests                  |
| Mises à jour PWA             | 9 tests                  |
| Performance Canvas/SVG       | 1 test                   |
| Build de production          | Réussite                 |
| Audit npm                    | 0 vulnérabilité observée |

Benchmark Chromium156 headless Linux, viewport390px, 240 mises à jour de la même source640×640 : Canvas médiane0,10ms/p95 0,20ms; SVG médiane14,70ms/p95 36,60ms. Mesure CPU et layout forcé en développement, hors inférence, peinture GPU et téléphone physique. Les changements ne prétendent pas mesurer de nouvelles performances sur matériel mobile.

Les tests préexistants ne sont pas neutralisés : les cas positifs du moteur fournissent désormais l’attestation obligatoire, les exclusions de mesures invalides sont toujours testées avec une attestation valide, et le cas E2E de sujets différents vérifie explicitement le refus de combinaison.

## Limites maintenues

Une attestation utilisateur peut être erronée : elle ne prouve pas biométriquement l’identité commune. Le profil strict et le côté anatomique restent déclarés et placés manuellement. Les poses automatiques sont approximatives, les mesures sont des projections2D et le score est une heuristique subjective. Aucun nouveau jeu expert ni cohorte d’acquisitions répétées n’est créé. La validation sur téléphones physiques reste à compléter.
