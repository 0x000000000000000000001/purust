# Faire tourner les tests b8x avec des FFI Rust `.rs`

Mis à jour le 13 septembre 2026.

## Objectif

Permettre à la suite de tests de b8x d'être compilée et exécutée avec purust,
en utilisant des FFI Rust locales (`.rs`), tout en conservant les chemins JS,
Go et PHP existants.

**Critère d'arrivée confirmé :** après `target rust` et le build habituel,
`t -c` doit lancer **par défaut toute la suite active b8x**, comme dans le
workflow JS/Go, avec les assertions originales, les intégrations et le
nettoyage des bases. Aucune sélection `--suite` ne doit être nécessaire pour
obtenir la suite complète. L'agrégat HTML + Stash actuel est une validation
intermédiaire ; un code 0 sur ce sous-ensemble ne clôt pas cet objectif.

Interface retenue en 0.18, implémentée pour Rust HTML en 0.19–0.21 :

```sh
target rust
b -c
t -c
```

`b` et `t` sont les alias existants de `bin/build` et `bin/test`.
`--runtime rust` permet aussi une sélection ponctuelle sans changer de cible.
Le contrat 0.18 fixe les entrées et limites de la première version HTML ;
le test intégré réel `b -c; t -c` est validé en 0.22 : build 0, HTML 2/2 et
test 0 ; négatif séparé 2/3 avec sortie 101. La cible b8x est laissée sur Rust.
La validation des autres backends
porte sur les comportements déjà pris en charge, pas sur un nouveau portage
complet de b8x vers chacun d'eux.

## Choix du modèle de travail

Référence : [documentation officielle sur les modèles](https://developers.openai.com/api/docs/models).
La répartition ci-dessous est une recommandation pour ce projet, pas une mesure
comparative des deux modèles sur b8x. Ces listes attribuent les responsabilités ;
seules les cases des phases suivent l'avancement du travail.

Règle générale : utiliser `gpt-6-astra` pour les décisions difficiles, les
diagnostics et les validations de sémantique ; utiliser `gpt-5.6-luna` pour les
tâches nombreuses, répétitives et précisément bornées. Luna ne doit pas être
chargée de trancher seule une question d'architecture, d'ABI ou de sémantique
du compilateur.

### Utiliser Astra

- **Phase 0 — tranche verticale** : choisir le premier test, comprendre le
  graphe de dépendances, analyser le Rust généré et diagnostiquer un échec de
  résolution FFI.
- **Phase 1 — profil Rust** : décider du raccordement `target rust` / `--runtime rust`, de la
  séparation des sorties et de la compatibilité avec les runners existants.
- **Phase 2 — runner** : concevoir la séparation Node/backend-neutre, le
  contrat de sortie, l'attente des callbacks et les codes d'erreur.
- **Phase 4 — Aff et concurrence** : analyser les annulations, les fibres,
  les erreurs asynchrones, les races et les durées de vie.
- **Phase 6 — première intégration externe** : choisir l'architecture Rust
  pour PostgreSQL, RabbitMQ et EventStore, puis valider le premier adaptateur.
- **Phase 7 — purust** : modifier le générateur, le contrat FFI, les stubs,
  la résolution des chemins ou la propagation Cargo.
- **Tout échec ambigu** : reprendre avec Astra dès qu'il faut distinguer un
  problème de TAST, de code généré, de runtime Rust, de FFI ou de service
  externe.
- **Revue de jalon** : relire les changements de code sensibles et les preuves
  d'exécution avant M1, M2, M3 ou M4. Un relevé de résultat ou une correction
  documentaire ne nécessite pas systématiquement une revue supplémentaire.

Niveau conseillé : `high` ou `xhigh` pour le compilateur, l'ABI, Aff et les
intégrations ; `max` seulement pour une impasse réellement complexe ou une
revue finale à fort enjeu.

### Utiliser Luna

- **Inventaire Phase 3** : parcourir les modules, relever les FFI existantes,
  classer les fonctions utilisées et maintenir la matrice de couverture.
- **Portages répétitifs Phase 3** : appliquer un contrat déjà validé à des
  FFI simples, créer les squelettes `.rs`, renommer les symboles et ajouter les
  cas de test prévisibles.
- **Phase 5 — suite unitaire** : lancer les mêmes commandes, collecter les
  sorties, comparer les résultats et mettre à jour les tableaux de couverture.
- **Phase 6 après le premier adaptateur validé par Astra** : reproduire les
  fixtures établies et les opérations simples au même contrat. Les transactions,
  callbacks, annulations et durées de vie restent du ressort d'Astra.
- **Phase 7 après décision d'Astra** : appliquer les corrections mécaniques
  dans les configurations et compléter la documentation ; les changements du
  générateur ou du runtime restent du ressort d'Astra.
- **Validation locale ciblée** : relancer un test précis après une petite
  modification dont le contrat et la commande sont déjà connus.

Niveau conseillé : `low` ou `medium` pour les tâches bornées ; `high` seulement
si Luna doit suivre un graphe de dépendances déjà documenté. Chaque tâche Luna
doit avoir un fichier cible, une commande de validation et un critère de sortie
explicites.

### Règle de passage entre modèles

1. Astra définit le contrat et réalise la première implémentation risquée.
2. Luna déroule les variantes mécaniques et les validations répétitives.
3. Astra examine les diffs, les erreurs résiduelles et les effets de bord avant
   de passer au jalon suivant.
4. Revenir à Astra dès qu'un échec n'a pas de cause locale établie, que le
   résultat attendu est incertain ou qu'une correction touche le compilateur,
   le runtime, l'ABI ou la concurrence. Transmettre la commande, le code de
   sortie, la trace utile et les fichiers concernés.

## État actuel

### b8x

- Les branches historiques de [`b8x/bin/test`](../../b8x/bin/test) délèguent à
  [`b8x/bin/run`](../../b8x/bin/run) ; le chemin Rust utilise le driver dédié.
- `bin/run` exécute JS, Go et PHP, ainsi que les suites Rust `html` et
  `html-negative` depuis 0.21–0.22, puis `html-decode` depuis 0.24.
  Depuis 0.32, le défaut Rust est l'agrégat **47 tests HTML + Stash** ;
  `--suite stash` reste une sélection explicite de 41 tests. Pas encore
  les autres applications ou toute b8x.
- La configuration racine `b8x/spago.yaml` pointe vers le profil Rust depuis
  0.22. `html-decode`, choisi en 0.23, est raccordé et validé en 0.24.
- b8x possède désormais une FFI `.rs` locale pour l'encodage/décodage HTML,
  validée en 0.14 ; les autres modules restent à inventorier et porter.
- [`b8x/test/Main.purs`](../../b8x/test/Main.purs) dépend de `spec-node`,
  `Node.Process` et `keepMainAlive`. Il utilise aussi `Effect.Now`, une API
  PureScript dont l'implémentation doit être disponible sous Rust, même avec
  le runner générique.
- Les tests couvrent des modules purs/utilitaires, l'EventStore PostgreSQL et
  les projections PostgreSQL, avec RabbitMQ dans leurs fixtures. EventStore
  désigne ici une couche b8x, pas un troisième serveur à déployer.
- Les clients PostgreSQL et RabbitMQ utilisent `Promise` et `Promise.Aff` à
  leur frontière FFI : leur pont Rust est un prérequis des intégrations.
- Inventaire 0.25 : **46 specs feuilles, 286 déclarations de tests actifs**,
  dont 259 sans services et 27 d'intégration. Les 6 tests HTML validés font
  partie des 259 ; les 41 tests Stash, alors non exécutés sous Rust, ont
  un premier résultat natif en 0.29 (**12 réussis, 29 échoués**), puis
  **41/41 réussis en 0.31**, après correction du partage des valeurs de module.
  Les totaux 259/286 restent un relevé des sources, pas un bilan
  d'exécution de la suite complète.
- Portage 0.27 : `Foreign/Object/ST.rs` fournit maintenant `STObject` et ses
  quatre primitives différées. Sur 66 modules TAST frais, Cargo et les dix
  tests natifs passent dans chacun des modes normal/threaded. Le diagnostic
  Stash complet (228 modules) dépasse ce blocage, puis échoue sur le type natif
  `Foreign.Object.Object` absent : 218 occurrences du même diagnostic E0425.
  À cette étape 0.27, aucun des 41 tests Stash n'avait été exécuté en Rust.
- Qualification 0.28 : même échec réduit à 100 modules sans Stash/Spec/Aff.
  Un alias natif `Object = STObject` lève les erreurs dans des exports
  expérimentaux seulement ; le contrôle négatif confirme que les FFI Object
  restent non fonctionnelles. Les quatre signatures et les contrats de copie
  sont fixés pour 0.29, avec des limites JS explicitement documentées.
- Portage 0.29 : les quatre primitives Object sont réelles ; **11 tests Object
  + 10 tests ST passent dans chacun des modes normal/threaded**. Le chemin
  Cargo de Stash compile sous Linux et ses 41 tests s'exécutent : **12/41**,
  sortie 101, aucun des 31 fallbacks gardés du binaire atteint. Le nouveau
  blocage est la perte de l'état entre opérations ; `_stash` reste généré
  comme un getter réexécutant `new empty`, à isoler avant correction.
- Qualification 0.30 : le défaut de partage est reproduit sur **36 modules
  TAST frais**, sans Stash/Spec/Aff/Object. JS initialise la référence une fois ;
  le Rust normal/threaded la recrée quatre fois et perd la valeur écrite.
  Un getter mémorisé dans des copies expérimentales rétablit le partage,
  y compris entre threads. **Pas encore de correctif du compilateur** :
  l'implémentation bornée est prévue en 0.31, avec l'écart d'initialisation
  anticipée JS conservé comme point distinct. Stash reste au résultat 12/41
  de 0.29 ; aucun nouveau run Stash en 0.30.
- Correctif 0.31 : le générateur mémorise les bindings de module éligibles
  d'après leur TAST, avec stockage typé et mode normal/threaded explicite.
  **52 tests codegen, 21 sondes natives de partage et 42 exécutions Object/ST
  passent**. Sous Linux, les 8 cas UnsafeStash puis les **41 Stash passent**,
  sortie 0 et aucun fallback gardé atteint. À la fin de 0.31, le défaut CLI
  était encore HTML (2 tests) et ses artefacts n'avaient pas été reconstruits.
- Raccordement 0.32 : le défaut `Test.Rust.Main` réunit HTML Encode, HTML Decode
  et Stash ; `t -c` et `bin/run Test` passent **47/47**, sans filtre.
  Les deux dépendances locales `foreign` / `foreign-object` sont intégrées au
  profil et à son lockfile. Les artefacts sont reconstruits avec le bundle
  0.31 ; les preuves HTML historiques ne sont pas promues artificiellement.
  **M2 reste ouvert : 47 tests exécutés, pas encore les 259 sans services.**
- Diagnostic 0.33 : `RemoveComments` est retenu devant `PadLeft` ; son TAST
  frais contient 247 modules et 20 tests, mais Cargo échoue dans `purust_core`
  sur le champ de record Rust réservé `final` (14 erreurs). Le défaut est
  reproduit sur deux modules, normal/threaded. Un échappement expérimental
  limité aux champs lève ce cas et conserve `final` / `final_kw` distincts.
  **Compilateur non corrigé, aucun des 20 tests b8x exécuté ; défaut 47 inchangé.**
- Correctif 0.34 : le générateur échappe maintenant le champ natif `final`
  en `r#final`, sans modifier les clés dynamiques ni les noms composites/FFI.
  Régression permanente rouge puis verte : **3 tests natifs par mode**, avec
  `final_kw` distinct ; **53 tests codegen** et les quatre suites ciblées de
  records/valeurs de module passent. Le défaut est reconstruit avec le nouveau
  bundle : `bin/t`, `bin/run Test` et **`bin/t -c` passent 47/47**, sortie 0.
  `RemoveComments` dépasse `purust_core`, puis Cargo relève deux types natifs
  absents : **35 erreurs Nullable et 82 BigInt**. Ses 20 tests restent non
  exécutés ; prochaine qualification bornée : `Data.Nullable` (0.35).
- En 0.25, le contrôle de fraîcheur relève un changement du binaire `purs`
  depuis les artefacts HTML 0.24. Leurs succès restent historiques ; un build
  neuf sera nécessaire avant de les relancer. Aucun artefact prêt n'est
  modifié pour contourner ce contrôle.

### purust

- [`src/Main.purs`](src/Main.purs) utilise `findFfiFile ".rs"`.
- La recherche d'un FFI local voisin suit normalement le chemin :
  `src/X/Y.purs` -> `src/X/Y.rs`.
- Les fonctions Rust doivent respecter les noms qualifiés attendus, par exemple
  `Module_Function`.
- Le générateur concatène actuellement le Rust fourni par le FFI et ajoute des
  stubs de secours lorsqu'il ne trouve pas certains symboles.
- Cette stratégie doit être vérifiée sur une tranche verticale avant de porter
  une suite réelle : un stub qui compile ne constitue pas une FFI fonctionnelle.
- Une partie de l'écosystème `purust-*` possède déjà des FFI Rust, mais la
  couverture de `purust-spec`, des runners Node et de plusieurs packages Node
  reste incomplète.
- Le compilateur accepte `--source`, `--out`, `--main` et `--threaded`.
  `--main` choisit le point d'entrée ; le code actuel charge et transmet au
  générateur tous les modules trouvés dans `--source`. Il ne constitue donc
  pas un filtre suffisant pour une première compilation isolée de b8x.
- Les anciens chemins Cargo absolus de `perceus_ptr` ont été remplacés en
  0.19 par un runtime embarqué et des chemins relatifs ; l'export est aussi
  compilé/exécuté dans `api-cli` en 0.20, sans montage du compilateur hôte.

### Acquis à réutiliser

L'ancien todo, conservé dans Git (`git show 157cbac:todo.md` depuis ce dépôt),
rapporte une validation du 10 septembre : **45 tests Aff**, **5 groupes de
concurrence**, **4 scénarios de durée de vie**, et un bilan final de
**13 runners de paquets, 41 vérifications codegen et 16 suites TAST**.
Cela couvre notamment assert, console, effect, refs, functions, exceptions,
avar, arrays, foldable-traversable, unfoldable, unsafe-coerce et partial.
Ce sont des résultats historiques, non réexécutés lors de cette revue.

Le runner [`purust-aff/bin/test`](../purust-aff/bin/test) utilise `--threaded`.
Dans `src/Main.purs`, la présence d'Aff avec cette option active l'enveloppe
`purust_aff_run_main`, qui prend en charge la durée de vie du programme.
Réutiliser ce socle pour b8x ; la phase 4 vérifie son intégration et ses
non-régressions, elle ne recommence pas un portage d'Aff.

Les cycles forts de références `Rc`/`Arc` restent une limite connue. Leur
collecte générale est un chantier distinct, sauf blocage mesuré des tests b8x.

## Définition de terminé

- La commande intégrée retenue (`target rust`, build habituel, puis `t -c`)
  sélectionne Rust et exécute par défaut toute la suite active, sans `--suite`.
  La sélection ponctuelle `t --runtime rust -c` suit le même contrat.
- Le sous-ensemble pur initial constitue M1, pas la définition de terminé ;
  toute la suite doit compiler avec le TAST du fork local et s'exécuter en Rust.
- Une FFI `.rs` locale est découverte, incluse et exécutée ; aucun fallback vide
  n'est silencieusement utilisé.
- Les succès et les échecs des tests donnent les bons codes de sortie.
- Le runner attend bien la fin des effets asynchrones avant de terminer.
- Toute la suite unitaire b8x est portée avant les intégrations externes.
- Les intégrations des clients, de l'EventStore et des projections sont ensuite
  exécutables avec les services PostgreSQL/RabbitMQ de la suite actuelle.
- Tous les tests actifs de la suite b8x passent sous Rust avec leurs assertions
  préservées ; une exclusion temporaire laisse l'objectif incomplet.
- Les changements des scripts communs ne dégradent pas les chemins JS, Go et
  PHP par rapport aux références réellement relevées.

## Ordre d'exécution et jalons

Les phases ci-dessous regroupent les sujets ; elles ne sont pas huit blocs à
terminer successivement. La phase 0 nécessite un minimum des phases 1, 2, 3,
4 et 7 : environnement isolé, runner Spec compatible, FFI d'encodage,
`--threaded` et contrôle des FFI manquantes.

1. **M1 — validé le 12 septembre 2026 (0.17), réconcilié sur `master`** :
   référence JS ciblée, puis les deux tests existants sous Rust et
   une fixture négative, avec TAST frais et FFI réelle. Les FFI de bibliothèques
   nécessaires au runner sont des prérequis supplémentaires au fichier b8x.
2. **M2** : intégration aux scripts b8x et ensemble des tests sans services,
   identifiés par leur graphe de dépendances, quel que soit leur dossier.
3. **M3** : contrats des clients PostgreSQL/RabbitMQ et pont Promise/Aff validés.
4. **M4** : suites EventStore, projections et suite complète b8x derrière
   `t -c` sans filtre ; aucun test actif retiré pour obtenir une réussite.

Préparer le contrôle des FFI absentes avant M1. La portabilité Docker et la
généralisation de l'interface des scripts peuvent suivre cette première preuve.

## Phase 0 — Tranche verticale empirique

But : valider le pipeline complet avec le moins de variables possible.

- [x] Relever le résultat de référence d'un petit test b8x pur avec le runtime
  JS actuel : deux tests passés, zéro échec, zéro pending, sortie 0.
- [x] Choisir un test b8x sans PostgreSQL, RabbitMQ ni EventStore :
  `Util.Html.Encode.Test.EncodeHtmlEntities` (sélection par lecture et
  exécution le 11 septembre ; voir la micro-étape 0.1 ci-dessous).
- [x] Préparer un point d'entrée PureScript qui importe cette spec inchangée,
  avec `Proem` selon les conventions b8x. Fournir au compilateur un répertoire
  TAST limité à ses dépendances et conserver les chemins des sources réelles
  (211 modules compilés, micro-étape 0.2).
- [x] Inventorier les déclarations étrangères du graphe réel : 52 modules,
  dont 13 sans `.rs` voisin ; voir le manifeste de la micro-étape 0.2.
- [x] Qualifier cet inventaire par le résolveur et une génération diagnostique :
  29 symboles remplacés par des fallbacks, dont 20 encore référencés dans le
  Rust produit (micro-étape 0.3). Une référence conservée ne prouve pas à elle
  seule que le test exécutera ce chemin.
- [x] Valider les prérequis Spec/Now et leurs dépendances pour cette tranche ; la présence d'un
  fichier ne prouve pas sa compatibilité. `Test.Spec.Console.write` et
  `Effect.Now.now` sont validées isolément (0.4–0.5). `Data.Exists` est
  corrigé et validé en 0.6, `Data.Lazy` en 0.8, `MonadAff` en 0.9 et
  `freeMonadRec` en 0.10 et `Pipes.Internal.X` en 0.11. Le `cargo check`
  du graphe complet passe. `Record.Unsafe.unsafeSet` est corrigé en 0.13.
  Avec la vraie FFI HTML (0.14), les deux tests ciblés passent, résumé
  `2/2 tests passed` et sortie 0. En 0.15, la fixture négative termine aussi
  son résumé et sort avec un code non nul ; son erreur Aff finale est désormais
  affichée en Rust (0.16). Les 22 fallbacks conservés sont qualifiés pour ces
  exécutions en 0.17 : 13 référencés mais non atteints, 9 sans référence hors
  définition. Leur sémantique générale n'est ni portée ni validée.
- [x] Ajouter une seule FFI `.rs` nécessaire au runner :
  `purust-spec/src/Test/Spec/Console.rs` (micro-étape 0.4).
- [x] Vérifier que `findFfiFile ".rs"` découvre bien ce fichier local voisin.
- [x] Porter `Effect.Now.now` et vérifier sa résolution, sa définition générée
  et son effet différé rejouable en modes normal et threaded (0.5).
- [x] Générer un TAST frais avec le binaire du fork PureScript local identifié
  dans la micro-étape 0.2.
- [x] Générer le Rust en utilisant les arguments `--threaded` consignés dans
  le manifeste (génération diagnostique 0.3, sans Cargo). Le profil de
  préparation ne lance toujours pas automatiquement le backend.
- [x] Inspecter le Rust généré : nom qualifié, type de retour, arité, captures
  et absence de stub à la place de `Test_Spec_Console_write` et `Effect_Now_now`.
- [x] Valider `cargo check` sur le projet généré : premier essai en 0.5,
  premier succès sur les 211 modules en 0.11, sortie **0**.
- [x] Construire le binaire du projet Cargo généré : build et édition de
  liens réussis en 0.12, sortie **0**.
- [x] Effectuer une première exécution diagnostique bornée : les deux cas
  HTML sont atteints en 0.12, puis sortie **101** sur `unsafeSet`.
- [x] Valider une exécution complète de la spec ciblée avec la vraie FFI HTML
  Rust : deux tests, quatre assertions, résumé complet et sortie 0 (0.14).
  Les cas vides verts de 0.12–0.13, obtenus avec le fallback, ne comptaient pas.
- [x] Vérifier séparément un test qui réussit et un test qui doit échouer :
  référence JS fraîche et Rust, résumés complets et codes nuls/non nuls (0.15).
- [x] Vérifier les codes de sortie et les messages d'erreur de cette tranche :
  contrôles JS/Rust positifs et négatifs verts ; l'erreur Aff finale est
  affichée une fois, les erreurs interceptées restent silencieuses (0.16).

Critère de sortie : un test b8x réel, avec une FFI Rust réelle, passe de
PureScript à TAST, puis à Rust/Cargo, avec un résultat observable correct.

### Micro-étape 0.1 — Test et contrat choisis avec Astra

Sélection terminée le 11 septembre 2026 par lecture des sources et inspection
statique des imports JS générés. La référence JS a ensuite été exécutée ; aucun
build Rust ni portage FFI n'a encore été exécuté.
Révisions inspectées : b8x `66250cf5e8`, purust `157cbac`.

La première spec est
[`Util.Html.Encode.Test.EncodeHtmlEntities`](../../b8x/src/Util/Html/Encode/Test/EncodeHtmlEntities.purs).
Elle contient deux tests et quatre assertions. Le calcul testé est pur ; son
harness utilise toutefois `Aff`, `Test.Spec` et `Test.Util.Assert`.

| Entrée | Sortie exacte attendue |
| --- | --- |
| `<div>` | `&#x3C;div&#x3E;` |
| `Hello & world` | `Hello &#x26; world` |
| `"quoted text"` | `&#x22;quoted text&#x22;` |
| chaîne vide | chaîne vide |

Les assertions existantes font foi : les entités nommées telles que `&lt;`
ne sont pas interchangeables avec ces sorties hexadécimales. Le commentaire
d'exemple du module d'encodage utilise une autre représentation.

**FFI locale ciblée :**
`b8x/src/Util/Html/Encode/Encode.rs`, à créer à côté de
[`Encode.purs`](../../b8x/src/Util/Html/Encode/Encode.purs).
Le chemin appelé est `encodeHtmlEntities -> _encodeHtmlEntities`, avec le type
PureScript déclaré `String -> String`. D'après le générateur actuel, la
signature Rust attendue est
`pub fn Util_Html_Encode_Encode__encodeHtmlEntities(input: String) -> String` ;
à confirmer sur le TAST frais et le Rust produit.

Il s'agit d'un seul fichier FFI, mais le module déclare aussi
`_decodeHtmlEntities`. Le générateur parcourt actuellement toutes ses
déclarations étrangères et peut produire un fallback pour ce second symbole.
Lors du portage, vérifier s'il est conservé et, s'il l'est, fournir son
implémentation réelle dans le même fichier, avec ses tests de décodage propres.
Le succès de la spec d'encodage ne validera pas le décodage ni la couverture
HTML/Unicode complète. Implémenter un contrat général, sans cas particuliers
codés pour les quatre exemples. Respecter la représentation des chaînes du
runtime purust lors du passage à une bibliothèque Rust.

**Dépendances identifiées :** la spec importe `Proem`, `Effect.Aff`, `Test.Spec`,
`Test.Util.Assert` et le module d'encodage. `Proem` ajoute les helpers
PureScript du projet ; l'assertion utilise `Eq`, `Show` et
`Test.Spec.Assertions.fail`. Côté JS, `Encode.js` utilise `Util.Runtime` et
charge dynamiquement le package `he` sous Node. La future FFI Rust devra
implémenter le contrat d'encodage nativement. Le runner générique appelle
`Effect.Now.now` pour chaque test ; supprimer le chronométrage de `Test.Main`
ne supprime pas cette dépendance.

L'inspection statique des sorties JS existantes, en partant de cette spec,
du runner générique, du reporter console et du résumé, trouve 158 modules.
Les seuls modules b8x retenus sont la spec, `Test.Util.Assert`,
`Util.Html.Encode.Encode` et `Util.Runtime` ; aucun module `Core`, `Infra`,
`Inter` ou `Node.*` n'apparaît dans ce parcours. Cette inspection porte sur
les imports statiques du JS existant, pas sur la fermeture TAST future ni
sur l'ensemble des chargements dynamiques.

**Commande JS de référence exécutée par Luna.**
Depuis la racine b8x, elle charge la spec existante et le runner générique,
attend son résultat Aff et exige exactement deux tests réussis. Ses appels
ont été vérifiés par lecture des exports générés et par exécution. Les sorties
JS inspectées portent des dates de modification du 3 septembre ; cela ne
prouve pas leur correspondance avec le checkout actuel. Ce résultat est donc
une référence fonctionnelle sur les artefacts actuels ; il sera renouvelé
après compilation fraîche avant de conclure à la parité avec Rust.

Le runner générique renvoie ici une `Aff (Aff résultats)` parce que `evalSpecT`
est instancié avec `Aff` comme monade de génération. La commande exécute l'effet
de construction, puis l'effet de test qu'il renvoie. Elle importe explicitement
`defaultConfig` depuis `Test.Spec.Config` ; `Test.Spec.Runner` le réexporte
également. L'aplatissement par `bind` de la commande initiale était lui aussi
cohérent avec cette API.

```sh
cd /Users/0x1/Documents/htdocs/b8x &&
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import * as Aff from './run/bak/js/output/Effect.Aff/index.js';
import { Left } from './run/bak/js/output/Data.Either/index.js';
import * as Config from './run/bak/js/output/Test.Spec.Config/index.js';
import * as Runner from './run/bak/js/output/Test.Spec.Runner/index.js';
import { consoleReporter } from './run/bak/js/output/Test.Spec.Reporter.Console/index.js';
import { summarize } from './run/bak/js/output/Test.Spec.Summary/index.js';
import { spec } from './run/bak/js/output/Util.Html.Encode.Test.EncodeHtmlEntities/index.js';

const runAff = aff => new Promise((resolve, reject) => {
  Aff.runAff(result => () => {
    if (result instanceof Left) reject(result.value0);
    else resolve(result.value0);
  })(aff)();
});

const nested = Runner.evalSpecT(Aff.functorAff)
  ({ ...Config.defaultConfig, exit: false })([consoleReporter])(spec);
let watchdog;
try {
  watchdog = setTimeout(() => {
    console.error('EncodeHtmlEntities did not finish within 15 seconds');
    process.exit(1);
  }, 15_000);
  const tree = await runAff(nested);
  const results = await runAff(tree);
  const counts = summarize(results);
  console.log(JSON.stringify(counts));
  assert.deepEqual(counts, { passed: 2, failed: 0, pending: 0 });
} finally {
  clearTimeout(watchdog);
}
JS
baselineStatus=$?
printf 'Baseline exit code: %s\n' "$baselineStatus"
test "$baselineStatus" -eq 0
```

Résultat exécuté le 11 septembre 2026 : un groupe contenant deux tests
réussis, résumé `2/2 tests passed`, puis
`{"pending":0,"passed":2,"failed":0}` et code de sortie `0`.

Ne pas utiliser `./bin/test --example ...` pour cette mesure :
[`Test.Main`](../../b8x/test/Main.purs) transmet directement `defaultConfig`
à `runSpecAndGetResults`, sans appeler `fromCommandLine`. Le filtre transmis
par les scripts n'est donc pas appliqué. De plus, `bin/run` transforme
actuellement le code 139 en succès dans son chemin Docker ; la validation
des échecs devra contrôler ce comportement lors de l'intégration du runner.

**Critères de sortie de la future tranche Rust :** mêmes deux tests et quatre
assertions inchangés, `passed = 2`, `failed = 0`, `pending = 0`, sortie 0 après
la fin d'Aff et preuve que le symbole de la FFI locale est bien exécuté.
Une fixture négative isolée devra produire un échec et une sortie non nulle.
Ne pas remplacer la suite PureScript par quatre assertions Rust autonomes.
Une sortie 0 avec zéro test, un skip ou une interruption ne satisfait pas M1.

La référence JS est terminée. Le point d'entrée et le profil TAST sont décrits
ci-dessous ; la prochaine action porte sur les prérequis de génération Rust.

### Micro-étape 0.2 — Point d'entrée et profil TAST préparés avec Astra

Réalisée le 11 septembre 2026. Le profil se trouve dans
[`b8x/run/bak/rust`](../../b8x/run/bak/rust/README.md) et comprend :

- [`src/Main.purs`](../../b8x/run/bak/rust/src/Main.purs), module
  `Test.Rust.EncodeHtmlEntities.Main` : import de la spec originale,
  deux niveaux Aff exécutés successivement, `exit = false` et erreur Aff si
  le résumé n'est pas exactement deux réussites, zéro échec, zéro pending ;
- [`spago.yaml`](../../b8x/run/bak/rust/spago.yaml) et son lockfile propres :
  package set 77.10.1 et overrides natifs locaux, dont `purust-spec` 8.1.2 ;
- [`prepare.mjs`](../../b8x/run/bak/rust/prepare.mjs) : résolution Spago hors
  ligne, sélection par `purs graph`, compilation des seuls modules retenus,
  contrôle des layouts/types TAST et inventaire des FFI voisines.

Commande exécutée depuis b8x : `node run/bak/rust/prepare.mjs`.
La préparation finale retourne **0**, avec **211 modules compilés**, sans
erreur ni avertissement du compilateur. Aucun module `Core.*`, `Infra.*`,
`Inter.*` ou `Node.*` n'appartient à ce graphe. Les chemins des sources b8x
d'origine sont préservés ; les assertions n'ont pas été copiées ou modifiées.

Le manifeste de validation est
[`output/prepare-fpWEyc/manifest.json`](../../b8x/run/bak/rust/output/prepare-fpWEyc/manifest.json),
et les commandes et sorties sont dans
[`commands.json`](../../b8x/run/bak/rust/output/prepare-fpWEyc/commands.json).
Ces artefacts sont ignorés par Git et recréés dans un dossier neuf à chaque
préparation. Le manifeste contient les empreintes du binaire, du lockfile et
des sources ainsi que les futurs arguments du backend avec `--threaded`.

Outils : Spago **1.0.3** ; le binaire `purs` sélectionné dans le fork annonce
`0.15.16 [development build; commit: 65010ea6512741ef38b3027c6f25d82511c648cd DIRTY]`.
Le checkout du fork est `a6a9864` : cette validation utilise le binaire existant,
pas une recompilation de ce HEAD. Les contrôles TAST ont réussi, notamment
les tableaux `dataDecls`/`classDecls`, `typeTable`, les types étrangers et les
chemins sources. Avant une validation d'un changement du compilateur, reconstruire
le binaire concerné et enregistrer sa nouvelle empreinte.

**Inventaire observé, à qualifier avant le portage :**

| Modules sans `.rs` voisin | Suite à donner |
| --- | --- |
| `Effect.Now` | Horloge requise par Spec ; qualifier ses deux imports étrangers. |
| `Test.Spec.Assertions`, `Test.Spec.Console`, `Test.Spec.Runner` | Distinguer les fonctions exécutées des déclarations conservées par le backend. |
| `Data.Date`, `Data.DateTime`, `Data.DateTime.Instant` | Dépendances de Now et du calcul de durée ; vérifier les primitives disponibles. |
| `Control.Extend`, `Data.Int.Bits`, `Data.Lazy`, `Data.Show.Generic`, `Data.Symbol` | Contrôler la prise en charge intrinsèque avant de créer une FFI. |
| `Util.Html.Encode.Encode` | Premier FFI b8x à porter, après les prérequis du runner. |

Deux autres fichiers `.rs` sont présents mais le relevé textuel ne trouve pas
tous les noms attendus : `Data.Int.fromStringAsImpl`,
`Record.Unsafe.unsafeSet` et `Record.Unsafe.unsafeDelete`. Ce relevé ne reproduit
ni le résolveur complet ni la génération des primitives et ne suffit pas à
conclure qu'ils sont absents du code natif.

Le TAST frais confirme les deux déclarations `_encodeHtmlEntities` et
`_decodeHtmlEntities`, de type `String -> String` via `typeTable`. À la fin
de cette micro-étape, aucun `.rs` b8x n'avait été ajouté, et ni le backend Rust
ni Cargo n'avaient été exécutés. Les liens JS de la racine b8x sont conservés.

### Micro-étape 0.3 — Qualification FFI avec Astra

Réalisée le 11 septembre 2026, sans portage ni modification du compilateur.
Les empreintes des **211 sources** du manifeste 0.2 ont été revérifiées :
toutes sont inchangées. Le même TAST a été réutilisé pour une génération
diagnostique dans un nouveau dossier, distinct des sorties précédentes.

Depuis `purust/purust`, commande exécutée :

```sh
./bin/purust \
  --source ../../b8x/run/bak/rust/output/prepare-fpWEyc/tast \
  --out ../../b8x/run/bak/rust/output/qualify-i0901q/rust \
  --main Test.Rust.EncodeHtmlEntities.Main --threaded
```

Résultat : **211 modules Rust générés, sortie 0**. Cargo et les tests Rust
n'ont pas été exécutés. Le main produit utilise bien `purust_aff_run_main` ;
cela prouve la sélection de l'enveloppe, pas encore son exécution avec Spec.
Le backend est le bundle existant `bin/purust.js`, non reconstruit ici,
SHA-256 `48589d7d7c6d659a7337fa22f6257d089ed77031a653b277dbb175d87ba8e456`.
Sources inspectées : purust `157cbac`, PBO réellement configuré
`purescript-backend-optimizer-purust` `82438c1`.

Attention : le PBO écrit `.purmeta` relativement au dossier courant, même
avec `--out` isolé. Les 58 fichiers suivis, initialement propres, modifiés
par ce diagnostic ont été restaurés ; les 119 nouveaux fichiers de cache
ont été déplacés dans `qualify-i0901q/generated-purmeta`, avec une copie
des 58 versions générées. Pour les prochains diagnostics, isoler aussi ce
cache et revérifier la résolution FFI depuis le dossier de travail choisi.

Preuves locales, ignorées par Git :

- [`audit.mjs`](../../b8x/run/bak/rust/output/qualify-i0901q/audit.mjs) :
  diagnostic exécuté, vérification des empreintes, résolution et génération ;
- [`generation.json`](../../b8x/run/bak/rust/output/qualify-i0901q/generation.json) :
  arguments absolus réellement transmis, empreinte, statut et sorties ;
- [`resolution.json`](../../b8x/run/bak/rust/output/qualify-i0901q/resolution.json) :
  résultats du `findFfiFileImpl` du PBO local avec les arguments du backend ;
- [`symbols.json`](../../b8x/run/bak/rust/output/qualify-i0901q/symbols.json) :
  définitions fallback et références avec leurs fichiers/lignes Rust.

Ces fichiers ont été réécrits par la relance de la micro-étape 0.4 : ils
contiennent maintenant la vraie FFI console. Les comptes et le tableau qui
suivent décrivent l'observation historique 0.3. La micro-étape 0.5 possède
ses propres sorties et recalcule les présences depuis les fichiers actuels.

**Résolution initiale 0.3 :** 39 fichiers voisins retrouvés, aucun chemin alternatif pour
les 13 modules sans voisin. Les trois noms absents des deux fichiers présents
ne sont pas fournis par une autre résolution. Le code de `src/Main.purs`
ajoute un fallback pour chaque déclaration étrangère typée absente ; il ne
filtre pas ces déclarations selon leurs usages. La génération confirme
**29 fallbacks**, dont 20 symboles avec des références hors définition et
9 sans référence dans ce Rust. Ces comptes portent sur les noms exacts,
pas sur un graphe d'appels dynamiques ni une preuve de couverture.

| Module / symboles | Qualification et conséquence |
| --- | --- |
| `Control.Extend.arrayExtend` | Pas d'intrinsèque identifié ; fallback `unimplemented!()` référencé par l'instance tableau conservée. À porter ou à éliminer avec cette instance après preuve d'inutilisation. |
| `Data.Date` : `canonicalDateImpl`, `calcWeekday`, `calcDiff` | Trois vrais manques, tous référencés par leurs wrappers. Les fallbacks `FnN` sont même sans argument : ne pas prendre leur signature comme contrat. |
| `Data.DateTime` : `calcDiff`, `adjustImpl` | Deux vrais manques référencés. Le chronométrage Spec utilise `Instant.diff`, pas cette FFI `calcDiff`. |
| `Data.DateTime.Instant` : `fromDateTimeImpl`, `toDateTimeImpl` | Deux vrais manques référencés par les conversions conservées. `Instant.diff` est du PureScript sur des millisecondes ; chronométrer les tests n'impose pas ces conversions à l'exécution. |
| `Data.Int.fromStringAsImpl` | Vrai symbole manquant dans `Data/Int.rs`, encore référencé par le parsing. Pas d'intrinsèque identifié. |
| `Data.Int.Bits` : les sept fonctions | Le PBO les transforme en opérations primitives, émises par `Purust.CodeGen`. Aucun appel à ces sept noms dans le Rust produit, mais leurs sept fallbacks `0` restent définis. Candidats à suppression contrôlée, pas FFI validées ni preuve de parité bit à bit sur tous les cas. |
| `Data.Lazy.defer`, `force` | Pas d'intrinsèque ; deux fallbacks référencés dans `Data.Lazy`, `Control.Monad.List.Trans` et `Control.Comonad.Cofree`. Le type étranger `crate::Lazy` est aussi référencé. Portage de la mémorisation et du type natif, ou élimination prouvée des bindings concernés : travail Astra. |
| `Data.Show.Generic.intercalate` | Fallback chaîne vide, encore référencé par le Show générique. Pas d'intrinsèque identifié. |
| `Data.Symbol.unsafeCoerce` | Fallback référencé, notamment dans `Util.Type.Symbol`. L'intrinsèque PBO de `Unsafe.Coerce.unsafeCoerce` ne couvre pas ce nom différent. |
| `Effect.Now.now` | Requis directement avant/après chaque test ; fallback `unimplemented!()`. Le TAST donne `Effect Number` après dépliage des newtypes : fournir un effet différé retournant les millisecondes Unix, pas une lecture faite à sa construction. |
| `Effect.Now.getTimezoneOffset` | Aucun appel dans ce Rust, mais fallback conservé. Son portage n'est pas nécessaire au chronométrage ; ne pas le remplacer par un faux zéro. |
| `Record.Unsafe.unsafeSet` | Le PBO optimise certains labels littéraux, mais 15 lignes de références restent dans les instances de records (`Semiring`, `Semigroup`, etc.). Ce symbole manque réellement pour ces chemins ; ne pas le déclarer couvert par l'intrinsèque. |
| `Record.Unsafe.unsafeDelete` | Optimisation PBO partielle également ; aucun appel résiduel à ce nom dans ce graphe, fallback conservé. Candidat à suppression contrôlée. |
| `Test.Spec.Assertions.unsafeStringify` | Fallback chaîne vide utilisé par `AnyShow`. Les assertions b8x choisies utilisent leur `Show` typé et `fail`, pas `AnyShow`. Binding conservé à traiter, pas prérequis direct des quatre assertions. |
| `Test.Spec.Console.write` | Vrai manque sur le chemin du reporter console, fallback `unimplemented!()`. **Premier fichier à porter.** |
| `Test.Spec.Runner.exit` | Fallback encore référencé dans la branche `config.exit`. Le main fixe `exit = false`, donc cette branche n'est pas demandée ; il reste à traiter sa conservation sans interrompre les nettoyages Aff. |
| `Util.Html.Encode.Encode` : les deux fonctions | Deux fallbacks chaîne vide conservés. L'encodage est directement appelé par les assertions ; le wrapper de décodage reste généré. Les deux vrais contrats restent à porter. |

L'absence d'appel dynamique ne suffit pas à supprimer un problème de
compilation : les corps Rust conservés devront être typés. La génération
actuelle n'applique pas une élimination globale des fonctions depuis `main`.
Il reste donc à porter ou éliminer explicitement les bindings non nécessaires,
sans retirer de test actif. La présence des 39 autres `.rs` ne constitue pas
une validation de leurs signatures ou de toute leur sémantique.

Sources du classement : [`src/Main.purs`](src/Main.purs) pour les fallbacks,
[`Purust.CodeGen`](src/Purust/CodeGen.purs) pour les opérations bit à bit et
[`Semantics.Foreign`](../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/Semantics/Foreign.purs)
pour les règles PBO sur les bits, records et coercions.

**Contrat de la micro-étape Luna, `medium` : `Test.Spec.Console.write` seulement.**
Choix local fondé sur ce contrat borné, pas sur un benchmark b8x des modèles ;
la [documentation officielle Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
décrit son positionnement pour les tâches à coût maîtrisé.

- FFI à créer : `purust-spec/src/Test/Spec/Console.rs`, à côté du
  [`Console.purs`](../purust-spec/src/Test/Spec/Console.purs) existant.
- Signature native observée :
  `pub fn Test_Spec_Console_write(message: String) -> purust_core::UnknownType`.
  Ici `UnknownType` est le type `Value` du contrat d'effet existant, pas une
  absence de type dans le TAST (`String -> Effect Unit`).
- Réutiliser la convention de
  [`Effect/Console.rs`](../purust-console/src/Effect/Console.rs) : renvoyer
  `Value::Func1(Func1::Shared(Rc::new(...)))`, puis `Value::Unit` à l'exécution.
  Aucune écriture lors de la construction ; chaque exécution réécrit le texte.
  Le traitement `threadedRust` convertit le code vers `Arc` pour `--threaded`.
- Écrire exactement le texte sur stdout, sans préfixe, indentation ni saut de
  ligne ajouté. Convertir les chaînes purust avec
  `purust_string_to_utf8_lossy`, conserver ANSI et caractères Unicode, puis
  `write_all` et `flush` sous verrou stdout. Ignorer les erreurs d'écriture
  comme la FFI JS existante ; ne pas ajouter de dépendance Cargo.
- Ajouter uniquement le test natif ciblé
  `purust/tests/codegen/spec-console-ffi.mjs`, en reprenant le montage du
  runtime généré de [`effect-ffi.mjs`](tests/codegen/effect-ffi.mjs).
  Tester construction silencieuse, deux exécutions du même effet, chaîne
  vide, Unicode (dont paire et surrogate isolé), ANSI, absence de newline
  ajouté, retour `Unit` et stdout fermé. Vérifier les modes normal et
  `--threaded` via `threadedPrelude`/`threadedRust`.
- Commande de sortie prévue depuis `purust/purust` :
  `node --test tests/codegen/spec-console-ffi.mjs`. Le test doit compiler la
  vraie FFI avec `rustc`, exécuter les binaires et comparer les octets stdout.
  Contrôler aussi que le résolveur trouve le nouveau fichier et que la
  génération n'ajoute plus de fallback pour `Test_Spec_Console_write`.
- Arrêter après ce fichier, sa régression et le relevé de résultat. Ne pas
  porter Now, Lazy, l'encodage HTML ou modifier le générateur dans cette étape.
  Si le contrat d'effet existant ne suffit pas, revenir à Astra avec la trace.

### Micro-étape 0.4 — FFI console portée par Luna

Réalisée le 11 septembre 2026. Le fichier
[`Test/Spec/Console.rs`](../purust-spec/src/Test/Spec/Console.rs) implémente
`Test_Spec_Console_write` comme un effet différé rejouable : la construction
n'écrit rien, chaque exécution écrit le texte sur stdout sous verrou et
retourne `Unit`. Il utilise `purust_string_to_utf8_lossy`, `write_all` et
`flush`, sans nouvelle dépendance Cargo.

La régression
[`spec-console-ffi.mjs`](tests/codegen/spec-console-ffi.mjs) compile la vraie
FFI avec `rustc`, puis exécute les binaires normal et `--threaded`. Elle vérifie
la construction silencieuse, deux exécutions du même effet, chaîne vide, ANSI,
paire UTF-16 `🦀`, surrogate isolé converti en `�`, absence de newline ajouté,
retour `Unit` et absence de stderr.

Commande exécutée depuis `purust/purust` :

```sh
node --check tests/codegen/spec-console-ffi.mjs &&
node --test tests/codegen/spec-console-ffi.mjs
```

Résultat : **1 test passé**, code 0, en **0,95 s** ; les deux sous-processus
Rust, normal et threaded, ont réussi. Une génération diagnostique séparée
avec le TAST 0.2 a ensuite retrouvé
`/Users/0x1/Documents/htdocs/purust/purust-spec/src/Test/Spec/Console.rs` et
a produit la définition réelle `Test_Spec_Console_write`, sans fallback
`unimplemented!()`, avec sortie 0. Les sorties et le relevé sont conservés
dans [`qualify-i0901q`](../../b8x/run/bak/rust/output/qualify-i0901q).

Cette étape valide le contrat de cette FFI et son adaptation threaded ; elle
ne valide pas encore le runner Spec complet, `Effect.Now.now`, Cargo généré,
les codes d'échec de suite ou M1.

Le test initial ne contenait pas le scénario stdout fermé prévu dans le
contrat, ni un scénario séparé de construction sans exécution. Ces deux
vérifications sont ajoutées et exécutées en 0.5, sans changement de la FFI.

### Micro-étape 0.5 — Horloge native et premier blocage Cargo

Réalisée avec Astra le 11 septembre 2026.

[`purust-now/src/Effect/Now.rs`](../purust-now/src/Effect/Now.rs) fournit
`Effect_Now_now() -> purust_core::UnknownType`. Ce résultat est l'effet
`Value::Func1` attendu par le runtime ; son exécution lit `SystemTime::now`
et renvoie un `Value::Number` en millisecondes Unix entières. Le helper de
conversion traite aussi les dates antérieures à l'époque. Le TAST conserve
le contrat `Effect Number` après dépliage d'`Instant`/`Milliseconds`.
Aucune nouvelle dépendance Cargo ; chaque rejeu de l'effet relit l'horloge.
Il s'agit de l'horloge civile, qui peut être réglée par le système, pas d'une
garantie de monotonie.

`getTimezoneOffset` reste non porté : le graphe actuel ne l'appelle pas,
mais le générateur conserve son fallback `unimplemented!()`. Les wrappers
de conversion en date/heure et leurs FFI restent également à traiter.
La présence de `Now.rs` ne signifie donc pas que le package Now entier passe.

**Validation native :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
node --test tests/codegen/now-ffi.mjs tests/codegen/spec-console-ffi.mjs
```

Résultat : **3 tests passés**, zéro échec, sortie **0**, environ **1,37 s**
(Node 24.8.0, rustc/Cargo 1.96.0).

- [`now-ffi.mjs`](tests/codegen/now-ffi.mjs) : deux tests, normal et threaded,
  qui compilent la vraie FFI contre le runtime généré. Dates connues autour
  de l'époque, précision milliseconde, effet construit avant une attente,
  deux lectures espacées du même effet, composition avec les vrais
  `Effect_bindE`/`Effect_pureE`, horodatages encadrés par `Date.now()` côté
  Node, puis exécution depuis un autre thread en mode threaded.
- [`spec-console-ffi.mjs`](tests/codegen/spec-console-ffi.mjs) : régression
  complétée ; trois scénarios par mode sur cette machine Unix : construction
  seule silencieuse, sortie/rejeu comparés octet par octet, stdout fermé avec
  deux exécutions retournant `Unit`. Les cas UTF-16/ANSI restent vérifiés.
  Le scénario de fermeture utilise uniquement le descripteur stdout de son
  sous-processus de test ; il n'est pas exécuté sous Windows.

**Génération et état des fallbacks :**

Le diagnostic
[`now-pM1j0H/audit.mjs`](../../b8x/run/bak/rust/output/now-pM1j0H/audit.mjs)
a généré **211 modules**, sortie **0**, dans un dossier neuf. Son dossier
courant contient aussi `.purmeta` : aucun cache suivi du compilateur n'a
été modifié. Les empreintes des 211 sources PureScript du manifeste 0.2
sont inchangées ; ce TAST a été réutilisé pour le diagnostic. Le bundle
backend est le même que celui identifié en 0.3, non reconstruit ici.

Le résolveur trouve **41 fichiers FFI**, dont les deux nouveaux fichiers
Now/Console. Le Rust contient leur code réel intégral après `threadedRust`,
avec une seule définition de chaque symbole. L'inventaire recalculé donne
**27 fallbacks**, dont **18 encore référencés** et **9 sans référence hors
définition**, contre 29/20/9 avant les deux portages.

Preuves conservées dans ce dossier :
[`generation.json`](../../b8x/run/bak/rust/output/now-pM1j0H/generation.json)
(commandes, empreintes sources FFI, résolution, sorties),
[`symbols.json`](../../b8x/run/bak/rust/output/now-pM1j0H/symbols.json)
(symboles présents/manquants et références),
[`cargo-check.json`](../../b8x/run/bak/rust/output/now-pM1j0H/cargo-check.json)
(premier `cargo check --offline` du graphe complet).

**Blocage mesuré :** `cargo check` retourne **101**, avec quatre erreurs
`E0425` (type `crate::Exists` absent) et une erreur `E0057` (`runExists`
transmet deux arguments à la fonction unaire `Unsafe_Coerce_unsafeCoerce`).
La source `Data.Exists` déclare `foreign import data Exists`, puis définit
`mkExists` et `runExists` via `unsafeCoerce`. Son tableau TAST `foreign` est
vide : l'inventaire des valeurs étrangères ne couvre pas les types étrangers
ni tous les défauts de génération. Aucun test b8x n'a encore été exécuté.

Un reproducteur conserve uniquement les TAST originaux de `Data.Exists`
et `Unsafe.Coerce` :
[`reproduce-exists.mjs`](../../b8x/run/bak/rust/output/now-pM1j0H/reproduce-exists.mjs).
La génération de ces deux modules réussit, puis
`cargo check --offline --manifest-path rust/Cargo.toml -p Purs_Data_Exists`
reproduit les mêmes erreurs. Commandes et sorties exactes :
[`exists-AA4yCZ/commands.json`](../../b8x/run/bak/rust/output/now-pM1j0H/exists-AA4yCZ/commands.json).

**Contrat de la micro-étape suivante, réalisé en 0.6 — Astra :** résoudre ce reproducteur `Data.Exists` :
représentation du type étranger et arité de la coercion au rang 2, en
s'appuyant sur le TAST. Ajouter une régression native qui emballe une valeur
via `mkExists`, la consomme via `runExists` et vérifie le callback et son
résultat, y compris en threaded. Recompiler le backend après correction,
obtenir un `cargo check` réussi sur le reproducteur, puis relever le premier
blocage suivant du graphe complet. Ne pas remplacer le type manquant par
une struct vide ni supprimer ce module pour faire passer la compilation.

La suite du traitement des fallbacks dépend de ces preuves : conserver les
vraies FFI Now/Console, traiter séparément les types étrangers (Exists/Lazy),
puis porter les chemins requis ou éliminer les bindings non utilisés avec
une analyse d'accessibilité. `getTimezoneOffset`, les sept noms bit à bit
et `unsafeDelete` n'ont pas de référence résiduelle ici ; leurs définitions
fallback existent toujours et ne constituent pas une couverture native.
M1 reste incomplet.

### Micro-étape 0.6 — Data.Exists corrigé et validé en Rust

Réalisée avec Astra le 11 septembre 2026.

Deux corrections dans [`CodeGen.purs`](src/Purust/CodeGen.purs) :

- Le type qualifié `Data.Exists.Exists` utilise `UnknownType` (`Value`),
  c'est-à-dire son contenu existentiel, sans struct fictive ni allocation
  d'un conteneur supplémentaire. Cette règle ne s'applique pas à tous les
  types étrangers ; les autres types et layouts TAST restent inchangés.
- Une annotation de fonction sur une référence globale conserve son type
  TAST instancié, même si son arité diffère de celle de la déclaration
  polymorphe. L'adaptateur d'arité existant applique alors `unsafeCoerce` au
  callback, puis le callback au contenu. La FFI unaire `unsafeCoerce` reste
  inchangée ; les gardes des annotations obsolètes sur les autres formes
  d'expressions sont conservées.

La régression [`exists.mjs`](tests/tast/exists.mjs) compile un TAST neuf depuis
le vrai `Data.Exists` du package `exists-6.0.0` présent dans le cache Spago du
compilateur et depuis `purust-unsafe-coerce/src/Unsafe/Coerce.purs`. Elle ne
réécrit ni la bibliothèque ni ses annotations. Avant correction, elle échouait
sur la référence Rust au type `crate::Exists` absent.

Après reconstruction du backend, les exports générés passent les vérifications
natives en modes normal et `--threaded` : emballage et lecture de nombres et
chaînes, callback capturant un compteur appelé une fois par lecture, identité
d'un tableau partagé, identité d'une closure capturée rendue sans exécution
anticipée, puis transfert du contenu et lecture depuis un autre thread.

**Reconstruction et non-régression :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PATH="$PWD/node_modules/.bin:$PATH" ./node_modules/.bin/spago bundle --offline --module Main --platform node --outfile bin/purust.js --bundle-type app
node --test --test-concurrency=2 tests/codegen/*.mjs
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs node --test --test-concurrency=2 tests/tast/*.mjs
```

Build et bundle : sortie **0**, zéro erreur, **75 avertissements** au build
complet (non traités dans cette micro-étape). Le bundle suivi
[`bin/purust.js`](bin/purust.js) a été reconstruit, SHA-256 :
`d708da95656502e71c128fab75ddd1d49b0ba7206c16423bee38877feaedf46f`.
Tests : **45/45 codegen** (~11,24 s) et **17/17 TAST** (~77,46 s), zéro échec.
La nouvelle régression fait partie des 17 tests TAST ; elle couvre les deux
modes, et non deux tests Node distincts.

**Vérification du graphe b8x :**

`node prepare.mjs` a recompilé les **211 modules** dans
[`prepare-L2x9hL`](../../b8x/run/bak/rust/output/prepare-L2x9hL/manifest.json).
Le manifeste et `commands.json` identifient les sources et le binaire TAST du
fork local ; les réserves sur sa provenance décrites en 0.2 restent valables.
Le diagnostic neuf
[`exists-fixed-YU9nh0/audit.mjs`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/audit.mjs)
utilise ce TAST et le nouveau bundle, avec son propre dossier courant pour
`.purmeta`, sans réécrire les diagnostics antérieurs ni les caches suivis.

- Reproducteur à deux modules, threaded : génération réussie et
  `cargo check --offline --manifest-path minimal-rust/Cargo.toml -p Purs_Data_Exists`
  réussi, sortie **0**. Commandes et sorties :
  [`minimal-check.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/minimal-check.json).
- Graphe complet : génération **211 modules**, sortie **0** ; **41 fichiers
  FFI**, **27 fallbacks**, dont **18 référencés** et **9 sans référence hors
  définition**, inchangés. Now et Console restent de vraies FFI.
  Preuves : [`generation.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/generation.json)
  et [`symbols.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/symbols.json).
- Cargo complet : sortie **101**, **21 erreurs `E0603`** dans
  `Purs_Control_Monad_List_Trans`, sur `Purs_Data_Lazy::Lazy` déclaré privé.
  [`cargo-check.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/cargo-check.json)
  conserve le diagnostic complet. Aucun test b8x exécuté en Rust ; M1 reste
  incomplet.

**Contrat repris et réalisé en 0.7 — Astra :** isoler `Data.Lazy` avec un consommateur
minimal et définir son contrat de représentation/mémorisation natif.
Le type étranger `Data.Lazy.Lazy` n'est pas implémenté : dans le Rust actuel,
le nom `Lazy` est fourni par l'import privé de la classe `Control.Lazy.Lazy`,
qui est un dictionnaire différent. La suggestion de rustc d'importer ce
dictionnaire directement ne corrige donc pas la représentation du contenu
différé. Les fallbacks `Data_Lazy_defer` et `Data_Lazy_force` restent présents.
Fixer une régression : aucune évaluation à la construction, une seule au
premier `force`, résultat partagé aux lectures suivantes ; préciser aussi
le comportement threaded et en cas de panic. Le portage de cette
représentation et de ses deux opérations suivra ce contrat, sans étendre
l'étape aux autres FFI. Luna attend un contrat d'implémentation borné.

### Micro-étape 0.7 — Data.Lazy isolé ; contrat natif fixé

Réalisée avec Astra le 11 septembre 2026. Diagnostic et contrat uniquement :
aucune modification du générateur, du runtime ou d'une FFI dans cette étape.

**Reproducteur empirique :**

Le consommateur [`LazyProbe.purs`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/LazyProbe.purs)
contient trois fonctions : construire un `Lazy Int`, le forcer, et conserver
son identité. Il importe le vrai `purust-lazy/src/Data/Lazy.purs` sans le
réécrire. [`reproduce.mjs`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/reproduce.mjs)
sélectionne sa fermeture avec `purs graph`, compile un TAST neuf, génère le
Rust et lance Cargo séparément en normal et threaded. Résultat : **77 modules**
(le consommateur et 76 dépendances), sans Spec/Aff ni application b8x ;
**5 erreurs `E0603` dans chaque mode**, sortie Cargo **101**, sur le type
`Purs_Data_Lazy::Lazy` privé. Le script termine à 0 parce qu'il vérifie
explicitement cet échec attendu ; ce n'est pas une validation native réussie.

Preuves : [`commands.json`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/commands.json)
et [`reproduction.json`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/reproduction.json)
(sources et empreintes, annotations étrangères TAST, layout du dictionnaire,
signatures et erreurs). Bundle inchangé depuis 0.6 :
`d708da95656502e71c128fab75ddd1d49b0ba7206c16423bee38877feaedf46f`.
Le diagnostic utilise son propre `.purmeta` et refuse de réutiliser son TAST
déjà généré : reprendre les scripts dans un dossier neuf pour une autre mesure.

Le TAST distingue correctement les deux types : `Data.Lazy` ne définit aucun
layout ADT/classe et déclare le type étranger `Lazy` ; `Control.Lazy` définit
la classe `Lazy` avec son champ `defer`. Le Rust de `Data_Lazy_lazyLazy`
retourne déjà `Rc<Purs_Control_Lazy::Lazy>` (ou `Arc`) ; les opérations sur
le contenu différé attendent `Rc<Purs_Data_Lazy::Lazy>` (ou `Arc`). Le portage
doit fournir ce dernier type, pas réexporter le dictionnaire homonyme.

**Sémantique JS mesurée :**

[`probe-js.mjs`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/probe-js.mjs)
importe directement la vraie FFI locale `purust-lazy/src/Data/Lazy.js`.
**5 vérifications passées**, sortie 0 : construction/alias sans évaluation,
résultat partagé après succès, fonction retournée sans exécution anticipée,
`Lazy` imbriqué non forcé automatiquement, exception propagée puis nouvel
essai, exceptions répétées sans valeur de remplacement. Les deux premiers
points sont regroupés dans un même scénario ; voir
[`js-contract.json`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/js-contract.json).
La nuance de contrat est importante : **un résultat réussi est mémorisé ;
une tentative qui lève une exception ne l'est pas**.

**Représentation et ABI retenues pour le portage :**

- Ajouter uniquement `purust-lazy/src/Data/Lazy.rs` et ses régressions.
  Définir `pub struct Lazy` avec un état privé partagé, distinct du dictionnaire
  `Control.Lazy.Lazy`. Garder la représentation native déjà émise : `Rc<Lazy>`
  en normal, transformée en `Arc<Lazy>` par `threadedRust`. Cloner le handle
  partage la cellule et ne copie pas l'état de mémorisation.
- Signatures normales observées, à respecter :
  `Data_Lazy_defer(thunk: purust_core::Func1<(), crate::UnknownType>) -> Rc<Lazy>`
  et `Data_Lazy_force(value: Rc<Lazy>) -> crate::UnknownType`.
  `defer` ne calcule rien ; `force` appelle le callback avec `()` et retourne
  directement la valeur mémorisée. Ce ne sont pas des wrappers `Effect`.
- Le résultat polymorphe utilise `Value` comme les autres FFI génériques ;
  les sites d'appel gardent leurs types TAST (le consommateur retourne `i64`).
  Les conversions existantes via `Value::Class` doivent conserver le handle.
  Ne pas assimiler ce type à `Value::Thunk` : ce dernier sert aux valeurs
  récursives déjà initialisées et `resolve()` attend une valeur disponible,
  sans callback à évaluer. Aucun nouveau variant du runtime n'est requis
  par le contrat retenu.

**Mémorisation, concurrence et erreurs — décisions natives à implémenter :**

- États : en attente avec callback, en cours avec propriétaire, prêt avec
  résultat. Choix initial : `Mutex` + `Condvar` de la bibliothèque standard,
  utilisables dans les deux modes. Conserver `Func1` et le traitement Rc/Arc
  existants ; pas de `unsafe impl Send/Sync` ni de dépendance Cargo ajoutée.
- Une seule tentative à la fois par cellule. En threaded, les autres lecteurs
  attendent puis obtiennent le même résultat partagé ; ne jamais conserver
  le verrou pendant l'exécution du callback. Après réussite, libérer les
  captures du callback devenues inutiles. Les lectures renvoient un clone
  de `Value`, sans recalcul ni copie profonde des contenus partagés.
- Si le callback panique en mode unwind, propager le panic d'origine au
  lecteur concerné, remettre la cellule en attente avec son callback, puis
  réveiller les lecteurs. Un lecteur suivant peut réessayer ; ne publier ni
  `Unit` par défaut, ni erreur en cache, ni état définitivement empoisonné.
  Prévoir un garde de restauration RAII ; ne pas exécuter le callback sous
  le verrou. Avec `panic=abort`, le processus s'arrête normalement.
- Un `force` réentrant sur la même cellule dans le thread évaluateur doit
  échouer explicitement (`Data.Lazy.force: reentrant evaluation`) plutôt
  qu'attendre son propre résultat. C'est un choix de diagnostic natif, pas
  une garantie issue de la FFI JS. Les dépendances imbriquées acycliques et
  les structures paresseuses productives restent permises. La détection
  générale des cycles de dépendances entre plusieurs threads est hors de
  cette première implémentation ; ne pas promettre leur prise en charge.
- Forcer un `Lazy` contenant une fonction, un effet ou un autre `Lazy`
  retourne ce contenu sans l'exécuter ni le forcer récursivement. Un effet
  ainsi retourné reste rejouable à chaque appel explicite.

**Contrat réalisé en 0.8 — Astra :** réaliser ce portage et une régression native
sur la vraie FFI. Le contrat est défini, mais la première implémentation de
l'état partagé, du réveil après panic et de la réentrance reste un travail
de sémantique/concurrence ; Luna pourra ensuite étendre mécaniquement les cas.

- [x] Tester normal/threaded : compteur à 0 après `defer` et copie du handle,
  puis 1 après plusieurs `force` ; identité du résultat partagé et des
  fonctions, absence d'exécution anticipée, libération des captures après
  succès et des valeurs à la destruction des derniers handles (cas acycliques).
- [x] Tester tentative qui panique puis réussit, échecs répétés, réentrance
  bornée et forcing d'une autre cellule. En threaded, tester des lecteurs
  simultanés avec une barrière, une seule évaluation réussie et des lecteurs
  réveillés après un panic. Mettre un timeout sur ces sous-processus pour
  rendre un deadlock observable.
- [x] Ajouter une régression TAST normale/threaded avec le vrai consommateur
  et vérifier aussi le dictionnaire `Data_Lazy_lazyLazy`, sans confusion avec
  le type du contenu. Refaire Cargo sur les 77 modules, attendu 0.
- [x] Régénérer le graphe b8x dans un dossier neuf et vérifier la résolution
  des deux vrais symboles, sans fallback. Si seuls ces deux symboles changent,
  l'inventaire attendu est 25 fallbacks dont 16 référencés, à mesurer et non
  à présumer. Relever le prochain blocage puis s'arrêter.

M1 reste incomplet : ce diagnostic n'a ni exécuté une spec b8x en Rust, ni
validé une implémentation native de `Data.Lazy`. Les 62 régressions de 0.6
n'ont pas été relancées : aucun code de production n'a changé ici.

### Micro-étape 0.8 — FFI Data.Lazy implémentée et validée

Réalisée avec Astra le 11 septembre 2026.

[`purust-lazy/src/Data/Lazy.rs`](../purust-lazy/src/Data/Lazy.rs) fournit le
type étranger `Lazy`, `Data_Lazy_defer` et `Data_Lazy_force`, avec les signatures
natives prévues en 0.7. La cellule utilise `Mutex`/`Condvar`, sans dépendance
ajoutée ni `unsafe`. Son handle `Rc` devient `Arc` en threaded. Le callback
est déplacé hors du verrou pendant l'évaluation ; le succès publie le résultat
et libère les captures, tandis qu'un garde RAII restaure le callback et
réveille les lecteurs lors d'un panic. Le payload du panic est conservé.
La réentrance dans le thread évaluateur produit le diagnostic convenu.

Aucun changement du générateur, du runtime, de PBO ou du bundle dans cette
micro-étape. Le bundle reste celui de 0.6, SHA-256
`d708da95656502e71c128fab75ddd1d49b0ba7206c16423bee38877feaedf46f`.
SHA-256 de la nouvelle FFI après formatage :
`ad0ee57acc45e594b7e096dbecb9d86be4c108255c25c84bcee01d49daee161f`.
Les limites du contrat 0.7 subsistent : cycles interthreads non détectés,
pas de récupération avec `panic=abort`, tests de libération sur cas acycliques.

**Régressions natives :**

- [`lazy-ffi.mjs`](tests/codegen/lazy-ffi.mjs) compile la vraie FFI contre le
  runtime généré, puis exécute [`lazy-ffi.rs`](tests/codegen/fixtures/lazy-ffi.rs).
  Deux tests Node, normal/threaded ; respectivement 8 et 10 scénarios Lazy
  (le harnais exécute aussi 4 tests du runtime en normal). Construction et
  aliases sans calcul, résultat partagé, aller-retour via `Value::Class`,
  libération des captures et des derniers résultats, destruction sans force,
  fonctions/effets renvoyés sans exécution, lazy imbriqué, panic inchangé puis
  retry, échecs répétés, réentrance et forcing d'une autre cellule.
  Un callback peut aussi intercepter son propre échec de réentrance puis
  publier un résultat valide.
- En threaded : `Lazy: Send + Sync` vérifié par rustc ; 8 lecteurs concurrents
  face à un premier évaluateur bloqué, résultat partagé après succès ; même
  scénario avec panic du premier lecteur, puis réveil et un seul retry réussi.
  Chaque scénario concurrent est répété 8 fois. Les sous-processus ont des
  délais maximaux pour rendre un deadlock observable.
- [`tests/tast/lazy.mjs`](tests/tast/lazy.mjs) compile le vrai module et le
  consommateur [`LazyProbe.purs`](tests/tast/fixtures/lazy/LazyProbe.purs).
  Les dépendances sont résolues depuis le lockfile/cache du compilateur et
  les sources natives locales, sans dépendre d'un diagnostic b8x antérieur.
  La fermeture compilée reste de **77 modules**. Dans les deux modes : vraie
  FFI intégrale trouvée dans le Rust, une seule définition de chaque symbole,
  aucun fallback à leur place, **Cargo check réussi**. Les tests Cargo passent :
  2 en normal, 3 en threaded. Ils couvrent l'identité et la lecture de la
  cellule depuis PureScript, le dictionnaire distinct `Data_Lazy_lazyLazy`
  et le transfert de la valeur générée entre threads.

Commande de non-régression exécutée depuis `purust/purust` :

```sh
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_LAZY_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/lazy-fixed-1zpVDj node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

**65 tests Node passés**, zéro échec, sortie **0**, environ **104,32 s**
(47 codegen et 18 TAST). L'option de conservation est facultative : sans elle,
le test Lazy supprime uniquement son propre dossier temporaire. Preuves du
dernier test Lazy, après formatage :
[`commands.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/purust-lazy-tast-MZ9YZq/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/purust-lazy-tast-MZ9YZq/provenance.json).

**Intégration b8x et prochain blocage mesuré :**

`node prepare.mjs` a régénéré **211 modules TAST** dans
[`prepare-QlQ5st`](../../b8x/run/bak/rust/output/prepare-QlQ5st/manifest.json).
Le diagnostic neuf [`lazy-fixed-1zpVDj/audit.mjs`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/audit.mjs)
a généré les 211 modules Rust, sortie **0**, avec son propre `.purmeta`.
L'inventaire mesure **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**
et **9 sans référence hors définition**. Now et Console restent de vraies FFI ;
`Data_Lazy_defer` et `Data_Lazy_force` le sont désormais aussi. Empreintes et
résolution : [`generation.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/generation.json) ;
références : [`symbols.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/symbols.json).
La FFI testée et la FFI utilisée par b8x ont la même empreinte.

Cargo complet retourne **101**, maintenant sur `Purs_Effect_Aff_Class` :
**9 erreurs `E0308`** (`Value` attendu, `Arc<MonadAff>` produit) et
**9 erreurs `E0609`** (champs `liftAff`/`MonadEffect0` lus sur un `Value`).
Premier exemple : `Effect_Aff_Class_monadAffAff`, ligne 142 du Rust généré.
Le TAST frais contient bien `classDecls.MonadAff`, sa méthode `liftAff` et
sa superclasse `Effect.Class.MonadEffect` : il ne manque pas ce layout.
Diagnostic complet : [`cargo-check.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/cargo-check.json).

**Contrat réalisé en 0.9 — Astra :** isoler et corriger la représentation du
dictionnaire `Effect.Aff.Class.MonadAff`, en vérifiant notamment la règle
générale qui classe les types des modules `Effect_Aff*` comme `UnknownType`.
Préserver l'ABI des valeurs Aff tout en utilisant le layout TAST de la classe.
Ajouter une régression native normale/threaded pour la construction du
dictionnaire, `liftAff` et la projection de superclasse, puis relancer b8x et
relever le blocage suivant. Ne pas modifier la FFI Aff pour masquer un défaut
de représentation de dictionnaire. Luna intervient après validation du
premier correctif sémantique, pour des extensions de tests précisément bornées.

M1 reste incomplet : aucune spec b8x exécutée en Rust à ce stade.

### Micro-étape 0.9 — Dictionnaire MonadAff natif corrigé

Réalisée avec Astra le 11 septembre 2026.

La règle de [`CodeGen.purs`](src/Purust/CodeGen.purs) qui traitait tous les
modules préfixés `Effect_Aff` comme `UnknownType` englobait à tort la classe
`Effect.Aff.Class.MonadAff`. Elle est remplacée par les noms exacts des modules
de runtime déjà opaques : `Effect.Aff`, `Effect.Aff.AVar` et `Effect.Aff.Compat`.
La classe retrouve ainsi sa représentation native fournie par le layout TAST,
sans changer l'ABI des valeurs Aff ni celle de leurs wrappers.

Avant correction, la nouvelle régression obtenait `crate::UnknownType` au
lieu de `Rc<crate::MonadAff>` et échouait. Après correction, le Rust de b8x
déclare `Effect_Aff_Class_monadAffAff() -> Arc<crate::MonadAff>` et le premier
argument de `Effect_Aff_Class_liftAff` est ce dictionnaire natif. Les 18 erreurs
`E0308`/`E0609` précédentes ne sont plus le blocage Cargo.

**Validation :**

- [`tests/codegen/aff-class.mjs`](tests/codegen/aff-class.mjs) : test de
  représentation et régression Rust en **normal et threaded**. Construction
  native du dictionnaire, capture et identité de la superclasse, méthode
  `liftAff`, conservation d'un contenu opaque et absence d'exécution anticipée
  d'une fonction rejouable. Les représentations opaques Aff/ParAff/Supervisor,
  Fiber/Canceler/FFIUtil et des wrappers Compat sont vérifiées, ainsi que la
  représentation native inchangée d'`Effect.AVar.AVar`.
- [`tests/tast/aff-class.mjs`](tests/tast/aff-class.mjs) : le vrai
  `purust-aff/src/Effect/Aff/Class.purs`, ses instances et le consommateur
  [`AffClassProbe.purs`](tests/tast/fixtures/aff-class/AffClassProbe.purs) passent
  par **120 modules TAST frais**, puis par le nouveau backend et Cargo.
  `cargo check` et `cargo test` retournent **0**. Le test Rust utilise la vraie
  FFI Aff et son exécuteur : `viaAff` conserve l'identité du descripteur natif,
  `viaEffect` projette la superclasse, et quatre exécutions explicites sont
  comptées, sans aucune exécution lors de la construction ou du lifting.
  Cette régression sur l'exécuteur Aff est **threaded** ; le mode normal est
  couvert pour la représentation des dictionnaires, pas pour l'exécuteur Aff.
- Aucun changement de la FFI Aff ni de PBO. L'empreinte de la FFI Aff est
  identique à celle du diagnostic 0.8 et à celle utilisée par le test :
  `f7a382756ef00bbdb4c61f20f936685016b0ce5a3b1aefb20fbb8e6eacfbcf62`.

**Reconstruction et non-régression complète :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PATH="$PWD/node_modules/.bin:$PATH" ./node_modules/.bin/spago bundle --offline --module Main --platform node --outfile bin/purust.js --bundle-type app
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_AFF_CLASS_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/monadaff-fixed-m5tgGr node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

Build/bundle : sortie **0**, zéro erreur, **65 avertissements** lors de cette
recompilation incrémentale, non traités ici. Nouveau bundle suivi, SHA-256 :
`9956b4910d75e5e2f9931ccd0b154d0f4e3236673e1ee32d622189bfc3443b3c`.
**67 tests Node passés** (48 codegen et 19 TAST), zéro échec, sortie **0**,
environ **113,37 s**. L'option de conservation des résultats Aff est facultative.
Preuves du dernier test TAST :
[`commands.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/purust-aff-class-tast-0cjYSl/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/purust-aff-class-tast-0cjYSl/provenance.json).

**Graphe b8x :**

`node prepare.mjs` a recompilé les **211 modules** dans
[`prepare-g4cpfC`](../../b8x/run/bak/rust/output/prepare-g4cpfC/manifest.json).
Le diagnostic neuf [`monadaff-fixed-m5tgGr/audit.mjs`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/audit.mjs)
a généré les 211 modules Rust, sortie **0**, avec un `.purmeta` isolé.
Inventaire inchangé : **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**
et **9 sans référence hors définition**. Now, Console et Lazy restent les
vraies FFI. Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/cargo-check.json).

Cargo retourne **101** sur le blocage suivant : **8 erreurs `E0308`** dans
`Purs_Control_Monad_Free`, fonction `Control_Monad_Free_freeMonadRec`.
Aux lignes 423–435 du Rust produit, des tests/projections des constructeurs
`Control.Monad.Rec.Class.Step.Loop` et `Done` sont appliqués à un `&Val`.
Le commentaire généré montre lui-même l'écart : annotation `Rc<Step>`,
expression locale `Rc<Val>`. Ce relevé ne tranche pas encore entre une
annotation obsolète, une instanciation mal propagée et une conversion absente.

**Baby step suivant, réalisé en 0.10 — Astra :** isoler `freeMonadRec` et corriger cette
confusion `Val`/`Step` à partir du TAST et d'un reproducteur exécuté.
Préserver les deux layouts et les sémantiques de `Loop`/`Done`, sans cast
non vérifié ni effacement global des types. Ajouter une régression native
normale/threaded qui exerce les deux branches, vérifier Cargo sur le
reproducteur, puis relancer b8x et relever le blocage suivant. Ne pas étendre
ce correctif aux FFI restantes. Luna pourra étendre les cas après validation
du premier correctif sémantique.

M1 reste incomplet : les régressions isolées passent, mais aucune spec b8x
n'a encore été exécutée en Rust.

### Micro-étape 0.10 — Frontière existentielle de freeMonadRec corrigée

Réalisée le 11 septembre 2026.

Le reproducteur [`tests/tast/free-monad-rec.mjs`](tests/tast/free-monad-rec.mjs)
compile le vrai package `free-7.1.0` et un consommateur, soit **91 modules TAST
frais**. Avant correction, il reproduit les **8 erreurs `E0308`** `Val`/`Step`
de b8x, sortie Cargo **101**. Le TAST associe bien `Step a b` au paramètre de
la continuation de `freeMonadRec`. Dans la source, `freeBind` conserve cette
continuation via `unsafeCoerceBind :: (a -> Free f b) -> Val -> Free f Val`.
`dataDecls.Val` n'a aucun constructeur : `Val` sert de conteneur existentiel,
pas de valeur d'un enum habité que Rust pourrait construire.

Le backend représentait ce conteneur par `Rc<Val>`/`Arc<Val>` et tentait de
tester/projeter `Loop` et `Done` directement dessus. La correction dans
[`CodeGen.purs`](src/Purust/CodeGen.purs) représente **uniquement
`Control.Monad.Free.Val` par `Value`**. Les conversions existantes récupèrent
alors le vrai `Rc<Step>`/`Arc<Step>` par un downcast vérifié. `Free`, `FreeView`
et `Step` gardent leurs layouts natifs ; aucune modification de leurs
déclarations TAST, de PBO, des sources du package `free`, ni des FFI.
Les types `Val` d'autres modules ne sont pas concernés.

**Régressions :**

- [`tests/codegen/free-val.mjs`](tests/codegen/free-val.mjs) verrouille la
  portée exacte de la représentation et les layouts natifs conservés.
- Le test TAST vérifie le `Val` sans constructeur, l'absence de référence
  native à `Val` et la présence de la conversion vérifiée vers `Step`.
  `cargo check` et `cargo test` passent en **normal et threaded**.
- **5 tests Rust par mode** : `Loop`/`Done` avec zéro, une et plusieurs
  itérations (jusqu'à 1000), chemins purs et suspendus ; identité d'un tableau
  et rejeu d'un `Free` partagé ; compte exact des continuations et résultat
  final d'un autre type ; retour d'une fonction sans exécution anticipée,
  identité et rejeu ; rejet d'un payload natif incorrect à la frontière `Step`.
  Le compteur observe aussi la construction immédiate de `k(seed)`, conforme
  à l'implémentation, sans la confondre avec les continuations différées.

**Reconstruction :** même commande `spago bundle --offline` qu'en 0.9,
sortie **0**, zéro erreur et **65 avertissements** lors du build incrémental,
non traités ici. Bundle suivi, SHA-256 :
`942d1ac450b63a19d68378f18a50a9891fdadd742f50d4dd5c0d66cae3212a93`.

**Non-régression complète :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_FREE_MONAD_REC_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

**69 tests Node passés** (49 codegen, 20 TAST), zéro échec, sortie **0**,
environ **134,19 s**. Ce sont des régressions du compilateur/runtime, pas des
tests b8x. Preuves du test TAST Free :
[`commands.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/purust-free-monad-rec-tast-fISwXs/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/purust-free-monad-rec-tast-fISwXs/provenance.json).
L'empreinte du bundle y est identique à celle du diagnostic b8x.
`git diff --check`, les vérifications de syntaxe Node et `rustfmt --check`
sur les nouveaux tests passent aussi.

**Graphe b8x :**

Préparation neuve de **211 modules** :
[`prepare-10Rtjb/manifest.json`](../../b8x/run/bak/rust/output/prepare-10Rtjb/manifest.json).
Génération diagnostique **0**, `.purmeta` isolé :
[`free-monad-rec-fixed-yK3WWL/audit.mjs`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/audit.mjs).
Inventaire inchangé : **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**
et **9 sans référence hors définition**. Cargo franchit `Control.Monad.Free`
et retourne **101** sur **3 erreurs `E0425`** dans `Purs_Pipes_Internal` :
`crate::X` absent, aux lignes 173 (`Pipes_Internal_X`) et 609
(`Pipes_Internal_closed`) du Rust produit. La source contient
`newtype X = X X` ; aucun layout `dataDecls.X` n'est présent. Ce constat
n'est pas encore un diagnostic complet de la représentation de ce newtype.

Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/cargo-check.json).

**Baby step suivant, réalisé en 0.11 — Astra :** isoler le newtype récursif `Pipes.Internal.X`
et `closed`, déterminer leur représentation à partir du TAST et corriger la
génération sans fabriquer une valeur de ce type impossible ni généraliser
l'effacement des ADT. Vérifier le reproducteur en normal/threaded, puis le
graphe b8x et relever le blocage suivant. Ne pas porter d'autres FFI dans ce
correctif. Luna pourra étendre les cas après validation du choix sémantique.

M1 reste incomplet : aucun test b8x n'a encore été exécuté en Rust.

### Micro-étape 0.11 — Pipes.Internal.X corrigé, premier cargo check b8x réussi

Réalisée le 11 septembre 2026.

Le TAST frais de `pipes-8.0.0/src/Pipes/Internal.purs` décrit le constructeur
`X` avec la métadonnée `IsNewtype`, une abstraction identité et la signature
`X -> X`. Aucun `dataDecls.X` n'est présent. La source est bien
`newtype X = X X`, suivie de `closed (X x) = closed x` : ce type récursif
n'a pas de valeur finie constructible. Le backend demandait pourtant
`Rc<crate::X>`/`Arc<crate::X>`, sans déclaration native correspondante.

La règle dans [`CodeGen.purs`](src/Purust/CodeGen.purs) associe le nom qualifié
**`Pipes.Internal.X` à `purust_core::Void`**, l'enum vide déjà fourni par le
runtime. `X` reste une fonction identité `Void -> Void` ; `closed` conserve
sa boucle et son argument de type vide. Aucun `Value`, faux constructeur ou
cast non vérifié ne permet de fabriquer un `X`. `Proxy` reste natif et les
autres types nommés `X` sont inchangés. Cette règle est limitée à ce contrat
de bibliothèque, pas une détection générale des newtypes récursifs.
Aucun changement de PBO, des sources de `pipes` ni des FFI.

**Reproducteur et validation :**

- [`tests/tast/fixtures/pipes-x/Pipes/Internal.purs`](tests/tast/fixtures/pipes-x/Pipes/Internal.purs)
  reprend uniquement les déclarations `X`/`closed` du package. Avec son
  consommateur et la vraie FFI `Unsafe.Coerce`, il forme un reproducteur de
  **3 modules TAST frais**, distinct du graphe réel b8x.
- Avant correction, ce reproducteur donne les mêmes **3 erreurs `E0425`**
  que b8x, sortie Cargo **101**. Après correction, `cargo check` et
  `cargo test` passent en **normal et threaded**.
- **5 tests Rust par mode** : signatures natives et preuve d'inhabitation
  impossible par `match value {}` ; transport de `closed` et de callbacks
  sans exécution, résultat et identité conservés ; rejet d'un faux `X`
  produit par `unsafeCoerce` ; rejet d'un argument invalide avant l'entrée
  dans la boucle d'un `closed` boxé ; ADT homonyme et newtype ordinaire natifs.
- [`tests/codegen/pipes-x.mjs`](tests/codegen/pipes-x.mjs) verrouille le nom
  qualifié, la représentation `Void` inchangée et celle de `Proxy` et des
  types `X` voisins. [`tests/tast/pipes-x.mjs`](tests/tast/pipes-x.mjs)
  vérifie aussi les métadonnées du TAST, pas seulement le Rust généré.

**Reconstruction :** même commande `spago bundle --offline` qu'en 0.9,
sortie **0**, zéro erreur et **65 avertissements** lors du build incrémental,
non traités ici. Bundle suivi, SHA-256 :
`8fb49f42b6cd1b4f94628659bc70e89e120bd67870660c01780d5400b2b68d79`.

**Non-régression complète :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_PIPES_X_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

**71 tests Node passés** (50 codegen, 21 TAST), zéro échec, sortie **0**,
environ **141,05 s**. Ce sont les régressions compilateur/runtime, pas les
specs b8x. Preuves du test minimal :
[`commands.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/purust-pipes-x-tast-6tN6pe/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/purust-pipes-x-tast-6tN6pe/provenance.json).
L'empreinte du bundle est identique dans ce test et le diagnostic b8x.
`git diff --check`, les vérifications de syntaxe Node et `rustfmt --check`
des nouveaux tests passent également.

**Graphe réel b8x :**

[`prepare-nPjDfC/manifest.json`](../../b8x/run/bak/rust/output/prepare-nPjDfC/manifest.json)
consigne **211 modules TAST frais**, dont le vrai `Pipes.Internal` inchangé.
Le diagnostic neuf
[`pipes-x-fixed-OtEWpV/audit.mjs`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/audit.mjs)
génère les 211 modules Rust avec un `.purmeta` isolé, sortie **0**.
Leurs signatures `X`/`closed` utilisent bien `purust_core::Void` et le
`cargo check --offline` du workspace complet retourne désormais **0**,
environ **11,68 s**. Aucun nouveau blocage de typage n'est détecté.

Inventaire FFI inchangé : **42 fichiers**, **25 fallbacks**, dont
**16 référencés** et **9 sans référence hors définition**. Ils empêchent de
conclure au support d'exécution ; leur présence ne prouve pas non plus
qu'ils seront tous atteints par ce test. Aucun binaire b8x n'a été lancé.
Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/cargo-check.json).

**Baby step suivant, réalisé en 0.12 — Astra :** construire puis lancer le profil minimal
b8x en diagnostic borné, avec stdout/stderr, code de sortie et backtrace
conservés. Utiliser un diagnostic neuf et des sources/bundle identifiés.
Relever le premier blocage de build ou d'exécution réellement observé
(fallback FFI, runtime ou génération), l'isoler si nécessaire, puis définir
le correctif suivant. Ne pas porter plusieurs FFI à l'aveugle ni compter
une exécution interrompue comme une spec passée. Luna pourra porter les
cas répétitifs une fois le contrat correspondant validé.

M1 reste incomplet : `cargo check` passe, mais aucun test b8x n'a encore été
exécuté en Rust, et les fixtures positive/négative restent à valider.

### Micro-étape 0.12 — Premier lancement b8x et blocage réel du résumé

Réalisée le 11 septembre 2026. Diagnostic uniquement : aucun correctif du
compilateur, du runtime ou des FFI n'a été appliqué pendant cette étape.

**Préparation et provenance :**

- [`prepare-EjHcws/manifest.json`](../../b8x/run/bak/rust/output/prepare-EjHcws/manifest.json) :
  **211 modules TAST frais**, point d'entrée et specs inchangés.
- Diagnostic neuf, génération et `cargo check` réussis :
  [`first-execution-Kk5IGG/audit.mjs`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/audit.mjs).
  **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**, inchangés.
- Bundle identique à celui de 0.11, SHA-256 :
  `8fb49f42b6cd1b4f94628659bc70e89e120bd67870660c01780d5400b2b68d79`.
  Les empreintes des sources, des FFI, de **431 fichiers natifs/manifests**
  et du binaire sont conservées et revérifiées après l'exécution.
- `.purmeta`, Cargo et binaire restent dans ce nouveau diagnostic ; les
  profils/liens JS existants sont inchangés. Aucune intégration externe
  n'est ajoutée au graphe sélectionné.

**Build et lancement :**

```sh
cd /Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/first-execution-Kk5IGG
node audit.mjs
node build-run.mjs
```

Ces scripts refusent d'écraser un diagnostic déjà réalisé : pour répéter,
créer un nouveau dossier et sélectionner un manifeste de préparation neuf.
[`build-run.mjs`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/build-run.mjs)
exécute un `cargo build --offline -p purust_output --bin purust_output`
avec cible Cargo explicitement isolée, puis le binaire debug avec
`RUST_BACKTRACE=full`. Bornes : **60 s** pour le build, **15 s** pour le
lancement ; arrêt du groupe de processus en cas de dépassement.

- Build et édition de liens : sortie **0**, environ **15,20 s**.
- Binaire lancé : sortie **101**, environ **0,54 s**, sans timeout ni signal.
- SHA-256 du binaire :
  `17bfd58dcb540e25b605358cdc49402cbbcae1e249f2e479f847bd15347a7c76`.

**Résultats observés, sans les compter comme un portage réussi :**

Le reporter atteint les deux cas de la spec originale. Il affiche un échec
pour `encodes HTML entities` (`""` reçu au lieu de `"&#x3C;div&#x3E;"`) puis
un succès pour `handles empty strings`. Le Rust produit confirme que
`_encodeHtmlEntities` est encore un fallback `String::new()` ; le cas vide
est donc un **faux signal de validation du portage**, pas une preuve que
l'encodage Rust fonctionne. La vraie FFI HTML reste à écrire. Les assertions
suivantes du premier cas ne sont pas validées par cette exécution.

Le **premier arrêt fatal** est ensuite la panic `not implemented` dans
`Record_Unsafe_unsafeSet`, ligne 26 du Rust généré. La backtrace relie :

`consoleReporter / printSummary` → `Test.Spec.Summary.summarize` →
`monoidCount` → `Data.Semiring.semiringRecordCons` → `Record.Unsafe.unsafeSet`.

Le résumé initialise ses compteurs avec `Count zero`. La FFI existante
[`purust-prelude/src/Record/Unsafe.rs`](../purust-prelude/src/Record/Unsafe.rs)
ne fournit que `unsafeGet` et `unsafeHas` : `unsafeSet` est donc bien un
fallback manquant atteint en pratique. Aucun bilan final fiable ni contrôle
final « deux succès » n'est obtenu. La sortie 101 prouve cette panic, pas
encore le bon code de sortie d'une spec négative terminée normalement.

**Preuves conservées :**
[`build.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/build.json),
[`execution.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution.json),
[`stdout`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution.stdout.log),
[`backtrace complète`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution.stderr.log),
[`execution-provenance.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution-provenance.json)
et [`binary.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/binary.json).
Les checks de syntaxe des scripts et `git diff --check` passent. Les
**71 régressions de 0.11 ne sont pas relancées** : aucun code fonctionnel
n'a changé dans ce diagnostic.

**Baby step suivant, réalisé en 0.13 — Astra :** isoler puis implémenter uniquement
`Record.Unsafe.unsafeSet`, en partant de `zero :: { failed :: Int, passed :: Int,
pending :: Int }` et du résumé réel. La FFI JS crée une copie : couvrir
l'ajout et le remplacement d'un champ, la conservation des autres champs
et l'absence de mutation du record original partagé. Déterminer la bonne
transition entre les formes de records à partir du TAST/runtime, sans
effacer globalement leurs layouts ni exposer ces détails dans la FFI.
Valider `zero`, l'addition des compteurs et les résumés succès/échec/pending
par un reproducteur TAST en normal/threaded, puis relancer b8x et s'arrêter
au prochain blocage. Ne pas porter `unsafeDelete` ou la FFI HTML dans ce
même correctif ; ne pas remplacer les fallbacks restants par des succès.
Luna pourra compléter les cas répétitifs après validation de ce contrat.

M1 reste incomplet : **le binaire et les cas b8x s'exécutent désormais**, mais
avec un encodeur placeholder et un résumé interrompu ; les deux vrais
succès HTML et la fixture négative restent à valider.

### Micro-étape 0.13 — `Record.Unsafe.unsafeSet` et résumé Spec fonctionnel

Réalisée le 11 septembre 2026. Périmètre : cette FFI, le support des records
dans le générateur et leurs régressions. Ni `unsafeDelete`, ni la FFI HTML,
ni le runtime Aff n'ont été modifiés.

**Reproduction puis correction :**

- Le reproducteur compile **123 modules TAST frais**, dont le vrai
  `Test.Spec.Summary`. Avant correction, Cargo check réussit mais les trois
  tests Rust échouent sur le fallback `Record_Unsafe_unsafeSet` :
  [`commands.json du cas rouge`](/private/tmp/purust-record-set-tast-lAE5aG/commands.json).
- [`Record/Unsafe.rs`](../purust-prelude/src/Record/Unsafe.rs) délègue à
  `record.__purust_set_field(&field, value)`. La FFI ne dépend pas des
  structures de records générées.
- [`CodeGen.purs`](src/Purust/CodeGen.purs) conserve les formes natives pour
  les champs qu'elles peuvent contenir. L'ajout d'un champ hors forme passe
  seulement ce record dans `DynamicRecord`, un `BTreeMap<String, Value>`
  partagé par `PerceusPtr`. Les mises à jour utilisent le copy-on-write ;
  l'extension conserve les valeurs présentes sans exécuter les fonctions
  qu'elles contiennent. Aucun effacement global des layouts TAST.
- Les lectures ordinaires, empruntées et FFI, ainsi que les setters ordinaires,
  prennent en charge cette représentation d'extension. Les clés dynamiques
  utilisent leurs labels exacts, pas les identifiants Rust assainis.

**Régressions :**

- [`record-set-ffi.mjs`](tests/codegen/record-set-ffi.mjs) : ajout/remplacement,
  conservation des champs et des originaux partagés, clés connues seulement
  à l'exécution et réservées, copie superficielle, fonctions différées,
  libération des captures, thunk mémoïsé, rejet des non-records et mises à
  jour concurrentes indépendantes. **6 nouveaux tests Rust en normal et 7
  en threaded** ; le harness normal exécute aussi 4 tests du pointeur partagé.
- [`record-set.mjs`](tests/tast/record-set.mjs) : `zero`, addition des compteurs,
  résumé vide et résumé réel imbriqué (**2 succès, 1 échec, 1 pending**),
  extension d'une forme native puis projection/mise à jour ordinaires.
  **3 tests Rust par mode**, Cargo check/test réussis en normal et threaded.
- Suite complète : **73 tests Node passés, zéro échec**, environ **165,71 s**.
  Ce total couvre le compilateur/runtime, pas 73 specs b8x. Commande :

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs \
PURUST_RECORD_SET_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T \
node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

Preuves du reproducteur conservé lors de cette suite :
[`commands.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/purust-record-set-tast-Azaxsb/commands.json),
[`provenance.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/purust-record-set-tast-Azaxsb/provenance.json).
Bundle reconstruit hors ligne avec succès (**65 avertissements incrémentaux,
0 erreur**), contrôles de syntaxe Node, rustfmt et `git diff --check` réussis.
SHA-256 du bundle :
`689c42cfe194acc820ab0b1c276f321487fa0776b9e5c7c6c1ca7ce422b937f9`.
SHA-256 de la FFI `Record/Unsafe.rs` :
`d3539ecf80f9335b4972a14c2ea74f588d3936d590cfd15c19035cc505c8f293`.

**Nouvelle exécution b8x :**

Préparation neuve :
[`prepare-W1na2s/manifest.json`](../../b8x/run/bak/rust/output/prepare-W1na2s/manifest.json),
**211 modules TAST frais**, spec et point d'entrée inchangés. Diagnostic
[`unsafe-set-fixed-hPBD3T`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/generation.json)
avec caches/sorties isolés et empreintes revérifiées. Les scripts `audit.mjs`
et `build-run.mjs` suivent les mêmes commandes et bornes qu'en 0.12 et
refusent de réutiliser leurs sorties ; créer un dossier neuf pour répéter.

- **42 fichiers FFI**, **24 fallbacks**, dont **15 référencés** et 9 présents
  seulement comme définitions. `unsafeSet` provient désormais de la vraie FFI.
- Cargo check : **0** ; build/édition de liens : **0**, environ **16,01 s**.
- Exécution : **101**, environ **0,40 s**, sans timeout ni signal, stderr vide.
  Le reporter affiche l'échec d'encodage puis le cas vide vert, et termine
  cette fois son résumé : **`1/2 tests passed`**. La panic de fallback
  `unsafeSet` de 0.12 n'interrompt plus le résumé.
- Le point d'entrée exige toujours deux succès et lève une erreur Aff sinon.
  La sortie non nulle est observée après le résumé ; son message n'est pas
  imprimé. Le runtime existant remonte les exceptions via `resume_unwind`,
  sans hook de panic. Le contrat complet positif/négatif du runner et ses
  diagnostics restent à valider, sans compter ce lancement comme M1 réussi.
- Le blocage fonctionnel observé reste `_encodeHtmlEntities`, dont le Rust
  généré renvoie encore `String::new()`. Le test vide est toujours un faux
  signal de validation du portage ; aucune FFI HTML n'a été ajoutée.

Preuves :
[`symbols.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/cargo-check.json),
[`build.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/build.json),
[`execution.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/execution.json),
[`provenance native`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/execution-provenance.json),
[`binary.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/binary.json).

**Baby step suivant, réalisé en 0.14 — Astra :** porter le seul fichier
`b8x/src/Util/Html/Encode/Encode.rs` selon le contrat 0.1. Vérifier les deux
symboles conservés (encodage et décodage), établir une parité ciblée avec
la FFI Node réelle, puis tester l'implémentation native générale, y compris
les entités et Unicode. Ne pas coder uniquement les quatre exemples ni
retoucher Cargo à la main pour masquer une dépendance non propagée.
Relancer les deux tests b8x originaux avec TAST frais et sans fallback HTML ;
s'arrêter au prochain écart observé. Luna pourra compléter les cas répétitifs
une fois le contrat validé. La fixture négative et le contrat de sortie final
restent un contrôle séparé avant M1.

### Micro-étape 0.14 — Vraie FFI HTML et deux tests b8x réussis

Réalisée les 11–12 septembre 2026. Premier fichier FFI local b8x :
[`src/Util/Html/Encode/Encode.rs`](../../b8x/src/Util/Html/Encode/Encode.rs).
Les deux fonctions étrangères sont implémentées : `_encodeHtmlEntities` et
`_decodeHtmlEntities`. Le TAST frais confirme dans les deux cas le contrat
`String -> String`, devenu `String -> String` côté Rust. Aucun changement
du compilateur, du runtime, des specs originales ou du point d'entrée.

**Contrat et représentation :**

- Référence : la FFI Node réelle de b8x et son package local **he 1.2.0**,
  avec les options par défaut. Le harness exige que la FFI JS générée soit
  identique au fichier source courant. Cela renouvelle la référence du FFI,
  mais pas la compilation JS complète de la spec, encore requise avant M1.
- Encodage hexadécimal majuscule ; décodage HTML en contexte texte, tolérant,
  en une seule passe, avec noms sensibles à la casse, formes historiques
  sans point-virgule et corrections des références numériques invalides.
  Références de contrat : [he](https://github.com/mathiasbynens/he) et
  [noms HTML](https://html.spec.whatwg.org/multipage/named-characters.html).
- Les `String` de purust contiennent des unités UTF-16 représentées par des
  scalaires Rust décalés, pas directement du texte UTF-8. L'encodeur utilise
  `purust_string_to_utf16` pour distinguer les paires et surrogates isolés ;
  le décodeur conserve les unités brutes et convertit les entités via
  `purust_string_from_utf8`. Aucune conversion UTF-8 avec perte.
- Le générateur ne propage pas encore des dépendances Cargo propres aux FFI.
  Ce fichier est donc autonome, avec la bibliothèque standard Rust et une
  table complète intégrée de **2 231 entrées** (2 125 noms avec point-virgule
  et 106 formes historiques). Table issue de he 1.2.0, licence MIT conservée
  dans le fichier. Aucun ajout de crate ni retouche de Cargo.toml généré.
- [`html-entities-table.mjs`](../../b8x/run/bak/rust/tests/html-entities-table.mjs)
  reproduit la table depuis la dépendance JS locale et peut imprimer son
  patch avec `--patch`. Le test vérifie que la table embarquée correspond
  exactement ; aucune génération ni dépendance Node n'est requise à l'exécution
  du binaire Rust. Le fichier FFI contient 2 377 lignes, principalement ces
  données générées ; ne pas maintenir les noms à la main.

**Parité native :**

```sh
cd /Users/0x1/Documents/htdocs/b8x
node run/bak/rust/tests/html-entities.mjs
```

**22 722 cas passés en normal, puis les mêmes 22 722 en threaded**, avec les
vrais helpers UTF-16 du compilateur et le vrai fichier FFI. Couverture :

- Les quatre assertions d'encodage et les exemples des quatre tests de
  décodage existants ; ces derniers sont vérifiés ici en natif, leur spec
  PureScript complète n'est pas ajoutée au profil des deux tests d'encodage.
- Chaque entrée de la table et ses suffixes ambigus ; références décimales,
  hexadécimales, hors Unicode, surrogates numériques et remplacements C1.
- Tous les **1 112 064 scalaires Unicode**, testés par blocs, et les
  **65 536 unités UTF-16**, dont surrogates isolés ; chaînes mixtes et sans
  entités, contrôles, non-caractères, références imbriquées non redécodées.
- Longues entrées adverses et 1 000 chaînes mixtes pseudo-aléatoires
  reproductibles. Le transport du harness préserve les unités UTF-16.

Preuve : [`html-ffi-J43vzv/parity.json`](../../b8x/run/bak/rust/output/html-ffi-J43vzv/parity.json),
avec empreintes FFI, he, harness, helpers, entrée et résultats des deux modes.
FFI SHA-256 :
`b3df1fc1f5a4fb1826838c5174f8f63dba63b9197b41d45429d78ca7db636bcb`.
he.js SHA-256 :
`76c554d5bbfd032fe620595076a50abea5124b9cbd4e9ffe6ac94a4f855aeceb`.
La première compilation isolée a révélé une double référence dans `peek()` ;
corrigée avant les deux validations de parité. Les **73 régressions de 0.13
ne sont pas relancées** : aucun code du compilateur/runtime n'a changé.

**Tranche b8x réelle :**

Préparation hors ligne neuve de **211 modules TAST** :
[`prepare-UCJhUa/manifest.json`](../../b8x/run/bak/rust/output/prepare-UCJhUa/manifest.json).
La première tentative sandboxée ne pouvait pas ouvrir le cache SQLite global
Spago ; la préparation autorisée hors sandbox réussit. Sources et sorties JS
existantes préservées. Bundle identique à 0.13, SHA-256 :
`689c42cfe194acc820ab0b1c276f321487fa0776b9e5c7c6c1ca7ce422b937f9`.

Diagnostic neuf :
[`html-ffi-fixed-QCPrdm/audit.mjs`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/audit.mjs),
puis [`build-run.mjs`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/build-run.mjs).
Les scripts utilisent un répertoire neuf et refusent d'écraser les résultats.
Les deux symboles HTML sont présents une seule fois, et le fichier FFI réel
est inclus intégralement dans le Rust généré.

- **43 fichiers FFI**, **22 fallbacks**, dont **13 référencés** et 9 présents
  seulement comme définitions ; plus aucun fallback HTML.
- Cargo check : **0**, environ **8,91 s** ; build/édition de liens : **0**,
  environ **14,90 s**.
- Binaire : **sortie 0**, environ **0,57 s**, sans timeout ni signal, stderr
  vide. Les deux tests originaux passent, avec leurs quatre assertions :
  `encodes HTML entities` et `handles empty strings`. Résumé complet :
  **`2/2 tests passed`**. Le contrôle final exige deux succès, zéro échec
  et zéro pending. Aucun succès déduit seulement du code de sortie.
- Les empreintes des sources, FFI, bundle et fichiers natifs sont vérifiées
  avant et après l'exécution. Les liens et scripts JS/Go/PHP restent inchangés.
  Syntaxe Node, rustfmt et `git diff --check` réussis.

Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/cargo-check.json),
[`build.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/build.json),
[`execution.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/execution.json),
[`provenance native`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/execution-provenance.json),
[`binary.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/binary.json).

**Baby step suivant, réalisé en 0.15 avec un écart restant — Astra :** valider une fixture volontairement fautive
avec la vraie FFI HTML, dans une entrée diagnostique séparée, sans modifier
les specs b8x. Exiger une assertion effectivement échouée, un résumé cohérent,
une terminaison bornée et un code non nul ; distinguer l'échec attendu d'une
panic de fallback. Vérifier les messages d'erreur (la levée finale Aff de
0.13 n'imprimait pas son message). Revalider le contrôle positif et renouveler
la référence JS de la spec avec compilation fraîche et sorties isolées.
S'arrêter au premier écart observé, sans intégrer encore `bin/test` ni porter
d'autres FFI. Luna peut exécuter les variantes une fois les commandes et le
contrat d'erreur stabilisés.

M1 reste incomplet tant que ce contrôle négatif, la référence JS fraîche et
la qualification des fallbacks pertinents ne sont pas validés. L'exécution
positive des deux tests avec une vraie FFI Rust est désormais acquise.

### Micro-étape 0.15 — Contrôle négatif et référence JS fraîche

Réalisée le 12 septembre 2026. Diagnostic et régressions seulement : aucun
changement des specs b8x, de la FFI HTML, du compilateur, du runtime ou des
scripts partagés `bin/test`. Arrêt au premier écart de comportement confirmé.

**Fixture et commandes reproductibles :**

La nouvelle entrée
[`Test.Rust.HtmlNegative.Main`](../../b8x/run/bak/rust/tests/fixtures/html-negative/Main.purs)
exécute les deux tests originaux, puis ajoute une assertion volontairement
fausse : `encodeHtmlEntities "<div>" =? "INTENTIONAL_HTML_MISMATCH"`.
Elle attend le résultat de Spec, imprime les compteurs exacts, puis lève
`HTML_NEGATIVE_EXPECTED_FAILURE` si les trois tests ne sont pas tous réussis.
Le contrôle positif conserve le point d'entrée original sans modification.

```sh
cd /Users/0x1/Documents/htdocs/b8x
node run/bak/rust/tests/html-runner.mjs
```

Le harness recrée les graphes et sorties JS/TAST/Rust dans un dossier neuf.
Il utilise les sources déjà présentes des lockfiles JS et Rust, sans fetch,
service externe ou changement de profil. **212 modules JS frais** par cas,
avec `spec` **8.1.1** ; **211 modules TAST frais** par cas, avec l'override
`purust-spec` **8.1.2**. La dépendance de la FFI JS vers `Util.Runtime`,
invisible au graphe PureScript, est explicitement incluse côté JS.
Un lien `node_modules` est créé seulement dans le nouveau diagnostic, vers
les dépendances existantes du profil JS ; les liens racine restent inchangés.

**Résultats du lancement 0.15, avant le correctif 0.16 :**

| Cas | Résumé | Code processus | Erreur finale Aff sur stderr |
| --- | --- | --- | --- |
| JS positif | 2/2 | 0 | Sans objet |
| JS négatif | 2/3 | 1 | Présente |
| Rust positif, threaded | 2/2 | 0 | Sans objet |
| Rust négatif, threaded | 2/3 | 101 | **Absente** |

Les deux cas négatifs affichent l'assertion fautive avec la vraie valeur
`"&#x3C;div&#x3E;"`, puis `passed=2, failed=1, pending=0`. Le reporter affiche
donc bien le message d'assertion en Rust : l'écart concerne uniquement
l'erreur Aff finale **non interceptée**, après le résumé.

Les compilations JS et TAST, générations Rust et builds Cargo réussissent.
Builds Rust positif/négatif : environ **18,60 s / 18,24 s** ; exécutions :
**0,41 s / 0,37 s**. Aucun timeout ni signal. Les codes 1 et 101 satisfont
le critère « non nul » ; leur différence n'est pas le défaut identifié.
Les deux graphes Rust conservent **43 fichiers FFI**, **22 fallbacks** dont
**13 référencés**. Les deux symboles HTML proviennent de la vraie FFI locale.
Les fallbacks ne sont pas remplacés ou instrumentés pour ce diagnostic.

**Écart et régression rouge :**

Le runtime [`purust_aff_run_main`](../purust-aff/src/Effect/Aff.rs) attend les
fibres puis transmet son erreur finale à `purust_exception_raise`.
Dans [`Effect/Exception.rs`](../purust-exceptions/src/Effect/Exception.rs),
cette primitive utilise `resume_unwind`, volontairement sans hook de panic
pour que les exceptions interceptées ne produisent pas de diagnostic parasite.
À la frontière finale du programme, aucun affichage ne précède cette remontée :
le processus Rust échoue avec stderr vide, alors que JS affiche le marqueur
`HTML_NEGATIVE_EXPECTED_FAILURE` et sa stack.

[`verify-html-runner.mjs`](../../b8x/run/bak/rust/tests/verify-html-runner.mjs)
vérifie les quatre résultats et exige ce marqueur sur stderr des cas négatifs.
Il est appelé automatiquement à la fin du harness. La commande complète
termine donc désormais avec **sortie 1**, sur l'échec explicite :
`rust: the final uncaught Aff error message is missing from stderr`.
Les quatre exécutions ont terminé ; cela ne signifie pas que leur contrat
global est validé. Ne pas enlever cette vérification pour rendre le test vert.

Contrôle de la preuve conservée, sans recompilation :

```sh
node run/bak/rust/tests/verify-html-runner.mjs \
  run/bak/rust/output/html-runner-sl5K8G/report.json
```

**Preuves et provenance :**
[`report.json`](../../b8x/run/bak/rust/output/html-runner-sl5K8G/report.json),
[`JS positif`](../../b8x/run/bak/rust/output/html-runner-sl5K8G/js-positive-execution.json),
[`JS négatif`](../../b8x/run/bak/rust/output/html-runner-sl5K8G/js-negative-execution.json),
[`Rust positif`](../../b8x/run/bak/rust/output/html-runner-sl5K8G/rust-positive-execution.json),
[`Rust négatif`](../../b8x/run/bak/rust/output/html-runner-sl5K8G/rust-negative-execution.json),
[`FFI négatives`](../../b8x/run/bak/rust/output/html-runner-sl5K8G/rust-negative/foreign.json).
Le dossier contient également chaque commande de compilation/génération/build
et ses sorties. Un premier diagnostic `html-runner-Y0dOdI` avait déjà montré
le même écart ; le dernier lancement valide le harness final avec son assertion.

Empreintes des sources, lockfiles, FFI Rust, code généré et binaires vérifiées
après les exécutions. Le bundle est inchangé depuis 0.13 :
`689c42cfe194acc820ab0b1c276f321487fa0776b9e5c7c6c1ca7ce422b937f9`.
Fork : `0.15.16`, binaire développement `65010ea… DIRTY` identifié par SHA-256
dans le rapport. Syntaxe Node et `git diff --check` réussis. Les 73 régressions
compilateur/runtime et la parité FFI exhaustive de 0.14 ne sont pas relancées :
aucun de ces composants n'a changé.

**Baby step suivant, réalisé en 0.16 — Astra :** corriger seulement le reporting des erreurs
Aff non interceptées à la frontière `purust_aff_run_main`. Afficher une fois
l'erreur finale sur stderr, avec le nom/message et la conversion de chaîne
appropriée, puis conserver une sortie non nulle. Ne pas ajouter un affichage
global à `purust_exception_raise` : les erreurs interceptées doivent rester
silencieuses. Préserver l'attente des fibres, les nettoyages et les vraies
panics Rust. Ajouter un petit reproducteur couvrant succès, erreur interceptée,
erreur non interceptée (dont Unicode) et panic native, puis relancer les
régressions Aff pertinentes et `html-runner.mjs`. Luna pourra ensuite dérouler
les variantes au contrat stabilisé.

À l'issue de 0.15, M1 reste incomplet : la référence JS fraîche et les contrôles
positif/négatif sont acquis, mais le reporting final et la qualification des
fallbacks pertinents restent à terminer. Aucun portage supplémentaire dans
cette étape.

### Micro-étape 0.16 — Reporting final des erreurs Aff

Réalisée le 12 septembre 2026. Le changement de runtime se limite à neuf lignes
dans [`purust_aff_run_main`](../purust-aff/src/Effect/Aff.rs) : après l'attente
des fibres et la propagation prioritaire d'une éventuelle panic native,
formater l'erreur finale avec `Effect_Exception_showErrorImpl`, convertir la
chaîne PureScript vers UTF-8 avec `purust_string_to_utf8_lossy`, écrire une
ligne sur stderr, puis relever l'exception d'origine. Un échec d'écriture est
ignoré pour préserver cette exception. `purust_exception_raise`, les hooks
de panic, le compilateur et la FFI HTML restent inchangés.

**Régression rouge puis verte :**

[`error-reporting.mjs`](../purust-aff/test/error-reporting.mjs) compile
**107 modules TAST frais** et un exemple Cargo threaded, puis lance chaque
scénario dans un processus séparé, borné à 15 secondes. Il utilise les vraies
FFI et vérifie leurs empreintes après exécution. La fixture
[`Test.ErrorReporting`](../purust-aff/test/Test/ErrorReporting.purs) couvre :

- succès et erreurs Aff/Effect interceptées : sortie 0, stderr vide ;
- erreurs Aff et Effect non interceptées : nettoyages exécutés, nom/message
  Unicode exact sur stderr, affiché une seule fois, sortie 101 ;
- exception synchrone du main : l'enfant termine avant la sortie 101 ;
- panics Rust synchrones et dans Aff : diagnostic natif conservé, sans
  doublon ni reformatage en erreur PureScript ; l'enfant survivant termine ;
- stderr non inscriptible : le driver intercepte la remontée finale et
  vérifie le type ainsi que le nom/message de l'exception originale.

Avant le correctif, le cas Unicode échoue parce que stderr est vide :
[`preuve rouge`](</var/folders/w9/l8bnb22d6c75c401f71djbt00000gn/T/purust-aff-errors-LXcPxH/commands.json>).
Après le correctif, **9 scénarios passent** :
[`rapport vert`](</var/folders/w9/l8bnb22d6c75c401f71djbt00000gn/T/purust-aff-errors-FiRRsP/report.json>).
Ce test est également raccordé au runner complet
[`purust-aff/bin/test`](../purust-aff/bin/test), sans alourdir `--smoke`.

**Commandes et validations :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust-aff
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs ./bin/test

cd /Users/0x1/Documents/htdocs/b8x
node run/bak/rust/tests/html-runner.mjs
```

La suite Aff complète passe, y compris après raccordement des neuf nouveaux
scénarios : **45 contrôles Aff**, concurrence Ref/AVar, durées de vie et trois
sorties d'échec attendues ; runner global **sortie 0**.
[`Journal complet`](</tmp/purust-aff-suite-XXXXXX.log>) et
[`rapport des neuf scénarios intégrés`](</var/folders/w9/l8bnb22d6c75c401f71djbt00000gn/T/purust-aff-errors-zciNeQ/report.json>).
La compilation PureScript
fraîche du runner porte sur **242 modules**, sans erreur ni avertissement.
Un essai direct Spago avait utilisé le compilateur standard 0.15.15 : ses
sorties sans TAST ont été écartées puis régénérées avec le fork explicitement
sélectionné ; elles ne servent à aucune validation native.

Le harness HTML et son vérificateur terminent avec **sortie 0**. Chaque
contrôle repart de sources fraîches : **212 modules JS / 211 modules TAST**.
Les positifs terminent avec `2/2 tests passed`, sortie 0 et stderr vide.
Les négatifs terminent avec `2/3 tests passed`, les compteurs `2/1/0` et les
codes attendus non nuls (JS 1, Rust 101). Le Rust affiche exactement :

```text
Error: HTML_NEGATIVE_EXPECTED_FAILURE: the suite contains an intentional assertion failure
```

Preuves HTML :
[`rapport des quatre contrôles`](../../b8x/run/bak/rust/output/html-runner-4POjqb/report.json),
[`exécution Rust négative`](../../b8x/run/bak/rust/output/html-runner-4POjqb/rust-negative-execution.json).
Les commandes, sorties de compilation et empreintes sont conservées dans
le même dossier. SHA-256 de la FFI Aff testée :
`645c2a2752e90e04d2b80729453f76e558b7c71d74f38a89ffbc77a0ad5e2f53`.
Le bundle reste `689c42cf…b937f9` et le fork `0.15.16` identifié dans les
rapports. `rustfmt --edition 2021 --check`, syntaxe Bash/Node et
`git diff --check` passent. Les 73 tests du compilateur et la parité HTML
exhaustive de 0.14 ne sont pas relancés ; les composants concernés sont
inchangés, les régressions Aff pertinentes sont relancées ici.

**Baby step suivant, réalisé en 0.17 — Astra :** qualifier les **22 fallbacks conservés**
(13 référencés dans le dernier inventaire). Sur les contrôles HTML positif
et négatif, établir une preuve reproductible qu'aucun fallback silencieux
n'est exécuté, avec un garde vérifiable et une distinction entre absence
de référence et chemin non atteint. S'arrêter au premier appel manquant
avéré et définir alors son portage ou son élimination ; aucun portage
préventif, notamment de `unsafeDelete`. Luna pourra répéter les contrôles
une fois ce protocole stabilisé. Aucune intégration au `b8x/bin/test` ici.

À l'issue de 0.16, M1 reste incomplet sur cette qualification et sa revue finale ;
la vraie FFI HTML, les références fraîches, les résumés, les codes de sortie
et les diagnostics d'erreur de la tranche ciblée sont désormais validés.

### Micro-étape 0.17 — Fallbacks qualifiés sur la tranche M1

Réalisée le 12 septembre 2026. Aucun portage, aucune suppression de binding,
aucun changement du compilateur, des FFI ou des scripts partagés b8x.
L'option diagnostique `--guard-fallbacks` de
[`html-runner.mjs`](../../b8x/run/bak/rust/tests/html-runner.mjs) reconstruit les
graphes JS/TAST et instrumente seulement le nouveau Cargo généré, avant build.
Sans cette option, le runner conserve la génération normale.

**Garde et preuve de son fonctionnement :**

[`fallback-guard.mjs`](../../b8x/run/bak/rust/tests/fallback-guard.mjs) croise
le manifeste FFI du résolveur avec les définitions Rust. Il exige une unique
définition et un corps de fallback connu ; une forme absente, dupliquée ou
inconnue arrête le diagnostic. Le relevé des références textuelles précède
l'ajout des sondes, pour ne pas compter les appels de contrôle comme usages.

Chaque corps factice devient une écriture du marqueur
`PURUST_FFI_FALLBACK_REACHED:<symbole>` suivie de `std::process::exit(86)`.
Les signatures sont conservées. Ce garde ne peut pas être absorbé par
`catch_unwind` ou Aff, contrairement à une simple panic. Un exemple Cargo
séparé appelle chacun des **22 vrais symboles instrumentés**, sous
`catch_unwind`, avec des arguments Rust valides et sans `unsafe`.
Les **44 appels forcés** (22 par graphe) donnent exactement le marqueur
attendu, stdout vide et sortie 86. Une panic ou un retour factice ne satisfait
pas ce contrôle. Le manifeste généré reçoit seulement les dépendances locales
nécessaires à cet exemple ; aucune dépendance publiée supplémentaire.

**Inventaire recalculé, identique dans les deux graphes :**

| Fonctions | Nombre | Référence hors définition |
| --- | --- | --- |
| `Data.Symbol.unsafeCoerce` | 1 | Oui |
| `Control.Extend.arrayExtend` | 1 | Oui |
| `Data.Show.Generic.intercalate` | 1 | Oui |
| `Test.Spec.Runner.exit` | 1 | Oui |
| `Data.Date` : `canonicalDateImpl`, `calcWeekday`, `calcDiff` | 3 | Oui |
| `Data.DateTime` : `calcDiff`, `adjustImpl` | 2 | Oui |
| `Data.DateTime.Instant` : `fromDateTimeImpl`, `toDateTimeImpl` | 2 | Oui |
| `Data.Int.fromStringAsImpl` | 1 | Oui |
| `Test.Spec.Assertions.unsafeStringify` | 1 | Oui |
| `Record.Unsafe.unsafeDelete` | 1 | Non |
| `Data.Int.Bits` : les sept fonctions | 7 | Non |
| `Effect.Now.getTimezoneOffset` | 1 | Non |

Total : **22 fallbacks, 13 référencés et 9 présents seulement comme définitions**.
Les deux contrôles HTML n'en atteignent **aucun**, garde actif. Ce constat
concerne ces entrées, données et exécutions ; il ne prouve ni l'inutilité globale
des 13 chemins conservés, ni la validité des stubs sur les autres tests.
Les signatures des stubs ne deviennent pas des contrats FFI à porter.

**Reproduction et résultats :**

```sh
cd /Users/0x1/Documents/htdocs/b8x
node --test run/bak/rust/tests/fallback-guard.test.mjs
node run/bak/rust/tests/html-runner.mjs --guard-fallbacks
node run/bak/rust/tests/html-runner.mjs
```

Les **7 tests du garde** passent : reconnaissance des corps, références,
exclusion des vraies FFI, rejet des définitions ambiguës, sondes obligatoires
et distinction entre fallback atteint et assertion volontairement échouée.
Les deux runners complets terminent avec **sortie 0** ; le vérificateur exige
les 22 sondes pour chaque résultat Rust annoncé comme instrumenté.
Chaque cas compile **212 modules JS ou 211 modules TAST frais**, sans cache
de compilation PureScript réutilisé, avec les mêmes FFI réelles qu'en 0.16.

- Positifs JS/Rust : `2/2 tests passed`, sortie 0, stderr vide.
- Négatifs JS/Rust : `2/3 tests passed`, compteurs `2/1/0`, codes 1/101,
  erreur finale `HTML_NEGATIVE_EXPECTED_FAILURE` visible.
- Avec/sans garde : stdout, stderr et statut Rust identiques pour chaque
  entrée. Les empreintes des inputs sont identiques ; les **213 fichiers Rust
  originaux par graphe** concordent, en utilisant l'empreinte avant modification
  pour les fichiers instrumentés. Seuls les corps de fallback, l'exemple et
  son manifeste constituent l'instrumentation diagnostique.

Preuves finales :
[`rapport avec garde`](../../b8x/run/bak/rust/output/html-runner-hLH8iC/report.json),
[`inventaire et sondes positifs`](../../b8x/run/bak/rust/output/html-runner-hLH8iC/rust-positive/fallback-guard.json),
[`inventaire et sondes négatifs`](../../b8x/run/bak/rust/output/html-runner-hLH8iC/rust-negative/fallback-guard.json),
[`rapport sans garde`](../../b8x/run/bak/rust/output/html-runner-sGc2vO/report.json).
Chaque dossier conserve commandes, sorties, empreintes et binaires. Le premier
essai instrumenté `html-runner-3XpJMs` était déjà vert ; la dernière relance
valide le classement statique final et sa comparaison sans instrumentation.
Le bundle reste `689c42cf…b937f9`, le fork `0.15.16` et la FFI Aff
`645c2a27…d5e2f53`. Syntaxe Node et `git diff --check` passent.
Les suites Aff et compilateur ne sont pas relancées : aucun de leurs fichiers
n'a changé dans cette étape.

**Revue technique M1 : validée pour la tranche définie.** Les deux tests b8x inchangés
et la fixture négative tournent avec leurs vraies FFI, une référence JS fraîche,
des résumés/codes/diagnostics conformes et aucun fallback atteint sous garde
éprouvé. Les validations Aff de 0.16 couvrent l'attente et les nettoyages.
Cela ne valide pas M2 : le garde reste diagnostique, les stubs restent générés
normalement et `b8x/bin/test` ne sélectionne pas encore Rust.

**Incident Git résolu sur `master`, à la demande de l'utilisateur :** le checkout b8x était passé
de `custom-prompts` à `master` pendant le dernier contrôle. Le reflog indique
`b824377376 checkout: moving from custom-prompts to master` ;
`html-runner.mjs` et `verify-html-runner.mjs` étaient en conflit `deleted by us`,
et `tests/fixtures/html-negative/Main.purs` avait disparu du checkout.
Les deux runners ont été conservés dans leur version validée, la fixture
restaurée à l'identique depuis `c829468c7e` (SHA-256
`182c6ba401057063726cad1c014893e3e42b1820e2631586da0a3d2a0ed05165`).
Ces trois fichiers et les deux fichiers du garde sont indexés ; aucun conflit
Git ne reste. Aucun commit, cherry-pick ou changement de branche effectué.
Le Dockerfile modifié par l'utilisateur est laissé intact et hors index.
Les empreintes de toutes les sources/FFI et des artefacts des deux rapports
0.17 concordent de nouveau avec le checkout restauré ; les 7 tests Node passent.

La revalidation complète sur `master` est verte :
`node run/bak/rust/tests/html-runner.mjs --guard-fallbacks` termine avec sortie 0,
après les quatre contrôles JS/Rust (positifs 2/2, négatifs 2/3 avec codes 1/101),
**44 sondes forcées** et aucun fallback atteint par les tests HTML. Chaque
contrôle repart d'une compilation fraîche (212 modules JS / 211 modules TAST).
Les empreintes sources/FFI/génération/binaires sont vérifiées après exécution.
[`Rapport de revalidation sur master`](../../b8x/run/bak/rust/output/html-runner-MCdD70/report.json).

**Baby step suivant, réalisé en 0.18 — Astra :** définir le contrat du premier raccordement
Rust à `b8x/bin/test` (phase 1 / début M2), borné à cette spec et sélectionné
explicitement. Fixer l'interface CLI, l'exécution locale ou Docker, les sorties
isolées, le contrôle obligatoire des FFI manquantes et le traitement des options
existantes (`--build`, `--bundle`, `--clean-dbs`), sans changer le comportement
par défaut JS/Go/PHP. Découper ensuite une première implémentation vérifiable ;
ne pas élargir encore le graphe ni porter les 22 fallbacks préventivement.
Luna pourra dérouler la matrice d'options une fois ce contrat stabilisé,
notamment la validation intégrée `b -c; t -c` décrite après la phase 2.

### Micro-étape 0.18 — Contrat du raccordement Rust V1

Défini le 13 septembre 2026 par lecture des scripts et des artefacts M1.
**Conception seulement : aucun script modifié, aucune commande de build,
aucune bascule de cible ou exécution Docker dans cette étape.** M2 reste ouvert.

**Constats qui déterminent le contrat :**

- [`bin/target`](../../b8x/bin/target) refuse Rust et attend
  `spago.rust.yaml`, alors que le profil existant s'appelle `spago.yaml`.
  Il supprime actuellement plusieurs chemins racine et redémarre le groupe API.
- [`bin/build`](../../b8x/bin/build) et [`bin/run`](../../b8x/bin/run) déduisent
  JS/Go/PHP des fichiers de sortie. `bin/run` recherche un module avant cette
  détection et transforme certains échecs 139 en succès.
- Le fork TAST et les overrides `purust-*` sont accessibles sur l'hôte.
  Le montage de [`run/bak`](../../b8x/run/docker/_shared/config/api/_shared.yml)
  est déjà disponible dans `api-cli`, mais pas les dépôts frères purust.
- [`src/Main.purs`](src/Main.purs) émet le chemin macOS absolu de `perceus_ptr`
  dans tous les manifestes Cargo concernés, y compris via `configureThreading`.
  Copier seulement le Cargo généré dans Linux ne suffit donc pas.

#### Interface et périmètre

| Commande | Contrat Rust V1 |
| --- | --- |
| `target rust` | Sélection persistante du profil Rust de test ; annoncer explicitement « HTML uniquement, pas toute b8x ». Ne lance aucun build. |
| `b` | Générer un TAST frais et le Rust avec le bundle purust identifié, puis compiler le binaire Linux dans `api-cli`. |
| `b -c` | Reconstruire aussi le bundle du backend purust et nettoyer les artefacts générés Rust concernés avant reconstruction. Ne reconstruit ni le compilateur Haskell ni l'image Docker. |
| `t` | Exécuter le dernier build réussi et encore valide de la suite demandée dans `api-cli`, sans build implicite. |
| `t -b` / `t --build` | Effectuer `b` pour le même runtime et la même suite, puis tester seulement si le build réussit. |
| `t -c` / `t --clean-dbs` | Même exécution que `t`, avec le nettoyage des bases de test prévu par le runner ; ce n'est pas un nettoyage de compilation. |
| `b --runtime rust`, `t --runtime rust` | Même chemin, sans modifier les liens ni la cible persistante. L'override explicite prime sur la cible sélectionnée. |
| `--suite html` | Suite par défaut Rust V1 : les deux tests HTML originaux, entrée `Test.Rust.EncodeHtmlEntities.Main`. |
| `--suite html-negative` | Entrée diagnostique distincte `Test.Rust.HtmlNegative.Main` ; trois tests dont un volontairement faux, sortie non nulle attendue par le validateur, jamais transformée en succès par `t`. |
| `bin/run --runtime rust Test --suite …` | Même exécution que `t`, sans nettoyage de bases ; résolution par le manifeste Rust, pas par la recherche JS de `*.Main`. |

`--suite` s'applique à `b`, `t` et à l'entrée `Test` de `bin/run` ; le défaut
est toujours `html`, jamais « la dernière suite construite ». Les deux entrées
ont des artefacts séparés. Toute exécution affiche runtime, suite, point
d'entrée, identifiant de build et nombre de tests attendu (2 ou 3).
Les autres suites, applications et filtres génériques (`--example`, etc.)
sont refusés avec un diagnostic explicite dans cette V1, pas ignorés ni présentés
comme pris en charge. Le filtre générique reste une étape ultérieure de M2.

Pour Rust V1, `--bundle`, `--watch` et le chemin Spago de `bin/run -p` sont
refusés avant compilation/nettoyage, avec sortie 2. `bin/run -e` est conservé
par exécution directe du binaire. `b -c` accepte ses alias `--clean` et
`--compiler-too`. Les options inconnues, valeurs manquantes et suites inconnues
échouent aussi avec sortie 2. Ces restrictions ne changent pas les branches
JS/Go/PHP existantes. Aucun mode `--runtime` autre que `rust` n'est ajouté en V1.
`bin/run -b` / `--build` suit le même enchaînement que `t -b` : build sur
l'hôte, puis exécution seulement après succès ; il est refusé dans le conteneur.

#### Sélection, hôte et conteneur

- Sur l'hôte, le mode Rust vient de `--runtime rust` ou de la cible persistante
  `TARGET=rust` écrite par `target` dans `env/dev/target.env`. Sans override,
  vérifier la cohérence de cette sélection persistante avec les liens racine :
  une contradiction doit échouer, pas retomber sur JS. L'override ponctuel
  autorise les liens d'une autre cible puisqu'il ne les utilise pas.
  Un ancien `TARGET` exporté dans le shell ne doit pas
  écraser ce choix. Sans demande Rust, conserver le dispatch historique.
- `target rust` doit prévalider le profil et les liens, utiliser le vrai
  `run/bak/rust/spago.yaml`, puis remplacer seulement les liens gérés. Ne pas
  supprimer les répertoires réels, les caches JS/Go/PHP, `vendor` ou les fichiers
  Composer. Revenir à l'état antérieur si une mise à jour échoue. Tester aussi
  le retour de Rust vers chaque cible existante sur des fixtures de fichiers.
- Ne pas redémarrer automatiquement tout le groupe API pour ce profil de test.
  L'image construite/recréation de `api-cli` relève d'un prérequis explicite.
  Transmettre runtime, suite et chemin relatif du build aux commandes internes
  du conteneur : ne dépendre ni de son ancien `TARGET`, ni de son lien `output`.
  Aligner également le cas Rust de l'entrypoint sur le vrai nom du profil lors
  d'une recréation ultérieure ; aucune promesse d'exécution des services métier
  avec ce profil HTML. Les autres services ne doivent pas être relancés ici.
- **Build orchestré depuis l'hôte uniquement en V1** : fork sélectionné via
  `PURS` absolu ou découverte unique vérifiée ; Spago et overrides du profil
  isolé ; génération purust avec `--threaded`. Pas d'utilisation du `purs` npm
  standard de l'image. Un `b` directement dans le conteneur est refusé clairement.
- **Cargo et exécution dans `api-cli`** : vérifier Linux, architecture, versions
  Rust/Cargo attendues (1.96.0) et accès au build partagé. Un conteneur absent
  ou inadéquat produit un échec ; ni création/rebuild d'image automatique, ni
  repli vers un binaire macOS. Les arguments passent correctement les chemins
  avec espaces ; les signaux atteignent le processus natif.

#### Artefacts, fraîcheur et FFI

- Utiliser `run/bak/rust/output/integrated/<suite>/<build-id>/` pour le TAST,
  le Cargo et les rapports, avec répertoire de travail isolé pour `.purmeta`.
  Ne pas dépendre des liens racine pendant la génération. Séparer les caches
  Cargo Linux par architecture de tous les anciens caches/binaries macOS.
- Rendre l'export Cargo autonome **dans purust** : embarquer une copie identifiée
  de `perceus_ptr` et émettre des chemins relatifs depuis la racine, `purust_core`
  et les modules. Préserver le mode `threaded`. Ne pas monter `/Users/0x1` dans
  Docker ni maintenir un remplacement ad hoc de chemins après chaque génération.
  Les autres dépendances de chemin doivent rester dans l'export ; conserver
  les versions résolues dans `Cargo.lock`. Le premier build peut télécharger les
  dépendances Cargo nécessaires ; `t` ne résout ni ne télécharge de dépendances.
- Garder le contrôle anti-fallback obligatoire pour les artefacts de test V1 :
  manifeste FFI, garde explicite et sondes de 0.17 éprouvées avant publication.
  Une nouvelle forme non prise en charge arrête le build au lieu d'être ignorée.
  Le garde reste actif dans le binaire lancé par `t`, y compris après interception
  d'une erreur Aff. Aucun portage préventif des 22 fallbacks actuels.
- Publier un manifeste « prêt » seulement après build et sondes réussis : suite,
  main, plateforme, versions/empreintes du fork et du bundle, lockfiles, sources,
  FFI, runtime embarqué, options et binaire. `t` côté hôte vérifie la fraîcheur
  des inputs ; le lanceur Linux vérifie plateforme, manifeste et binaire.
- Dès qu'un `b` Rust aux arguments valides commence, marquer sa suite comme non
  exécutable jusqu'au succès. Un échec de prérequis/build laisse ce statut :
  `t` ne réutilise pas l'ancien binaire même si l'utilisateur a tapé `b -c; t -c`.
  Un artefact absent, modifié, périmé ou de mauvaise plateforme doit demander
  une reconstruction et sortir non nul. Conserver les diagnostics de l'échec.
- `b -c` ne nettoie que les artefacts générés identifiés du backend/profil Rust ;
  pas les sources de dépendances ni les preuves historiques 0.1–0.17. La portée
  exacte du nettoyage est testée avant tout essai sur le checkout réel.

#### Sorties et nettoyage

Les échecs de génération, Cargo, validation FFI, test et transport Docker restent
non nuls à travers tous les wrappers. Sortie 86 réservée au garde ; les panics
natives et le code 139 ne sont jamais convertis en succès sur le chemin Rust.
Conserver les diagnostics et l'attente de `purust_aff_run_main`, sans `exit(0)`
prématuré. Tester aussi un signal et l'échec du build avant lancement des tests.

Pour `t -c` lancé sur l'hôte, préserver la cible et le moment du nettoyage
actuel (trap après exécution/interruption), en vérifiant explicitement les bases
de test concernées. Ne pas élargir leur sélection. Un échec de nettoyage doit
être visible et non nul si les tests ont réussi ; si les tests ont échoué,
préserver leur code et signaler séparément le nettoyage. Une erreur d'arguments
ne déclenche pas de nettoyage. L'appel direct avec `-c` dans le conteneur n'est
pas pris en charge par V1 et doit être refusé plutôt que prétendre nettoyer.

#### Découpage et validations — état actualisé

1. **0.19 — Astra : export Cargo portable, réalisé ci-dessous.** Corriger uniquement l'embarquement
   et les chemins de `perceus_ptr` dans purust. Sur un petit TAST frais, vérifier
   l'export déplacé, l'absence de dépendance absolue hôte et la conservation des
   modes normal/threaded ; lancer les régressions compilateur pertinentes.
   Ne pas toucher encore à `target`, `b`, `t` ou au déploiement Docker.
2. **0.20 — Astra : driver Rust isolé, réalisé ci-dessous.** Réutiliser préparation/FFI de M1,
   produire un build HTML portable, le compiler dans `api-cli`, éprouver le
   garde et le lancer par son manifeste. Valider les entrées positive/négative
   et le rejet des artefacts périmés, sans modifier les scripts partagés.
3. **0.21 — Astra : sélection et raccordement CLI, réalisé ci-dessous.** Ajouter le dispatch Rust
   et les options du contrat, puis la bascule sûre `target rust` ; réutiliser le
   driver éprouvé. Tester arguments/dispatch/liens/codes/signaux avec de fausses
   commandes sur des fixtures, sans basculer le checkout ni effacer de bases.
4. **0.22 — Luna au contrat stabilisé : validation intégrée réelle.** Image et
   services nécessaires prêts, vérifier le périmètre de nettoyage, puis exécuter
   `target rust`, **`b -c; t -c`** (ou `b -c && t -c`). Contrôler les deux statuts
   et le résumé limité à HTML. Exécuter séparément `b --suite html-negative`,
   puis `t --suite html-negative` et exiger son échec attendu. Faire la revue des
   branches JS/Go/PHP affectées avant d'élargir la suite pour M2.

**Baby step suivant, réalisé en 0.19.** La preuve Docker et le test `b -c; t -c` sont
désormais positionnés dans ce raccordement ; ils ne précèdent pas sa conception.

### Micro-étape 0.19 — Export Cargo portable

Réalisée le 13 septembre 2026, dans purust uniquement. Aucun changement des
scripts b8x, de sa cible, du Dockerfile ou des sources du runtime. b8x reste
sur `master` ; purust conserve sa branche `edge` préexistante.

**Implémentation :**

- [`Purust.Runtime`](src/Purust/Runtime.purs) exporte `perceus_ptr/Cargo.toml`
  et ses trois fichiers Rust dans chaque workspace généré. Le bundle contient
  leurs octets issus des fichiers canoniques de `tests/runtime/perceus_ptr` ;
  les loaders esbuild sont configurés dans `spago.yaml`. Aucun chemin hôte
  n'est résolu à l'exécution du bundle pour retrouver ce runtime.
- [`Main`](src/Main.purs) déclare ce membre du workspace et émet uniquement
  `perceus_ptr` ou `../perceus_ptr` comme dépendance, selon le manifeste.
  La feature `threaded` est ajoutée explicitement à la dépendance ; elle ne
  dépend plus du remplacement d'une chaîne contenant un chemin absolu.
- Le runtime embarqué est réécrit lors d'une régénération dans un répertoire
  existant. Les sources canoniques restent inchangées, comparées octet par octet.
  Le bundle suivi `bin/purust.js` est reconstruit.

**Régression et preuves :**

[`portable-cargo.mjs`](tests/tast/portable-cargo.mjs), intégré à `test:tast`,
compile **33 modules TAST frais** avec le fork explicitement sélectionné.
Il copie le bundle seul dans un dossier distinct, génère les deux modes,
altère une copie du runtime puis vérifie sa restauration par régénération.
Chaque export est ensuite déplacé dans un chemin contenant des espaces,
sans laisser de copie au chemin initial.

`cargo metadata --offline` confirme qu'une seule instance de `perceus_ptr`
est résolue, à l'intérieur de l'export, avec la feature correcte. Tous les
manifestes et dépendances Cargo de chemin sont internes et relatifs.
Les deux binaires se compilent et s'exécutent avec `--offline --locked`,
sortie 0 et marqueur exact `PORTABLE_CARGO_OK`.
Les contrôles natifs valident aussi le copy-on-write dans les deux modes et
`Send + Sync` / le partage entre threads dans le mode threaded : **5 contrôles
runtime normaux et 2 threaded**. Les quatre tests historiques locaux partagent
`DROP_COUNT` ; après un échec concurrent observé, ils sont lancés avec
`--test-threads=1`, sans modifier le runtime ni leurs assertions.

La preuve initiale rouge constate l'absence du runtime dans l'ancien export :
[`commandes`](</tmp/purust-portable-9P6MIG/commands.json>).
Preuve finale verte : [`rapport`](</tmp/purust-portable-SJ7kgN/report.json>) et
[`commandes complètes`](</tmp/purust-portable-SJ7kgN/commands.json>).
Le rapport conserve versions, empreintes du bundle, des quatre fichiers du
runtime, des sources PureScript et des fixtures, lockfiles et binaires.
SHA-256 du bundle : `d50718c73a8bb4995327903a77b4072fd22a90d7e4adc32142e37dcc9983c7b1`.

**Validation :** `npm run build` réussit ; **51 tests codegen et 23 tests TAST**
passent avec `--test-concurrency=2`. Trois timeouts du premier lancement
codegen à concurrence par défaut passent isolément, puis dans cette relance
complète, sans allonger les délais. Le test portable final est aussi relancé
séparément après ajout de ses contrôles natifs. Syntaxe Node, `rustfmt --check`
des nouvelles fixtures et `git diff --check` passent. Les avertissements
préexistants de `Main.purs` et des tests locaux du runtime ne sont pas nettoyés.

**Baby step suivant, réalisé en 0.20 — Astra :** raccorder cet export portable à un
driver isolé b8x : génération sur l'hôte, Cargo/exécution dans `api-cli`,
garde anti-fallback et manifeste de fraîcheur, contrôles HTML positif/négatif.
La compilation Linux/Docker n'est pas encore validée par 0.19 ; aucun
`target rust`, `b -c` ou `t -c` n'a été lancé.

### Micro-étape 0.20 — Driver isolé hôte → Cargo Linux → tests

Réalisée le 13 septembre 2026. Le nouveau
[`driver.mjs`](../../b8x/run/bak/rust/driver.mjs) réutilise le périmètre et les
contrôles FFI de M1, le garde de 0.17 et l'export portable de 0.19. Ses helpers
séparent préparation du profil, manifestes, sous-processus, transport Docker
et worker Linux. Aucun raccordement aux scripts partagés `target`, `b`, `t` ;
b8x reste sur `master`, sans bascule de cible ni nettoyage de bases.

**Commandes vérifiées depuis b8x :**

```sh
node run/bak/rust/driver.mjs build
node run/bak/rust/driver.mjs run
node run/bak/rust/driver.mjs build --suite html-negative
node run/bak/rust/driver.mjs run --suite html-negative
```

Le négatif sort volontairement avec **101** : le driver ne transforme pas
cet échec attendu en succès. Le défaut reste `html`, même après un build
négatif ; les autres suites et options sont refusées avec sortie 2.

**Pipeline et garanties acquises :**

- Sur l'hôte : Spago 1.0.3 hors ligne, fork TAST explicitement sélectionné et
  identifié, **211 modules frais par suite**, génération Rust `--threaded`.
  Les FFI sont photographiées avant génération et leur résolution est recontrôlée.
- Dans le conteneur `api-cli` correspondant au montage de ce checkout :
  Linux ARM64, Rust/Cargo 1.96.0, cible explicite `aarch64-unknown-linux-gnu`.
  Cargo ne dépend d'aucun chemin hôte et conserve son `Cargo.lock`. Aucun cache
  natif macOS, aucune création/reconstruction d'image, aucun redémarrage.
  Image vérifiée : `sha256:1efccad9260b57ee2a2614bbeeda11806b9ea968e4566a4c26da10dd29989676`.
  La branche x64 du préflight n'a pas été exécutée ici.
- Les **22 gardes**, dont 13 symboles référencés avant instrumentation, sont
  éprouvés chacun par une sortie 86 et leur marqueur exact avant publication.
  Ils restent actifs dans les binaires ; aucun n'est atteint par les tests HTML.
- Publication atomique du manifeste après les vérifications, avec **274 inputs**
  identifiés et **647 artefacts** par suite, plateforme/image, options et preuves
  des gardes. `run` vérifie la fraîcheur côté hôte puis les artefacts côté Linux,
  et lance directement le binaire, sans build ni résolution Cargo implicite.
- Tout nouveau build invalide d'abord sa suite, y compris si un prérequis
  échoue. Un verrou empêche les builds concurrents et la réutilisation d'un
  ancien état prêt après interruption brutale ; un verrou abandonné demande
  une inspection explicite, jamais une suppression automatique.
- Les interruptions sont transmises par une demande au worker propriétaire,
  qui arrête son groupe de processus. Les sous-processus sont bornés et leurs
  commandes, sorties, erreurs et signaux sont conservés dans le diagnostic.

**Validation : 18 régressions rapides et 18 contrôles Docker verts.**
[`driver.test.mjs`](../../b8x/run/bak/rust/tests/driver.test.mjs) et les sept
tests existants du garde couvrent arguments, manifestes, chemins/symlinks,
inputs/FFI absents ou modifiés, plateforme, reporting et signaux.
[`driver-integration.mjs`](../../b8x/run/bak/rust/tests/driver-integration.mjs)
prouve les succès/échecs attendus, le défaut HTML, le refus d'un autre fork,
d'un binaire altéré/manquant et d'un manifeste modifié. Il provoque un vrai
échec de prérequis, vérifie le refus de l'ancien négatif et l'indépendance du
positif, puis interrompt une opération `cargo metadata` dans Linux : le worker
confirme **SIGINT**, le driver sort **130**, et l'état reste inexécutable.
Le négatif est ensuite reconstruit ; les deux suites sont revalidées.

Preuve complète :
[`rapport des 18 contrôles`](../../b8x/run/bak/rust/output/integrated/integration-check-6RD75h/report.json).
Derniers artefacts prêts :
[`HTML positif — 2/2, sortie 0`](../../b8x/run/bak/rust/output/integrated/html/build-BlrZMI/manifest.json),
[`HTML négatif — 2/3, sortie 101 et erreur Aff visible`](../../b8x/run/bak/rust/output/integrated/html-negative/build-shhkmH/manifest.json).
Le bundle purust reste celui de 0.19, SHA-256 `d50718c7…83c7b1` ; aucun
changement du compilateur/runtime. La référence JS et les 74 régressions
compilateur de 0.19 ne sont pas relancées dans cette étape. Les empreintes des
scripts partagés, du Dockerfile et des liens racine sont vérifiées inchangées.
Usage et prérequis décrits dans le [`README Rust`](../../b8x/run/bak/rust/README.md).

**Baby step suivant, réalisé en 0.21, Astra :** raccorder ce driver éprouvé à la sélection
et aux commandes `target` / `bin/build` / `bin/test` / `bin/run`, selon le contrat
0.18, avec tests de dispatch/options/liens/codes/signaux sur fixtures.
Ne pas élargir le graphe HTML. La vraie séquence **`b -c; t -c`** reste en 0.22,
après ce raccordement et vérification explicite du périmètre des bases à nettoyer.

### Micro-étape 0.21 — Raccordement CLI Rust V1

Réalisée le 13 septembre 2026 sur `b8x/master`, sans changement de branche.
**HTML uniquement : graphe et FFI de 0.20 inchangés ; M2 reste ouvert.**

- [`bin/_rust`](../../b8x/bin/_rust) sélectionne le chemin Rust avant les effets
  de `_shared`. `b`, `t`, `bin/build`, `bin/test` et `bin/run` transmettent les
  options validées au driver. Le chemin historique reste inchangé sans Rust.
  L'override ponctuel prime ; le défaut persistant exige des liens cohérents et
  ignore l'ancien `TARGET` exporté sur l'hôte.
- [`cli/target.mjs`](../../b8x/run/bak/rust/cli/target.mjs) prévalide le profil et
  les quatre liens, utilise le vrai `spago.yaml` Rust, publie `target.env` en
  dernier et restaure les liens en cas d'échec. Les vrais répertoires/fichiers,
  liens non gérés, caches existants et Composer/vendor ne sont pas supprimés.
  Un conflit de rollback conserve le fichier concurrent et un verrou visible.
  Les allers-retours Rust↔JS/Go/PHP ne redémarrent aucun conteneur.
- `t -b` et `bin/run -b Test` lancent la même suite seulement après succès du
  build. Le défaut est toujours `html` ; `html-negative` reste séparé. Options
  inconnues/incomplètes, suite inconnue, filtres, applications, bundle/watch et
  `run -p` sortent 2 avant mutation. Seule la syntaxe `--runtime rust` est ajoutée.
- `b -c` accepte `--clean` / `--compiler-too`. Après invalidation de sa suite,
  il sauvegarde les seuls `purust/output` et `purust/bin/purust.js` dans
  `node_modules/.cache/purust-clean/build-…`, puis reconstruit le bundle via npm.
  Les sources `.spago`, preuves historiques et autres backends restent intacts.
  Le TAST et Cargo utilisent un export neuf, comme chaque build du driver.
  Un échec de reconstruction laisse un état `failed`, jamais l'ancien binaire.
- `t -c` conserve le sélecteur SQL et le nettoyage après exécution/interruption,
  une seule fois. Les identifiants sont échappés, les erreurs SQL/transport sont
  visibles ; le code du test est prioritaire lorsqu'il échoue aussi. Les `_`
  du sélecteur historique restent des jokers SQL : contrôler la liste en 0.22.
- `bin/run -e` remplace son wrapper par le driver (`process.execve`, Node 24
  vérifié), puis le binaire Linux est exécuté directement sous supervision,
  sans shell ni Cargo. Les codes 101/139 et signaux 130/143 sont conservés.
  Le worker sait aussi lancer le manifeste courant depuis le conteneur ; build
  et nettoyage DB directs dans celui-ci sont refusés. L'entrypoint utilise le
  bon nom de configuration Rust pour un futur rebuild/recréation de l'image wrap.
  Ce rebuild n'est pas requis pour la validation hôte 0.22.

**Validation : 38 tests rapides verts**, dont 20 tests dans
[`cli.test.mjs`](../../b8x/run/bak/rust/tests/cli.test.mjs) et les 18 régressions
driver/garde existantes. Les fixtures couvrent les chemins avec espaces, la
sélection, chaque échec de publication des liens, les fichiers concurrents,
les erreurs de build/nettoyage, les signaux et l'entrypoint des quatre profils.
Une copie du vrai driver prouve que l'état est déjà `building` lors du faux npm,
puis `failed` et inexécutable après son échec. Vérifications de syntaxe Bash/Node
et `git diff --check` réussies. Aucun build compilateur/Cargo réel, aucune bascule
du checkout, aucune base nettoyée, aucun conteneur redémarré ; les liens racine
et `TARGET=js` sont conservés. Les fixtures temporaires sont supprimées par les
tests ; les sauvegardes du nettoyage ne concernent ici que ces fixtures.

**Baby step suivant, réalisé en 0.22, Luna :** l'image est disponible et les conteneurs
ont déjà été revalidés en 0.20. Examiner les bases sélectionnées, puis valider
réellement `target rust` et **`b -c; t -c`** selon la section dédiée ci-dessous,
avec statuts séparés et contrôle négatif. Les changements du driver rendent les
anciens manifestes 0.20 périmés : reconstruire, ne pas contourner leur contrôle.
Ne pas élargir encore les suites ni relancer les services métier.

### Micro-étape 0.22 — Validation réelle des commandes intégrées

Réalisée le 13 septembre 2026 sur `b8x/master`. Le checkout reste sur cette
branche et sa cible persistante est désormais **Rust HTML**. Aucun service
n'a été redémarré et aucune suite supplémentaire n'a été portée.

| Commande réelle | Résultat |
| --- | --- |
| `bin/target rust` | Sortie 0, quatre liens Rust cohérents, `TARGET=rust`. |
| `bin/b -c` | Sortie 0 ; reconstruction complète purust, TAST frais de 211 modules, Cargo Linux ARM64 et 22 sondes anti-fallback. |
| `bin/t -c` | Sortie 0 ; deux tests HTML originaux réussis, nettoyage exécuté après les tests. |
| `bin/t --runtime rust -b --suite html-negative` | Build réussi ; 2/3 tests, erreur finale Aff visible, sortie 101 conservée. |
| `bin/t` après le négatif | Sortie 0, reprend bien l'artefact positif initial, pas la dernière suite construite. |
| `bin/run --runtime rust -e Test` | Sortie 0 et 2/2, depuis l'hôte puis directement dans `api-cli`. |

La sélection SQL de nettoyage était **vide** avant la séquence, juste avant
`t -c` et après : **aucune base supprimée**. Ce contrôle valide le vrai chemin
de nettoyage sans cible présente ; les suppressions et leurs erreurs restent
couvertes sur fixtures en 0.21, pas par une suppression PostgreSQL réelle ici.

Preuve : [`rapport 0.22`](../../b8x/run/bak/rust/output/integrated/cli-validation-gqBYgq/report.json),
avec commandes/statuts/sorties séparés et contrôles de préservation.
Artefacts prêts :
[`HTML — build-RsKzF0`](../../b8x/run/bak/rust/output/integrated/html/build-RsKzF0/manifest.json),
[`négatif — build-iBFVly`](../../b8x/run/bak/rust/output/integrated/html-negative/build-iBFVly/manifest.json).
Chacun conserve le garde obligatoire et les 22 sondes réussies ; aucun fallback
n'est atteint pendant les tests. Le conteneur et l'image sont ceux de 0.20,
avec Rust/Cargo 1.96.0, cible `aarch64-unknown-linux-gnu`.

La reconstruction a compilé 428 modules du backend. Le contenu du nouveau
bundle retrouve exactement le SHA-256 `d50718c7…83c7b1` de 0.19/0.20 ; Spago
l'a rendu exécutable (`100644` → `100755`). L'ancien bundle et son output sont
conservés dans `purust/node_modules/.cache/purust-clean/build-rYEShy/`.
Les inventaires JS/Go/PHP (chemins, types, tailles, dates de modification et
inodes) sont inchangés ; les scripts et le Dockerfile ont les mêmes empreintes.
**38 régressions rapides CLI/driver/garde sont également repassées.**

Limite relevée : le build complet affiche **75 avertissements PureScript**
(65 dans purust, 10 dans PBO), sans erreur, plus l'avertissement de format ancien
de Spago. Ils sont consignés dans `build-clean.json` ; aucun nettoyage des sources
du compilateur ou migration de configuration n'est inclus dans cette validation.
Les 74 régressions compilateur de 0.19 n'ont pas été relancées, ses sources
n'ayant pas été modifiées dans cette étape.

**Baby step suivant, réalisé en 0.23, Astra :** choisir la prochaine spec b8x sans services
pour M2, puis relever sa fermeture TAST et les FFI réellement atteignables.
Fixer un périmètre et un critère de succès avant le portage ; ne pas porter
préventivement les fallbacks HTML qui restent inaccessibles. Cette validation
termine le raccordement HTML, pas M2 ni la suite complète b8x.

### Micro-étape 0.23 — Choix et inventaire de la prochaine spec sans services

Réalisée le 13 septembre 2026 sur `b8x/master`. **Choix retenu :
`Util.Html.Encode.Test.DecodeHtmlEntities`**, spec originale de quatre tests,
déjà collectée par `Util.Html.Encode.Test.Test` dans la suite b8x normale.
Le portage 0.14 fournit déjà sa FFI Rust et inclut ses exemples dans les tests
différentiels ; la spec PureScript complète n'avait pas encore été exécutée
par le chemin intégré. C'est donc le plus petit élargissement utile après
l'encodage. `RemoveComments` et `PadLeft` sont différés : leurs modules importent
notamment Regex, le nettoyage HTML et des codecs génériques, absents de cette
fermeture minimale ; leur inventaire détaillé n'est pas réalisé ici.

**Preuve fraîche, pas seulement lecture des imports :**
[`rapport TAST 0.23`](../../b8x/run/bak/rust/output/decode-discovery-2RT6F2/report.json),
[`inventaire typé des foreigns`](../../b8x/run/bak/rust/output/decode-discovery-2RT6F2/foreign.json),
[`main diagnostique`](../../b8x/run/bak/rust/output/decode-discovery-2RT6F2/Main.purs).
Spago a résolu les sources hors ligne, puis le fork a produit un `purs graph`
et un TAST neuf, tous avec sortie 0. Compilation TAST : environ deux secondes.
Les types proviennent des annotations et de leur `typeTable`, avec les tableaux
`dataDecls` et `classDecls` présents ; aucune inférence depuis du CoreFn non typé.

- **211 modules**, dont **209 communs** avec le build HTML 0.22. Les deux
  remplacements sont le main et la spec encodage→décodage ; aucune dépendance
  supplémentaire. Aucun module `Core.*`, `Infra.*`, `Inter.*` ou `Node.*`.
- **52 modules déclarent 275 foreigns**, exactement les mêmes symboles et
  résolutions FFI qu'en 0.22. Aucune nouvelle déclaration FFI ni résolution `.rs`.
- Le TAST de la spec contient **4 références à `it`, 12 à `decodeHtmlEntities`
  et 0 à `encodeHtmlEntities`**. L'alias appelle
  `Util_Html_Encode_Encode__decodeHtmlEntities`, de type TAST `String -> String`,
  fourni par le fichier Rust existant ; l'encodeur est également présent dans
  le module étranger, sans être appelé par cette spec.
- Les neuf modules sans fichier Rust résolu et les 22 fallbacks du diagnostic
  HTML sont consignés. Ce sont des déclarations conservées, pas la preuve
  d'un appel exécuté. **L'absence de nouvelle déclaration ne prouve pas que
  le nouveau chemin est libre de fallbacks : le build et les sondes seront
  obligatoires en 0.24.** Ne pas porter ces fallbacks préventivement.

| Test original de décodage | Assertions |
| --- | --- |
| Entités usuelles : balises, esperluette, guillemets, apostrophe, espace insécable | 5 |
| HTML composé avec plusieurs entités | 1 |
| Références décimales/hexadécimales, accent et chaînes sans entités | 5 |
| Chaîne vide | 1 |

Cette étape ne génère ni ne compile de Rust et n'exécute pas encore les quatre
tests. Aucun driver, FFI, source compilateur ou script CLI n'a été modifié.
Les deux états prêts de 0.22, leurs inputs, les liens et `TARGET=rust` sont
vérifiés inchangés. Aucun accès Docker, service, build de bundle ou nettoyage DB.
Le main et le TAST diagnostiques restent hors des sources du profil actif.

#### Contrat de la micro-étape 0.24 — Luna, réalisé ci-dessous

Raccorder **uniquement** la suite explicite `--suite html-decode` au runner
existant. `html` reste le défaut avec ses **2 tests** ; `html-negative` garde
ses **3 tests** et son échec intentionnel. Ne pas transformer silencieusement
`html` en un agrégat de six tests.

Fichiers et changements bornés :

1. Ajouter `b8x/run/bak/rust/src/DecodeMain.purs`, module
   `Test.Rust.DecodeHtmlEntities.Main`, d'après le main diagnostique : importer
   la vraie spec, attendre la fin d'Aff et exiger `{ passed: 4, failed: 0,
   pending: 0 }`, sinon lever une erreur. Ne pas recopier ses assertions.
2. Enregistrer ce main, son chemin et `expectedTests: 4` dans
   `driver/shared.mjs` ; ajouter la source originale de la spec dans
   `driver/profile.mjs`. L'artefact sera séparé dans
   `output/integrated/html-decode/<build-id>/`.
3. Adapter `verifyExecution` sans affaiblir le négatif : appeler d'abord
   `suiteConfig`, conserver le contrat strict de `html-negative`, et pour les
   suites positives connues exiger sortie 0, résumé `N/N` selon leur
   `expectedTests`, stderr vide et garde valide. Le `else` actuel suppose que
   toute suite autre que `html` est négative : il ne convient pas à ce troisième cas.
4. Mettre à jour l'aide de `cli/options.mjs` et `driver.mjs`, le README et les
   fixtures `driver.test.mjs` / `cli.test.mjs` : sélection des trois suites,
   défaut inchangé, mauvais main/compte refusé, pas de build implicite et codes
   non nuls conservés. Aucun changement de cible, Dockerfile, ABI ou FFI requis.

Validation attendue :

```sh
cd /Users/0x1/Documents/htdocs/b8x
node --test run/bak/rust/tests/cli.test.mjs run/bak/rust/tests/driver.test.mjs run/bak/rust/tests/fallback-guard.test.mjs
bin/b --runtime rust --suite html-decode
bin/t --runtime rust --suite html-decode
bin/run --runtime rust Test --suite html-decode
```

Exiger **4/4, sortie 0**, main exact et TAST frais de 211 modules, inventaire
FFI qualifié, sondes anti-fallback complètes et aucun garde atteint. `t` et
`bin/run` doivent utiliser le même artefact. Renouveler également une référence
JS fraîche de cette seule spec dans un dossier isolé, avec le profil JS réel
et les quatre mêmes tests ; réutiliser la méthode de `tests/html-runner.mjs`
pour ne pas modifier les liens ni les sorties JS existantes.

Les modifications du driver rendront les anciens manifestes périmés :
reconstruire séparément `html` et `html-negative`, puis vérifier **2/2 → 0**,
**2/3 → 101** et le défaut toujours `html` après les autres suites. Aucun besoin
de `-c`, de rebuild du bundle, de nettoyage de bases ou de redémarrage d'image.
Mettre à jour le todo avec les preuves, puis s'arrêter. Revenir à **Astra** si
la génération, Cargo ou un fallback révèle un écart : aucun portage ou changement
de runtime implicite dans cette micro-étape Luna. M2 reste ouvert.

### Micro-étape 0.24 — Suite `html-decode` raccordée et validée

Réalisée le 13 septembre 2026, en restant sur `b8x/master` avec `TARGET=rust`.
Le nouveau [`src/DecodeMain.purs`](../../b8x/run/bak/rust/src/DecodeMain.purs)
importe les quatre tests originaux, attend leur fin et exige 4 réussites,
aucun échec ni attente. Aucune assertion n'est recopiée ou modifiée.

La suite est enregistrée dans `driver/shared.mjs`, sa source b8x dans
`driver/profile.mjs`, et les aides CLI/driver listent les trois suites.
`verifyExecution` valide d'abord le catalogue, puis exige pour une suite positive
connue une ligne de résumé exacte `N/N tests passed`, le code 0, stderr vide
et le garde valide. `html-negative` conserve son contrat strict et sa sortie
non nulle. `html` reste le défaut à deux tests, pas un agrégat encodage+décodage.

**Trois régressions d'abord rouges, puis 41 tests rapides verts** : sélection
de la suite et de son main, mauvais compte/manifeste refusé, résumé de type
`14/4` refusé, codes 86/101/139 conservés, aucun build implicite, défaut et liens
inchangés. Les 38 régressions précédentes sont conservées.

| Contrôle réel | Résultat |
| --- | --- |
| `t --runtime rust --suite html-decode` avant le premier build | Sortie 1, artefact absent ; aucune compilation implicite. |
| `b --runtime rust --suite html-decode` | Sortie 0, TAST frais et Cargo Linux ARM64. |
| `t --runtime rust --suite html-decode` | **4/4, sortie 0**. |
| `bin/run --runtime rust Test --suite html-decode` | **4/4, sortie 0**, même artefact que `t`. |
| Référence JS fraîche et isolée | **4/4, sortie 0**, même spec et même main. |
| `html` reconstruit séparément | **2/2, sortie 0**. |
| `html-negative` reconstruit via `t -b` | **2/3, sortie 101**, assertion intentionnelle et erreur finale Aff visibles. |
| `t` après les autres suites | Reprend le build d'encodage, **2/2, sortie 0**. |
| Décodage après les autres suites, puis `bin/run -e` dans `api-cli` | **4/4, sortie 0**, toujours le même build de décodage. |

Preuve complète :
[`rapport 0.24`](../../b8x/run/bak/rust/output/integrated/decode-validation-VMdIuO/report.json).
Les trois artefacts sont prêts et leurs inputs revalidés :
[`décodage — build-uusUwx`](../../b8x/run/bak/rust/output/integrated/html-decode/build-uusUwx/manifest.json),
[`encodage — build-CaVKqf`](../../b8x/run/bak/rust/output/integrated/html/build-CaVKqf/manifest.json),
[`négatif — build-fnu6d5`](../../b8x/run/bak/rust/output/integrated/html-negative/build-fnu6d5/manifest.json).
Chacun comporte **211 modules TAST, 275 déclarations FFI et 22 sondes de garde
réussies** ; aucun fallback n'est atteint par ces exécutions. Le décodage
sélectionne bien sa spec, pas celle d'encodage.

La référence JS utilise le vrai profil `run/bak/js`, son lockfile `spec` 8.1.1,
et **212 modules** incluant `Util.Runtime` pour l'import direct de la FFI JS.
Compilation et exécution sont isolées du vieil output ; sources, FFI copiées,
JS généré et lockfile sont identifiés par empreinte. Aucun mélange avec les
overrides Rust ; les 12 assertions d'origine sont exécutées via la vraie spec.

**Correction de compatibilité annexe, prouvée par exécution :** l'ajout du main
dans `src/` rendait le préparateur historique `prepare.mjs` invalide, car son
graphe ne recevait pas la source `DecodeHtmlEntities.purs`. Le
[`reproducteur rouge`](../../b8x/run/bak/rust/output/prepare-8u1W1Z/commands.json)
montre `Module …DecodeHtmlEntities was not found`. Une ligne ajoutée à sa liste
de sources rétablit la commande ; la
[`preuve verte`](../../b8x/run/bak/rust/output/prepare-LPZiH8/manifest.json)
conserve son entrée encodage et sa fermeture de 211 modules. Aucun élargissement
de FFI ou du compilateur n'a été nécessaire.

Les inventaires JS/Go/PHP, liens racine, scripts partagés, Dockerfile et bundle
purust sont inchangés. Aucun `-c`, nettoyage DB, rebuild de bundle/image ou
redémarrage de conteneur. Le garde et l'ABI ne changent pas ; les 75 avertissements
compilateur relevés en 0.22 restent hors de cette étape, sans nouveau build du
compilateur ni relance de ses 74 régressions propres.

**Prochain baby step — Astra :** choisir une première spec sans services hors
encodage/décodage HTML et relever le delta de modules/FFI avant tout portage,
en comparant notamment les candidats utilitaires laissés de côté en 0.23.
Les six tests HTML originaux passent désormais via deux suites explicites ;
cela ne couvre toujours pas tous les tests sans services et ne clôt pas M2.

### Micro-étape 0.25 — Inventaire de la suite complète et choix du bloc Stash

Réalisée le 13 septembre 2026 sur `b8x/master`, `TARGET=rust`, sans portage.
Le chemin réel est [`Test.Main`](../../b8x/test/Main.purs) → `Core.spec`,
`Infra.spec`, `Util.spec`. Le relevé suit les appels `.spec`, pas seulement les
noms de fichiers ou les imports : **70 modules de collecte/specs, 46 specs
feuilles et 286 sites `it` à titre littéral**. Aucun `xit`, `fit` ou `pending`
relevé dans cet arbre. Il ne s'agit pas d'une exécution ni d'une nouvelle
référence JS/Go complète.

Preuves : [`inventaire détaillé`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/inventory.json),
[`script reproductible`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/inventory.mjs).
Les arêtes de collecte, chemins, lignes des tests et empreintes des sources
sont conservés. Les compteurs statiques devront être confrontés aux résumés
réels à M2/M4 ; ne pas déduire un pourcentage de travail restant de 6/286.

| Bloc réellement collecté | Specs | Tests | Services / état Rust |
| --- | ---: | ---: | --- |
| Core : `HandleCommand` | 1 | 3 | PostgreSQL et fixture RabbitMQ ; non porté. |
| Infra EventStore : `Append`, `Load` | 2 | 13 | PostgreSQL et fixture RabbitMQ ; non porté. |
| Infra Projection : `HandleProjectionReadFind` | 1 | 11 | PostgreSQL et fixture RabbitMQ ; non porté. |
| Util Debug / Stash | 8 | 41 | Sans service ; prochain bloc, TAST seulement. |
| Util Html / Clean | 9 | 128 | Sans service ; non porté. |
| Util Html / Encode | 2 | 6 | 2 encodage + 4 décodage validés en 0.24, séparément. |
| Util Type / String | 18 | 63 | Sans service ; non porté. |
| Util Type / Variant / Encoding | 5 | 21 | Sans service ; non porté. |
| **Total** | **46** | **286** | **259 sans services + 27 d'intégration.** |

**Détail des specs feuilles**, avec le préfixe de chaque bloc omis :

- Core / Infra : `HandleCommand` (3), `Append` (5), `Load` (8),
  `HandleProjectionReadFind` (11).
- Stash : `UnsafeStash` (8), `UnsafeGetStashWithDefault` (8), `UnsafeDidStash`
  (5), `UnsafeDropStash` (4), `UnsafeGetStashAndDrop` (4), `UnsafePushToStash`
  (5), `UnsafeIncrementStash` (4), `UnsafeClearStash` (3).
- Html Clean : `CleanAttributesInTag` (16), `CleanAttributesInTags` (19),
  `FindUnescapedQuote` (15), `RemoveAttribute` (12), `RemoveComments` (20),
  `RemoveDataAttributes` (16), `Untag` (19), `UntagExcept` (7), `UntagOnly` (4).
- Html Encode : `EncodeHtmlEntities` (2), `DecodeHtmlEntities` (4).
- String : `CaseTo` (1), les sept `CaseToPascal/Camel/Snake/Kebab/Constant/Train/Header`
  (1 chacun), les sept `IsPascal/Camel/Snake/Kebab/Constant/Train/HeaderCased`
  (1 chacun), `PadLeft` (15), `PadRight` (14), `Slugify` (19).
- Variant Encoding : `EncodeValueJson` (3), `WriteForeign` (3), `EncodeJsonWith`
  (3), `ReadForeign` (6), `DecodeJsonWith` (6). Le fichier `DecodeJson.purs`
  déclare bien le dernier nom de module ; le relevé suit la déclaration.

Les collecteurs `Core.Message.Command.Handle.Test.Integration.Test`,
`Infra.EventStore.Postgres.Test.Integration.Test` et
`Infra.Projection.Postgres.Finder.Test.Integration.Test` construisent le client
RabbitMQ différé, créent les bases via `createTestDbs` et gèrent les clients
PostgreSQL avec `bracket`/`afterAll_`. Les 3 tests Core sont donc des intégrations,
pas des tests purs à placer dans M2. Cela décrit leurs fixtures, sans prouver un
échange RabbitMQ dans chacun des 27 cas. `Util.Lexicon.Test` est un module de
lexique, pas une spec supplémentaire.

#### Choix du bloc et preuve TAST

[`Comparaison des candidats`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/candidates.json)
par parcours des imports depuis les sources du profil Rust inchangé :

- **Stash** : seulement `Foreign` et `Foreign.Object` absents des sources
  actives. `Util.Debug.Stash.Stash` est entièrement PureScript, sans FFI b8x
  locale à créer ; il utilise Ref, Object, ST et Unsafe.Coerce.
- `RemoveComments` et `PadLeft` : le module de nettoyage HTML importe aussi
  Regex et les codecs génériques. La frontière manquante comprend
  `Effect.Random`, `Foreign`, `Record.Builder`, `Yoga.JSON` et
  `Yoga.JSON.Generics.TaggedSumRep`. La fermeture complète n'est pas compilée ici.
- Variant Encoding : ajoute encore `Data.Variant`, `Foreign.Index`,
  `Foreign.Object` et `Heterogeneous.Folding` à cette frontière. Différé.

Ces limites sont des modules absents à la frontière du profil, pas l'inventaire
exhaustif de leurs propres dépendances. Ne pas les porter préventivement.

[`Rapport frais`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/report.json),
[`main diagnostique`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/Main.purs),
[`FFI typées`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/foreign.json) :

- Le main importe l'agrégateur Stash original, attend la fin de Spec et exige
  41 réussites, zéro échec et zéro attente. **Il n'a pas été exécuté.**
- Pour ce diagnostic seulement, les sources locales `purust-foreign` et
  `purust-foreign-object` sont ajoutées explicitement au graphe, avec leurs
  configurations et sources identifiées par empreinte. Aucun changement du YAML,
  lockfile ou glob actif ; leur intégration Spago reste à faire.
- `purs --version`, `spago sources --offline --json`, `purs graph` et compilation
  `--codegen corefn` : **sortie 0** ; TAST neuf compilé en environ **2,2 secondes**.
- **228 modules** : 208 communs avec le décodage, 20 ajoutés et 3 retirés
  (main décodage, sa spec et le codec HTML). Aucun module
  `Core.*`, `Infra.*`, `Inter.*` ou `Node.*` dans cette fermeture.
- Les **41 références `Test.Spec.it`** sont retrouvées dans le TAST des huit
  specs, avec les mêmes comptes que dans les sources.
- **54 modules déclarent 295 foreigns** : 22 déclarations nouvelles et les deux
  foreigns HTML retirés. Les nouveaux modules `Foreign`, `Foreign.Object` et
  `Foreign.Object.ST` n'ont aucun `.rs` résolu. Ce nombre de 22 ne représente ni
  les anciens fallbacks HTML ni une obligation de porter 22 fonctions d'emblée.
- Le TAST conserve `typeTable`, les annotations étrangères, les quantificateurs,
  `dataDecls` et `classDecls`. `Object a`, `STObject r a` et l'utilisation explicite
  de `Foreign` dans `_stash :: Ref (Object Foreign)` doivent guider le contrat
  natif ; ne pas attribuer cette hétérogénéité explicite à un effacement des types.

[`Parcours conservatif des références TAST`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/reachability.json)
depuis le main : **six nouveaux symboles étrangers référencés** :

| Opération Stash / Object | Frontière FFI nouvelle |
| --- | --- |
| Initialiser / vider l'objet | `Foreign_Object_empty` |
| Lire / tester la présence d'une clé | `Foreign_Object__lookup` |
| Copier avant modification, exécuter la région ST | `Foreign_Object__copyST`, `Foreign_Object_runST` |
| Insérer / remplacer une valeur | `Foreign_Object_ST_poke` |
| Supprimer une clé | `Foreign_Object_ST_delete` |

Les 16 autres nouvelles déclarations ne sont pas référencées par ce parcours,
dont les cinq fonctions d'inspection de `Foreign`. **Ce n'est pas une preuve
d'élimination par le générateur ni une trace d'exécution.** Le Rust généré,
le premier `cargo check` et les gardes devront confirmer la frontière nécessaire.
Le parcours résout les références qualifiées rencontrées hors `Prim.undefined`,
nœud du TAST à ne pas confondre avec une FFI native validée.

#### Contrat de la micro-étape 0.26 — réalisé ci-dessous

**Astra**, selon la répartition déjà fixée pour le générateur, l'ABI et les
premiers diagnostics. Cible : le stockage `_stash` et les opérations Object/ST
ci-dessus, en commençant par le chemin stockage/lecture/suppression exercé par
les **8 tests originaux `UnsafeStash`**. Ne pas commencer les codecs, Regex,
les services ou les 22 déclarations en bloc.

1. Générer le Rust du diagnostic isolé et lancer un `cargo check` borné dans
   l'image existante ; relever le premier blocage concret, sans changer le profil
   actif ni forger un artefact prêt.
2. Isoler ce blocage dans un reproducteur court. Examiner les types natifs de
   `Object a`, `STObject r a`, `Foreign` et Ref, la copie avant mutation et les
   callbacks de `_lookup`. Conserver le singleton `_stash` entre opérations ;
   ne pas remplacer son comportement par un stockage spécial dans une FFI b8x.
3. Fixer le contrat du **premier correctif/portage seulement**, avec signatures
   issues du TAST et commande de validation. Arrêt sur ce diagnostic et ce
   contrat. Le portage viendra ensuite, avec référence JS fraîche, puis les
   8 cas, puis les 41 cas Stash et les gardes.

**Raccordement ultérieur vers `t -c` :** après validation de Stash, agréger les
specs originales déjà portées (6 HTML + 41 Stash = 47) derrière le défaut Rust,
avec un périmètre partiel affiché et un compteur exact. Les sélections ciblées
restent des outils de diagnostic. Puis élargir ce même agrégat aux **259 tests
sans services pour M2**, puis aux **286 tests actifs pour M4** (recalculer ces
nombres si les sources évoluent), sans exclusions silencieuses. Ce raccordement
n'est pas effectué en 0.25 : `t` choisit encore HTML 2/2.

**Préservation et fraîcheur :** les trois états/manifests intégrés, leurs inputs
courants, les liens et `TARGET=rust` sont vérifiés inchangés pendant le diagnostic.
[`Écart avec les inputs du build 0.24`](../../b8x/run/bak/rust/output/suite-discovery-hXVAsI/baseline.json) :
le binaire `purs` a changé avant le diagnostic (empreinte actuelle
`31c8fb80912fd243cbbca7b464aaa86ba28cca3ca740b9c17e50ca37cf885a90`).
Le contrôle a refusé de traiter l'ancien build comme frais ; il faudra
reconstruire avant le prochain `t`. Aucun compilateur, bundle, FFI, script actif,
source b8x, Dockerfile ou cible modifié par 0.25. Aucun Docker, accès aux services,
nettoyage DB, build Rust ou redémarrage. **M2 reste ouvert.**

### Micro-étape 0.26 — Premier blocage natif Stash isolé

Réalisée le 13 septembre 2026 sur `b8x/master`, `TARGET=rust`. Aucun portage,
changement de générateur, de profil actif ou de binaire prêt. Le diagnostic
utilise l'image `api-cli` existante, Rust/Cargo **1.96.0**, cible Linux ARM64,
sans accès PostgreSQL/RabbitMQ, sans nettoyage DB ni redémarrage.

[`Bilan vérifié`](../../b8x/run/bak/rust/output/stash-native-aDbCeg/summary.json),
[`diagnostic complet`](../../b8x/run/bak/rust/output/stash-native-aDbCeg/full/report.json),
[`diagnostic réduit`](../../b8x/run/bak/rust/output/stash-native-aDbCeg/minimal/report.json).

| Contrôle réel | Résultat |
| --- | --- |
| TAST neuf du Stash complet | 228 modules, sortie 0, environ 2,3 s. |
| Génération Rust `--threaded` | Sortie 0, environ 8,4 s. |
| `cargo check --offline --message-format=json -j 1` dans `api-cli` | **101**, environ 14,6 s ; 5 erreurs `E0425`, toutes sur `STObject`. |
| Reproducteur réduit : TAST puis génération | 66 modules, sorties 0/0, environ 0,4/0,9 s. |
| Cargo réduit, paquet `Purs_StashProbe` | **101**, environ 6,5 s ; les mêmes 5 erreurs dans `Purs_Foreign_Object_ST`. |
| Contrats de la FFI JS originale `Foreign/Object/ST.js` | **8 contrôles passés**, sans compiler ni exécuter la suite b8x. |

Chaque Cargo est borné à 90 secondes dans le worker, avec cible et dossier de
sortie explicites. `cargo check` n'exécute aucun main. Les dépendances Cargo
locales restent dans l'export ; aucun téléchargement n'est nécessaire.
Les sorties complètes, arguments et diagnostics JSON sont conservés, notamment
[`les cinq erreurs initiales`](../../b8x/run/bak/rust/output/stash-native-aDbCeg/full/cargo-errors.json).

#### Cause et réduction

Premier diagnostic natif :
`Purs_Foreign_Object_ST/src/lib.rs:55`, **cannot find type `STObject` in the crate root**.
Les autres occurrences sont la closure de `peek` et les signatures des fallbacks
`delete`, `peekImpl`, `poke` (lignes 60, 70, 72, 73).

Le TAST contient bien `forall a r. STObject r a` et les retours `ST r ...`.
`dataDecls` et `classDecls` sont vides dans ce module : **`STObject` est un
`foreign import data`, pas un ADT PureScript dont le layout aurait été perdu**.
La résolution FFI `.rs` renvoie `null` ; le générateur émet
`Arc<crate::STObject>` dans le module propriétaire et
`Arc<Purs_Foreign_Object_ST::STObject>` chez les consommateurs, mais aucun type
natif `STObject` n'est défini. Les quatre primitives sont des `unimplemented!()`.

[`StashProbe.purs`](../../b8x/run/bak/rust/output/stash-native-aDbCeg/StashProbe.purs)
réduit le cas à `removeKey = delete "key"`, typé
`forall r. STObject r Int -> ST r (STObject r Int)`, avec les dépendances réelles
de `Control.Monad.ST` et `Foreign.Object.ST`. Il n'importe ni Spec, ni Aff,
ni le Stash b8x, ni `Foreign.Object`. Les 66 modules incluent les dépendances
ST/Prelude/Effect/Ref ; ce n'est pas un faux module ST fourni pour l'occasion.
Le check cible son paquet bibliothèque, sans exiger un main fictif.

Cette réduction établit le premier prérequis manquant. Elle ne prouve pas que
le reste de Stash compilera après sa correction. Aucun type factice ou alias
`STObject = UnknownType` n'a été injecté pour obtenir un check vert.

#### Contrat du premier portage — 0.27, Astra, réalisé ci-dessous

**Seule cible fonctionnelle :** créer
[`purust-foreign-object/src/Foreign/Object/ST.rs`](../purust-foreign-object/src/Foreign/Object/ST.rs)
(fichier absent en 0.26), avec le type natif **`pub struct STObject`** et les
quatre primitives étrangères du module. Ne pas remplacer la fonction PureScript
`peek`, qui délègue à `peekImpl`, ni modifier le générateur pour transformer
tous les types étrangers en valeurs indifférenciées.

Le stockage natif est un objet mutable à clés `String`, partagé par identité.
Conserver le pointeur typé `Rc<STObject>` / `Arc<STObject>` attendu par le Rust
généré, une synchronisation sûre dans la variante threaded, et les conventions
existantes de `purust-st` pour les actions différées. Les charges polymorphes
utilisent l'ABI `Value` actuellement émise ; les clés restent des `String`
natives. Ne pas ajouter d'`unsafe impl Send/Sync`, ni recréer un runtime ST/Aff.

[`ABI issue du TAST et du Rust`](../../b8x/run/bak/rust/output/stash-native-aDbCeg/abi.json).
Dans la table, `V = crate::UnknownType` (alias de `Value`),
`H = Arc<STObject>` en threaded, `Rc<STObject>` en mode normal :

| Symbole Rust exact | Arguments → retour | Contrat |
| --- | --- | --- |
| `Foreign_Object_ST_new` | `() → V` | Retourne une action ST ; chaque exécution alloue un objet vide distinct. |
| `Foreign_Object_ST_poke` | `(String, V, H) → V` | Action différée ; insère/remplace puis retourne le même handle. |
| `Foreign_Object_ST_delete` | `(String, H) → V` | Action différée ; retire la clé, même absente, puis retourne le même handle. |
| `Foreign_Object_ST_peekImpl` | `(Func1<V,V>, V, String, H) → V` | Action différée ; appelle `just` une fois si la clé propre existe, sinon retourne `nothing`. |

Le `V` retourné est l'action ST, pas son résultat immédiat. À son exécution,
les handles doivent être emballés de façon compatible avec les conversions
`Value::Class` / `unwrap_class::<Rc/Arc<STObject>>()` des consommateurs générés.
Cette conversion doit être vérifiée par un vrai aller-retour PureScript généré,
pas seulement par des appels Rust directs aux nouvelles fonctions.

Les huit contrôles sur le JS original, exécutés par
[`abi.mjs`](../../b8x/run/bak/rust/output/stash-native-aDbCeg/abi.mjs), fixent :
allocations indépendantes ; écriture différée et identité ; lecture différée et
callback sélectionné ; suppression différée/rejouable ; conservation des autres
clés et distinction absence/valeurs falsy ; références des tableaux/records ;
absence d'une propriété seulement héritée (`toString`) ; callback de lecture
réentrant qui supprime la même clé. **Relâcher le verrou avant le callback**.
Ce sont des contrôles de primitives, pas les 8 tests `UnsafeStash` de b8x.
Node signale uniquement le warning de package JS sans champ `type` ; aucun
`package.json` n'est modifié pour le supprimer.

**Validation prescrite en 0.26 pour 0.27, désormais réalisée :**

1. Ajouter une régression TAST/native dédiée au module ST, avec un vrai parcours
   allocation → écriture → `peek` PureScript → suppression. Vérifier les types,
   les handles et les résultats sur le Rust généré, en modes normal et threaded.
2. Reprendre les huit contrats JS en Rust, notamment la réentrance, l'absence
   d'effet avant exécution et deux objets indépendants. Toute primitive du
   module appelée doit être une FFI réelle, jamais un fallback ou un succès vide.
3. Le contrôle Cargo ciblé doit devenir vert : dans chaque export neuf,
   `cargo check --offline -p Purs_StashProbe`, puis la régression native dédiée
   via `cargo test --offline -p Purs_StashProbe --test foreign_object_st`.
   La fixture et le test sont maintenant créés ; ces commandes sont vertes
   dans les deux modes (résultats 0.27 ci-dessous).
4. Regénérer le diagnostic Stash complet, relever le prochain blocage et s'arrêter
   avant de le corriger. Ne pas étendre ce portage à `Foreign.Object`, aux
   codecs, au singleton, aux services ou à un nouveau flag CLI.

#### Pré-requis suivants observés, non corrigés

- `Foreign.Object.Object` n'a pas non plus de définition native dans l'export.
  Son portage immutable et les frontières `_copyST`, `runST`, `empty`, `_lookup`
  restent séparés. L'ABI générée de `_lookup` est actuellement un retour `V`
  utilisé comme fonctions successives ; ne pas déduire une signature Rust
  uncurried correcte du seul nom `Fn4` dans le TAST.
- `_stash` est généré comme une fonction appelant `Effect_Ref__new` à chaque
  invocation, sans mémorisation visible. **Observation de code, pas encore un
  échec d'exécution reproduit** ; sa conservation entre opérations sera à
  vérifier dès que le chemin natif pourra s'exécuter. Ne pas contourner cela
  par une FFI spéciale b8x qui réimplémenterait le Stash.
- Les copies avant mutation et les callbacks `_lookup` appartiennent au prochain
  contrat Object, pas aux quatre primitives ST de 0.27. La simple disparition
  des cinq erreurs `STObject` ne doit pas être comptée comme 8/8 ou 41/41.

Les sources, le fork `purs` et le bundle purust sont identifiés par empreinte
et vérifiés inchangés, ainsi que les trois états/manifests HTML, le YAML/lockfile
Rust et les liens racine. Les deux diagnostics utilisent le même conteneur,
la même image et le même `StartedAt` avant/après. Aucun `target`, `b -c` ou
`t -c` lancé. Les anciens builds HTML restent périmés par le changement de
`purs` relevé en 0.25. **Zéro test b8x exécuté en 0.26 ; M2 reste ouvert**.
Le chemin prévu reste : prérequis Stash → 8 cas → 41 cas → agrégat de 47 tests
par défaut → tous les tests sans services → suite complète derrière `t -c`.

### Micro-étape 0.27 — FFI `Foreign.Object.ST` portée et validée

**Réalisée avec Astra.** Seul fichier fonctionnel ajouté :
[`Foreign/Object/ST.rs`](../purust-foreign-object/src/Foreign/Object/ST.rs).
`STObject` possède un stockage `HashMap<String, Value>` protégé par `Mutex` ;
le handle reste natif `Rc<STObject>` / `Arc<STObject>`, sans `unsafe impl`.
Les quatre primitives renvoient des actions ST différées et rejouables.
Le callback de lecture et la destruction d'une ancienne valeur se produisent
après libération du verrou. Aucun changement du générateur ni de `Foreign.Object`.

Régression ajoutée à la suite TAST existante :
[`foreign-object-st.mjs`](tests/tast/foreign-object-st.mjs),
[`StashProbe.purs`](tests/tast/fixtures/foreign-object-st/StashProbe.purs) et
[`checks.rs`](tests/tast/fixtures/foreign-object-st/checks.rs).
Le premier run a échoué sur l'absence réelle de `ST.rs`, après compilation TAST
réussie. Avec le portage, chaque mode normal/threaded régénère son Rust depuis
**66 modules TAST frais** : `cargo check --offline -p Purs_StashProbe` sort 0 et
`cargo test --offline -p Purs_StashProbe --test foreign_object_st` passe **10/10**.
Ce sont dix cas exécutés dans deux modes, pas vingt cas distincts ni des tests b8x.

Les tests vérifient les huit contrats primitifs de 0.26, plus les parcours du
PureScript généré : primitives et records, constructeurs `Maybe`, et boxing
`Value::Class` du handle natif. Sont également vérifiées la conservation des
références et leur libération, ainsi que la réentrance sans verrou conservé.
L'export contient exactement une définition réelle de chaque foreign ST,
sans `unimplemented!()`. Le lancement via `node --test` passe également ;
`rustfmt --check` sur `ST.rs` et `git diff --check` sont verts.

Commande reproductible depuis le dépôt compilateur, avec `PURS` pointant vers
le binaire de notre fork TAST :

```sh
PURS=/chemin/vers/le/fork/purs node --test tests/tast/foreign-object-st.mjs
```

**Diagnostic complet et point d'arrêt :** l'export Stash neuf conserve ses
228 modules. TAST et génération sortent 0 ; dans `api-cli` Linux ARM64,
`Purs_Foreign_Object_ST` compile, puis Cargo sort **101 en 17,6 s** avec
**218 erreurs E0425**, toutes `cannot find type Object in the crate root`
dans `Purs_Foreign_Object`. La première est dans `Foreign_Object_values`,
ligne 125 de l'export. Il s'agit de références répétées au même type natif
manquant, pas de 218 causes indépendantes. Ce blocage n'est pas corrigé ici.

Preuves : [bilan vérifié](../../b8x/run/bak/rust/output/stash-st-fixed-jNdIR7/summary.json),
[commandes natives](../../b8x/run/bak/rust/output/stash-st-fixed-jNdIR7/purust-foreign-object-st-7ygqfY/commands.json),
[rapport complet](../../b8x/run/bak/rust/output/stash-st-fixed-jNdIR7/full/report.json),
[diagnostics Cargo](../../b8x/run/bak/rust/output/stash-st-fixed-jNdIR7/full/cargo-errors.json).
`verify.mjs` dans ce dossier revérifie les empreintes et ces résultats.
La FFI finale, les sources PureScript, le fork, le bundle, les trois
états/manifests HTML, le profil Rust et les liens racine sont vérifiés inchangés
entre les mesures finales et leur contrôle. Même conteneur, image et `StartedAt`.
Les branches sont conservées, notamment b8x et `purust-foreign-object` sur `master`.
Aucun `target`, `b -c`, `t -c`, rebuild d'image, redémarrage ou nettoyage DB.
**Zéro test b8x exécuté en 0.27 ; le défaut reste HTML (2 tests), M2 reste ouvert.**

**Micro-étape suivante — 0.28, Astra, réalisée ci-dessous :** isoler ce blocage `Foreign.Object`,
qualifier l'ABI réelle et les contrats de copie/identité aux frontières
`empty`, `_copyST`, `runST`, `_lookup`, puis fixer le portage minimal et sa
régression. Ne pas déduire l'ABI de `_lookup` du seul `Fn4`, ni corriger
préventivement le singleton `_stash`, les codecs ou les services.

### Micro-étape 0.28 — ABI et représentation de `Foreign.Object` qualifiées

**Réalisée avec Astra ; diagnostic, aucun portage de production.**
Le reproducteur [`ObjectProbe.purs`](../../b8x/run/bak/rust/output/object-abi-kl6DE9/ObjectProbe.purs)
conserve les vraies bibliothèques et réduit la fermeture à **100 modules TAST
frais**, sans Stash, Spec ni Aff. Les exports normal et threaded produisent
chacun les **218 E0425 sur `Object`**, alors que `STObject` compile.
Ces contrôles Cargo sont exécutés sur l'hôte ; la référence Linux complète
reste celle de 0.27, dont les entrées sont toujours vérifiées identiques.

Une seconde paire d'exports reçoit uniquement un alias de diagnostic :
`pub use Purs_Foreign_Object_ST::STObject as Object;`.
Le contrôle compare le module au Rust initial, hors cet ajout et les espaces
finaux. **Cargo devient vert dans les deux modes, sans implémenter de foreign.**
Trois contrôles natifs par mode passent : mêmes `TypeId` et boxing du handle
pour l'alias ; incompatibilité d'un wrapper Rust distinct au même downcast ;
contrôle négatif où `ObjectProbe.roundTrip` doit encore paniquer sur une FFI
non implémentée. Ce dernier succès est une **panique attendue**, pas un
aller-retour Object fonctionnel. Les exports initiaux restent rouges et intacts.

#### Signatures mesurées, pas déduites du seul `Fn4`

Le TAST conserve les `ForAll`, le `ST r b`, les deux types étrangers et le
`Fn4 z (a -> z) String (Object a) z`. Le Rust émis choisit toutefois l'ABI
suivante : `V = Value`, `H = Rc<Object>` / `Arc<Object>`.

| Symbole exact | ABI Rust actuelle | Contrat du portage |
| --- | --- | --- |
| `Foreign_Object_empty` | `() -> H` | Objet natif vide, utilisable immédiatement, sans action ST. |
| `Foreign_Object__copyST` | `(V) -> V` | Retourne une action ST ; copie superficielle neuve à chaque exécution, lue au moment de cette exécution. |
| `Foreign_Object_runST` | `(V) -> H` | Exécute l'action une fois et retourne son handle, sans copie supplémentaire. |
| `Foreign_Object__lookup` | `() -> V` | Fournit quatre fonctions `Func1<V,V>` successives : `nothing`, `just`, clé, objet ; la dernière application effectue la lecture synchrone. |

Le caller généré de `lookup` applique exactement quatre `unwrap_func1()` et
attend le résultat `Maybe` boxé, pas une action ST. Le callback `just` lui-même
arrive dans un `Value::Func1`. Conserver ces conventions, même si la FFI JS
originale reçoit ses quatre arguments en un seul appel.
Les conversions de `thawST` et `freezeST` emballent leur handle natif dans
`Value::Class(Rc/Arc::new(handle))` avant le **même** `_copyST(V) -> V`.
Ne pas inventer un argument de direction absent de cette ABI : l'alias commun
permet aux consommateurs de lire le résultat comme `Rc/Arc<Object>` ou
`Rc/Arc<STObject>`, tout en conservant un type natif concret.

#### Contrats JS et domaine effectivement vérifié

Neuf expériences sur les fichiers JS originaux passent : objet vide préservé
par copie/mutation ; copie différée et rejouable ; copie superficielle des
propriétés propres énumérables ; isolation freeze/thaw ; identité de `runST` ;
lecture synchrone distinguant absence et valeurs falsy ; références et callback
réentrant ; lecture des propriétés héritées ; comportement de `__proto__`.

**Écarts à ne pas masquer :** `_lookup` JS utilise `in` et voit notamment le
`toString` hérité, alors que `ST.peekImpl` exige une propriété propre.
L'affectation JS à `__proto__` peut changer le prototype ; le `HashMap` Rust
de 0.27 stocke une entrée ordinaire. La parité de 0.27 porte donc sur ses
contrats testés, pas sur tout le modèle d'objets/prototypes JavaScript.
Le relevé TAST des huit specs Stash trouve **167 applications à clé littérale,
52 clés distinctes, aucune clé calculée ni nom hérité d'Object.prototype**.
Ces écarts ne sont pas sollicités par ces sources de test ; cela ne prouve
pas une compatibilité générale de la bibliothèque.

`empty` est une constante partagée en JS. Le contrat minimal Rust porte sur
son contenu vide et sa non-mutation par les opérations immuables, pas sur
l'identité de pointeur entre deux appels à son getter. Une allocation fraîche
est admise dans ce domaine de validation ; ne pas la présenter comme une
preuve d'identité JS, ni ajouter un cache global ou toucher `_stash` pour cela.
La prise en charge complète des prototypes et des observations d'identité
via des opérations unsafe reste séparée et explicitement non validée.

Preuves : [bilan](../../b8x/run/bak/rust/output/object-abi-kl6DE9/summary.json),
[ABI TAST et callers Rust](../../b8x/run/bak/rust/output/object-abi-kl6DE9/abi.json),
[contrats JS exécutables](../../b8x/run/bak/rust/output/object-abi-kl6DE9/js-contract.mjs),
[expérience d'alias](../../b8x/run/bak/rust/output/object-abi-kl6DE9/representation.json),
[inventaire des clés](../../b8x/run/bak/rust/output/object-abi-kl6DE9/stash-keys.json).
`qualify.mjs` revérifie les entrées et rassemble ces résultats.
Sources, FFI ST, JS originaux, fork, bundle, trois états/manifests HTML, profil
Rust et liens racine inchangés. Aucun changement de branche, de générateur,
de fichier FFI de production, de conteneur, de DB ou de commande CLI.
**Aucun test b8x exécuté ; le défaut reste HTML, M2 reste ouvert.**

#### Contrat du portage — 0.29, Astra, réalisé ci-dessous

1. Créer uniquement `purust-foreign-object/src/Foreign/Object.rs` pour l'alias
   natif et les **quatre primitives ci-dessus**. Réutiliser `STObject`, sans
   wrapper distinct, `unsafe impl`, runtime bis ni changement du générateur.
2. Ajouter à `ST.rs` seulement les petits accès nécessaires à ce partage :
   construction vide, snapshot superficiel indépendant et lecture clonée.
   Garder le stockage/verrou privé ; aucun callback sous verrou. Réexécuter
   les dix régressions ST de 0.27 dans chaque mode.
3. `_copyST` doit retourner une action rejouable qui clone les entrées dans un
   nouvel objet à l'exécution. Une simple copie du `Rc/Arc` serait incorrecte.
   `runST`, à l'inverse, conserve exactement l'identité du handle obtenu.
   Pour `_lookup`, ne rien lire avant la quatrième application et invoquer
   `just` une seule fois, hors verrou, seulement si une entrée est trouvée ;
   sinon rendre le `nothing` fourni. Couvrir le domaine natif de clés ordinaires
   ci-dessus, sans filtre spécial b8x ni annonce de parité des prototypes JS.
4. Ajouter une vraie régression TAST/native `foreign-object.mjs` dans la suite
   compilateur : `empty -> insert -> lookup -> delete`, freeze/thaw dans les
   deux directions, copies différées/rejouables, identité de `runST`, absence
   d'effet de lookup partiellement appliqué, callbacks sélectionnés/réentrants,
   valeurs falsy, payloads primitifs/tableaux/records et conservation/libération
   des références. Les appels doivent traverser le PureScript généré.
5. Exiger, sur des exports neufs normal/threaded, `cargo check --offline
   -p Purs_ObjectProbe` puis `cargo test --offline -p Purs_ObjectProbe
   --test foreign_object`. Ni alias injecté après génération, ni contrôle
   négatif de 0.28 compté comme test fonctionnel. Vérifier la présence des
   quatre FFI réelles et faire échouer tout fallback Object atteint par les
   parcours testés, y compris ceux dont le stub actuel retourne `false` ou `0`.
6. Regénérer le diagnostic Stash complet sous Linux et relever le prochain
   blocage. S'arrêter avant de le corriger ou de raccorder Stash à `t -c`.
   Les neuf autres foreigns Object, `fromHomogeneous`, l'ordre d'énumération,
   le singleton `_stash`, les codecs et les services restent hors de ce portage.

### Micro-étape 0.29 — Object porté, première exécution Stash complète

**Réalisée avec Astra.**
[`Foreign/Object.rs`](../purust-foreign-object/src/Foreign/Object.rs) fournit
l'alias natif `Object = STObject` et les quatre FFI `empty`, `_copyST`, `runST`,
`_lookup`. [`ST.rs`](../purust-foreign-object/src/Foreign/Object/ST.rs) expose
seulement les accès supplémentaires `empty`, `snapshot`, `get` ; le stockage
et le verrou restent privés. `_copyST` copie les entrées à chaque exécution
de son action ; `runST` conserve le handle ; `_lookup` respecte les quatre
applications de l'ABI et appelle le callback hors verrou.
Les limites concernant les prototypes JS, l'identité d'`empty` et les autres
opérations Object restent celles de 0.28. Aucun changement du générateur.

La régression [`foreign-object.mjs`](tests/tast/foreign-object.mjs) et ses
[fixtures](tests/tast/fixtures/foreign-object/ObjectProbe.purs) utilisent les
vraies sources et FFI. Premier run rouge sur l'absence de `Object.rs`, après
TAST réussi ; puis **100 modules TAST frais**, Cargo check 0 et **11 tests
fonctionnels réussis par mode normal/threaded**. Couverture : parcours générés
sur primitives/tableaux/records, insert/delete immuables, freeze/thaw, copies
différées/rejouables et superficielles, identité de `runST`, currying de lookup,
valeurs falsy, réentrance et conservation/libération des références.
Les neuf stubs Object résiduels sont remplacés, dans les seuls exports de test,
par des gardes fatals (sortie 86), chacun vérifié par un appel forcé ; les
retours silencieux `false` et `0` sont inclus. Aucun garde atteint par les
parcours fonctionnels. **18 contrôles négatifs séparés**, non comptés comme
tests fonctionnels. Aucun alias ajouté manuellement au Rust pour faire passer
ces régressions.

La régression ST de 0.27 est rejouée sur **66 modules TAST frais** : Cargo check
0 et **10/10 dans chaque mode**. Total de cette validation : 21 cas fonctionnels
exécutés deux fois, soit **42 exécutions réussies**. `node --test`,
`rustfmt --check` sur les deux FFI et `git diff --check` sont verts.

**Diagnostic Linux :** l'export Stash est regénéré depuis 228 modules TAST.
Le `cargo check` du point d'entrée Stash sort **0 en 21,9 s**, avec 195 crates
`Purs_*` effectivement compilées. Les 228 modules émis ne sont donc pas tous
des dépendances natives du binaire ; notamment `Purs_Foreign` n'en fait pas partie.
La première sonde forçant les 36 fallbacks émis a ajouté cette dépendance et
échoué sur **77 erreurs dans `Purs_Foreign` (8 E0308, 69 E0599)**. C'est un
blocage de cette sonde élargie, **pas du chemin Stash**, laissé non corrigé.
Ses journaux sont conservés séparément (`probe-all-*.json`). Les cinq foreigns
de ce module restent non validés, sans être présentés comme exécutés ou portés.

La sonde est ensuite limitée aux **31 fallbacks des crates déjà atteintes par
le Cargo check initial**. Le binaire et la sonde se construisent (sortie 0),
les 31 appels forcés sortent chacun 86 comme attendu, puis le vrai main Stash
exécute ses **41 tests originaux** sous une borne de 20 s :

```text
12/41 tests passed
Error: Stash: expected 41 successful tests; passed=12, failed=29, pending=0
```

Sortie **101**, exécution en **47 ms**, aucun fallback gardé atteint.
Premier échec : `stores and retrieves a string value`,
`Nothing ≠ (Just "hello")`. Les lectures ne retrouvent pas les valeurs stockées.
Le getter `Util_Debug_Stash_Stash__stash`, ligne 120 de l'export, appelle toujours
`unsafePerformEffect (new empty)` sans mémorisation visible. Cela concorde avec
la réinitialisation suspectée en 0.26 ; **le défaut de conservation de l'état
est maintenant exécuté, mais sa correction générale reste à isoler**.
Les 12 succès portent surtout sur absence/défauts/nettoyage et ne valident pas
la persistance. Ni les huit cas `UnsafeStash` ni le bloc de 41 ne sont verts.

Preuves : [bilan vérifié](../../b8x/run/bak/rust/output/object-port-kUhwKt/summary.json),
[Object natif](../../b8x/run/bak/rust/output/object-port-kUhwKt/purust-foreign-object-ZM4fnd/commands.json),
[ST natif](../../b8x/run/bak/rust/output/object-port-kUhwKt/purust-foreign-object-st-Naf3hV/commands.json),
[exécution Stash](../../b8x/run/bak/rust/output/object-port-kUhwKt/full/stash-execution.json),
[gardes et build](../../b8x/run/bak/rust/output/object-port-kUhwKt/full/runtime.json).
`verify.mjs` rassemble les résultats et revérifie les empreintes des sources,
des FFI, du fork et du bundle. Les profils, trois états/manifests HTML et liens
racine sont inchangés ; même conteneur, image et `StartedAt` avant/après.
b8x et `purust-foreign-object` restent sur `master`, purust sur sa branche
existante `edge`. Aucun `target`, `b -c`, `t -c`, rebuild d'image, redémarrage,
nettoyage DB, nouveau raccordement de suite ou correction du singleton.
**Le défaut CLI reste HTML (2 tests) ; les 41 cas ont été lancés uniquement
dans le diagnostic isolé. M2 reste ouvert.**

### Micro-étape 0.30 — Partage de valeur de module isolé

**Qualification réalisée ; aucun correctif de production.** Le reproducteur
`ModuleInitProbe` utilise les vrais `Effect.Ref` et `Effect.Unsafe`, avec une
FFI de mesure indépendante (`tick` / compteur), sans Object, Stash, Spec ou Aff.
Le fork produit **36 modules TAST et JS frais** ; le bundle inchangé produit
deux exports Cargo normal/threaded. Toutes les commandes de génération, build
et sondes sortent 0 ; les sondes rapportent des valeurs, ce ne sont pas des
tests de parité déclarés verts malgré le défaut.

| Observation | JS frais | Rust normal | Rust threaded |
| --- | --- | --- | --- |
| Initialisations après deux lectures de `shared` | 1 | 2 | 2 |
| Identité des deux handles | identiques | différents | différents |
| Lecture après `store 42` | 42 | 0 | 0 |
| Initialisations après ces lectures + store/load | 1 | 4 | 4 |
| Deux appels à la factory | 2 créations distinctes | idem | idem |
| Création d'une action puis deux exécutions | 0 effet à la création, 2 créations distinctes | idem | idem |

`shared :: Ref Int`, `factory :: Int -> Ref Int` et
`action :: Effect (Ref Int)` sont bien distincts dans les annotations TAST.
Les appels de store/load restent des références à `shared`, pas une copie
de son corps dans chacun des callers. Le getter généré exécute directement
`unsafePerformEffect` et `Ref.new` à chaque accès. Le point de correction est
donc l'émission des bindings de module dans
[`codegenBindingGroup`](src/Purust/CodeGen.purs), qui transforme aussi les
valeurs sans paramètres en `pub fn` sans stockage persistant. Rien dans cette
preuve n'impose de modifier le fork, PBO ou les FFI Ref/Object.
`ShareNullaries` ne règle pas ce problème : son partage est local à une
construction, sans racine persistante de module.

**Expérience ciblée, pas implémentation du générateur :** seules des copies
du module Rust dans les exemples diagnostiques reçoivent un getter mémorisé
pour `shared`. L'export original et toutes les FFI restent intacts.
Une `thread_local!` + `std::cell::OnceCell<Value>` en normal, et une
`static std::sync::OnceLock<Value>` en threaded, donnent : **une initialisation,
même handle, lecture 42** ; les contrôles factory/action restent inchangés.
Deux threads successifs échangent également la même référence et retrouvent
42 ; huit threads accédant simultanément à la cellule produisent une seule
initialisation et le même handle. Le mode normal est ici mono-thread ; son
stockage local au thread n'est pas une preuve de partage inter-thread `Rc`.

**Deux sémantiques à distinguer :** JS initialise `shared` dès l'import du
module, avant le premier accès du programme. La cellule expérimentale est
paresseuse : compteur 0 avant ce premier accès, contre 1 en JS. Un appel
explicite préalable au getter donne le même résultat sur ce petit probe, mais
**ne valide pas un mécanisme général d'initialisation des modules**.
Le main Rust actuel n'a pas cette phase : il obtient puis exécute `main`.
La correction du partage et l'initialisation anticipée sont donc deux pièces
distinctes ; ne pas annoncer la parité JS complète après la seule mémorisation.
L'ordre des dépendances, les valeurs récursives/polymorphes, les fonctions
calculées par une expression stricte, les échecs/réentrances d'initialisation
et la destruction des cellules restent non qualifiés par cette expérience.

Preuves : [bilan vérifié](../../b8x/run/bak/rust/output/module-init-1LKf6N/summary.json),
[reproduction originale](../../b8x/run/bak/rust/output/module-init-1LKf6N/report.json),
[types TAST et getters](../../b8x/run/bak/rust/output/module-init-1LKf6N/abi.json),
[expérience de mémorisation](../../b8x/run/bak/rust/output/module-init-1LKf6N/memo-experiment.json).
`diagnose.mjs`, `memo-experiment.mjs` et `qualify.mjs` conservent les commandes,
résultats et empreintes. Vérification finale des entrées TAST, FFI, générateur,
fork, bundle, trois états/manifests HTML, profil Rust et liens racine.
Exécution sur l'hôte seulement : aucun conteneur, DB, `target`, `b -c`, `t -c`
ou artefact HTML prêt modifié ; b8x reste sur `master`, purust sur `edge`.
**Stash n'est pas rejoué : son dernier bilan demeure 12/41 ; M2 reste ouvert.**

#### Contrat 0.31 — partage borné, réalisé ci-dessous

1. Ajouter une régression permanente TAST/native `module-values.mjs`, à partir
   du reproducteur, puis constater le rouge avec le générateur actuel.
   Garder la comparaison JS indépendante ; ne pas reprendre les getters
   corrigés manuellement comme preuve d'un correctif de génération.
2. Traiter les **bindings de module non récursifs, de type fermé, sans
   paramètre de fonction**, avec les types TAST et la forme du binding.
   Conserver l'ABI des getters ; stocker une fois leur valeur avec la
   représentation Rust déjà déterminée, puis la cloner aux accès suivants.
   Ne pas convertir tous les types natifs en `Value` : celui du probe est
   déjà représenté ainsi par l'ABI actuelle de Ref. Aucun traitement par nom
   `_stash`, type Ref spécial, FFI b8x ou cache d'`Object.empty`.
3. Utiliser un stockage adapté au mode : cellule locale au thread pour le
   runtime normal `Rc`, cellule partagée entre threads pour `Arc`. Passer
   explicitement ce choix à la génération ou au runtime ; la substitution
   textuelle `Rc -> Arc` ne transforme pas une `thread_local!` en singleton
   partagé. Pas d'`unsafe impl Send/Sync` ni de stockage global dynamique bis.
4. Ne pas mémoriser le résultat des appels d'une vraie fonction, une
   allocation locale ou l'exécution d'un Effect. Un binding `Effect a` peut
   partager **l'action construite**, jamais son résultat : chaque exécution
   doit encore faire ses effets. Exclure les foreigns, workers et constructeurs
   synthétiques de cette nouvelle règle ; ne pas assimiler tout `fn()` Rust
   à une valeur de module. Les bindings récursifs, polymorphes et les valeurs
   de fonction calculées restent hors de ce premier correctif explicite.
5. Valider store/load, identité, deux appels à une factory, action obtenue
   plusieurs fois et rejouée, valeur dépendant d'une autre valeur de module,
   puis partage entre threads et première lecture concurrente. Fixer et tester
   une politique explicite de réentrance/échec d'initialisation : aucune attente
   infinie ni exécution de callbacks sous un verrou global ajouté. Ne pas
   prétendre que l'expérience 0.30 a couvert ces derniers cas.
6. Recompiler le bundle, générer des exports **neufs** normal/threaded et
   exécuter la régression, puis celles d'Object/ST. Reprendre le diagnostic
   Linux avec les gardes de fallbacks, d'abord les huit cas `UnsafeStash`, puis
   les 41 Stash ; relever le résultat réel et s'arrêter au prochain défaut.
   Ne pas modifier le défaut CLI ni réutiliser un état HTML devenu périmé.

**Après 0.31 :** garder un jalon explicite sur l'initialisation anticipée
(phase d'initialisation des modules atteignables, dépendances avant consommateurs,
valeurs avant l'exécution de main, sans exécuter les actions Effect stockées).
Son ordre, sa portée et les bindings exclus ci-dessus demandent leur propre
qualification ; un préchauffage manuel du probe n'en est pas l'implémentation.
Revalider Stash avant de raccorder l'agrégat HTML + Stash, sans confondre ces
succès avec la parité générale de toutes les initialisations JS.

### Micro-étape 0.31 — Partage implémenté, Stash 41/41

**Réalisée avec Astra.**
[`Purust.ModuleValues`](src/Purust/ModuleValues.purs) sélectionne les bindings
non récursifs depuis leurs annotations TAST originales, avec type fermé,
sans fonction PureScript à la racine ni constructeur synthétique.
Les annotations manquantes, `Any`, variables, quantificateurs, contraintes
et rangées ouvertes restent exclues. Le générateur revérifie la forme finale
(valeur sans paramètres, groupe non récursif, pas de worker privé).
`Main` transmet explicitement la sélection et le mode à
`codegenModuleWithOptions`. Les anciennes API de génération sans cette
sélection conservent leur comportement ; aucun heuristique sur le nom `_stash`
ou sur l'ABI nullaire de l'ensemble des foreigns.

Les getters gardent leur ABI et clonent une valeur conservée dans une
`module_values::Cell<T>` : cellule `thread_local!` en normal, `static` partagée
en threaded. `T` conserve la représentation existante (`i64` testé, et non
conversion universelle vers `Value`). L'initialisation construit une action
Effect sans l'exécuter ; ses exécutions et les appels des factories restent
distincts et rejouables. Ni `Effect.Ref`, ni `Effect.Unsafe`, ni Object/ST,
ni les sources b8x n'ont été modifiés.

Le [support d'initialisation](src/Purust/ModuleValues.js) contient des cellules
typées et un petit graphe d'attente partagé **d'identifiants de threads/cellules
seulement**, pas une seconde table globale de valeurs PureScript.
Les mutex sont relâchés pendant l'initialiseur, les callbacks et le déroulement
de pile ; le clonage se fait après le retour du getter de cellule.
Un échec marque définitivement cette cellule en échec : les appels suivants
ne rejouent pas des effets partiellement exécutés. Une dépendance cyclique
sur le même thread ou entre threads provoque un diagnostic, puis réveille
les éventuels autres lecteurs. Les dépendances acycliques concurrentes restent
autorisées. Aucune déclaration `unsafe impl Send/Sync`.

**Régression rouge puis verte :**
[`module-values.mjs`](tests/tast/module-values.mjs) compile **36 modules TAST
et JS frais**, utilise les vrais Ref/Unsafe et une FFI de mesure par compteur.
Avec l'ancien bundle, Cargo compile mais la première comparaison d'identité
échoue, sortie 101 (`module value must preserve its handle`). Après correction
et reconstruction du bundle, les exports neufs normal/threaded passent :

- 5 parcours PureScript générés par mode : partage/store/load, factory,
  action obtenue plusieurs fois et rejouée, dépendance entre valeurs de module,
  valeur native `Int` conservée dans `Cell<i64>` ;
- 5 sondes du support de cellule par mode : échec non rejoué, cycle indirect,
  cycle inter-thread, échec concurrent, dépendance concurrente acyclique ;
- 1 sonde threaded supplémentaire : huit premiers accès concurrents partagent
  le même handle, puis écriture/lecture sur des threads distincts.

Soit **21 sondes natives réussies**. Les sondes de politique d'échec sont
bornées à 10 s et distinguent leurs paniques attendues d'un blocage.
La référence JS indépendante reste anticipée au chargement ; ces tests
**ne valident pas une initialisation anticipée générale en Rust**.
Le nouveau [test de sélection](tests/codegen/module-values.mjs) couvre aussi
les exclusions TAST et le stockage natif. La suite codegen complète passe
**52/52** ; Object et ST repassent respectivement **11 et 10 tests dans
chaque mode** (42 exécutions), plus les 18 contrôles négatifs Object séparés.
Le build du compilateur/bundle réussit ; 65 avertissements sont signalés dans
Main/CodeGen, aucun dans le nouveau module. Pas de nettoyage hors périmètre.

**Validation Linux :** un export frais contient **229 modules TAST** : les
228 du diagnostic Stash et un main supplémentaire pour les seuls huit cas
UnsafeStash. Le Cargo check du main complet réussit en **22,1 s**, avec
**195 crates `Purs_*` réellement compilées**. Les 31 fallbacks de ce chemin
reçoivent des gardes fatals et sont chacun forcés avec sortie 86 ; les cinq
foreigns de `Purs_Foreign`, hors de ce graphe natif, ne sont pas ajoutés aux
appels de la sonde ni déclarés validés.

Le premier build de la nouvelle sonde UnsafeStash échoue sur un point-virgule
superflu dans **son exemple Rust** (`()` au lieu de `Value`). Ce défaut de
sonde est corrigé séparément, sans toucher au compilateur ni aux tests originaux ;
ses logs sont conservés sous `probe-semicolon-*.json`. Le build repris sort 0,
les 31 gardes passent, puis les vrais tests donnent :

```text
UnsafeStash : 8/8 tests passed, sortie 0, 13 ms
Stash      : 41/41 tests passed, sortie 0, 46 ms
```

Stderr vide pour les deux exécutions, aucun fallback gardé atteint. Les huit
cas sont inclus dans les 41 : **41 tests b8x distincts validés**, pas 49.
Le getter `_stash` mémorisé provient du nouveau générateur, sans patch manuel
du singleton dans cet export. Les seules instrumentations Rust sont les
gardes de diagnostic et les exemples d'exécution/contrôle.

Preuves : [bilan vérifié](../../b8x/run/bak/rust/output/module-sharing-PNEsaw/summary.json),
[régression rouge](../../b8x/run/bak/rust/output/purust-module-values-8gDgYC/commands.json),
[régression finale](../../b8x/run/bak/rust/output/purust-module-values-h9PPOW/commands.json),
[suite codegen](../../b8x/run/bak/rust/output/module-sharing-PNEsaw/codegen.json),
[8 cas](../../b8x/run/bak/rust/output/module-sharing-PNEsaw/unsafe-stash-execution.json),
[41 cas](../../b8x/run/bak/rust/output/module-sharing-PNEsaw/stash-execution.json).
`verify.mjs` contrôle les résultats et empreintes des entrées ; les FFI,
profils, trois états/manifests HTML et liens racine sont inchangés.
Même conteneur, image et `StartedAt` avant/après ; b8x reste sur `master`,
purust sur `edge`. Aucun `target`, `b -c`, `t -c`, rebuild d'image,
redémarrage ou nettoyage DB exécuté.

**Limites conservées :** partage paresseux, types/groupes exclus ci-dessus,
pas de parité générale de l'ordre d'initialisation JS ni de promesse de partage
inter-thread pour le mode normal `Rc`. Les cellules sont des racines retenues
(jusqu'à la fin du thread normal ou du processus threaded), pas des valeurs
libérées après chaque getter. Le jalon d'initialisation anticipée reste ouvert.
**À l'issue de 0.31, le défaut CLI était encore HTML (2 tests) ; M2 reste ouvert.**

**Contrat 0.32 — réalisé ci-dessous, Astra :** raccorder le bloc Stash désormais
validé et préparer l'agrégat HTML + HTML Decode + Stash (**47 tests**) comme
défaut Rust. Reconstruire les entrées/artefacts avec le bundle actuel, revalider
les six tests HTML et le total agrégé, les codes d'échec et le chemin CLI.
Ne pas promouvoir les anciens artefacts HTML devenus périmés. Ce jalon réduit
le chemin restant vers `t -c` complet ; il ne valide ni les 259 tests sans
services ni les 286 tests actifs. Garder le chantier d'initialisation anticipée
distinct, sans en faire une correction préventive de Stash maintenant vert.

### Micro-étape 0.32 — Agrégat de 47 tests par défaut, CLI validée

Réalisée sur `b8x/master`, cible Rust persistante ; purust reste sur `edge`.
Le nouveau main `Test.Rust.Main` collecte **les specs originales** HTML Encode,
HTML Decode et Stash, attend Spec/Aff et exige exactement **47 réussites,
zéro échec et zéro attente**. Les options du CLI et du driver partagent le
même défaut `default`. `--suite stash` sélectionne séparément les 41 Stash ;
`html`, `html-decode` et `html-negative` gardent leurs contrats 2/4/3.
Construire une suite explicite ne modifie jamais la sélection par défaut.

Le profil Spago et son lockfile ajoutent seulement les dépendances locales
`foreign` / `foreign-object`, déjà qualifiées ; aucune mise à jour de version.
Le graphe reçoit les chemins explicites de Stash, puis sélectionne la fermeture
de chaque main. Aucun portage FFI, changement du compilateur ou de son bundle.

**Gardes FFI :** toutes les définitions fallback émises restent instrumentées
par la sortie fatale 86. Les sondes ne forcent que les crates déjà présentes
dans les dépendances du binaire. Le lecteur strict des manifests générés est
recoupé avec `cargo metadata` filtré pour la cible Linux avant compilation ;
un format inattendu ou un désaccord bloque le build. Les cinq stubs `Foreign_*`
hors du graphe natif Stash restent gardés, mais ne sont ni ajoutés artificiellement
au binaire ni annoncés éprouvés. Cela évite le faux blocage observé en 0.31.

Les cinq builds utilisent du **TAST et du Cargo neufs**, le fork explicitement
sélectionné et le bundle de 0.31, sous Linux ARM64 avec l'image existante :

| Suite | TAST | Crates natives `Purs_*` | Gardes forcés | Résultat réel |
| --- | ---: | ---: | ---: | --- |
| `default` | 231 | 198 | 31 | **47/47 → 0** |
| `stash` | 228 | 195 | 31 | **41/41 → 0** |
| `html` | 211 | 179 | 22 | **2/2 → 0** |
| `html-decode` | 211 | 179 | 22 | **4/4 → 0** |
| `html-negative` | 211 | 179 | 22 | **2/3 → 101**, assertion et erreur finale Aff visibles |

Chaque garde forcé sort 86 avec son marqueur exact ; aucun n'est atteint
par les suites réelles. Les tests des suites explicites sont inclus dans
l'agrégat : **47 tests b8x distincts**, pas 94. Le négatif est une fixture séparée.

Le [rapport vérifié 0.32](../../b8x/run/bak/rust/output/integrated/default-validation-s7TK9C/report.json)
conserve les 20 contrôles et les cinq manifests. `bin/t -c`, `bin/run Test`,
`bin/run -e Test` et le lancement direct dans `api-cli` passent tous à **47/47**.
Après les builds ciblés et le négatif 101, `bin/t` reprend exactement
[`build-lsaoHX`](../../b8x/run/bak/rust/output/integrated/default/build-lsaoHX/manifest.json),
sans rebuild implicite. Le sélecteur DB est vide avant/après le vrai `t -c` :
**aucune base supprimée**. La suppression de bases présentes reste couverte
par les fixtures, pas par cette exécution réelle.

**49 régressions rapides passent**, dont le défaut 47, le refus des résumés
partiels, les sélections isolées, les statuts/signaux/nettoyages et quatre
contrôles du graphe Cargo/gardes. Le runner Docker général a été adapté au
nouveau défaut et vérifié syntaxiquement ; ses scénarios de corruption et
d'interruption volontaire ne sont pas relancés ici. Le rapport 0.32 couvre
les builds et chemins CLI réels listés ci-dessus.

**Régression annexe corrigée :** le préparateur historique voyait les nouveaux
mains mais pas leurs imports Stash : [échec prouvé](../../b8x/run/bak/rust/output/prepare-SgzR6N/commands.json).
Il partage désormais l'inventaire de sources du driver, tout en conservant
son entrée HTML seule ; [TAST neuf réussi](../../b8x/run/bak/rust/output/prepare-OVtZYX/manifest.json),
**211 modules**, sans génération ni exécution Rust par ce préparateur.

Les sources/assertions originales, FFI, bundle, scripts partagés, Dockerfile,
liens racine et cible sont vérifiés inchangés. Même conteneur, image et
`StartedAt` avant/après ; aucun rebuild d'image ni redémarrage. `b` a généré
des artefacts frais ; **`b -c` n'a pas été relancé** dans cette étape.
**M2/M4 restent ouverts : le défaut couvre 47 tests, pas encore 259/286.**

**Contrat 0.33 — réalisé ci-dessous, Astra :** reprendre les candidats hors Stash
de 0.25 (`RemoveComments` et `PadLeft`), comparer leur delta avec le profil
désormais enrichi d'Object/ST, puis retenir une seule tranche. Produire son
TAST frais et tenter un `cargo check` Linux borné dans un export diagnostique,
sans modifier le défaut actif de 47 tests. Relever le premier blocage concret
et fixer le contrat du prochain correctif/portage seulement ; ne pas porter
Regex/JSON/les services en bloc. Si Cargo passe, qualifier les fallbacks avant
le premier run. Garder l'initialisation anticipée comme chantier distinct.

### Micro-étape 0.33 — RemoveComments retenu, premier blocage isolé

Diagnostic réalisé sur `b8x/master`, cible Rust, purust sur `edge`, sans portage
ni modification du profil actif ou du compilateur. Le
[bilan vérifié](../../b8x/run/bak/rust/output/next-slice-HjzJTe/summary.json)
conserve les preuves et l'identité du défaut 47 tests.

**Comparaison actualisée :** Object/Foreign sont désormais disponibles dans
le profil, mais `RemoveComments` et `PadLeft` rencontrent tous deux la frontière
`Effect.Random`, `Record.Builder`, `Yoga.JSON` et `Yoga.JSON.Generics.TaggedSumRep`.
Après résolution diagnostique, les fermetures des specs seules comptent
**214 modules contre 216**. `PadLeft` importe lui aussi le nettoyage HTML via
`Util.Type.String.String` : il n'évite donc pas cette frontière. Choix retenu :
**`Util.Html.Clean.Test.RemoveComments`, 20 tests originaux**, au graphe plus petit.
Voir les comparaisons [profil actif](../../b8x/run/bak/rust/output/next-slice-HjzJTe/candidates-active.json)
et [dépendances résolues](../../b8x/run/bak/rust/output/next-slice-HjzJTe/candidates-resolved.json).

Le diagnostic possède son propre `spago.yaml`/lockfile, au package set 77.10.1.
Il conserve les sources communes du profil, ajoute les sources locales
`random`, `record`, `yoga-json`, `nullable`, `variant`, et résout les dépendances
transitives hors ligne, notamment `js-date` 8.0.0, `js-bigints` 2.2.1 et
`yoga-tree` 1.0.0. Aucun override ni lockfile du profil actif n'est changé.
Les noms `JS.*` ici sont des modules de bibliothèques, pas des imports Node
ni une validation de leurs FFI Rust.

**Preuve complète avant le premier blocage :**

- `purs graph`, TAST et génération threaded réussissent. Le main de diagnostic
  importe la spec originale, attend Spec/Aff et exige 20/20, zéro attente.
- **247 modules TAST frais**, soit **+29 / −13** par rapport au défaut de 231 ;
  compilation TAST en environ **2,0 s**. Les 20 références `Test.Spec.it`
  sont vérifiées dans le TAST. Aucun `Core.*`, `Infra.*`, `Inter.*`, `Node.*`.
- **399 déclarations étrangères**, dont 102 nouvelles ; 93 ne sont pas
  fournies textuellement par une `.rs` résolue. Ces nombres ne constituent
  ni 102 portages nécessaires ni des fallbacks qualifiés par exécution.
- Le [parcours conservatif TAST](../../b8x/run/bak/rust/output/next-slice-HjzJTe/reachability.json)
  ne référence que quatre nouvelles FFI depuis ce main : `Data.String.CodePoints`
  `_singleton`, `_toCodePointArray`, `_take`, `_unsafeCodePointAt0`.
  Elles existent déjà dans la vraie `CodePoints.rs`. Ce relevé n'est ni une
  trace d'exécution ni une preuve d'élimination des autres déclarations.
- Cargo Linux confirme **217 crates natives `Purs_*`**. Le
  [`cargo check`](../../b8x/run/bak/rust/output/next-slice-HjzJTe/cargo-check.json)
  s'arrête en environ **3,0 s**, sortie **101**, avec **14 erreurs de syntaxe
  dans `purust_core`** : `expected identifier, found reserved keyword final`.

**Cause établie :** le record `{ b, current, final }` de `Yoga.Tree` entre dans
la génération du support de records. `sanitizeIdent` ne traite pas `final` ;
les structs et accès produits contiennent `pub final: …`, `r.final`,
`make_mut(r).final`, etc. L'échec précède toute exécution de `RemoveComments`
et toute qualification native de ses FFI. Ne pas modifier le code de Yoga.Tree,
renommer la clé PureScript ni démarrer un portage JSON pour contourner ce point.

**Réduction empirique :** le premier essai d'un module sans imports a buté sur
la dépendance `Purs_Record_Unsafe` requise par les records générés ; ce problème
de montage est conservé dans `normal-check.json`, pas compté comme une preuve
du mot réservé. Le reproducteur qualifié inclut le vrai `Record.Unsafe` :
**deux modules TAST**, sans Stash, Spec, Aff, Yoga, Regex ni FFI nouvelle.
Il utilise `{ final :: Int, final_kw :: Int }`, construction, lecture empruntée,
mise à jour ordinaire et opérations dynamiques de la vraie FFI Record.
Les deux exports neufs [normal/threaded](../../b8x/run/bak/rust/output/next-slice-HjzJTe/minimal-report.json)
reproduisent chacun **14 erreurs `final`, sortie 101**.

**Expérience bornée, pas un correctif livré :** dans deux autres exports,
seule l'orthographe des champs natifs devient `r#final` : 14 sites dans le
support de records et un site de construction par mode. Les clés dynamiques
restent `"final"`, les helpers `get_final` / `set_final` et les noms `Record_*`
restent inchangés. Aucune modification de `final_kw`, de la FFI ni du bundle.
Les [deux tests natifs par mode](../../b8x/run/bak/rust/output/next-slice-HjzJTe/experimental-proof.json)
passent : champs distincts, lecture empruntée, mises à jour ordinaires/dynamiques,
élargissement du record et conservation de l'original par copie-sur-écriture.
`verify.mjs` contrôle le delta exact, à un saut de ligne terminal normalisé près.

**Arrêt au contrat convenu :** aucun correctif permanent, aucun nouveau run
b8x, pas de reprise du grand export pour découvrir/corriger d'autres erreurs.
Les gardes des 93 déclarations ne sont pas qualifiés à ce stade, puisque Cargo
ne passe pas. Les cinq états/manifests intégrés, leurs inputs, les sources/FFI,
le bundle, liens et cible sont inchangés ; même conteneur/image/`StartedAt`.
Aucun `target`, `b`, `t -c`, nettoyage DB, rebuild d'image ou redémarrage.
**Défaut conservé : 47 tests. M2 et M4 restent ouverts.**

#### Contrat 0.34 — Correctif borné de l'identifiant de champ `final` (réalisé)

**Astra**, car le correctif concerne la génération Rust, pas le portage d'une FFI.

1. Ajouter la régression permanente issue des deux modules ci-dessus, rouge
   avec le bundle actuel. Garder `final` et `final_kw` dans le même record.
2. Distinguer l'identifiant d'un champ Rust des noms composites de structs,
   getters/setters et symboles FFI. L'expérience `r#final` qualifie cette
   distinction pour le cas rencontré ; ne pas injecter `r#` au milieu de
   `Record_*` / `get_*`, ni remplacer globalement `final` par `final_kw`.
3. Appliquer l'échappement cohérent à tous les sites concernés : déclaration,
   construction, accès/borrow, mise à jour et conversion vers record dynamique.
   Conserver la clé logique PureScript `"final"`, la distinction des deux champs,
   les types TAST et les conventions FFI existantes. Ne pas annoncer une
   couverture générale de tous les labels/mots réservés avec ce seul cas.
4. Reconstruire purust, valider les deux modes avec les vrais accès Record,
   puis les régressions codegen/records pertinentes. Générer de nouveau le
   diagnostic `RemoveComments` et relever le premier blocage résiduel, sans
   corriger préventivement Yoga/Regex/Foreign ni élargir le défaut de 47.
5. Un changement de bundle rend les builds CLI périmés : reconstruire et
   revalider au minimum le défaut **47/47**, sans forger un état prêt ni
   réutiliser les copies expérimentales. Qualifier les gardes avant tout
   premier run des 20 tests si le grand Cargo passe.

#### Résultat 0.34 — Champ `final` corrigé, défaut 47 revalidé

Réalisé le 13 septembre 2026 sur b8x `master` (`98c43f7`) et purust `edge`
(`64e05e3` + diff courant), sans commit ni changement de branche.

Preuves conservées dans `b8x/run/bak/rust/output/` :

- `field-keyword-0Hguvt/summary.json`, vérifié par `verify.mjs` ; commandes
  des régressions dans `codegen.json`, `keyword.json` et `records.json`.
- Rouge : `field-keyword-0Hguvt/purust-record-keyword-ct1H6K/commands.json` ;
  ancien bundle `be8f645241def832099d958a96cc542819bd6c7f47175857290fb415c12a2f74`,
  échec Cargo 101 sur **14 erreurs `final`**, avant ajout des tests Rust à l'export.
- Vert : `field-keyword-0Hguvt/purust-record-keyword-3cE12h/commands.json` ;
  nouveau bundle `772bce8b38d9d8259ceaeadd875cd91a5e07e993cdd821297cb9e6bfcc7685d9`.
- Nouveau diagnostic `RemoveComments` : `remove-comments-2tYjyH/report.json`,
  `cargo-check.json` et `cargo-errors.json` ; les copies expérimentales 0.33
  n'ont pas servi de build de validation.

**Correctif permanent.** `src/Purust/CodeGen.purs` sépare `recordFieldIdent`
de `sanitizeIdent` : seul le champ natif `final` devient `r#final`. Déclarations,
construction, getters, borrows, setters et conversions dynamiques sont cohérents.
`Record_final_final_kw`, `get_final`, `set_final`, les clés `"final"` / `"final_kw"`
et les conventions FFI restent inchangés. Ce n'est pas une couverture générale
de tous les mots réservés ou collisions de labels Rust.

Régression permanente : `tests/codegen/record-keyword.mjs`,
`tests/tast/record-keyword.mjs` et `tests/tast/fixtures/record-keyword/`.
Le runner compile **deux modules TAST frais**, emploie la vraie FFI
`Record.Unsafe.rs`, vérifie l'export non retouché avec Cargo, puis exécute
**trois tests natifs dans chacun des modes normal/threaded** : coexistence des
champs, accès/borrow/update, record historique `Record_a`, clés dynamiques,
élargissement et conservation de l'original par copy-on-write.

Commandes de validation : fork local dans `PURS` et le `PATH` pour
`npm run build`, puis `node tests/tast/record-keyword.mjs`,
`node --test tests/codegen/*.mjs` et `node --test` sur
`tests/tast/{record-borrows,record-root-move,record-set,module-values}.mjs`.
Résultats : build **0 erreur, 65 avertissements existants**, **53/53 codegen**,
**6 tests natifs du nouveau cas** et **quatre suites TAST ciblées vertes**.
La suite TAST complète et les autres backends ne sont pas réexécutés ici.

**CLI réel.** `bin/t` refuse d'abord l'ancien artefact à cause du nouveau
`bin/purust.js` (sortie 1, `stale-default.json`). Après `env PURS=<fork> bin/b`,
le build neuf `integrated/default/build-uBnwKL/manifest.json` contient
**231 modules TAST**, 31 gardes natifs éprouvés par appels forcés et cinq
fallbacks gardés hors fermeture native. `bin/t`, `bin/run Test` puis `bin/t -c`
passent chacun **47/47**, sortie 0, aucun fallback gardé atteint.
Le sélecteur DB est vérifié vide avant `-c` ; résultat `Rust database cleanup: []`,
aucune base supprimée. `b -c` n'est pas répété : le compilateur vient d'être
reconstruit explicitement et `bin/b` régénère déjà TAST/Cargo.
Les quatre suites explicites n'ont pas été reconstruites avec ce bundle :
leurs succès 0.32 restent historiques et leurs artefacts devront être rebâtis
avant réexécution, sans contourner le contrôle de fraîcheur.

**Prochain blocage mesuré.** Le diagnostic isolé régénère **247 modules TAST**
et une fermeture Cargo de **217 crates PureScript**, avec le nouveau bundle.
`cargo check --offline --locked --target aarch64-unknown-linux-gnu -p purust_output
--bin purust_output --message-format=json` termine en environ cinq secondes,
sortie **101**. `purust_core` compile ; les 117 erreurs E0425 restantes sont
**35 occurrences de `Nullable` absent** dans `Purs_Data_Nullable` et
**82 de `BigInt` absent** dans `Purs_JS_BigInt`. Le premier diagnostic observé
est `Data_Nullable_toNullable`, ligne 64 de son export. Ces nombres décrivent
ce run Cargo parallèle, pas 117 causes indépendantes ni un ordre garanti.

Les types et FFI suivants ne sont pas corrigés ; **aucun des 20 tests
RemoveComments n'est exécuté**, les 93 déclarations fallback de ce diagnostic
restent à qualifier. Sources/FFI et profil b8x inchangés ; empreintes vérifiées.
Même conteneur, image et `StartedAt` qu'en 0.33, sans rebuild ni redémarrage.
**Défaut conservé et frais : 47 tests. M2 et M4 restent ouverts.**

#### Contrat 0.35 — Qualifier `Data.Nullable` sans portage en bloc

**Astra** : le type étranger polymorphe et son ABI exigent une qualification.

1. Isoler `Data.Nullable` dans un petit reproducteur TAST frais, sans
   Yoga/BigInt/Spec/b8x ; reproduire l'absence du type natif normal/threaded.
2. Confronter le TAST, les signatures générées et la vraie FFI JS pour
   `null`, `notNull`, `nullable` (`Fn3`), puis `toMaybe` / `toNullable`.
   Fixer le contrat de représentation, les conversions, le partage et le cas
   imbriqué `Nullable (Nullable a)` ; ne pas choisir un alias sur la seule
   base de sa capacité à compiler.
3. Définir la régression native/JS et le correctif minimal à partir de ces
   preuves. Si une expérience Rust est nécessaire, la limiter aux exports
   isolés et conserver une preuve exacte du delta.
4. S'arrêter au diagnostic et au contrat : pas encore de portage permanent
   Nullable, pas de correction BigInt ni d'élargissement du défaut 47.

## Phase 1 — Profil et sélection explicite du runtime Rust

- [x] Ajouter la configuration dédiée `b8x/run/bak/rust/spago.yaml` et son
  lockfile ; le profil de préparation utilise `prepare.mjs`.
- [x] Définir la sélection des sources et des dépendances du profil minimal :
  fermeture de 211 modules par `purs graph`, sans les modules applicatifs
  et intégrations hors périmètre.
- [x] Configurer les overrides `purust-*` dans le workspace isolé ; les
  arguments du futur backend sont enregistrés dans le manifeste.
- [x] Activer la génération Rust dans le driver isolé avec prérequis et
  fallbacks qualifiés (0.20 : builds et exécutions Linux positif/négatif).
- [ ] Fixer les versions et le lockfile du profil. La baseline b8x utilise
  `spec` 8.1.1 et `spec-node` 0.0.3 ; `purust-spec` annonce 8.1.2 et un autre
  package set. Vérifier la compatibilité des API et des tests sans mettre à
  jour implicitement les profils existants.
- [ ] Fixer explicitement le binaire du fork PureScript, la version Spago,
  le backend recompilé et leurs révisions. Réutiliser la méthode des runners
  `purust-*` validés, en vérifiant les chemins depuis le répertoire de travail.
- [x] Rendre l'export Cargo portable avec runtime embarqué et dépendances de
  chemin internes/relatives (0.19, génération et déplacement en deux modes).
- [x] Dans le driver isolé, distinguer la racine b8x de l'installation de
  purust et utiliser cet export pour Cargo Linux (0.20). Le raccordement aux
  scripts partagés est réalisé en 0.21, validé sur fixtures.
- [x] Fixer le contrat de sélection et d'exécution Rust V1 (0.18).
- [x] Implémenter `target rust` et l'override `--runtime rust` selon ce contrat
  (fixtures 0.21 et validation réelle 0.22).
- [x] Propager explicitement runtime et suite dans l'enchaînement build/test/run
  Rust (0.21 : les scripts utilisent le même driver, sans passer par `_shared`).
- [x] Réutiliser la cible persistante de `env/dev/target.env`, avec priorité
  de l'option CLI et transmission explicite au conteneur selon 0.18 ; ne pas
  introduire une seconde variable de sélection concurrente.
- [x] Séparer TAST, cache Spago et sorties Cargo du profil Rust. Utiliser
  `--source` et `--out` explicitement ; leur défaut est relatif au répertoire
  de travail. Ne pas écraser les cibles des liens JS `output`, `.spago` et
  `spago.yaml` pendant l'essai isolé.
- [x] Définir le comportement avec et sans build préalable (contrat 0.18).
- [x] Implémenter et valider ce comportement dans le driver (0.20) et les
  fixtures CLI (0.21), puis la séquence réelle (0.22) : vérifier que le
  binaire lancé correspond au profil et au point d'entrée demandés. Conserver
  la signification de `bin/test -c`, qui nettoie les bases, pas la compilation.
- [x] Conserver le dispatch et les corps des branches JS, Go et PHP lorsqu'aucune
  cible/option Rust n'est demandée (fixtures 0.21 ; pas de nouveaux builds natifs).

Critère de sortie : le même test peut être lancé explicitement sous JS puis
sous Rust, sans ambiguïté dans la configuration ni dans les artefacts.

## Phase 2 — Runner de tests compatible Rust

Le runner actuel de b8x dépend de Node. Le premier point d'entrée Rust doit
charger seulement la spec choisie et les services de test nécessaires.

### Option recommandée

Créer un point d'entrée PureScript adapté à Rust, en réutilisant les specs et
assertions originales. Le module `Test.Spec.Runner` constitue une piste, mais
son portage FFI et ses dépendances restent à valider avant M1.

- [ ] Identifier les imports Node réellement nécessaires à `Test.Main`.
- [ ] Séparer la collecte des specs, l'exécution, le reporting et la sortie du
  processus.
- [ ] Agréger les specs validées derrière la commande Rust sans filtre, en
  annonçant explicitement tout périmètre encore partiel. À M2, le défaut couvre
  toutes les specs sans services ; à M4, `t -c` couvre l'ensemble actif collecté
  par `Core.spec`, `Infra.spec` et `Util.spec`, sans option `--suite`.
- [ ] Pour le runner intégré, transmettre et appliquer réellement le filtre
  demandé. Tester le cas sans correspondance et le nombre attendu de tests ;
  un filtre d'exécution ne réduit pas à lui seul le graphe à compiler ni les
  effets déclenchés pendant la construction de la suite.
- [ ] Utiliser le runner générique `Test.Spec.Runner` lorsque ses dépendances
  sont suffisantes.
- [ ] Ajouter un point d'entrée Rust dédié si le `Test.Main` actuel ne peut pas
  être partagé sans imports Node.
- [ ] Porter ou remplacer la sortie console et les reporters nécessaires.
- [ ] Faire remonter un résultat de suite au point d'entrée Rust et sortir avec
  un code non nul en cas d'échec. Propager aussi les erreurs du compilateur,
  de Cargo, les panics et les signaux à travers les wrappers.
- [ ] Réutiliser l'attente fournie par `purust_aff_run_main` avec `--threaded`.
  Une sortie immédiate du processus ne doit pas court-circuiter les nettoyages
  et l'attente des fibres. Ne pas recréer un moteur Aff ou un keep-alive natif.
- [x] Fournir `Effect.Now.now`, requise pour le chronométrage de chaque test,
  et valider son effet isolément (0.5), puis son utilisation par la spec
  ciblée (0.14). Le package Now complet, dont `getTimezoneOffset`, n'est pas porté.

### Dépendances du runner à porter ou isoler

- [ ] `Test.Spec`, `Test.Util.Assert` et les assertions nécessaires. La validation
  de `purust-assert` ne couvre pas le package distinct `purust-spec`.
- [ ] Console/reporter utilisé par les tests.
- [ ] Assertions de chaînes et erreurs attendues.
- [ ] Sortie du processus et code de sortie.
- [ ] Horloge réelle pour `Effect.Now`, notamment les appels internes du runner.
- [ ] Aff/AVar et dépendances transitives réellement générées : notamment Pipes,
  datetime, refs et exceptions ; réutiliser les implémentations disponibles et
  inventorier les FFI encore absentes avant de les porter.

Critère de sortie : une suite volontairement fautive échoue réellement sous
Rust, et une suite corrigée termine avec un code nul après exécution complète.

### Validation intégrée — `b -c; t -c`

À réaliser **après la définition du contrat et le raccordement des phases 1–2**,
avec l'image API Rust construite et utilisée par `api-cli`, avant d'élargir le
graphe des tests. Ce contrôle valide les commandes usuelles, pas seulement le
harness diagnostique M1 ; le contrat est défini en 0.18 et le raccordement
est implémenté en 0.19–0.21. L'image/API est disponible (preuve 0.20).
**Contrôle HTML réalisé en 0.22**, avec le sélecteur DB vide ; à répéter lors
des élargissements suivants.

- [x] Luna, au contrat stabilisé par Astra : sélectionner explicitement Rust
  via `target rust` une fois cette commande raccordée, puis tester la séquence
  demandée **`b -c; t -c`** dans b8x (`b` = `bin/build`, `t` = `bin/test`).
- [x] Vérifier que `b -c` reconstruit le backend et les sorties du profil Rust
  conformément au contrat : TAST frais du fork, génération Rust et compilation
  Cargo pour la plateforme d'exécution, sans toucher aux artefacts JS/Go/PHP.
- [x] Vérifier que `t -c` exécute le résultat de ce build dans `api-cli` et
  conserve le sens de `-c` : nettoyage des bases de test, pas compilation.
  Contrôler le périmètre de ces bases avant le nettoyage (0.22 : aucune cible).
- [x] Consigner séparément les codes de sortie de `b` et de `t`, le profil,
  le point d'entrée, le nombre de tests et l'artefact réellement exécuté.
  Le `;` lance aussi `t` si `b` échoue : ne jamais valider alors un ancien
  binaire. Pour arrêter au premier échec, exécuter `b -c && t -c`.
- [x] Exiger le succès de la spec HTML ciblée et revalider séparément la
  fixture négative par le chemin intégré : échec non nul, erreur visible,
  aucun fallback silencieux. Le périmètre limité doit être explicite dans la
  sélection et le résumé ; cette réussite ne vaut pas validation de toute b8x.
- [ ] Répéter ce contrôle après élargissement aux suites sans services pour
  M2, puis sur la suite complète pour M4, **avec `t -c` sans `--suite`** et sans
  exclusions cachées. Comparer aussi les specs et le nombre total exécutés à
  la référence, pas seulement le code de sortie.

## Phase 3 — Inventaire et portage des FFI b8x

Pour chaque module du graphe des tests ayant des déclarations étrangères, y
compris les dépendances de paquets :

- [ ] Identifier les fonctions utilisées par les tests, pas seulement toutes les
  fonctions déclarées.
- [ ] Distinguer ces appels des déclarations étrangères effectivement conservées
  par le générateur. Relever pour chacune le type TAST, le chemin `.rs` résolu,
  le symbole attendu et la couverture ; contrôler les doublons entre paquets.
- [ ] Décider si la fonction doit être portée, remplacée par une abstraction
  backend-neutre au même contrat, ou éliminée parce qu'elle n'appartient pas au
  graphe des tests. Un test actif bloqué reste à porter.
- [ ] Ajouter le FFI Rust au chemin miroir du module PureScript.
- [ ] Respecter les noms `Module_Function` attendus par purust.
- [ ] Respecter les types TAST, l'arité, les valeurs différées et le contrat
  `Aff`. Exploiter `ann.type`, `dataDecls`, `classDecls` et les instanciations
  `TypeApp` ; ne pas compenser une perte de type supposée par des valeurs
  opaques ou des valeurs par défaut.
- [ ] Ajouter un test positif et, lorsque pertinent, un test négatif.
- [ ] Interdire le fallback silencieux pour les FFI demandées par les tests.

### Ordre de portage recommandé

1. Prérequis manquants de la spec sélectionnée et de son runner : Spec, Now et
   leurs FFI, en réutilisant le socle Effect/Aff/AVar déjà disponible.
2. Premier module d'encodage HTML, puis utilitaires atteints par les tests :
   chaînes, JSON, variantes et assertions.
3. FFI simples utilisées par les modules Core et Util de b8x.
4. FFI de fichiers, UUID, crypto et configuration si elles apparaissent dans le
   graphe unitaire.
5. PostgreSQL, RabbitMQ et EventStore pour les intégrations.
6. Modules UI/navigateur hors du graphe : les laisser hors du profil initial.
   Un module nommé Node mais utilisé par un test exige un adaptateur compatible
   ou une substitution justifiée, pas une exclusion automatique du test.

## Phase 4 — Intégration du socle Aff déjà validé

Les primitives et scénarios Aff ont des validations historiques décrites plus
haut. Les cases suivantes concernent leur utilisation effective par b8x.

- [x] Activer `--threaded` et vérifier que le main généré utilise
  `purust_aff_run_main` (génération diagnostique 0.3). La validation
  d'exécution ci-dessous reste à faire ; ce mode doit être commun aux FFI.
- [ ] Vérifier le scénario Spec positif et négatif, les timeouts et la fin des
  fibres/ressources au retour du runner b8x.
- [ ] Vérifier l'annulation et le nettoyage des nouvelles FFI externes sur
  succès, erreur et interruption, en respectant leur contrat existant.
- [ ] Vérifier les captures `Send + Sync`, références partagées et callbacks
  introduits par les adaptateurs b8x.
- [ ] Après une modification du runtime ou du générateur, relancer les suites
  existantes pertinentes d'Aff, AVar et de durée de vie ; étendre seulement si
  le changement ou un échec le justifie.

Critère de sortie : aucun test vert ne doit dépendre d'un callback abandonné ou
d'un processus terminé prématurément.

## Phase 5 — Suite unitaire b8x

- [ ] Lancer toutes les suites sans services externes sous JS pour établir le
  nombre de tests et les résultats de référence.
- [ ] Lancer les mêmes suites sous Rust avec TAST frais.
- [ ] Comparer les tests exécutés, les résultats et les erreurs, sans comparer
  seulement le code de sortie global.
- [ ] Corriger les écarts de sémantique. Consigner les blocages et exclusions
  temporaires comme travail restant ; ne pas les compter comme tests passés.
- [ ] Vérifier les répétitions et les effets rejouables lorsque les tests les
  exercent.
- [ ] Vérifier la libération des ressources après chaque suite.
- [ ] Faire passer la suite unitaire complète avant d'activer les services
  externes.

Critère M2 : toutes les suites sans services externes exécutées, avec les
assertions originales et leurs nombres de tests vérifiés.

## Phase 6 — Clients PostgreSQL/RabbitMQ, EventStore et projections

- [ ] Lister les modules et FFI réellement atteints par chaque suite
  d'intégration.
- [ ] Porter ou compléter le pont `Promise`/`Promise.Aff` utilisé par les deux
  clients et les handles étrangers. Valider résolution/rejet, exécution des
  callbacks et comportement à l'annulation ; ne pas supposer que disposer
  d'Aff suffit à exécuter ces FFI.
- [ ] Choisir les clients Rust adaptés et encapsuler leurs différences derrière
  les mêmes contrats PureScript.
- [ ] Porter l'initialisation, les connexions, les transactions et le nettoyage.
- [ ] Réutiliser l'exécution dans `api-cli` fixée en 0.18 et éprouvée sur HTML
  en 0.20 ; vérifier les dépendances supplémentaires de ces suites. Reprendre les
  paramètres depuis la configuration b8x existante et les fixtures de bases
  de test, sans inscrire de secrets dans les sources ou le todo.
- [ ] Vérifier les erreurs réseau, timeouts, retries et annulations.
- [ ] Vérifier que les ressources sont fermées même après un échec de test.
- [ ] Éviter qu'une intégration externe soit considérée verte si le service est
  simplement absent ou si une FFI fallback a absorbé l'erreur.

Critère M3 : clients et pont Promise/Aff validés.

Critère M4 : suites EventStore PostgreSQL et projections, puis suite b8x
complète. Les fixtures de ces suites utilisent déjà PostgreSQL et RabbitMQ ;
ce ne sont pas trois infrastructures indépendantes.

## Phase 7 — Fiabilisation de purust pour b8x

Les points bloquant M1 sont traités dès la première tranche ; cette section
ne repousse pas le contrôle de l'ABI et des FFI absentes à la fin du projet.

- [ ] Remplacer les chemins codés en dur par des chemins portables dérivés du
  projet ou par une configuration explicite.
- [ ] Documenter le contrat exact d'une FFI `.rs` : noms, signatures, valeurs,
  effets, ownership et `Send`/`Sync` lorsque nécessaire.
- [ ] Faire échouer la génération lorsqu'une FFI requise est absente ou qu'un
  symbole attendu est remplacé par un stub. Couvrir le fichier absent, le
  symbole absent et la déclaration sans type exploitable. Distinguer les
  primitives réellement implémentées par le générateur des fallbacks factices.
- [ ] Couvrir aussi les types étrangers et leurs coercions : l'inventaire de
  `foreign` seul n'inclut pas `Data.Exists`. Reproducteur en 0.5, correction
  et régression native normale/threaded en 0.6 ; type et FFI `Data.Lazy`
  validés en 0.8. La couverture générale reste à compléter.
- [ ] Vérifier que supprimer le fichier `.rs` ciblé ou renommer son symbole
  provoque un échec explicite dans une fixture isolée ; une valeur par défaut
  `0`, `false` ou chaîne vide ne constitue pas une implémentation.
- [ ] Ajouter une trace diagnostique activable pour la résolution des FFI.
- [ ] Ajouter une régression minimale pour chaque correction générale du
  générateur ou du runtime.
- [ ] Vérifier que les dépendances Cargo des FFI sont propagées sans dépendre
  d'un état résiduel de `output/`. Identifier le mécanisme réellement utilisé
  avant de choisir une bibliothèque ; une retouche manuelle du Cargo.toml
  généré ne rend pas le pipeline reproductible.
- [ ] Vérifier que le TAST est toujours produit par le fork PureScript local et
  que les sorties obsolètes sont nettoyées.

## Matrice de validation finale

À renseigner avec les commandes et preuves. Les cases sont actuellement non
vérifiées. Rust doit couvrir tous les tests actifs ciblés ; JS fournit la
référence. Go/PHP ne constituent une obligation de non-régression que pour les
chemins existants affectés par les changements communs. Indiquer « non couvert
historiquement » ou « non exécuté » si nécessaire, jamais une réussite supposée.

| Cas | JS | Go | PHP | Rust |
| --- | --- | --- | --- | --- |
| Test pur minimal | [ ] | [ ] | [ ] | [ ] |
| FFI locale | [ ] | [ ] | [ ] | [ ] |
| Échec attendu | [ ] | [ ] | [ ] | [ ] |
| Effets Aff | [ ] | [ ] | [ ] | [ ] |
| Annulation | [ ] | [ ] | [ ] | [ ] |
| PostgreSQL | [ ] | [ ] | [ ] | [ ] |
| RabbitMQ | [ ] | [ ] | [ ] | [ ] |
| EventStore | [ ] | [ ] | [ ] | [ ] |
| Projections PostgreSQL | [ ] | [ ] | [ ] | [ ] |
| Suite complète | [ ] | [ ] | [ ] | [ ] |

## Règles de validation

- Pour la validation Rust et les comparaisons de parité, produire un TAST frais
  avec le fork local. La première référence JS de la micro-étape 0.1 reste un
  relevé explicitement limité aux artefacts existants.
- Conserver la commande exacte, le commit du compilateur et les sorties
  pertinentes pour chaque micro-étape.
- Ne cocher une validation qu'après exécution réelle. Pour un choix de plan ou
  un inventaire, indiquer explicitement la preuve de lecture et les vérifications
  d'exécution restant à faire.
- Distinguer clairement : test passé, test échoué, test bloqué, test exclu et
  test non exécuté.
- L'objectif est fonctionnel. Si une comparaison de performances devient
  nécessaire, utiliser les baselines officielles du README d'altbak.pub ; un
  run isolé ne suffit pas et les benchmarks ne bloquent pas ce plan de portage.
- Utiliser les contrats et fixtures `gopurs-*` comme références, sans supposer
  que leur existence prouve la compatibilité Rust.

## Prochaine action

- [x] Astra : choisir le premier test, sa FFI et son contrat (micro-étape 0.1).
- [x] Luna : exécuter uniquement la commande JS de référence de la
  micro-étape 0.1 ; noter les deux tests, le résumé et le code de sortie.
- [x] Astra : définir le point d'entrée PureScript, isoler ses sources et
  compiler le TAST frais ; inventorier les prérequis et enregistrer les
  arguments du backend avec `--threaded` (micro-étape 0.2).
- [x] Astra : qualifier les 13 modules sans `.rs` voisin et les trois noms non
  retrouvés textuellement ; fixer le premier prérequis Spec/Now à porter
  (micro-étape 0.3 : 29 fallbacks, premier portage `Test.Spec.Console.write`).
- [x] Luna, `medium` : porter uniquement `purust-spec/src/Test/Spec/Console.rs`
  et ajouter sa régression native selon le contrat 0.3 ; régression passée en
  modes normal et threaded, sans étendre le portage aux autres FFI
  (micro-étape 0.4).
- [x] Astra : porter et valider `Effect.Now.now`, compléter les validations
  console prévues, puis relever le premier blocage Cargo et les fallbacks
  conservés (0.5 : 27 fallbacks, 18 référencés ; reproducteur `Data.Exists`).
- [x] Astra : corriger les deux défauts de génération de `Data.Exists` dans
  le reproducteur à deux modules et ajouter sa régression (0.6 : Cargo minimal
  réussi, 45 tests codegen et 17 tests TAST passés).
- [x] Astra : isoler `Data.Lazy` et fixer le contrat natif de représentation,
  de mémorisation et de concurrence (0.7 : reproducteur 77 modules, cinq
  erreurs Cargo par mode ; cinq vérifications sur la vraie FFI JS passées).
- [x] Astra : porter `purust-lazy/src/Data/Lazy.rs` et ses régressions selon
  le contrat 0.7 (0.8 : Cargo minimal normal/threaded réussi ; 65 régressions
  passées ; b8x bloque maintenant sur les dictionnaires `Effect.Aff.Class`).
- [x] Astra : corriger le typage natif du dictionnaire `MonadAff` sans modifier
  l'ABI Aff (0.9 : Cargo sur 120 modules réussi, vraie exécution Aff validée,
  67 régressions passées ; nouveau blocage `Control.Monad.Free`).
- [x] Astra : isoler et corriger la confusion `Val`/`Step` dans `freeMonadRec`
  (0.10 : 91 modules TAST frais, cinq tests Rust par mode normal/threaded,
  blocage levé dans b8x ; prochain blocage `Pipes.Internal.X`).
- [x] Astra : isoler et corriger la représentation du newtype récursif
  `Pipes.Internal.X` et de `closed` (0.11 : cinq tests Rust par mode,
  premier `cargo check` b8x complet réussi).
- [x] Astra : construire et lancer le profil minimal en diagnostic borné
  (0.12 : build 0, exécution 101 ; cas HTML atteints avec fallback, puis
  panic `Record.Unsafe.unsafeSet` lors du résumé).
- [x] Astra : implémenter et valider uniquement `Record.Unsafe.unsafeSet`
  (0.13 : 73 régressions passées, résumé b8x terminé `1/2 tests passed` ;
  encodage HTML encore remplacé par un fallback).
- [x] Astra : porter le premier fichier `Util/Html/Encode/Encode.rs` et vérifier
  les deux symboles étrangers (0.14 : 22 722 cas de parité par mode,
  deux tests b8x originaux réussis, résumé complet et sortie 0).
- [x] Astra : exécuter la fixture négative avec la vraie FFI et renouveler
  la référence JS fraîche (0.15 : positifs 2/2, négatifs 2/3 et codes non nuls ;
  écart confirmé sur le message final Aff en Rust).
- [x] Astra : corriger le reporting final des erreurs Aff non interceptées
  selon le contrat 0.15 et rendre `html-runner.mjs` vert avant tout portage
  supplémentaire ; conserver le silence des erreurs interceptées
  (0.16 : neuf régressions, suites Aff/concurrence/durée de vie et quatre
  contrôles HTML verts).
- [x] Astra : qualifier les 22 fallbacks sur les contrôles M1 positif/négatif
  (0.17 : garde éprouvé par 44 appels forcés, aucun fallback atteint dans
  les contrôles HTML, sorties avec/sans garde identiques ; preuve technique M1).
- [x] Réconcilier sur `master`, selon le choix de l'utilisateur, les deux
  runners en conflit et la fixture absente après la bascule de branche.
  Cinq fichiers diagnostiques indexés, aucun commit ni changement de branche,
  Dockerfile utilisateur préservé ; empreintes 0.17 retrouvées et revalidation
  complète avec garde réussie sur `master` (`html-runner-MCdD70`).
- [x] Astra : fixer le contrat CLI et découper le premier raccordement Rust
  (0.18 : conception seulement, aucune intégration exécutée).
- [x] Astra : réaliser 0.19, l'export Cargo portable avec `perceus_ptr` embarqué
  (deux modes déplacés et exécutés, 51 codegen + 23 TAST verts).
- [x] Astra : réaliser le driver isolé 0.20 (18 régressions rapides et
  18 contrôles Docker verts, HTML positif/négatif, fraîcheur et interruption).
- [x] Astra : réaliser le raccordement CLI 0.21 au contrat 0.18, en réutilisant
  le driver éprouvé (38 tests rapides verts, dont 20 sur fixtures CLI).
- [x] Luna : valider réellement `target rust` puis **`b -c; t -c`** (0.22 :
  sorties 0/0, HTML 2/2 ; négatif séparé 101, sélecteur DB vide, cible Rust conservée).
- [x] Astra : choisir la prochaine spec sans services pour M2 et inventorier
  sa fermeture TAST/FFI (0.23 : décodage HTML, 4 tests/12 assertions, 211 modules,
  mêmes 275 foreigns, aucun nouveau portage).
- [x] Luna : raccorder `--suite html-decode` (0.24 : 4/4 Rust et JS frais,
  anciennes suites 2/2→0 et 2/3→101, 41 régressions rapides vertes).
- [x] Astra : inventorier l'ensemble actif et choisir le prochain bloc sans
  services hors codec HTML (0.25 : 286 tests statiques, dont 259 sans services ;
  bloc Stash de 41 tests, TAST frais de 228 modules, six nouvelles FFI référencées
  conservativement parmi 22 déclarations ajoutées ; aucun portage).
- [x] Astra : qualifier le premier blocage natif Stash et fixer son contrat
  minimal (0.26 : Cargo 101, 5 erreurs STObject ; même échec sur 66 modules,
  huit contrats JS primitifs passés ; aucun portage ni test b8x exécuté).
- [x] Astra : porter uniquement `Foreign/Object/ST.rs` et sa régression TAST/native
  selon 0.26 (type STObject et quatre primitives, modes normal/threaded, effets
  différés et handles vérifiés), puis relever le prochain blocage complet sans
  le corriger (0.27 : Cargo ciblé vert, 10 tests natifs par mode ; Cargo Stash
  atteint `Foreign.Object`, 218 occurrences du type `Object` manquant).
- [x] Astra : isoler `Foreign.Object` et qualifier le contrat natif minimal
  `Object` / `empty` / `_copyST` / `runST` / `_lookup`, avec preuves JS/TAST/Rust
  et plan de régression ; ne pas encore porter ni corriger le singleton (0.28 :
  100 modules, 9 contrôles JS, alias testé dans les deux modes, limites JS notées).
- [x] Astra : réaliser le portage minimal Object et ses régressions au contrat
  0.28, avec les seuls accès nécessaires dans ST.rs ; revalider ST puis relever
  le prochain blocage complet sans le corriger (0.29 : 42 exécutions natives
  réussies, Cargo Stash vert ; premier run 12/41, perte d'état, aucun fallback atteint).
- [x] Astra : isoler le partage de `_stash`/l'initialisation des valeurs de
  module, comparer au JS et fixer le correctif minimal et sa régression
  normal/threaded, sans FFI spéciale b8x (0.30 : reproduction sur 36 modules,
  expérience de cellules concluante, distinction partage/initialisation JS).
- [x] Astra : implémenter le partage des bindings de module au contrat borné
  0.31, ajouter la régression permanente et revalider Object/ST, puis les
  huit cas UnsafeStash et les 41 Stash dans le diagnostic isolé (52 tests codegen,
  21 sondes de partage, 42 exécutions Object/ST ; Linux 8/8 puis 41/41, sortie 0).
- [x] Astra : raccorder Stash et l'agrégat HTML + HTML Decode + Stash au défaut
  Rust, avec des artefacts frais et une validation CLI des **47 tests** (0.32 :
  `t -c` / `bin/run` 47/47, suites explicites vertes, négatif 101, 49 régressions).
- [x] Astra : comparer `RemoveComments` / `PadLeft` au profil enrichi,
  choisir une seule tranche et qualifier son premier blocage TAST/Cargo/FFI
  dans un diagnostic isolé, sans élargir le défaut ni porter en bloc (0.33 :
  RemoveComments, 247 modules ; champ Rust réservé `final`, reproduit sur deux
  modules ; expérience native concluante normal/threaded, aucun test b8x lancé).
- [x] Astra : corriger l'échappement du champ `final` au contrat 0.34,
  ajouter les régressions permanentes et reconstruire/revalider le défaut 47
  (53 codegen, 6 tests natifs, quatre suites TAST ciblées ; `t -c` 47/47).
  Prochains types natifs absents : Nullable et BigInt, sans portage à cette étape.
- [ ] Astra : isoler `Data.Nullable`, qualifier sa représentation/ABI et les
  trois primitives FFI, puis fixer le contrat de correction et de régression
  selon 0.35 ; pas de portage permanent ni d'élargissement du défaut à ce stade.
- [ ] Astra : qualifier l'initialisation anticipée des modules et les bindings
  exclus du premier correctif ; ne pas annoncer une parité JS générale avec
  le seul partage paresseux (écart établi en 0.30).
- [ ] Après validation de l'agrégat : poursuivre son élargissement vers les 259 tests
  sans services et les 286 tests actifs derrière `t -c`, sans filtre obligatoire.
- [ ] Astra : poursuivre, lors de l'élargissement M2, la qualification des bindings et fallbacks conservés,
  dont les autres opérations de records, selon les chemins réellement atteints ;
  porter ou éliminer par preuve, sans portage préventif de `unsafeDelete`.
