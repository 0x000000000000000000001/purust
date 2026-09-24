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

- [ ] Corriger `batch.sh` : statut non nul dès qu’un runner obligatoire échoue
  ou manque ; comptabiliser séparément succès, échecs et exclusions explicites.
- [ ] Préserver le statut réel des commandes, y compris en présence de pipes
  ou de captures de sortie. Borner les blocages par des timeouts.
- [ ] Remplacer les marqueurs de progression utilisés comme preuve de succès
  par des résultats vérifiés et une preuve de fin de la suite attendue.
- [ ] Vérifier les scénarios d’échec attendu avec leurs statuts et sorties ;
  vérifier qu’une assertion en échec ou un callback attendu absent fait échouer
  le runner concerné.
- [ ] Clarifier le passage des arguments aux suites, notamment les intégrations
  de `spec`, et garantir leur exécution dans la validation complète.

## 3. Fiabiliser les dépendances événementielles natives

### `node-streams`

- [ ] Corriger `testSetEncoding` : écrire dans les bons streams, installer les
  listeners au bon moment et attendre toutes les assertions attendues.
- [ ] Rendre les tests d’écriture, de fin, de lecture et du pipeline gzip
  sensibles aux callbacks absents, répétés ou exécutés trop tôt.
- [ ] Vérifier le contenu complet du pipeline gzip/gunzip et sa terminaison,
  avec une référence indépendante pour le format gzip.
- [ ] Raccorder `Test.Main1` à `Test.Main4` avec des fixtures locales adaptées
  aux fichiers, à stdin et à la durée de vie native.
- [ ] Réparer les défauts hérités de ces tests, dont `expected == expected`
  dans `Main2`, en rétablissant une entrée et un résultat attendu cohérents.
- [ ] Couvrir les lectures partielles, EOF, plusieurs chunks, les encodages,
  la contre-pression, `unpipe` et les options de terminaison des pipes.
- [ ] Vérifier puis corriger le rejeu des buffers et événements : chaque octet
  est consommé comme prévu, `end` n’est ni prématuré ni dupliqué, les sources
  initialement vides peuvent recevoir des données ultérieurement.
- [ ] Vérifier les chemins `read`/`read'` et `readEither`/`readEither'`, leurs
  représentations `Nullable`/`Chunk` et leurs erreurs sur encodage incompatible.
- [ ] Compléter les exports JavaScript correspondant aux nouvelles FFI pour
  permettre la comparaison du même contrat sur les deux backends.

### `node-event-emitter`

- [ ] Établir et préserver le contrat de l’API amont `unsafeEmitFn`. Résoudre le
  problème d’arité dans l’adaptation native sans considérer les seuls tests
  réécrits contre `unsafeEmitFn1/2/3` comme preuve de compatibilité générale.
- [ ] Mettre en cohérence déclarations PureScript, FFI Rust, FFI JS et exemples.
- [ ] Vérifier plusieurs listeners par événement : ordre normal et prepend,
  exécution unique de `once`, désabonnement, réentrance et notifications prévues
  par le contrat amont.
- [ ] Reproduire puis corriger l’insertion suspecte de `prependListener` lorsque
  tous les listeners existants concernent le même événement.

### `node-process` et sortie des runners

- [ ] Tester séparément `nextTick` et `nextTick'` : exécution différée, arguments,
  ordre et nombre d’appels observés.
- [ ] Tester dans des sous-processus les statuts de sortie et les événements de
  cycle de vie ; vérifier la capture d’exception au-delà de son enregistrement.
- [ ] Distinguer les garanties observées en absence de canal IPC des scénarios
  de communication restant à porter et à tester.
- [ ] Vérifier la sémantique différée de `Test.Spec.Runner.exit :: Int -> Effect
  Unit`, puis corriger sa FFI Rust si nécessaire.
- [ ] Après les changements partagés, vérifier `node-fs`, `node-net`,
  `node-child-process`, `node-http` et les intégrations Aff concernées.

## 4. Restaurer les suites réduites

### `st`

- [ ] Reprendre les tests Go de `STRef.read`, `write`, `modify` et `modify'`, y
  compris leurs valeurs de retour.
- [ ] Reprendre `ST.while`, `ST.for`, `ST.foreach` et `MonadRec`.
- [ ] Conserver le contrôle de `sumOfSquares`, puis aligner le verdict du runner
  sur l’ensemble des groupes effectivement exécutés.

### `foreign`

- [ ] Restaurer la classification des fonctions, objets et autres valeurs, les
  cas négatifs de `isArray` et les contrôles `isNull`/`isUndefined` pertinents.
- [ ] Restaurer les conversions Int/Number, les valeurs négatives, les nombres
  fractionnaires et les rejets sur types incompatibles.
- [ ] Porter les contrats Go de classification des fonctions ordinaires,
  partiellement appliquées et munies de métadonnées vers les carriers Rust.
- [ ] Résoudre le contrat de `hasProperty`/`hasOwnProperty` par comparaison avec
  la référence, puis le tester ; conserver les ajouts sur caractères et clés.
- [ ] Remplacer l’assertion dupliquée sur `readProp "name"` par un cas distinct.

### `js-bigints`

- [ ] Restaurer les générateurs et propriétés QuickCheck de la suite amont.
- [ ] Restaurer les lois `Eq`, `Ord`, `Semiring`, `Ring`, `CommutativeRing` et
  `EuclideanRing`, avec des domaines évitant les débordements du type témoin
  lorsqu’une comparaison avec `Int` l’exige.
- [ ] Conserver et compléter les cas déterministes ajoutés : grands entiers,
  signes, préfixes, entrées invalides, conversions, décalages et troncatures.
- [ ] Comparer le parsing et les opérations au wrapper JS du paquet ; conserver
  sa division euclidienne et son traitement documenté du diviseur nul.
- [ ] Faire échouer explicitement les helpers de tests lorsqu’une construction
  de valeur attendue échoue, plutôt que lui substituer silencieusement zéro.

### `js-promise`

- [ ] Restaurer `all` avec rejet, les courses entre promesses en attente,
  `finally` sur succès et rejet, et `Lazy.catch`/`Lazy.finally`/`Lazy.all`.
- [ ] Contrôler les résolutions avec des synchronisations déterministes et
  vérifier que les handlers d’erreur ne masquent pas les échecs d’assertions.
- [ ] Raccorder `test/native-contract.mjs` à `bin/test` : comparaison JS/Rust,
  modes Rc et Arc, ordre des réactions, adoption, cycles, exceptions,
  finalisation, agrégations et chaînes profondes.
- [ ] Conserver la suite PureScript via Aff comme validation de bout en bout.

### `random`

- [ ] Remplacer la tautologie booléenne par des contrôles utiles du contrat.
- [ ] Ajouter des cas limites sur les bornes et, lorsque nécessaire, des
  fixtures déterministes ; éviter les verdicts statistiques fragiles.

## 5. Rétablir les fonctionnalités et intégrations de Spec

### `spec-node`

- [ ] Restaurer la persistance réelle et la lecture de `.spec-results`, les
  codecs nécessaires et la compatibilité du format amont.
- [ ] Vérifier la conservation/fusion des résultats et le comportement en
  absence de fichier ou en présence de données invalides.
- [ ] Adapter les fixtures pour compiler puis lancer les binaires natifs en
  sous-processus avec capture fiable de stdout, stderr et du statut de sortie.
- [ ] Raccorder tous les scénarios CLI existants : filtres, fail-fast, timeout,
  only-failures, next-failure, combinaisons et générateurs non-Identity.
- [ ] Ajouter `bin/test`, son mode `-c` et l’entrée dans la batterie globale.

### `spec`

- [ ] Adapter les fixtures d’intégration au compilateur et au backend Rust en
  conservant les cas et les sorties attendues pertinentes.
- [ ] Inclure les intégrations dans le parcours complet exécuté par la batterie.
- [ ] Conserver les specs unitaires et les trois cas pending hérités ; rendre
  leur statut explicite dans le bilan.

### `spec-discovery`

- [ ] Définir une découverte AOT fondée sur les modules/exports réellement
  disponibles à la construction et sur leur enregistrement dans le binaire.
- [ ] Préserver le contrat observable de sélection par motif, de noms de specs
  et d’exécution ; identifier explicitement toute limite native restante.
- [ ] Remplacer le `panic!` de la FFI par le mécanisme de découverte retenu.
- [ ] Faire passer les tests par `discover`/`discoverAndRunSpecs`.
- [ ] Vérifier inclusion, exclusion, absence de résultat et ajout automatique
  d’une nouvelle fixture sans modification manuelle des imports du test.

### `yoga-json`

- [ ] Conserver la sélection des quatre modules de specs existants.
- [ ] Renforcer les helpers de round-trip pour comparer les valeurs décodées
  aux valeurs d’origine, avec les contraintes de types appropriées.
- [ ] Vérifier les scénarios null/undefined et les erreurs sur le backend natif.

## 6. Restaurer la couverture HTTP/HTTPS

- [ ] Réactiver le scénario HTTPS local avec une fixture de certificat maîtrisée
  et une véritable implémentation TLS native.
- [ ] Remplacer les dépendances à des services publics par des serveurs locaux
  exerçant les mêmes contrats HTTPS et cookies.
- [ ] Vérifier explicitement statuts, headers, corps complets, cookies et sockets
  d’upgrade ; conserver les assertions existantes sur les chemins d’upgrade.
- [ ] Attendre la fin effective des échanges et la fermeture des ressources.
- [ ] Ajuster le résumé du runner au périmètre réellement exécuté.

## 7. Validation finale et critères de clôture

- [ ] Reprendre l’inventaire de couverture et résoudre chaque scénario perdu
  ou exclusion injustifiée identifié par l’audit.
- [ ] Exécuter les tests du compilateur/PBO/Haskell appropriés aux modifications
  effectivement réalisées et les contrats FFI concernés.
- [ ] Exécuter la batterie complète en mode normal, puis avec `-c`, sur l’état
  final et en contrôlant les statuts réels.
- [ ] Conserver des logs distincts par campagne et paquet avec commandes,
  révisions, modes, nombre de scénarios et échecs/pending éventuels.
- [ ] Vérifier le périmètre initial de 37 paquets, tous les runners ajoutés et
  `spec-node` ; expliquer les validations exclusivement typées séparément.
- [ ] Relire les diffs de tests : chaque suppression ou adaptation doit avoir
  une justification et un équivalent vérifié, chaque fonctionnalité annoncée
  doit disposer d’un test effectivement exécuté.
- [ ] Mettre à jour les bilans de couverture et les affirmations de complétude
  selon ces preuves. Les tâches encore bloquées restent ouvertes.
