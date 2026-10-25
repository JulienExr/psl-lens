# Rapport V2 et export local

Le rapport distingue frontal, contrôles obliques et profils assistés. Chaque profil conserve côté déclaré, sens dans l’image, points confirmés, mesures, formule, méthode, version et incertitudes. Le score frontal reste compatible; le multi-vues est décrit dans [multiview.md](multiview.md).

« Préparer le PDF » charge le module et pdf-lib à la demande. « Télécharger le PDF » construit un vrai document PDF local : synthèse, mesures et constructions vectorielles, profils, vues/cohérence, recommandations et annexe technique optionnelle. La mise en page gère retour à la ligne, saut de page, titres de section et pagination. Helvetica standard conserve les accents français; les symboles mathématiques non représentables sont transcrits en texte ASCII. Aucun téléchargement de police, CDN ni upload.

Photos, scores et détails techniques sont décochés par défaut. Une photographie n’est incorporée que si l’utilisateur sélectionne explicitement les photos. Les scores ne peuvent être inclus lorsque la notation générale est masquée. Seules les images locales décodées de la session peuvent être incorporées. Les diagrammes vectoriels sont indépendants des photographies. Une photo Live n’existe que si la capture latérale a été déclenchée explicitement.

Le JSON `psl-report-2.0.0` conserve les mesures/provenances, profils sans images ni coordonnées brutes, vues, recommandations et scores facultatifs. Le fichier n’est jamais exporté automatiquement. Les téléchargements déjà enregistrés relèvent du navigateur/système et ne sont pas supprimés par l’effacement de session. L’application propose le PDF natif comme action d’export documentaire.

## Vérification

Tests pdf-lib : ouverture des vrais octets, pages, textes/accents, options techniques, absence/présence d’images et scores selon options. Un exemple synthétique long de 13 pages a été ouvert avec Poppler et rendu en PNG; des pages détaillées et une planche contact ont été inspectées, avec correction des titres orphelins et d’une collision d’annotation. Artefacts locaux ignorés dans `artifacts/v2-pdf-qa/`. Le parcours E2E réalise un téléchargement depuis une vraie photo publique de profil. Les résultats finaux figurent dans [v2-progress.md](v2-progress.md).
