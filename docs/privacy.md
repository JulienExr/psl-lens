# Confidentialité et sécurité

## Données

Images décodées, bitmaps, flux, landmarks et rapports restent en mémoire du
navigateur. Pas de compte, base de données, localStorage, IndexedDB facial,
télémétrie ou upload. Aucun enregistrement vidéo. Les tracks caméra sont
arrêtées lors de la navigation hors studio, d’un arrêt manuel, d’une annulation,
de la perte de visibilité ou du `pagehide`.

L’effacement de session démonte le parcours, invalide les traitements en cours,
ferme le worker et le moteur, libère les références React et supprime le rapport.
Comme pour toute application JavaScript, la collecte physique de mémoire est
gérée par le navigateur; aucune garantie d’effacement bas niveau n’est formulée.

Les photos de profil et les points assistés sont gardés uniquement en mémoire. Une capture latérale Live est créée après clic explicite; aucune sélection automatique de frames n’enregistre d’image. Le rapport frontal Live conserve uniquement les repères.

Le JSON volontaire `psl-report-2.0.0` écrit mesures/provenances, profils sans images ni coordonnées brutes, vues et conseils. Les scores sont exclus lorsque la notation est masquée. Le PDF natif est généré localement avec pdf-lib chargé à la demande. Photos, scores et détails techniques sont décochés par défaut; les photos sont intégrées uniquement après sélection explicite. Le masquage global empêche l’inclusion des scores. Aucun choix ne persiste entre sessions. La photo de rapport est masquée par défaut.

Les téléchargements déjà sauvegardés sont sous le contrôle du navigateur et du système; l’effacement de session ne supprime pas ces fichiers. Le PDF et le JSON ne sont jamais envoyés à un serveur. Voir [les exports V2](report-v2.md).

## Réseau

Installation : npm télécharge les dépendances, puis le script de préparation
récupère le modèle versionné sur storage.googleapis.com, uniquement s’il manque
ou si son empreinte ne correspond pas. Le runtime ne charge pas de CDN.

Utilisation : HTML, CSS, JavaScript, modèle et WASM sont servis par la même
origine. Le serveur voit les requêtes habituelles pour ces assets, donc son
hébergeur peut disposer de journaux HTTP; il ne reçoit pas de captures ou de
résultats faciaux. Aucun appel API externe n’est nécessaire à l’inférence.
Les liens de sources externes ne sont ouverts que par une action de l’utilisateur.

Le test E2E photo surveille les requêtes du navigateur et exige zéro requête
distante et zéro requête autre que GET pendant analyse/rapport/effacement.
Le serveur de développement a sa connexion HMR; elle n’existe pas dans le build.

## Cache et installation

Le service worker est enregistré seulement en production. Le cache est une
liste explicite des fichiers du build, de même origine; aucune requête arbitraire,
blob, data URL, photo, vidéo ou réponse d’analyse n’est enregistrée. Cache
versionné par empreinte de contenu. L’interface est précachée; le moteur est
mis en cache progressivement, avec la seule variante WASM utilisée. Voir
[les tailles et mises à jour](pwa-v1.1.md).
Les anciens caches de l’application sont supprimés à l’activation de la
nouvelle version, après fermeture des onglets de l’ancienne ou activation
explicite. L’onglet qui choisit la mise à jour est rechargé et perd sa session
en mémoire; les autres onglets proposent leur propre rechargement.

« Effacer la session » efface les données faciales mais conserve les assets
techniques. Le navigateur permet de supprimer ces derniers via les données du
site. Le mode hors ligne suppose que la préparation du cache a réussi et ne
constitue pas une promesse d’absence de réseau à la première visite.

## Permissions et en-têtes

`getUserMedia` n’est appelé qu’après clic. Contraintes audio false, caméra
frontale préférée, sélection optionnelle du deviceId. HTTPS ou localhost requis.
Les refus, absence de périphérique, caméra occupée et interruptions de flux sont
expliqués; l’import photo reste accessible.

Les en-têtes Cloudflare fournis interdisent microphone/géolocalisation, framing,
plugins et ressources externes. Le CSP permet `wasm-unsafe-eval` pour WASM et
les styles inline pour les dimensions/visualisations React; il n’autorise pas
`unsafe-eval` JavaScript. Aucun secret dans le frontend.
