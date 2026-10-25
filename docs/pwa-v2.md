# Cache progressif des modules V2

La compilation Vite produit maintenant `.vite/manifest.json`. `scripts/build-sw.mjs` utilise ce graphe pour distinguer le shell frontal des modules avancés. Le manifeste sert à la génération du service worker ; il n’est pas lui-même précaché.

## Ce qui est installé

Le shell contient l’entrée de l’application, ses imports statiques transitifs, leurs feuilles de style et leurs ressources associées, ainsi que les documents et icônes statiques livrés avec l’application. Les imports dynamiques ne sont pas parcourus pour constituer le shell.

Une exception explicite inclut le chunk `src/vision/engine.ts` et ses dépendances statiques. Ce module permet au client frontal de passer du Worker au moteur exécuté sur le fil principal, même hors ligne. Il reste chargé à la demande par l’application, mais son code est disponible dès l’installation du shell.

L’installation ne demande aucun modèle facial ni moteur WASM. Les ressources immuables sous `/vision/<révision>/` conservent leur cache progressif séparé, leurs variantes SIMD et non-SIMD et leur contrôle de disponibilité. Une première analyse hors ligne nécessite toujours que les ressources de vision correspondantes aient déjà été utilisées et mises en cache.

## Ce qui est chargé à la demande

Les autres fichiers JavaScript et CSS hachés du répertoire `/assets/` sont énumérés dans une liste exacte lors de la génération. Les modules profil assisté, PDF et exploration géométrique, ainsi que leurs dépendances séparées, entrent dans cette catégorie lorsqu’ils sont produits comme chunks dynamiques.

Le service worker les récupère à leur première requête et conserve une réponse réussie de même origine. Les prochaines requêtes peuvent utiliser cette réponse hors ligne. Les fichiers avancés inutilisés n’occupent pas le cache et leur indisponibilité n’empêche pas l’installation du shell. Les dépendances de code et les styles deviennent disponibles hors ligne après leur propre téléchargement réussi ; activer un module ne signifie pas que tous les autres modules sont prêts.

Les fichiers du shell et les modules progressifs partagent le cache versionné de leur compilation. Les fichiers de vision gardent leur cache par révision. Une erreur de quota ne prive pas l’application d’une réponse réseau utilisable ; le navigateur peut aussi supprimer des caches selon sa politique de stockage.

## Confidentialité et mises à jour

La liste des fichiers autorisés est figée dans le service worker. Le traitement des requêtes ne s’appuie pas sur une règle générale « tout fichier `.js` ou toute image ». Seules les requêtes GET de même origine, sans paramètres de recherche et dont le chemin figure exactement dans cette liste sont mises en cache. Les photos de l’utilisateur, données de session, requêtes POST et ressources arbitraires restent exclues.

Les règles de remplacement restent identiques : une nouvelle version attend la fermeture des anciens onglets ou l’action explicite de mise à jour. Son activation nettoie les anciens caches. Tant qu’un ancien onglet est actif, sa version conserve ses propres fichiers déjà mis en cache. Pour qu’il puisse charger un ancien chunk encore inutilisé après un déploiement, l’hébergement doit continuer à servir ce fichier immuable ; le service worker ne peut pas recréer un fichier absent du serveur et du cache.

Les distributions synthétiques ou anciennes sans manifeste Vite conservent le comportement précédent : tous les fichiers statiques hors `/vision/` sont précachés. Un manifeste présent mais invalide, une entrée absente ou une dépendance statique manquante fait échouer la génération au lieu de produire silencieusement un shell incomplet.

## Vérification

`npx playwright test --config playwright.pwa-update.config.ts` exécute neuf cas sur des serveurs temporaires utilisant leurs propres ports. Les huit cas existants couvrent notamment le téléchargement progressif de vision, les reprises après erreur et la coexistence des versions dans plusieurs onglets.

Le cas V2 ajoute un graphe de chunks avec dépendance partagée et styles. Il vérifie qu’un module avancé bloqué ne compromet pas l’installation, que le moteur frontal est précaché, que seuls les modules demandés et leurs dépendances sont ajoutés, et que le module et son style se rechargent hors ligne. Une image privée et un fichier de code inconnu servis avec succès restent absents du cache ; les requêtes avec paramètres ou POST restent également exclues.
