# PSL Lens V1.1

**Live Facial Analysis · See your face differently.**

Application web d’exploration morphologique faciale pour adultes. Détection
MediaPipe réelle, webcam, maillage, scan guidé et 15 mesures descriptives. Les
images restent dans le navigateur, sans compte, backend ni télémétrie.

## Démarrer

Node.js **22.12 ou supérieur**, npm et un navigateur récent sont nécessaires.

```sh
npm ci
npm run dev
```

Ouvrir l’adresse affichée, normalement **http://127.0.0.1:5173**. L’installation
copie les WASM du SDK et télécharge le modèle Google versionné (3,6 Mio), avec
vérification SHA-256. Cette connexion est nécessaire à la première installation.
`npm run assets:prepare` permet de retenter la préparation des assets.

L’application utilise React 19, TypeScript strict, Vite, Tailwind CSS v4,
Lucide et `@mediapipe/tasks-vision`. Les versions exactes sont verrouillées dans
`package-lock.json`. Aucune variable d’environnement n’est nécessaire.

## Utilisation

- **Photo** : importer ou déposer un JPG, PNG ou WebP. Un seul visage adulte,
  frontal, bien éclairé, sans filtre. Minimum 256 px sur chaque axe, maximum
  20 Mo et 48 MP. Le navigateur applique l’orientation EXIF, puis l’image est
  réduite à 1 600 px maximum pour le traitement. Une photo de profil facultative
  peut être prévisualisée; elle ne produit aucune mesure non validée.
- **Live** : cliquer sur « Activer la caméra ». Autoriser la caméra, jamais le
  microphone. Choisir le périphérique, activer/désactiver le miroir, changer de
  couche et sélectionner une région. Pause suspend l’inférence; Arrêter coupe
  la caméra. Une observation mesurable suffit au rapport; une série stabilisée affine la fiabilité.
- **Quick Scan** (par défaut) : 16 observations frontales stabilisées.
  **Multi-Angle Scan**, facultatif : ajoute 8 observations par rotation légère
  pour contrôler pose, taille, cadrage et continuité d’une proportion verticale.
  Les vues tournées ne corrigent pas les ratios frontaux et ne reconstruisent
  pas la 3D. Une capture incohérente conserve une estimation avec avertissement. Une capture invalide remet
  à zéro la série en cours; la progression dépend des détections réelles.
  Le bouton « Voir mon estimation maintenant » donne accès au score sans attendre
  la fin du scan guidé.
- **Rapport** : explorer les régions, ouvrir une mesure pour consulter sa
  formule, les indices, la construction géométrique, les effectifs, la rétention
  et la dispersion. Masquer la notation esthétique, exporter les mesures JSON
  ou imprimer/enregistrer en PDF via le navigateur. Aucun export automatique.
  Le JSON volontaire ne contient ni photographie ni landmarks.
- **Effacer la session** : l’icône corbeille libère les résultats et le moteur,
  arrête le studio actif et remet les vues à zéro. Le rechargement efface aussi
  les données de session.

## Mesures et score

Les ratios et angles sont calculés à partir de coordonnées en pixels, après
correction du roulis par la ligne des yeux. Ce sont des mesures **apparentes 2D**,
sans dimensions physiques et sans reconstruction osseuse.

Le **`psl-frontal-1.1.0`** conserve une note expérimentale sur 8 dès que le
visage est mesurable. Une qualité insuffisante, une pose imparfaite ou une série
courte déclenchent des avertissements et une fiabilité limitée. Les poids
nominaux restent 30/25/20/25 %. Si des mesures manquent, la note est normalisée
sur les seules entrées utilisables et la couverture est affichée explicitement.
Aucune valeur manquante n’est inventée. Une photo unique reste limitée;
les séries stabilisées peuvent atteindre une fiabilité modérée.
Voir [le protocole et les formules](docs/scoring.md).

Le protocole historique `psl-heuristic-1.0.0` reste séparé. **PSL complet :
indisponible**, car la projection du profil n’est pas validée. Aucun poids
manquant n’est silencieusement redistribué.

> Experimental PSL estimate — not a scientific beauty rating.

## Vérifications

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npx playwright install firefox webkit
npm run test:compat
npm run test:pwa
npm run test:pwa-update
npm run test:performance
npm run build
npm run format:check
npm run preview
```

Vitest et Testing Library vérifient les moteurs et états UI. Playwright utilise
un vrai navigateur, le vrai modèle sur une photographie publique de test et une
caméra simulée. Le test du parcours guidé remplace explicitement le worker par
une fixture synthétique; les moteurs qualité, scan, mesures et rapport restent
réels. Aucun mock n’est intégré à la production.

## Production et Cloudflare Pages

`npm run build` génère **`dist/`**, prêt à être servi statiquement à la racine
du domaine. Le build prépare aussi le worker classique, le modèle, les WASM,
les icônes, le manifeste et un service worker versionné par empreinte de contenu.
Pour Cloudflare Pages : commande `npm run build`, sortie `dist`, Node 22.12+.
`public/_redirects` fournit le fallback SPA et `public/_headers` les en-têtes
de sécurité. La caméra requiert HTTPS en production. Aucun déploiement ni push
n’est effectué par les scripts de ce projet.

La PWA installe d’abord la petite interface. Le moteur et la variante WASM utile
sont mis en cache progressivement pendant leur utilisation. L’indicateur
« Analyse hors connexion prête » confirme leur présence dans le cache; la
première visite exige une connexion. Les fichiers du moteur ont des chemins
immuables par empreinte. Tailles et contraintes de mise à jour :
[audit PWA](docs/pwa-v1.1.md).

La CI GitHub Actions vérifie le code, Chromium, les mises à jour PWA et les
moteurs Firefox/WebKit, sans déploiement automatique.

## Limites connues

- Profil à 90°, projection nasale/mentonnière et mesures osseuses indisponibles.
- Le score frontal est une heuristique subjective. Le score complet reste absent.
- Pose approximative, sensibles à la perspective, l’expression, aux lunettes,
  cheveux et occlusions. Les occlusions ne sont pas toutes détectables.
- Seuils de qualité empiriques, sans calibration démographique ou clinique.
- La dispersion sur plusieurs frames mesure la répétabilité, pas l’exactitude
  absolue; sur une photographie, elle n’est pas estimable.
- La cadence s’adapte au matériel. Le repli CPU principal est limité; aucune
  promesse de 30 FPS d’inférence.
- Parcours complets automatisés Chromium et analyse photo réelle également
  vérifiée sous Firefox et WebKit. Validation matérielle Safari iOS, Android et
  webcams à compléter sur de vrais appareils. Le pipeline prévoit les APIs
  standards et le repli lorsque le worker/OffscreenCanvas ne sont pas disponibles.
- Les traces/captures de tests contiennent uniquement des fixtures; éviter
  d’enregistrer des données de personnes privées lors des validations manuelles.

## Documentation

- [Architecture](docs/architecture.md)
- [Mesures, formules et indices](docs/measurements.md)
- [Scoring expérimental](docs/scoring.md)
- [Confidentialité et réseau](docs/privacy.md)
- [Tests et validation](docs/testing.md)
- [Bilan V1.1, résultats et limites](docs/v1.1-progress.md)
- [Checklist Android/iOS](docs/mobile-checklist.md)
- [Licences et attribution](THIRD_PARTY_NOTICES.md)

Les sources sont réparties entre `src/features` (parcours), `src/components`
(rendu), `src/hooks` (caméra), `src/vision` (détection/qualité/scan/agrégation),
`src/morphometry` (calculs) et `src/scoring` (heuristique).
