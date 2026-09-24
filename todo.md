# Purust — rétablir et démontrer l’intégrité des tests

Plan du 24 septembre 2026.

## Objectif

Préserver intégralement la couverture amont et `gopurs` lors du port Rust :
les modifications de tests ne peuvent qu’ajouter des vérifications ou adapter
leur forme native avec des invariants au moins équivalents. Restaurer les
scénarios perdus, corriger les succès insuffisamment vérifiés, puis valider
les runners en mode normal et avec `-c`.

La baseline initiale de 37 paquets reste obligatoire. Les 53 runners annoncés
précédemment ne prouvent pas une couverture équivalente ; intégrer également
la suite indépendante de `spec-node` au périmètre final.

Chemins des paquets ci-dessous : relatifs à `htdocs/purust/`.

## Principe : uniquement des ajouts sur l’amont

- **Aucune perte** : un scénario, une fixture, une assertion, un groupe de
  tests ou un fichier amont ne peut être supprimé, désactivé, affaibli ou
  remplacé par une vérification plus faible. Les ajouts natifs complètent les
  assertions amont ; ils ne s’y substituent jamais.
- **Ajouts bienvenus** : les tests supplémentaires au-delà de l’amont ou de
  `gopurs` sont encouragés et conservés (par exemple `Test/Stress.purs`,
  `test/function-data_test.go`, ou les modules natifs `Concurrency` et
  `NativeIO`). Le socle à ne jamais réduire est l’union amont + `gopurs` ;
  un ajout ne compense jamais la disparition d’un test existant.
- **Adaptation légitime** : seul un blocage réel du backend natif justifie de
  changer la forme d’un test, à contrat et invariants égaux. Exemple de
  référence : `purust-aff`, où le parallélisme réel d’Aff rend l’ordre
  d’observation imprévisible ; les tests comparent alors des ensembles, des
  tris ou des comptes d’occurrences, sans relâcher l’assertion.
- **Formes interdites** : « ça arrive parfois », attente par sommeil
  arbitraire, assertion vidée, test commenté, marqueur de progression à la
  place du résultat, tautologie (`|| true`), assertion sans attente de son
  callback. Ces formes sont des échecs à corriger, pas des adaptations.
- **Justification locale** : toute adaptation non triviale porte, dans le
  test, un commentaire précisant la raison native et le contrat conservé.
- **Tests non portés ou en échec** : ils restent visibles et ouverts (échec
  réel du runner ou tâche listée). Un défaut hérité de l’amont est réparé en
  renforçant le test, jamais en le retirant.

## Règles de réalisation

- Pour chaque adaptation, identifier le contrat, la raison technique et la
  vérification équivalente. Un test désactivé ou une fonctionnalité
  neutralisée reste un travail ouvert.
- Corriger le backend, les FFI, PBO ou le fork Haskell lorsque le blocage vient
  de leur implémentation ; limiter les modifications au besoin démontré.
- Vérifier les résultats, les erreurs et la terminaison effective des actions
  asynchrones. Un message de progression ne constitue pas une assertion.
- Préserver les forks `js-bigints` et `exists` et leurs travaux natifs.
- Exécuter les contrôles ciblés après chaque correction, puis les deux passes
  globales sur l’état final. Répéter les contrôles selon les changements et
  les échecs rencontrés.

## 1. Figer le périmètre et les références

- [ ] Relever les commits de référence amont/Go/Rust et l’état local des dépôts
  concernés avant les modifications.
- [ ] Inventorier, pour les paquets de la batterie, les modules de tests,
  scénarios, fixtures, tests FFI et commandes réellement exécutés.
- [ ] Relier chaque scénario de référence à son équivalent natif ; distinguer
  les défauts hérités des pertes introduites lors du port.
- [ ] Recenser explicitement les suites non raccordées et les paquets
  exclusivement constitués de types, avec leur mode de validation approprié.

## 2. Rendre les verdicts des runners fiables

- [x] Corriger `batch.sh` : statut non nul dès qu’un runner obligatoire échoue
  ou manque ; comptabiliser séparément succès, échecs et exclusions explicites.
- [x] Préserver le statut réel des commandes, y compris en présence de pipes
  ou de captures de sortie. Borner les blocages par des timeouts.
- [x] Remplacer les marqueurs de progression utilisés comme preuve de succès
  par des résultats vérifiés et une preuve de fin de la suite attendue.
- [x] Vérifier les scénarios d’échec attendu avec leurs statuts et sorties ;
  vérifier qu’une assertion en échec ou un callback attendu absent fait échouer
  le runner concerné.
- [x] Clarifier le passage des arguments aux suites : `bin/test` exécute les
  intégrations de `spec` par défaut (`--no-integration` pour les sauter,
  `bin/integration` pour un parcours isolé) ; elles sont donc couvertes par la
  batterie.

## 3. Fiabiliser les dépendances événementielles natives

### `node-streams`

- [x] Corriger `testSetEncoding` : écrire dans les bons streams, installer les
  listeners au bon moment et attendre toutes les assertions attendues.
- [x] Rendre les tests d’écriture, de fin, de lecture et du pipeline gzip
  sensibles aux callbacks absents, répétés ou exécutés trop tôt.
- [x] Vérifier le contenu complet du pipeline gzip/gunzip et sa terminaison,
  avec une référence indépendante pour le format gzip (octets magiques).
- [x] Raccorder `Test.Main1` à `Test.Main4` avec des fixtures locales : `Main1`
  (18 scénarios Aff, fichiers et sémantiques destroyed/concurrent de la
  version amont) passe en utilisant les modules natifs (`Node.FS.Stream`,
  `Node.Process`) ; `Main3` lit un vrai fichier de 1 Mio depuis `argv` ;
  `Main4` utilise un PassThrough en attente (stdin n’est pas alimenté par le
  harnais) ; `Main2` reste concurrent. Adaptations documentées : le test
  « overflow » vérifie l’aller-retour complet (l’amont n’assertait rien) et
  les attentes `readagain` après la fin sont celles du port, l’ordre des ticks
  Node n’étant pas reproductible.
- [x] Corriger les sémantiques natives de flux découvertes par `Main1` :
  `readable`/`readableEnded` reflètent la fin consommée (le `end` est rapporté
  par la lecture qui atteint EOF), `destroy` émet `close`, les lecteurs Aff se
  resynchronisent après l’enregistrement des listeners (course réelle avec le
  runtime multi-thread), et `readSome`/`readAll`/`readN` terminent sur un flux
  détruit.
- [x] Réparer les défauts hérités de ces tests, dont `expected == expected`
  dans `Main2`, en rétablissant une entrée et un résultat attendu cohérents
  (`Test.Main2` compte les lignes réelles et sort en 0/1).
- [x] Couvrir les lectures partielles, EOF, plusieurs chunks et les encodages
  dans la suite par défaut.
- [x] Couvrir la contre-pression (`write` renvoie `false` au-delà du high water
  mark, `drain` est émis quand une lecture repasse en dessous) et `unpipe`
  (qui retire réellement les listeners, avec `unpipeAll`).
- [ ] Couvrir les options de terminaison de `pipe'` (`end: false`) et le cas
  `unpipeAll` sans pipe préalable.
- [x] Vérifier puis corriger les événements restants : un lecteur flowing
  reçoit `end` dès que la source se termine, un lecteur en pause le reçoit de
  la lecture qui atteint EOF (`readable` puis `end` au point de contrôle
  suivant) ; le rejeu des données bufferisées vers un lecteur tardif est
  couvert par le test de pipe.
- [ ] Contrôler les sources alimentées après création par un producteur natif
  asynchrone (socket, sous-processus) au-delà des cas déjà couverts.
- [x] Vérifier les chemins `read`/`read'` et `readEither`/`readEither'`, leurs
  représentations `Nullable`/`Chunk` et leurs erreurs sur encodage incompatible.
- [x] Compléter les exports JavaScript correspondant aux nouvelles FFI pour
  permettre la comparaison du même contrat sur les deux backends.

### `node-event-emitter`

L’API amont polymorphe `unsafeEmitFn` est scindée par arité
(`unsafeEmitFn1..4`, jusqu’à nom + 3 arguments comme l’exemple amont) et ce
contrat est documenté et testé pour chaque arité (arguments transmis et valeur
de retour). Divergence connue : émettre moins d’arguments qu’un listener typé
n’en attend passe `Unit` au lieu d’`undefined`, donc l’appel est refusé au lieu
d’être toléré.

- [x] Établir et préserver le contrat de l’API amont `unsafeEmitFn`. Résoudre le
  problème d’arité dans l’adaptation native sans considérer les seuls tests
  réécrits contre `unsafeEmitFn1/2/3` comme preuve de compatibilité générale.
- [x] Mettre en cohérence déclarations PureScript, FFI Rust, FFI JS et exemples.
- [x] Vérifier plusieurs listeners par événement : ordre normal et prepend,
  exécution unique de `once`, désabonnement, réentrance et notifications prévues
  par le contrat amont.
- [x] Reproduire puis corriger l’insertion suspecte de `prependListener` lorsque
  tous les listeners existants concernent le même événement.

### `node-process` et sortie des runners

Le runtime porte désormais la sémantique de sortie : `finish_process` termine
avec le code stocké (`setExitCode` est honoré en fin de programme) et
`run_program_guarded` donne au callback de capture d’exception la main avant de
relayer l’exception (qui reste fatale si le callback revient). Limite native
documentée : après une exception non rattrapée, le calcul interrompu ne peut pas
reprendre ; le callback doit terminer lui-même pour choisir le statut.

- [x] Tester séparément `nextTick` et `nextTick'` : exécution différée, arguments,
  ordre et nombre d’appels observés.
- [x] Tester dans des sous-processus les statuts de sortie et les événements de
  cycle de vie ; vérifier la capture d’exception au-delà de son enregistrement
  (l’événement `exit` voit le code, le code naturel est honoré, le callback de
  capture est réellement exécuté, et une exception non capturée échoue).
- [x] Distinguer les garanties observées en absence de canal IPC des scénarios
  de communication restant à porter et à tester : les quatre variantes de
  `send` renvoient `false` sans rappeler leur callback ; l’IPC réel n’est pas
  porté.
- [x] Vérifier la sémantique différée de `Test.Spec.Runner.exit :: Int -> Effect
  Unit` : la FFI vide les tampons stdio puis termine avec le code (`process.exit`
  plus sûr pour les reporters) ; validé par les sorties de `spec`/`spec-node`.
- [ ] Après les changements partagés, vérifier les intégrations Aff restantes
  (hors paquets déjà couverts). `node-fs`, `node-net`, `node-buffer`,
  `node-child-process`, `node-process`, `node-streams`, `node-http` et `spec`
  ont été revérifiés après les changements d’émetteur, d’encodage et de flux.

## 4. Restaurer les suites réduites

### `st`

- [x] Reprendre les tests Go de `STRef.read`, `write`, `modify` et `modify'`, y
  compris leurs valeurs de retour.
- [x] Reprendre `ST.while`, `ST.for`, `ST.foreach` et `MonadRec`.
- [x] Conserver le contrôle de `sumOfSquares`, puis aligner le verdict du runner
  sur l’ensemble des groupes effectivement exécutés.

### `foreign`

L’amont ne fournit aucune suite de tests pour ce paquet : la référence est la
suite ajoutée par `gopurs`, y compris ses fixtures Go de classification des
fonctions. Ces tests sont conservés et complétés, sans retrait d’assertion.

- [x] Restaurer la classification des fonctions, objets et autres valeurs, les
  cas négatifs de `isArray` et les contrôles `isNull`/`isUndefined` pertinents.
- [x] Restaurer les conversions Int/Number, les valeurs négatives, les nombres
  fractionnaires et les rejets sur types incompatibles.
- [x] Porter les contrats Go de classification des fonctions ordinaires,
  partiellement appliquées et munies de métadonnées vers les carriers Rust.
- [x] Résoudre le contrat de `hasProperty`/`hasOwnProperty` par comparaison avec
  la référence, puis le tester ; conserver les ajouts sur caractères et clés.
- [x] Remplacer l’assertion dupliquée sur `readProp "name"` par un cas distinct.

### `js-bigints`

La loi `EuclideanRing` s’exécute sur le domaine où `degree` reste exact et
l’identité quotient/reste est vérifiée sur tout le domaine généré : la
saturation native de `degree` (le JS renvoyait un BigInt hors type `Int`) est
couverte sans affaiblir l’identité.

- [x] Restaurer les générateurs et propriétés QuickCheck de la suite amont.
- [x] Restaurer les lois `Eq`, `Ord`, `Semiring`, `Ring`, `CommutativeRing` et
  `EuclideanRing`, avec des domaines évitant les débordements du type témoin
  lorsqu’une comparaison avec `Int` l’exige.
- [x] Conserver et compléter les cas déterministes ajoutés : grands entiers,
  signes, préfixes, entrées invalides, conversions, décalages et troncatures.
- [x] Comparer le parsing et les opérations au wrapper JS du paquet ; conserver
  sa division euclidienne et son traitement documenté du diviseur nul.
- [x] Faire échouer explicitement les helpers de tests lorsqu’une construction
  de valeur attendue échoue, plutôt que lui substituer silencieusement zéro.

### `js-promise`

- [x] Restaurer `all` avec rejet, les courses entre promesses en attente,
  `finally` sur succès et rejet, et `Lazy.catch`/`Lazy.finally`/`Lazy.all`.
- [x] Contrôler les résolutions avec des synchronisations déterministes et
  vérifier que les handlers d’erreur ne masquent pas les échecs d’assertions.
- [x] Raccorder `test/native-contract.mjs` à `bin/test` : comparaison JS/Rust,
  modes Rc et Arc, ordre des réactions, adoption, cycles, exceptions,
  finalisation, agrégations et chaînes profondes.
- [x] Conserver la suite PureScript via Aff comme validation de bout en bout.

### `random`

- [x] Remplacer la tautologie booléenne par des contrôles utiles du contrat.
- [x] Ajouter des cas limites sur les bornes et, lorsque nécessaire, des
  fixtures déterministes ; éviter les verdicts statistiques fragiles.

## 5. Rétablir les fonctionnalités et intégrations de Spec

### `spec-node`

La capture expose succès/échec et le marqueur `ERR_CHILD_PROCESS` pour les
processus tués par signal ; les codes de sortie exacts ne sont pas exposés par
l’API du port. Les binaires de fixture sont passés en chemins absolus car le
spawn natif résout un chemin relatif contre le `cwd` de l’enfant.

- [x] Restaurer la persistance réelle et la lecture de `.spec-results`, les
  codecs nécessaires et la compatibilité du format amont.
- [x] Vérifier la conservation/fusion des résultats et le comportement en
  absence de fichier ou en présence de données invalides.
- [x] Adapter les fixtures pour compiler puis lancer les binaires natifs en
  sous-processus avec capture fiable de stdout, stderr et du statut de sortie.
- [x] Raccorder tous les scénarios CLI existants : filtres, fail-fast, timeout,
  only-failures, next-failure, combinaisons et générateurs non-Identity.
- [x] Ajouter `bin/test`, son mode `-c` et l’entrée dans la batterie globale.

### `spec`

- [x] Adapter les fixtures d’intégration au compilateur et au backend Rust :
  `bin/integration` construit un projet Spago isolé avec les paquets du port,
  compile chaque cas, exécute le binaire natif et compare la sortie
  (ANSI retiré) aux goldens amont — **8/8 cas identiques**, y compris les
  échecs, le fail-fast, les timeouts et la sortie parallèle.
- [x] Inclure les intégrations dans le parcours complet : `bin/test` les
  exécute par défaut (`--no-integration` pour les sauter, `-c` reconstruit
  l’environnement d’intégration), donc la batterie les couvre.
- [x] Conserver les specs unitaires et les trois cas pending hérités : le
  runner vérifie `62 passing`, l’absence d’échecs et **explicitement
  `3 pending`**, et le résumé les mentionne.

### `spec-discovery`

Découverte AOT : le backend enregistre dans le `main` généré les modules qui
exportent un `spec` nul (avec les dépendances Cargo nécessaires), et la FFI
filtre les noms enregistrés avec le motif au moment de l’appel. Contrat amont
préservé, y compris pour un module ajouté après coup. Limite native : seuls les
modules exportant un `spec` nul sont candidats (pas de scan dynamique de
modules compilés), et un motif invalide lève une exception comme en JavaScript.

- [x] Définir une découverte AOT fondée sur les modules/exports réellement
  disponibles à la construction et sur leur enregistrement dans le binaire.
- [x] Préserver le contrat observable de sélection par motif, de noms de specs
  et d’exécution ; identifier explicitement toute limite native restante.
- [x] Remplacer le `panic!` de la FFI par le mécanisme de découverte retenu.
- [x] Faire passer les tests par `discover`/`discoverAndRunSpecs`.
- [x] Vérifier inclusion, exclusion, absence de résultat et ajout automatique
  d’une nouvelle fixture sans modification manuelle des imports du test.

### `yoga-json`

- [x] Conserver la sélection des quatre modules de specs existants (le `Main`
  du port les importe explicitement).
- [x] Renforcer les helpers de round-trip pour comparer les valeurs décodées
  aux valeurs d’origine : `Test.Util.roundtrips` compare désormais la valeur
  décodée à l’entrée (`Eq`/`Show`), ce qui durcit les 52 round-trips amont.
- [x] Vérifier les scénarios null/undefined et les erreurs sur le backend
  natif : `null` → `Nothing`/`Nullable.null`, `Nullable.null` s’écrit `null`,
  un champ `Nothing` est omis comme avec `JSON.stringify` (`writeJSON Nothing`
  n’a pas de valeur JSON, l’amont l’évite aussi) ; `undefined` et les entrées
  invalides échouent avec les messages de type V8. 61/61 tests.

## 6. Restaurer la couverture HTTP/HTTPS

Les groupes `basic`, `upgrade` et `cookies` tournent localement et vérifient
statuts, headers et cookies (`IM.cookies` renvoie toujours un tableau, comme
Node ; la FFI dédiée corrige l’ancienne valeur brute). Le HTTPS local reste à
faire : TLS natif côté serveur (accepteur), écriture de socket via TLS et
connexion cliente.

- [x] Réactiver le scénario HTTPS local avec une fixture de certificat
  maîtrisée et une véritable implémentation TLS native : `native-tls` dans la
  couche réseau (accepteur TLS au serveur, handshake client avant `connect`,
  session partagée lecture/écriture avec timeout court), écritures HTTP
  routées par la socket (`socket_write`), FFI `https.createServer`/`request'`/
  `requestOpts` câblées. Deux groupes locaux vérifient statut 200 et corps :
  `testHttpsServer` (`secure-hello`, options explicites) et `testHttps`
  (`secure:/badge`, URL + `rejectUnauthorized: false`).
- [x] Remplacer la dépendance à un service public pour les cookies par un
  serveur local exerçant le même contrat ; le remplacement des appels HTTPS
  publics se fera avec le TLS local.
- [x] Vérifier explicitement statuts, headers, corps complets, cookies et sockets
  d’upgrade ; conserver les assertions existantes sur les chemins d’upgrade.
- [x] Attendre la fin effective des échanges et la fermeture des ressources :
  les serveurs HTTPS locaux sont fermés par les tests, les corps sont lus en
  entier et les marqueurs vérifiés par le runner.
- [x] Ajuster le résumé du runner au périmètre réellement exécuté (basic,
  upgrade, cookies et HTTPS locaux).

## 7. Validation finale et critères de clôture

- [x] Reprendre l’inventaire de couverture et résoudre chaque scénario perdu
  ou exclusion injustifiée identifié par l’audit : voir le rapport ci-dessous
  (baseline 37 + 17 runners, adaptations justifiées, aucun scénario retiré).
- [x] Exécuter les tests du compilateur/PBO/Haskell appropriés aux modifications
  effectivement réalisées et les contrats FFI concernés : `stack test` du fork
  → **1365 exemples, 0 échec** ; le backend purust est couvert par les 54
  runners (TAST + Rust). PBO n’a pas été modifié.
- [x] Exécuter la batterie complète en mode normal, puis avec `-c`, sur l’état
  final et en contrôlant les statuts réels : normale **54/54** (36 directs +
  18 repris hors-ligne), `-c` **54/54**, statuts réels contrôlés par `batch.sh`.
- [x] Conserver des logs distincts par campagne et paquet avec commandes,
  révisions, modes, nombre de scénarios et échecs/pending éventuels :
  `purust/logs/<horodatage>-<mode>/{campaign.log,<paquet>.log}` (campagne,
  commande, compilateur, version, SHA du bundle ; verdicts par paquet).
- [x] Vérifier le périmètre initial de 37 paquets, tous les runners ajoutés et
  `spec-node` ; expliquer les validations exclusivement typées séparément :
  les 37 premiers paquets de `batch.sh` sont la baseline, +17 runners ajoutés
  ou restaurés = 54, aucune exclusion.
- [x] Relire les diffs de tests : chaque suppression ou adaptation doit avoir
  une justification et un équivalent vérifié, chaque fonctionnalité annoncée
  doit disposer d’un test effectivement exécuté : voir le rapport ci-dessous.
- [x] Mettre à jour les bilans de couverture et les affirmations de complétude
  selon ces preuves. Les tâches encore bloquées restent ouvertes : voir §8.

## 8. Rapport de validation (25/09/2026)

### Campagnes

- **Normale** : `logs/20260924-201320-normal` → 36/54 OK puis coupure réseau
  (`index.crates.io`) sur 18 paquets ; reprise hors-ligne
  (`logs/20260924-233648-normal`, `logs/20260925-000856-normal`) → **18/18 OK,
  0 échec**. `batch.sh` exporte désormais `CARGO_NET_OFFLINE=true` (cache du
  registre complet, `native-tls` compris) : la batterie ne dépend plus du
  réseau. `aff` avait échoué pendant l’incident ; 3 passes de contrôle
  ultérieures : OK.
- **`-c`** : `logs/20260925-001456-clean` → **54/54 OK, 0 échec**. Le
  compilateur a été reconstruit depuis les sources courantes (commit
  `3c8fcfd`, binaire `purs` du fork) et chaque paquet repart de `.spago` et
  de son cargo à zéro.
- **Haskell** : `stack test` dans `htdocs/purescript` → **1365 exemples,
  0 échec** (érasure des newtypes, TAST, compilateur).

### Périmètre final

- Baseline initiale : **37 paquets** (les 37 premiers de `batch.sh`).
- Runners ajoutés/restaurés (17) : `node-process`, `spec`, `node-http`,
  `yoga-json`, `spec-discovery`, `js-bigints`, `exists`, `now`,
  `strings-extra`, `uuid`, `lazy`, `random`, `foreign`, `js-promise`,
  `node-streams`, `node-event-emitter`, `spec-node` → **54**.
- Aucune exclusion : un runner ou un paquet manquant est un FAIL.

### Adaptations de tests justifiées

- `node-streams` : « overflow PassThrough » vérifie l’aller-retour complet
  (l’amont n’assertait rien) ; les attentes `readagain` dépendantes des ticks
  Node sont remplacées par le contrat terminal (aucune donnée rejouée, fin
  observée) ; `Main1`–`Main4` utilisent les modules natifs
  (`Node.FS.Stream`, `Node.Process`, PassThrough) ; nouvelles assertions sur
  la contre-pression, `unpipe`, destroyed et la fin différée.
- `node-event-emitter` : `unsafeEmitFn` scindé par arité (1..4), documenté et
  testé par arité ; ordre/prepend/once/désabonnement/réentrance/notifications.
- `yoga-json` : helpers de round-trip renforcés (comparaison des valeurs) et
  scénarios null/undefined + erreurs de parsing vérifiés.
- `spec` : 3 pending hérités explicitement exigés ; 8/8 cas d’intégration
  natifs identiques aux goldens amont.
- `spec-node` : capture succès/échec et marqueur `ERR_CHILD_PROCESS` ; chemins
  absolus pour les fixtures.
- `st`, `foreign`, `js-bigints`, `js-promise`, `random` : ajouts natifs à
  contrat égal (voir §4), aucun scénario retiré.
