# Validation V2 : données, calculs et limites

L’évaluateur `src/validation/profile-evaluation.ts` compare des coordonnées
déclarées à une référence et réexécute le moteur du profil. Il ne lit pas les
pixels et ne lance aucun détecteur. Les résultats sont déterministes : les
UUID et dates internes du moteur ne sont pas repris dans le rapport.

## Commandes reproductibles

```sh
node scripts/evaluate-profile.mjs
node scripts/evaluate-profile.mjs /chemin/dataset.json
node scripts/evaluate-profile.mjs /chemin/dataset.json --output /chemin/rapport.json
node scripts/evaluate-profile.mjs --help
```

Le script utilise l’esbuild déjà présent pour compiler le module TypeScript
en mémoire, sous Node ≥22.12. Il n’ajoute aucune dépendance, n’écrit aucun bundle
et n’effectue aucune requête réseau. Sans chemin, il charge
`tests/fixtures/annotations/capone-profile.json`. Le rapport JSON contient les
conventions, les métadonnées, les résultats par observation, les mesures
indisponibles et les dispersions séparées.

## Jeu réellement disponible

La photographie `tests/fixtures/capone-profile.jpg` mesure 627×1050 pixels.
La [page source Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Al-Capone-Alcatraz-mug-shot-side.jpg)
attribue le cliché au Federal Bureau of Prisons, en 1934, et indique le domaine
public au titre d’un travail officiel du ministère américain de la Justice.
Cette attribution et la notice de licence ont été vérifiées sur la page source.

L’annotation a été placée manuellement par un seul opérateur sur l’image
réellement affichée. Elle n’est **pas une vérité experte indépendante**. Sept
repères sont annotés ; C est omis car le vêtement masque la transition du cou.
Les limites du nasion et des lèvres sont approximatives. Le côté anatomique
reste inconnu et l’angle exact de prise de vue n’est pas mesuré.

Le domaine public documente ici la provenance de l’image. Ce n’est pas une
cohorte de participants contemporains consentants, et aucun consentement à
une étude d’acquisitions répétées n’est revendiqué.

## Résultats du script fourni

| Résultat observé                                 | Valeur           | Interprétation                                                    |
| ------------------------------------------------ | ---------------- | ----------------------------------------------------------------- |
| Images / annotations réelles                     | 1 / 1            | Pas de généralisation à une population.                           |
| Références visibles / occluses / non renseignées | 7 / 1 / 0        | Visibilité du catalogue : 7/8.                                    |
| Longueur N–Me de référence                       | 315,990883 px    | Normalisateur des erreurs de points.                              |
| Couverture de l’auto-comparaison                 | 7/7 = 100 %      | Tous les points visibles ont été recopiés.                        |
| NME de l’auto-comparaison                        | 0                | Identité des coordonnées, sans précision indépendante.            |
| NME indépendante                                 | `null`           | Aucune annotation ou détection indépendante.                      |
| Taux de détection automatique                    | `null` ; 0 essai | L’import assisté ne constitue pas une détection automatique.      |
| Répétabilité réelle d’annotation                 | `null` ; 0 paire | Une seule annotation.                                             |
| Mesures réelles disponibles                      | 0/7              | `strictProfileConfirmed=false`, car le yaw exact n’est pas connu. |

Une seconde section comporte cinq échantillons **synthétiques** avec une
déclaration hypothétique de profil strict, afin de pouvoir exercer les formules
du moteur. Cette déclaration ne valide pas l’orientation de la photographie.
Pour `k∈{−2,−1,0,1,2}` pixels et l’indice i du point dans le JSON, le script
applique `ΔX=(−1)^i×k`, `ΔY=(i mod 3−1)×k`. Un déplacement diagonal est donc
de longueur `sqrt(2)×|k|`, et non de |k|. Le zéro est le scénario conditionnel
sans perturbation. Ces données dérivées sont exclues des résultats indépendants.

| Sensibilité synthétique                             | Valeur calculée                                     |
| --------------------------------------------------- | --------------------------------------------------- |
| NME à `k=±1`                                        | 0,004100963, soit 0,4100963 % de N–Me               |
| NME à `k=±2`                                        | 0,008201925, soit 0,8201925 % de N–Me               |
| Comparaisons synthétiques deux à deux               | 10 paires, 70 couples de points                     |
| Écart normalisé moyen entre placements synthétiques | 0,008201925                                         |
| Étendue de `nose-projection`                        | 0,026239487                                         |
| Étendue de `chin-projection`                        | 0,025237797                                         |
| Étendue de `profile-angle`                          | 2,779508890°                                        |
| Étendue de `upper-lip-offset`                       | 0,003969350                                         |
| Étendue de `lower-lip-offset`                       | 0,022950262                                         |
| Étendue de `lower-profile-share`                    | 0,024322778                                         |
| `chin-neck-angle`                                   | Indisponible pour les cinq échantillons : C masqué. |

Ces étendues décrivent les perturbations choisies. Elles ne sont ni un intervalle
de confiance, ni une erreur anatomique, ni une répétabilité d’opérateur ou
d’acquisition. Aucun seuil de réussite scientifique n’en est déduit.

## Convention NME et couverture

Pour une référence visible `r_i`, une observation confirmée `p_i`, une largeur W
et une hauteur H :

```text
e_i = hypot((p_i.x − r_i.x) × W, (p_i.y − r_i.y) × H)
h_ref = hypot((Me_ref.x − N_ref.x) × W, (Me_ref.y − N_ref.y) × H)
NME = (somme des e_i sur les points comparables / nombre de points comparables) / h_ref
couverture = points visibles comparables / références visibles
```

N et Me sont choisis car ils existent dans ce protocole latéral ; aucune
normalisation par distance interoculaire n’est supposée disponible. Le NME
utilise toujours le h de référence. Le moteur recalcule en revanche sa propre
base N–Me pour chaque observation lorsqu’il calcule les mesures.

Une référence absente signifie « non renseignée » ; `visible=false` signifie
explicitement « occluse/non visible ». Ces catégories sont séparées. Une
coordonnée observée absente, hors image, non finie ou non confirmée est exclue
et listée comme manquante ou invalide. Elle n’est jamais remplacée par la
référence. Les mesures correspondantes restent indisponibles.

Le NME n’est calculé que sur les points visibles comparables, avec sa couverture
affichée à côté. Un NME faible accompagné d’une faible couverture peut cacher
des points difficiles. Sans N et Me visibles et non confondus dans la référence,
le NME reste `null`, même si des points sont disponibles.

L’agrégat `independentPointError` exclut `self` et `synthetic-derived` et pondère
chaque comparaison de point normalisée de la même façon. Il conserve la
couverture sur l’ensemble des références visibles des observations concernées.
Le terme « indépendant » décrit la relation déclarée entre placements ; il ne
certifie pas l’expertise ou l’exactitude de la référence.

## Répétitions et disponibilité

Chaque cas correspond à **la même image, les mêmes dimensions et le même
protocole d’annotation**. Les `annotation` et `repeat-annotation` de ce cas sont
comparées deux à deux sur leurs points confirmés communs et visibles dans la
référence. L’écart moyen pondère chaque couple de points, pas chaque paire
d’annotations. Le rapport indique le nombre de paires possibles et utilisables.
Il faut deux observations utilisables pour une dispersion ; sinon elle vaut
`null`.

Chaque mesure conserve son nombre de valeurs disponibles, sa moyenne, son
étendue `max−min` et son écart-type d’échantillon
`sqrt(somme((x−moyenne)^2)/(n−1))`. Les deux derniers valent `null` si n<2.
Il ne s’agit pas d’un ICC, d’une limite d’accord, d’une variance entre sujets
ou d’un intervalle calibré. Conserver des cas séparés pour les opérateurs ou
protocoles que l’on ne veut pas mélanger.

Les `synthetic-sensitivity` sont traités dans une section différente. Ils ne
contribuent ni aux répétitions observées, ni au NME indépendant, ni au taux de
détection. Les champs de détection sont des résultats **fournis** par un
évaluateur externe : `automatic` exige un booléen `detected` et `manual` exige
`detected=null`. Un échec déclaré ne fournit aucun point ou mesure réussie.

## Import d’un jeu personnalisé

Le JSON doit déclarer `schema="psl-profile-evaluation-1.0.0"`, des métadonnées
non vides `name`, `source`, `license`, `consent`, et au moins un cas. Ces
métadonnées s’appliquent à toutes les images du fichier : documenter toutes
les sources et autorisations, ou scinder les jeux. L’outil exige leur présence
avant le calcul ; il ne peut pas vérifier la véracité d’une licence ou d’un
consentement. Ne pas importer de portraits dont l’usage n’est pas autorisé.

Exemple minimal **entièrement synthétique**, sans personne photographiée :

```json
{
  "schema": "psl-profile-evaluation-1.0.0",
  "metadata": {
    "name": "Exemple géométrique synthétique",
    "source": "Coordonnées générées pour le test, sans image de personne",
    "license": "CC0 pour cet exemple synthétique",
    "consent": "Aucun sujet humain ; aucune acquisition de portrait"
  },
  "cases": [
    {
      "id": "synthetic-1",
      "width": 1000,
      "height": 1000,
      "side": "unknown",
      "referenceType": "synthetic-not-anatomical-ground-truth",
      "reference": {
        "nasion": { "x": 0.5, "y": 0.2, "visible": true },
        "pronasale": { "x": 0.7, "y": 0.4, "visible": true },
        "subnasale": { "x": 0.55, "y": 0.5, "visible": true },
        "pogonion": { "x": 0.55, "y": 0.7, "visible": true },
        "menton": { "x": 0.5, "y": 0.8, "visible": true }
      },
      "observations": [
        {
          "id": "synthetic-placement",
          "kind": "synthetic-sensitivity",
          "method": "manual",
          "detected": null,
          "referenceRelation": "synthetic-derived",
          "strictProfileConfirmed": true,
          "points": {
            "nasion": { "x": 0.5, "y": 0.2, "source": "manual", "confirmed": true },
            "pronasale": { "x": 0.71, "y": 0.4, "source": "manual", "confirmed": true },
            "subnasale": { "x": 0.55, "y": 0.5, "source": "manual", "confirmed": true },
            "pogonion": { "x": 0.55, "y": 0.7, "source": "manual", "confirmed": true },
            "menton": { "x": 0.5, "y": 0.8, "source": "manual", "confirmed": true }
          }
        }
      ]
    }
  ]
}
```

Pour des annotations indépendantes réelles, utiliser `kind="annotation"`, puis
`repeat-annotation` pour les nouveaux placements sur cette même image, avec
`referenceRelation="independent"`. Pour une auto-comparaison, utiliser `self`.
Une perturbation synthétique exige la relation `synthetic-derived`. Les IDs
de cas et d’observations doivent être uniques dans leur portée. Des noms de
points inconnus sont refusés pour éviter de masquer une faute de saisie.

## Travail de validation restant

- Recruter une cohorte autorisée et consentante avec captures répétées, des
  références indépendantes et un protocole de conservation documenté.
- Répéter les annotations par opérateur et entre opérateurs, en aveugle et
  avec une référence experte explicitement définie.
- Acquérir plusieurs vraies orientations, dont le profil contrôlé à 90°, et
  mesurer le yaw de référence. Tester les deux côtés anatomiques.
- Évaluer des images réellement miroitées dans les parcours de capture, la
  rotation de tête, les différences d’éclairage, l’expression, les lunettes,
  la barbe, les occlusions, la résolution et les appareils.
- Donner une référence propre à chaque photographie d’acquisition répétée.
  Le présent regroupement d’annotations sur une même image ne doit pas être
  employé pour comparer directement des coordonnées de photos non recalées.
- Mesurer les taux de réussite et les erreurs d’un éventuel détecteur de profil
  sur ces données, puis définir des seuils et analyses d’accord appropriés.

Les invariances mathématiques, le miroir logiciel d’un jeu de points et les
perturbations synthétiques ne remplacent aucune de ces acquisitions réelles.
Les formules et les choix de méthode figurent dans
[l’analyse du profil](profile-analysis.md). La validité scientifique d’un score
esthétique n’est pas établie par ces contrôles géométriques.
