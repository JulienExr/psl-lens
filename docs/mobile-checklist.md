# Validation physique Android et iOS

Statut V1.1 : **à réaliser**. Les tests de bureau, les viewports Playwright et
WebKit de bureau ne valident pas une caméra de téléphone ni Safari iOS.
Pour chaque ligne, noter appareil, OS, navigateur/version, date et résultat;
ne pas conserver de photo privée dans les traces ou captures du dépôt.

| Vérification                                                               | Android Chrome | iPhone Safari / PWA |
| -------------------------------------------------------------------------- | -------------- | ------------------- |
| HTTPS, première visite, chargement lent du modèle, annulation puis reprise | À faire        | À faire             |
| Permission refusée puis autorisée; microphone jamais demandé               | À faire        | À faire             |
| Caméra frontale/arrière, sélection, périphérique indisponible              | À faire        | À faire             |
| Arrêter pendant inférence, relancer immédiatement dix fois                 | À faire        | À faire             |
| Changer de caméra pendant inférence; aucune piste ancienne active          | À faire        | À faire             |
| Live → Photo, Live → Quick Scan, effacement pendant chargement             | À faire        | À faire             |
| Pause/reprise, verrouillage écran, arrière-plan, retour, fermeture         | À faire        | À faire             |
| Portrait → paysage → portrait, vidéo proportionnelle, overlay aligné       | À faire        | À faire             |
| Miroir activé/désactivé, repères et vidéo réfléchis ensemble               | À faire        | À faire             |
| Couches vidéo/repères/maillage/mesures et toutes les régions               | À faire        | À faire             |
| Rapport partiel/complet, constructions sélectionnées, photo masquée        | À faire        | À faire             |
| Score frontal valide/refusé et masquage; PSL complet indisponible          | À faire        | À faire             |
| Quick Scan interrompu puis repris; Multi-Angle cohérent/incohérent         | À faire        | À faire             |
| Lunettes, cheveux, visage coupé, expression et lumières variées            | À faire        | À faire             |
| Image EXIF tournée, grande image, deux visages, format invalide            | À faire        | À faire             |
| JSON sans image/landmarks, impression locale/PDF                           | À faire        | À faire             |
| Installation PWA sans moteur; indicateur hors ligne après analyse          | À faire        | À faire             |
| Mode avion : nouvelle analyse après préparation complète                   | À faire        | À faire             |
| Mise à jour en attente, activation explicite, autre onglet préservé        | À faire        | À faire             |
| Mémoire/chauffe et cadence sur cinq minutes, fallback CPU si disponible    | À faire        | À faire             |

Relever la cadence, la latence d’inférence et le temps de dessin affichés dans
le studio. Ces mesures décrivent cet appareil et cette session; ne pas les
transformer en promesse générale de FPS. L’éviction du cache par le navigateur
peut imposer un nouveau téléchargement. Tester également le véritable
hébergement et ses en-têtes; aucun déploiement n’est effectué par la V1.1.
