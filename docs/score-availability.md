# Score disponible avec avertissements — 24 octobre 2026

La demande produit remplace les refus liés à la qualité par une estimation
visible et un avertissement. Base : `37a066e` (V1.1 fusionnée).
Branche : `codex/score-with-quality-warnings`.

- `psl-frontal-1.1.0` conserve la note pour une pose imparfaite/inconnue,
  une photo sombre/floue, une expression ou une série courte/dispersée.
- La fiabilité devient limitée; les raisons et conseils sont visibles.
- Les entrées absentes ou invalides sont exclues. Les poids effectivement
  calculés sont normalisés avec une couverture explicite totale/par catégorie.
  Les contributions affichées totalisent la note. Aucun remplissage par une
  cible, une moyenne de population ou une valeur aléatoire.
- Photo et Live calculent des mesures approximatives avec le même moteur
  géométrique. Le mode strict demeure pour la progression du scan stabilisé.
- Le rapport Live est accessible dès une observation mesurable. Le scan guidé
  propose « Voir mon estimation maintenant », sans prétendre terminer les étapes
  ou valider une continuité multi-angle.
- Pas de visage unique, coordonnées invalides ou géométrie effondrée : erreur
  d’acquisition. Sans aucune donnée calculable, une note ne serait pas réelle.
- Le score complet historique reste séparé. Aucun backend ou changement de
  confidentialité, de caméra, de stockage ou d’envoi réseau.

Les nouveaux tests ont d’abord reproduit le score null, le bouton photo bloqué
et l’absence de sortie immédiate du scan guidé, puis passent après correction.
Les anciens tests de refus ont été adaptés aux avertissements demandés, sans
supprimer les cas de géométrie non calculable. La normalisation est vérifiée
pour une catégorie entière absente et une demi-catégorie avec notes différentes.
Une revue indépendante n’a relevé aucun défaut bloquant.

Validation locale : lint, types, format et build; 142 tests unitaires/composants,
21 E2E Chromium, 2 Firefox/WebKit avec véritable inférence, 1 PWA réelle hors
ligne et 8 tests PWA de mise à jour passent. Les mocks sont réservés aux tests
contrôlés; la photographie historique est aussi analysée par le véritable modèle.

Le score reste une heuristique subjective, pas une mesure scientifique
d’attractivité. Une qualité insuffisante peut fortement modifier la note; le
message explique comment améliorer la capture. Les recommandations de seuils
et les nouvelles formules de couverture sont dans [le protocole](scoring.md).
