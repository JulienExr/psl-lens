# PWA et ressources locales V1.1

## Résultat et tailles

L'installation du service worker télécharge seulement la coquille : HTML,
JavaScript/CSS Vite, manifeste et icônes. Le worker de vision, le modèle et les
WASM sont téléchargés et mis en cache lorsqu'une analyse en a besoin. Une
ressource vision indisponible ne bloque plus l'installation de la coquille.

Mesures de l'audit initial, fichiers non compressés :

| Ressource                              |     Octets |
| -------------------------------------- | ---------: |
| Distribution V1 complète               | 45 245 920 |
| Liste précachée V1, 16 fichiers        | 45 243 886 |
| Répertoire WASM V1, six fichiers       | 40 669 596 |
| Variante module inutilisée, JS + WASM  | 13 854 106 |
| Modèle float16 v1                      |  3 758 596 |
| JavaScript/CSS Vite V1, trois fichiers |    605 362 |

La suppression de la seule variante module retire **13 854 106 octets** de
ressources redondantes. À code V1 inchangé, cela correspond à 31 391 814 octets
pour la distribution. Ce chiffre est une soustraction des tailles initiales,
pas une mesure du build final intégré.

La préparation V1.1 après intégration des chemins du worker produit
**30 732 019 octets** de ressources vision sous la révision
`c02a4d4696aca28f` : modèle 3 758 596, worker 157 933, paire classique SIMD
13 854 050 et paire classique sans SIMD 12 961 440. Une analyse télécharge
seulement la paire choisie, soit 17 770 579 octets avec le modèle et le worker
sur SIMD, ou 16 877 969 sans SIMD. Les chunks Vite sont comptés séparément.
Ces tailles évoluent si les moteurs changent.

Mesure du build intégré V1.1 (19 octobre 2026), fichiers non compressés :

| Élément                                      |     Octets |
| -------------------------------------------- | ---------: |
| Distribution complète                        | 31 428 701 |
| Coquille précachée, 8 fichiers               |    692 132 |
| Ressources vision distribuées, 6 fichiers    | 30 732 019 |
| Coquille + moteur SIMD effectivement utilisé | 18 462 711 |

La distribution baisse de **30,5 %** par rapport à V1. Le précache obligatoire
passe de 45 243 886 à 692 132 octets (**98,5 %** de moins); le moteur reste un
téléchargement nécessaire à la première analyse. Les deux variantes sont
livrées, mais une seule est chargée et mise en cache par ce navigateur.
Le contrôle du statut hors ligne ne crée pas de cache vision vide.
`build-sw.mjs` affiche les tailles réelles à chaque build. Aucun gain de
latence sur appareil physique n’est revendiqué.

## Choix des WASM et intégrité

Le SDK installé et verrouillé est `@mediapipe/tasks-vision` 1.1.1.
`FilesetResolver.forVisionTasks(base)` utilise par défaut `useModule=false`.
Son implémentation installée, contrôlée par deux sondes Node isolées, choisit :

- `vision_wasm_internal.js/.wasm` si la sonde SIMD réussit ;
- `vision_wasm_nosimd_internal.js/.wasm` sinon.

`vision_wasm_module_internal.js/.wasm` nécessite `useModule=true`, absent de
notre moteur. Les deux paires classiques restent distribuées, pour préserver
les navigateurs sans SIMD. Le choix CPU de MediaPipe ne remplace pas cette
sélection de variante.

La préparation conserve la vérification SHA-256 du modèle versionné Google :
`64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
La copie de travail du modèle est dans `node_modules/.cache/psl-lens/`, hors de
la racine publique. Le téléchargement d'installation reste nécessaire si ce
fichier est absent ou invalide. Les commentaires légaux du SDK restent dans
les fichiers copiés et le worker compilé. Voir `THIRD_PARTY_NOTICES.md`.

## Versions cohérentes

La préparation calcule une empreinte du worker et des cinq fichiers modèle/WASM.
Elle émet des URL immuables `/vision/<revision>/...`, ainsi que le manifeste
généré et ignoré `src/vision/runtime-assets.ts`. Le worker reçoit `assetBase`
dans son message d'initialisation ; il n'importe pas ce manifeste. Cela évite
une dépendance circulaire entre les octets du worker et sa propre empreinte.
Le repli principal reçoit la même base.

Le cache de coquille est propre au build. Le cache vision est propre à la
révision du moteur. Chaque service worker utilise seulement sa propre liste
statique. Les requêtes simultanées d'un même asset sont regroupées. Une erreur
HTTP n'est pas mise en cache ; un téléchargement ultérieur peut être retenté.
Une erreur d'écriture/quota laisse la réponse réseau utilisable et empêche
l'annonce d'une préparation hors ligne complète.

Par défaut, une mise à jour attend la fermeture des onglets de l'ancienne
version. Aucune activation forcée n'est automatique. `OfflineStatus` surveille
`registration.waiting` et propose « Mettre à jour et effacer la session ».
L'avertissement précise que le rechargement efface la photo, les résultats et
la session de cet onglet, puis arrête la caméra. Le clic envoie le message
`{type:'PSL_ACTIVATE_UPDATE'}` au worker en attente ; ce message explicite est
le seul chemin qui appelle `skipWaiting`. L'onglet demandeur recharge après
`controllerchange`. Un autre onglet déjà ouvert conserve sa session en mémoire
et propose son propre rechargement explicite ; il ne recharge pas automatiquement.
L'activation supprime les anciens caches, sauf la révision vision encore
utilisée par la nouvelle coquille.

Un hébergement qui remplace atomiquement la distribution par la seule version
B ne conserve pas les fichiers de la version A. Comme la préparation locale
retire aussi les anciens répertoires générés, la disponibilité du premier
chargement vision d'un ancien onglet A n'est **pas garantie** après ce
remplacement. Une réponse absente ou invalide produit un échec explicite ;
aucun nouveau moteur n'est substitué sous l'ancienne URL. Le bandeau de mise
à jour conseille alors d'activer B et de recharger avant de réessayer.

Pour permettre le chargement paresseux d'A sans changement de session,
l'hébergement doit conserver explicitement les anciens répertoires immuables
pendant la transition. Ce comportement est une possibilité de l'hébergement,
pas une garantie du build. Les tests couvrent séparément cette hypothèse de
rétention et le remplacement réel par B seul : ancien fichier A absent,
aucune activation spontanée, puis action explicite et reprise avec B. Ils
vérifient aussi qu'un autre onglet ne perd pas sa session sans son propre clic.

Si la révision moteur change, la nouvelle coquille peut être prête avant le
nouveau moteur. L'analyse hors ligne de cette version n'est annoncée prête
qu'après téléchargement et mise en cache de ses ressources. Le navigateur peut
également évincer des données : la préparation hors ligne ne garantit pas leur
conservation permanente.

`/sw.js` et `/index.html` restent `no-cache` ; `/vision/*` porte une directive
HTTP immutable. Les fichiers Vite portent déjà une empreinte dans leur nom.

## API de préparation hors ligne

Le manifeste généré exporte :

```ts
RUNTIME_ASSETS: {
  revision: string;
  workerUrl: string;
  assetBase: string;
}
getOfflineAssetStatus(): Promise<{
  revision: string;
  ready: boolean;
  missing: string[];
} | null>
```

Le helper teste SIMD localement avec la même sonde que le SDK. Il interroge le
service worker contrôlant la page via `MessageChannel` :
`{type:'PSL_CACHE_STATUS', revision, variant:'simd'|'nosimd'}`. La réponse contient
`type`, `revision`, `ready` et les URL `missing`. Elle vérifie le worker, le
modèle et la paire sélectionnée. Une révision inconnue renvoie `ready:false`.
Sans contrôleur ou sans réponse sous deux secondes, le helper renvoie `null`.
L'UI peut l'interroger après une analyse réussie ; l'analyse réussie seule ne
prouve pas la persistance des fichiers.

## Confidentialité

Le cache accepte seulement des GET de même origine figurant dans le manifeste
statique exact, sans paramètres de recherche. Les navigations reçoivent la
coquille mais leurs URL ne sont pas enregistrées. Photos, flux, blobs,
landmarks, rapports, exports et requêtes arbitraires ne sont jamais persistés.
La directive CSP `connect-src 'self'` et les autres restrictions restent en
place. L'effacement de session conserve uniquement les fichiers techniques.
La détection d'une mise à jour ne transfère ni ne persiste la session et ne
recharge aucun onglet automatiquement. Le rechargement volontaire repart avec
un nouvel état en mémoire ; aucune photo n'est copiée entre versions.

## Vérification et CI

```sh
npx playwright test --config playwright.pwa-update.config.ts
npm run test:pwa
```

La suite indépendante utilise un serveur statique temporaire et de petits
fichiers synthétiques. Elle exécute le véritable générateur de service worker
et Chromium : installation sans vision, cache progressif et fonctionnement
hors ligne, variante non téléchargée absente, requêtes privées exclues,
échec/réessai d'un asset, mise à jour en attente, séparation des moteurs,
nettoyage des anciens caches et échec de remplacement de coquille. Un test de
préparation vérifie les quatre fichiers WASM conservés, les empreintes stables
et leur changement lorsque le worker change. La suite production conserve une
vraie inférence sur la photographie historique publique puis hors ligne.

Le test production applique la CSP au document initial explicitement ; Vite
preview ne simule pas l'application par un hébergeur du fichier `_headers`.
La vérification de l'hébergement et des appareils iOS/Android reste distincte.

Le workflow GitHub Actions s'exécute sur push, pull request et lancement manuel.
Le job de contrôles réalise npm ci, lint, typecheck, tests unitaires, format et
build. Les jobs Chromium et PWA ainsi que la matrice Firefox/WebKit sont séparés
et bloquants en cas d'échec. Le cache setup-node stocke le téléchargement npm,
jamais node_modules. Les traces d'échec ne contiennent que les fixtures publiques
ou synthétiques des tests et expirent après sept jours. Aucun déploiement ou
merge automatique n'est configuré.
