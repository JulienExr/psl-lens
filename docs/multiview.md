# Acquisition et scoring multi-vues V2

Le frontal reste compatible avec `psl-frontal-1.1.0` et les avertissements de PR #2. Le profil `profile-2d-2.0.0` reste une construction assistée sur une photo. Les vues obliques ±22° servent aux contrôles de continuité existants et ne sont jamais moyennées avec les mesures latérales.

## Acquisitions

`/live` explore les prédictions sans score animé. `/scan` propose Quick (16 observations) et Multi-Angle (16+8+8), acquis selon pose et stabilité réelles. `/advanced` démarre en Multi-Angle et permet une photo latérale par action explicite, même lorsque le suivi MediaPipe disparaît. Après acquisition automatique complète, le rapport frontal peut être consulté directement ou complété par un profil. Importer un profil reste une alternative. Un second côté peut être ajouté depuis le rapport. Si le profil est ajouté avant la fin de l’Advanced Scan, les observations frontales guidées acceptées sont conservées et les obliques restent séparées. Sans observation frontale guidée, seule la dernière observation indicative est utilisée; aucune moyenne entre orientations non stabilisées n’est effectuée pour cette transition. Les profils validés sont conservés séparément par côté; une nouvelle validation du même côté remplace la précédente.

Chaque mesure frontale inclut la méthode, la version, le nombre d’observations et la pose représentative. `views` conserve les étapes réellement acquises. Une estimation immédiate avant stabilisation reste un rapport Live indicatif; elle ne valide pas les étapes restantes. Aucun contrôle d’identité automatique n’est effectué : l’utilisateur doit employer la même personne pour les vues qu’il associe.

## Protocole distinct : psl-multiview-2.0.0

Configuration inspectable : `src/scoring/multiview.ts`.

| Entrée                         | Poids nominal |                Cible |            Tolérance |
| ------------------------------ | ------------: | -------------------: | -------------------: |
| Score frontal /8               |          70 % | protocole compatible | protocole compatible |
| Projection apparente du nez    |          10 % |                 0,10 |                 0,15 |
| Projection apparente du menton |          10 % |                    0 |                 0,15 |
| Angle N–Sn–Pg                  |          10 % |                 165° |                  35° |

70 % conserve la prépondérance d’un protocole frontal existant; les trois constructions latérales partagent 30 % pour limiter la dépendance au pointage manuel. Cibles et tolérances sont des choix arbitraires de produit. Elles ne proviennent pas d’une population, d’une norme anatomique ou d’une étude de beauté. Modifier cette configuration exige de modifier la version et les tests.

Note latérale = `8 max(0,1−abs(valeur−cible)/tolérance)`. Le frontal conserve sa couverture interne. Couverture totale = somme des poids nominaux × couvertures. Note = somme des notes × poids × couvertures / couverture totale. Les contributions normalisées affichées totalisent la note. Couverture n’est pas exactitude.

Un frontal calculable ET au moins une entrée latérale confirmée sont nécessaires. Sinon, aucune note multi-vues n’est extrapolée; le frontal et les mesures latérales restent consultables. Les valeurs non finies, absentes, non confirmées ou dupliquées sont exclues. Une seule source latérale est sélectionnée : plus grand nombre de mesures disponibles, date la plus récente puis identifiant pour départager. Les deux côtés ne sont pas fusionnés. L’identifiant de la source sélectionnée est exporté. La fiabilité reste limitée.

Le masquage de la notation retire les deux notes de l’interface et du JSON; le PDF a sa propre sélection explicite, désactivée lorsque la notation est masquée. Aucun percentile, calibration démographique ou validation esthétique.

## Confirmation et provenance — correction du 25 octobre 2026

La présence géométrique des vues ne suffit plus : l’utilisateur doit confirmer explicitement qu’elles représentent la même personne. Le moteur refuse une note combinée si l’attestation est absente ou ne correspond plus exactement à l’analyse automatique et à l’ensemble des profils présents. Les cibles et poids du protocole restent inchangés. Sans attestation, les mesures et le score individuel restent consultables; les contributions combinées restent nulles. Une vue peut être retirée depuis le rapport. Remplacement, ajout ou retrait révoquent la confirmation; elle n’est pas persistée et disparaît au rechargement.

La provenance utilise la pose réellement observée, indépendamment du nom de l’étape d’acquisition et du protocole de formules frontales. Yaw >8° : `oblique-left`, yaw <−8° : `oblique-right`; en dehors de ces cas, |pitch| >8° : `non-frontal`. Une pose de matrice absente/non finie devient `orientation-unknown`. Ces plages décrivent l’orientation pour l’affichage, sans certifier l’angle anatomique. Une série de poses différentes est marquée `mixed-orientations` dans les mesures, avec les orientations observées séparées dans `views`.

`validatedFrontal=true` est réservé à une acquisition guidée d’au moins16 observations réellement frontales acceptées. Une estimation Live oblique ou inconnue garde son score indicatif et sa pose, mais ne devient ni une acquisition frontale validée ni un Quick Scan. Son avertissement apparaît dans le rapport, les raisons du score et les exports.
