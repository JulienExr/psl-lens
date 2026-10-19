# PSL Lens

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
  la caméra. Cinq observations frontales valides permettent de créer le rapport.
- **Scan guidé** : suivre les consignes frontales puis gauche/droite. Le scan
  requiert 16 observations frontales consécutives puis 8 pour chaque rotation
  légère. Un mouvement ou une capture invalide remet à zéro la série en cours.
  La progression dépend des détections réelles. Les vues tournées ne sont pas
  mélangées aux mesures frontales.
- **Rapport** : explorer les régions, ouvrir une mesure pour consulter sa
  formule, les indices et la dispersion, masquer les sous-scores et exporter
  les mesures JSON. L’export volontaire ne contient ni photographie ni landmarks.
- **Effacer la session** : l’icône corbeille libère les résultats et le moteur,
  arrête le studio actif et remet les vues à zéro. Le rechargement efface aussi
  les données de session.

## Mesures et score

Les ratios et angles sont calculés à partir de coordonnées en pixels, après
correction du roulis par la ligne des yeux. Ce sont des mesures **apparentes 2D**,
sans dimensions physiques et sans reconstruction osseuse.

Le scoring `psl-heuristic-1.0.0` est déterministe, inspectable et configurable
dans `src/scoring/index.ts`. Ses cibles sont des hypothèses de conception.
**La projection du profil n’est pas validée en V1 : le total sur 8 est donc
indisponible.** Les quatre catégories mesurables peuvent afficher leurs
sous-scores. Aucun poids manquant n’est silencieusement redistribué.

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
npm run build
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

La PWA peut être installée selon le navigateur. Le cache statique complet
représente environ 43 Mio (notamment les variantes WASM du SDK). Les nouvelles
versions s’activent après fermeture des onglets précédents. Ne pas promettre un
premier démarrage hors connexion : les assets doivent avoir été téléchargés.

## Limites connues

- Profil à 90°, projection nasale/mentonnière et mesures osseuses indisponibles.
- Aucun score global en V1, par construction du protocole complet.
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
- [Licences et attribution](THIRD_PARTY_NOTICES.md)

Les sources sont réparties entre `src/features` (parcours), `src/components`
(rendu), `src/hooks` (caméra), `src/vision` (détection/qualité/scan/agrégation),
`src/morphometry` (calculs) et `src/scoring` (heuristique).
