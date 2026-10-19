# Progression

Conception et plan établis à partir de la mission. Exécution directe dans le
dépôt demandé. Branche dédiée car dépôt sans commit initial; pas de second
worktree ou projet imbriqué. Aucune opération distante autorisée.

Décisions: deux visages détectables pour rejet multiple; profil non validé et
total PSL indisponible; sous-scores seulement. Pas de renormalisation du total.

## Livraison du 18 octobre 2026

Les cinq tâches du plan sont terminées. Les tests ont été écrits en amont des
moteurs et des parcours; les régressions ont été reproduites avant correction.

Revue indépendante : cinq points relevés et corrigés (signe anatomique du yaw,
course entre anciennes/nouvelles initialisations, overlay portrait, récupération
d’un worker crashé et cohérence de version du cache PWA). Les tests couvrent
ces conditions; aucun point de cette revue n’a été laissé sans traitement.

Vérification complémentaire : pause d’inférence en vol, cache avec Vary: Origin,
et WebKit exposant OffscreenCanvas sans WebGL en worker. Ces cas ont été
reproduits puis corrigés et vérifiés dans les moteurs de navigateur concernés.

Commandes exécutées avec succès :

- `npm run lint` : aucune erreur ni avertissement.
- `npm run typecheck` : aucune erreur.
- `npm test` : 34 tests, 6 fichiers.
- `npm run test:e2e` : 8 parcours Chromium.
- `npm run test:compat` : 2 parcours réels, Firefox et WebKit.
- `npm run test:pwa` : build et test production/CSP/cache/offline réussis.
- `npm run format:check` : tous les fichiers concernés conformes.
- `npm audit --omit=dev --audit-level=moderate` : aucune vulnérabilité signalée.
- `git diff --cached --check` : aucun défaut d’espacement.

Limites conservées explicitement : profil 90° et total PSL indisponibles;
pas de calibration scientifique; vrais smartphones, rotations physiques et
webcams multiples non validés matériellement. Les captures desktop/mobile et
rapport ont été inspectées dans `artifacts/`, ignoré par Git.

Conservation sur `codex/build-psl-lens`, aucun push/déploiement ni modification
du dépôt distant. Les sources et la documentation sont livrées dans ce dépôt.

Dernière vérification de l’agrégation : le niveau de fiabilité utilise le nombre
d’échantillons conservés pour chaque mesure, et non le nombre global de frames.
Régression reproduite puis corrigée et couverte par un test supplémentaire.
