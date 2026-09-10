# Plan de validation d’Aff pour Purust

Mis à jour le 10 septembre 2026.

**Objectif Aff atteint.** `purust-aff/bin/test -c` passe après recompilation du compilateur et génération de TAST frais : **45 tests Aff actifs inchangés**, **5 groupes de concurrence**, puis **4 scénarios de durée de vie des enfants** (succès, erreur Aff, panique Rust dans un enfant, panique Rust dans main).

Les sept runners `assert`, `console`, `effect`, `refs`, `functions`, `exceptions` et `avar` ont également été validés. Après la complétion des cinq dépendances ci-dessous, la suite Aff entière repasse, ainsi que **36 suites codegen et 16 suites TAST**. La collecte des cycles forts et la validation générale des passing officiels restent des travaux distincts.

**Régression de performance corrigée après revalidation.** La fusion des thunks retrouve les newtypes passés par un alias polymorphe : le PBO réduit une identité structurelle en conservant exactement la valeur et les annotations de l’appelant, tout en maintenant la garde des autres `ForAll` non instanciés. Cinq paires alternées du runner final mesurent **112,203 → 12,723 ms**, soit **99,480 ms récupérées**, avec Lazy à **0–1 µs**. Le README officiel indique 12,56 ms. [Cause, mesures et preuves](../../altbak.pub-purust/scratch/rust-thunk-inline-regression-20260910/REPORT.md).

La revalidation a également révélé une erreur préexistante dans `purust-functions` : les bindings sans argument doivent convertir leur corps vers le type de retour déclaré, notamment pour les valeurs `Fn2` à `Fn10`. Elle est corrigée. **Validation finale : 13 runners de paquets, 41 vérifications codegen et 16 suites TAST passent**, dont Aff complet et la régression de portée des types. Les nouveaux tests couvrent les alias de newtypes dans la fusion, les directives d’inlining, les fonctions et effets non exécutés par l’identité, puis les valeurs décurryfiées et leurs captures.

## Les cinq dépendances auparavant partielles

**Terminées et validées le 10 septembre 2026.** Les cinq commandes `bin/test -c` passent successivement avec le compilateur final : recompilation de Purust, nettoyage propre à chaque paquet, TAST frais, génération Rust et exécution. Les runners sont en Bash et les contrôles natifs en Rust ; les suites PureScript originales sont conservées.

| Paquet | Couverture validée |
| --- | --- |
| [purust-arrays](../purust-arrays/bin/test) | Les cinq suites originales Array, ST, Partial, ST.Partial et NonEmpty ; **6 groupes supplémentaires et 3 tests Rust**. Bornes, tri stable, captures, instantanés, rejeu, itérateurs ST et traversées jusqu’à 100 000 éléments. Le test original `fromFoldable` à 50 000 éléments passe. |
| [purust-foldable-traversable](../purust-foldable-traversable/bin/test) | Suite Go de 595 lignes inchangée ; **8 groupes supplémentaires et 3 tests Rust**. Plis et indices, accumulations, Traversable1, produit cartésien, erreurs, ordre et rejeu de 100 000 effets. |
| [purust-unfoldable](../purust-unfoldable/bin/test) | **17 assertions originales, 7 groupes supplémentaires et 4 contrôles natifs Rc/Arc**. États et nombres d’étapes, fonctions et records, effets différés, rejeu et traversées non vides. |
| [purust-unsafe-coerce](../purust-unsafe-coerce/bin/test) | Fixtures originales locale et Go ; **3 groupes d’intégration et 1 échec attendu**. Frontière FFI réelle, scalaires, newtypes compatibles, records, collections, fonctions capturées et effets différés/rejouables. |
| [purust-partial](../purust-partial/bin/test) | Fixture originale, décharge de contrainte passée comme valeur, fonctions capturées, effets différés/rejouables et **4 échecs de processus attendus**, avec contrôle des messages. |

Les FFI nécessaires sont complétées, avec des ajouts de prérequis dans ST, Prelude, Int et Number. Pour ces prérequis, la validation porte sur les usages exercés par les cinq suites.

Les tests ont aussi conduit à des corrections générales du compilateur : types des applications partielles et des bindings d’un même groupe, dictionnaires natifs construits depuis des records, tests de constructeurs sur valeurs opaques, motifs sur tableaux, opérations sur les bits, primitives de références ST, dépendances Cargo provenant des FFI et reconnaissance des appels terminaux à travers `TypeApp`. La limite de récursion de compilation Rust est fixée à 512 pour les grandes suites générées.

Le PBO conserve désormais un appel lorsque les quantificateurs de son implémentation ne sont pas encore instanciés, sauf pour la réduction sûre d’une identité structurelle appliquée : cela empêche une substitution du contexte appelant de capturer les variables de type du corps générique. Une petite régression indépendante vérifie `Wrapped 42` ; les contrôles existants de spécialisation native et d’allocations passent toujours. Les corrections ne dépendent d’aucun nom de benchmark ou de test.

Validation finale de non-régression : **36/36 suites codegen, 16/16 suites TAST**, puis **45 tests Aff, 5 groupes de concurrence et 4 scénarios de durée de vie des enfants**.

## Première micro-étape

- [x] Rendre `purust-assert` fiable : une assertion vraie réussit ; une assertion fausse provoque un échec observable et un code de sortie non nul.
- [x] Valider ensuite un petit scénario commun `Effect + Ref + Exception` : création d’une référence, modification dans un effet différé, lecture, exception et interception.

## 1. Fiabiliser les résultats — `purust-assert`, `purust-console`

Validé le 10 septembre avec [bin/test -c](../purust-assert/bin/test), inspiré du runner Go : **11 scénarios passent**, dont **10 sorties en erreur attendues**, avec vérification des messages. [Assert.rs](../purust-assert/src/Test/Assert.rs) renvoie des effets différés et réexécutables ; une assertion fausse déclenche maintenant une erreur. `checkThrows` appelle son callback une seule fois par exécution. Les **27 tests de génération du compilateur** passent aussi, après adaptation du contrôle de FFI dans `unit-values.mjs`.

- [x] Corriger et vérifier le comportement de `assertImpl` et `checkThrows`, avec des cas positifs et négatifs.
- [x] Vérifier les sorties de console utilisées par les tests.
- [x] Faire remonter les erreurs de compilation et d’exécution ; un message d’erreur suivi d’une sortie réussie ne doit pas compter comme un test vert.

`purust-console` validé le 10 septembre avec son [runner Bash `bin/test -c`](../purust-console/bin/test) : **7 scénarios passent**. Le golden d’origine reste inchangé ; les contrôles supplémentaires couvrent stdout/stderr, les helpers `Show`, les groupes imbriqués et multilignes, les effets différés et réexécutables, le résultat de `grouped`, les durées et le cycle de vie des timers, ainsi que `clear` en sortie redirigée et en terminal (`xterm`/`dumb`). La FFI Rust implémente désormais ces comportements.

Le test `grouped` a révélé une perte du type des dictionnaires de superclasses lors d’applications synthétiques sans annotation. Le compilateur utilise maintenant leurs types issus de `classDecls` pour les champs et leurs résultats ; cette correction générale ne dépend d’aucun nom de test.

Non-régression après cette correction : **28 tests codegen**, **16 tests TAST** avec le fork explicite et les **11 scénarios de `purust-assert/bin/test`** passent.

Critère de sortie : une suite volontairement fautive échoue effectivement, et la même suite corrigée réussit.

## 2. Valider le socle — `purust-effect`, `purust-refs`, `purust-exceptions`

`Effect` et `Effect.Class` validés le 10 septembre avec [purust-effect/bin/test -c](../purust-effect/bin/test), en Bash : **17 contrôles rejoués chacun deux fois** et **3 sorties en erreur attendues** passent. La FFI Rust existante fonctionne pour les cas testés, sans correction supplémentaire du compilateur. Les contrôles couvrent `pure`, `bind`, les instances Functor/Apply/Semigroup/Monoid, `liftEffect` polymorphe et les quatre boucles : ordre, bornes vides/inversées, éléments records, conditions et imbrication. La sonde de test Rust contrôle l’absence d’effets à la construction, les traces à chaque exécution et l’arrêt après erreur dans `bind` et `forE`.

La première validation d’`Effect` utilisait une sonde indépendante de `Ref`. Elle est complétée par les quatre tests de `gopurs-effect`, copiés dans `Test.RefIntegration` avec leurs corps, assertions et usages de vraies références inchangés. **`purust-effect/bin/test -c` passe les 17 contrôles rejoués deux fois, les 4 tests d’intégration Go et les 3 échecs attendus.** `Effect.Unsafe` et `Effect.Uncurried` sont désormais validés à l’étape 3.

`purust-refs` validé le 10 septembre avec [bin/test -c](../purust-refs/bin/test) : le [test d’origine](../purust-refs/test/Main.purs) est intact, avec toutes les assertions également présentes dans `gopurs-refs`, notamment `newWithSelf`. **7 groupes supplémentaires passent** : résultats de `modify`/`modify'`, indépendance des cellules, lecture/écriture/modification différées et réexécutables, allocation neuve au rejeu, références capturées par plusieurs callbacks et valeurs records/tableaux. La nouvelle FFI Rust implémente les cinq primitives avec des cellules partagées et des effets différés.

L’appel du `main` d’un module importé échouait à la compilation Rust : sa définition n’utilisait pas le nom qualifié attendu aux points d’appel. Les définitions et le registre de types sont maintenant cohérents ; un alias `main` conserve le point d’entrée de l’exécutable. Cette correction générale permet de conserver les tests d’origine.

Non-régression : **29 tests codegen et 16 tests TAST passent**, avec une nouvelle régression compilée et exécutée pour deux modules exportant chacun `main`.

Limite de durée de vie constatée sur la FFI compilée : les cellules sans cycle sont libérées après leur dernier propriétaire ; un cycle fort créé par `newWithSelf` reste alloué, puis se libère si le cycle est rompu. Le runtime `Rc` ne collecte pas automatiquement ces cycles.

- [x] Vérifier `pure`, `bind` et l’exécution différée : construire un effet ne l’exécute pas ; l’exécuter déclenche les actions dans l’ordre attendu.
- [x] Vérifier les références : création, lecture, écriture, modification et partage de la même cellule entre plusieurs callbacks.
- [ ] Traiter la collecte des cycles de références pour les programmes qui en créent durablement, notamment avec `newWithSelf`.
- [x] Vérifier les erreurs : construction, message, lancement, interception et propagation quand elles ne sont pas interceptées.
- [x] Valider le scénario commun annoncé en première micro-étape sur du TAST frais compilé en Rust.

Critère de sortie : les primitives nécessaires à `liftEffect` et aux premiers tests Aff ont des résultats et des effets observables corrects.

## 3. Valider les adaptateurs nécessaires à Aff

Paquets concernés : `purust-functions`, `purust-effect` pour `Effect.Uncurried` et `Effect.Unsafe`, ainsi que les usages nécessaires de `purust-unsafe-coerce` et `purust-partial`.

- [x] Vérifier les adaptateurs `mkFn` / `runFn` utilisés par Aff : arguments, résultat et exécution unique du callback.
- [x] Vérifier `mkEffectFn` / `runEffectFn`, notamment les arités utilisées par `Effect.Aff.Compat`, avec leurs effets et leur ordre d’exécution.
- [x] Vérifier les usages d’`unsafePerformEffect`, d’`unsafeCoerce` et des fonctions partielles présents sur ces chemins.
- [x] Repérer et compléter les FFI nécessaires aux scénarios Aff exécutés : une fonction de remplacement renvoyant une valeur par défaut ne constitue pas une implémentation validée.
- [x] Traiter les blocages du sous-ensemble utile de `purust-prelude`, `purust-arrays`, `purust-foldable-traversable`, `purust-datetime` et `purust-st` au fil des tests.

Validé par `purust-functions/bin/test` : **11 tests Go inchangés et 12 groupes supplémentaires**. `purust-effect/bin/test` passe désormais **17 contrôles historiques et 23 groupes d’adaptateurs rejoués deux fois, 4 tests Go avec Ref et 3 erreurs attendues**. Le générateur exécute le thunk des callbacks `UncurriedEffectAbs` exactement une fois ; `Func11` couvre aussi les runners de fonctions d’arité dix passés comme valeurs. Le fallback Rust d’`unsafeCoerce` et les primitives partielles ont une régression native dédiée.

`purust-exceptions/bin/test` passe les assertions originales, **8 intégrations et 3 erreurs attendues**. Les erreurs PureScript gardent leur identité et leur cause ; les panics Rust étrangères restent distinctes. Une correction générale propage le type résultat connu vers la queue des `Let`/`LetRec` après optimisation.

Critère de sortie : les callbacks nécessaires à `makeAff` et à `Effect.Aff.Compat` traversent correctement la frontière FFI. Il n’est pas nécessaire d’attendre toutes les suites de chaque dépendance pour commencer Aff.

## 4. Valider le noyau — `purust-aff`

Référence principale : [les tests PureScript d’Aff](../purust-aff/test/Test/Main.purs). La FFI Rust avec interpréteur Aff et moteur Tokio est validée sur la suite complète. `--threaded` utilise `Arc`, des callbacks `Send + Sync` et des références protégées par mutex. Les fonctions récursives sont initialisées via `OnceLock`. Les 45 tests actifs de la suite passent, sans assertion retirée. Le test initial `pure/bind/delay/fork/join` reste disponible avec `bin/test --smoke`.

Le point d’entrée attend **toutes les fibres actives après le retour de main et des parents**, y compris les descendants démarrés ensuite. Les erreurs non interceptées font échouer le processus après terminaison des autres enfants ; `Test.Lifetime` vérifie ce contrat aussi pour les panics Rust dans un enfant ou dans main. Un registre fort conserve les fibres actives jusqu’à leur terminaison, même quand aucun callback ni handle utilisateur ne les retient ; une régression couvre `supervise (void (forkAff never))`.

- [x] Faire passer `pure`, `bind`, `try`, `throw` et `liftEffect`.
- [x] Établir l’exécution des callbacks et la propagation des erreurs de `makeAff` et `runAff`.
- [x] Faire attendre à l’exécutable la fin des tests asynchrones ; vérifier qu’une erreur asynchrone fait échouer le processus.
- [x] Faire passer `delay`, `forkAff`, `joinFiber`, les jointures multiples et `suspendAff`.
- [x] Vérifier les chemins de `Effect.Aff.Compat` sur la sortie Rust.

Critère de sortie : les premiers tests synchrones et asynchrones terminent avec les résultats attendus. Un processus qui sort avant ses callbacks, ou un test bloqué, ne compte pas comme une réussite.

## 5. Valider la sémantique complète d’Aff

- [x] Faire passer l’annulation : `killFiber`, cancelers, actions suspendues et interactions avec les jointures.
- [x] Faire passer `bracket` et `generalBracket` : nettoyage sur succès, erreur et annulation, y compris les imbrications et les régions non annulables.
- [x] Faire passer la supervision : annulation des enfants restants et attente de leurs nettoyages.
- [x] Faire passer le parallèle, les courses, les erreurs et l’annulation des branches restantes.
- [x] Faire passer les régressions et cas de profondeur présents dans la suite.
- [x] Produire un bilan complet des tests de `Test.Main` : réussis, échoués, bloqués ou explicitement exclus, avec la raison de chaque exclusion.

Bilan : **45 réussis, 0 échoué, 0 bloqué** parmi les tests actifs de `Test.Main`, conservé intact. `test_scheduler_size` était déjà commenté dans la source upstream ; aucun nouveau test n’est exclu. `parallel/stack` exécute les 100 000 opérations et libère maintenant son graphe sans récursion de pile. Le compilateur accepte aussi les valeurs récursives opaques grâce à `OnceLock<Value>` et évite les conversions de paramètres inutilisés dans les callbacks.

Critère de sortie : les tests actifs de la suite Aff sont vérifiés jusqu’à leur fin, avec propagation des échecs et libération des ressources attendue. Les dépendances de `Test.Bench`, dont `minibench`, restent un travail distinct de la validation fonctionnelle de `Test.Main`.

## 6. Valider AVar et son intégration — `purust-avar`

Le `Test.Main` upstream de `purust-aff` n’importe pas AVar. Les tests croisés se trouvent maintenant dans `Test.Concurrency`, qui reprend également le [test de stress Aff/AVar](../../gopurs/gopurs-aff/test/Test/Stress.purs), utile comme référence supplémentaire.

- [x] Valider `Effect.AVar` : états vide/rempli/tué, lecture, retrait, écriture et opérations immédiates.
- [x] Vérifier l’ordre des files d’attente, le retrait des callbacks annulés et le réveil des actions en attente lors d’un `kill`.
- [x] Valider le pont `Effect.Aff.AVar` avec `makeAff` et les cancelers.
- [x] Reprendre les scénarios croisés Aff/AVar pertinents de Gopurs et vérifier leurs résultats sur Rust.

`purust-avar/bin/test` passe en mode concurrent : **16 tests Go inchangés, 8 contrôles PureScript et 2 tests Rust**. Les tests natifs vérifient la libération des captures annulées et la livraison exacte de 1 000 valeurs depuis 8 threads distincts. Les callbacks sont invoqués hors du verrou ; le pont Aff/AVar passe désormais dans la suite Aff : **1 000 producteurs et 1 000 consommateurs avec suspensions**, et le stress Go original est inchangé. Les compléments prouvent des reprises sur deux workers Tokio distincts, **8 000 modifications atomiques de Ref**, puis l’annulation par le superviseur d’un enfant `never` sans handle extérieur.

Critère de sortie : les tests AVar et les scénarios croisés terminent sans résultat perdu ni callback d’une opération annulée exécuté à tort.

## Méthode de suivi

- Utiliser les `gopurs-*` comme références de contrats, de tests et d’implémentation ; leur présence ne prouve pas que leurs suites actuelles passent.
- S’appuyer sur le TAST du fork local : types, layouts et instanciations. Les corrections du générateur restent générales et indépendantes des noms de tests.
- Sélectionner explicitement le fork PureScript pour générer le TAST, et écarter les sorties périmées lors des validations.
- Utiliser le Spago local du compilateur dans les runners `assert`, `console`, `effect` et `refs`. Spago 1.0.3 est désormais une dépendance de développement explicite : cela évite que `npm run build` choisisse le Spago 0.20.9 installé dans un `node_modules` parent, qui demande `spago.dhall`.
- Pour chaque micro-étape, conserver la commande, les cas exécutés, les résultats et le prochain blocage concret. Cocher seulement après exécution réussie.
- Lancer les vérifications de non-régression pertinentes aux changements du compilateur ou du runtime. Pour surveiller les performances acquises, utiliser les baselines du [README officiel d’altbak.pub](../../altbak.pub/README.md#rust).
- Après Aff et AVar, reprendre la couverture générale des passing officiels, puis réévaluer les nouvelles pistes de performance.

## Suite du travail

- La couverture Aff demandée est terminée ; les FFI nécessaires dans `arrays`, `foldable-traversable`, `unfoldable` et `unsafe-coerce` sont complétées. Cela ne signifie pas que toutes les fonctions de tous les `purust-*` sont validées.
- Les cycles forts de valeurs `Rc`/`Arc`, notamment `Ref.newWithSelf`, ne sont pas collectés automatiquement. Cette limite de mémoire reste ouverte.
- Les exceptions PureScript sont récupérables par Aff ; les panics Rust étrangères restent fatales, avec attente des enfants avant sortie du processus.
- Prochaine priorité disponible : couverture générale des passing officiels, puis réévaluation des performances sur les baselines altbak.pub.
