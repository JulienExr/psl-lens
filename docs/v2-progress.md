# PSL Lens V2 — livraison du 24 octobre 2026

## Base et portée

Branche `codex/v2-advanced-analysis`, issue de `84bf44b`, fusion de la PR #2 dans `codex/build-psl-lens`. La CI stable a été vérifiée avant développement. Baseline : 142 tests unitaires/composants, 21 Chromium, 2 Firefox/WebKit, 1 PWA, 8 mises à jour et 1 performance; lint/types/build/format/audit réussis. Développement isolé dans un worktree. Aucun merge ni déploiement public.

## Livré

- Profile Analyzer utilisable : import réel ou capture latérale volontaire, côté anatomique déclaré, confirmation d’une vue stricte environ90°, points manuels, zoom/pan, glisser, coordonnées et flèches, annulation et remise à zéro. Jusqu’à sept constructions 2D avec provenance, formule, validité et tracés correspondants. Aucune détection automatique stricte90° revendiquée.
- Advanced Scan : acquisition face/obliques réelle conservée; continuité contrôlée sans reconstruction; reprise d’étape; photo latérale même si le tracking disparaît; alternative import. Une transition avant la fin conserve les observations frontales acceptées, sans mélanger les obliques. Sans frontal accepté, une seule observation indicative est conservée.
- Rapport V2 : frontal + profils séparés, vues utilisées, profil seul possible, géométrie interactive facultative avec fallback SVG2D, conseils locaux explicables selon préférences déclarées.
- PDF natif local et paginé; images, scores et annexe technique exclus par défaut. Effacer la session ou masquer les scores annule un export concerné encore en cours. JSON `psl-report-2.0.0` sans images/coordonnées brutes.
- Score frontal `psl-frontal-1.1.0` et comportement de PR #2 conservés. Nouveau `psl-multiview-2.0.0` séparé, 70 % frontal + trois constructions latérales de10 %, avec cible/tolérance/contribution/couverture inspectables. Conditions et choix subjectifs dans [multiview.md](multiview.md).
- Modules profil/PDF/exploration téléchargés puis cachés à la demande. Moteur frontal et PWA existants conservés. Pas de backend ni appel LLM.

## Vérifications locales

224 tests unitaires/composants dans25 fichiers, 26 parcours Chromium, 4 Firefox/WebKit (analyse frontale réelle et profil/PDF), 2 PWA production (dont PDF natif hors ligne), 9 mises à jour PWA et 1 benchmark Canvas/SVG. Lint, TypeScript, format, build et audit passent; audit npm :0 vulnérabilité lors de cette vérification. La CI inclut aussi l’évaluation JSON du profil, l’audit et le benchmark.

Les tests browser utilisent des photographies publiques et des caméras simulées; les tests de scan multi-angle emploient un worker synthétique explicitement réservé au test. Les requêtes distantes sont surveillées. L’ouverture réelle des PDF est contrôlée par pdf-lib et Poppler; un exemple long de13 pages et ses rendus ont été inspectés, puis un PDF issu du parcours de profil réel est téléchargé avec et sans sélection de photo. Aucun test synthétique ne constitue une validation anatomique ou esthétique.

Deux revues indépendantes ont conduit notamment à corriger la conservation du frontal lors de l’import Advanced, le mélange de vues en transition incomplète, la soumission pendant remplacement d’image, le pan sous letterboxing SVG, l’ancien chemin d’impression sans sélection des photos et les exports tardifs après effacement/masquage.

## Performances mesurées

Sur Chromium156 headless Linux, viewport390px, source640×640, 240 mises à jour en build de développement : SVG2 557 nœuds, médiane21,5ms/p95 52,9ms; Canvas1 nœud, médiane0,20ms/p95 0,30ms. Mesure CPU de mise à jour avec layout forcé, sans peinture GPU ni inférence. Ce n’est pas une mesure de téléphone physique.

Build V2 : entrée JS environ484Ko brut/145Ko gzip, CSS49,7Ko. Modules facultatifs : profil9Ko, explorateur7,5Ko, contrôles PDF17,2Ko + pdf-lib419,9Ko (175,6Ko gzip), tous chargés à la demande. Shell PWA environ743Ko, modules progressifs454Ko, vision30 732 019octets (seule la variante WASM utilisée est récupérée). Voir [PWA V2](pwa-v2.md).

## Limites et suite de validation

Le moteur latéral est assisté. La déclaration de profil strict et du côté n’est pas vérifiée automatiquement. Mesures cutanées apparentes, sensibles à la focale, la pose, le contour visible et l’opérateur; aucune dimension physique, anatomie osseuse ou reconstruction3D exacte.

Une seule photographie historique publique est disponible, annotée par un seul opérateur. Angle exact inconnu, cou masqué. Aucune cohorte consentante avec acquisitions répétées, vérité experte ou précision indépendante. L’évaluateur permet de fournir ces données ultérieurement et sépare explicitement les perturbations synthétiques. Voir [validation-v2.md](validation-v2.md). Mesurer un angle ou la répétabilité ne valide pas un score de beauté.

Safari iOS, Android et la fluidité sur capteurs/appareils réels restent à vérifier manuellement. Les moteurs Firefox/WebKit automatisés ne les remplacent pas. Profil automatique spécialisé, segmentation robuste de silhouette et reconstruction métrique sont reportés. Les modules facultatifs inutilisés restent indisponibles hors ligne tant qu’ils n’ont pas été téléchargés.
