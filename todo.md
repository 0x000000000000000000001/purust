# Roadmap d'Optimisation pour purust (Backend Rust)

Priorités issues de l'[audit du Rust généré du 8 septembre 2026](../../altbak.pub-purust/scratch/rust-audit-20260908/REPORT.md). La représentation de `Unit` sans allocation est intégrée et [validée dans le runner complet](../../altbak.pub-purust/scratch/rust-unit-20260908/REPORT.md). Les emprunts des parents locaux natifs sont intégrés pour les [tests de constructeur](../../altbak.pub-purust/scratch/rust-tag-borrow-20260908/REPORT.md) et les [extractions de champs](../../altbak.pub-purust/scratch/rust-field-borrow-20260908/REPORT.md). Les [enums sans champs en valeur](../../altbak.pub-purust/scratch/rust-value-enums-global-20260908/REPORT.md) sont maintenant activés dans le runner. Les autres optimisations restent des prototypes ou des pistes à mesurer.

## Repères et validation

| Benchmark | Baseline officielle Rust relevée lors de l'audit | Avant Unit natif | Après Unit natif |
| --- | ---: | ---: | ---: |
| LazyEvaluation | 319,209 ms | 220,394 ms | 67,315 ms |
| RBTree | 67,125 ms | 57,558 ms | 57,541 ms |
| Polymorphism | 38,663 ms | 39,948 ms | 36,842 ms |
| Church | 24,331 ms | 11,036 ms | 11,086 ms |
| Total | 452,29 ms | 330,603 ms | 174,147 ms |

Baselines : [README officiel d'altbak.pub](../../altbak.pub/README.md#rust). Le tableau conserve les valeurs historiques de l'audit initial ; lors de la validation des extractions de champs, le README indique désormais **62,425 ms pour RBTree** et **190,94 ms au total**. Les mesures avant/après sont les médianes de trois exécutions du runner, chacune retenant le meilleur de dix essais ; le total est la somme des médianes. L'écart historique ne permet pas d'attribuer un gain à un changement particulier.

Pour chaque baby step : partir d'un cas minimal, modifier le générateur, vérifier le Rust émis et les régressions pertinentes, puis lancer `bin/rust/run -c` depuis `altbak.pub-purust`. Vérifier les 14 résultats et mesurer avant/après avec le même allocateur et le même profil. Comparer aussi aux baselines officielles ; conserver les observations dans l'audit. Mesurer les allocations séparément des temps pour éviter le biais de l'instrumentation.

Travailler avec `altbak.pub-purust` et `purescript-backend-optimizer-purust`, en conservant les checkouts habituels d'altbak.pub et PBO intacts. Purust reste dans ce checkout.

Le TAST fournit `ann.type`, `dataDecls`, `classDecls` et les instanciations `TypeApp` de la v3. S'appuyer sur ces informations pour définir des règles générales de génération, sans exception propre aux benchmarks. RBTree utilise déjà des ADT natifs, des clés `i64`, des appels directs et une boucle pour `buildTree`.

## 1. Unit sans allocation répétée — priorité pour le temps total

Constat initial : `Data_Unit_unit` construisait un `Record_a` dynamique de **6 408 octets**. LazyEvaluation en allouait **1 001 000** par passage. Le prototype partageant `Unit` passait de **235,337 à 85,204 ms**, soit **63,8 % de temps en moins** sur neuf mesures par variante. Il conservait les thunks et leur forçage. L'intégration utilise maintenant `()` dans le code typé et `Value::Unit` aux frontières dynamiques, sans cache ni allocation.

- [x] Reproduire la construction et le passage de `Unit` dans un petit module ; compter les allocations et couvrir les valeurs renvoyées par une continuation. Test : [unit-values.mjs](tests/codegen/unit-values.mjs), lancé avec `node --test tests/codegen/unit-values.mjs` après le build.
- [x] Introduire une représentation dédiée sans allocation : `()` dans le code typé, `Value::Unit` dans le runtime dynamique, conversions `mk_unit` / `unwrap_unit`, construction et FFI cohérentes. Les tableaux convertissent aussi leurs éléments natifs en `Value`.
- [x] Vérifier les passages par `Effect`, les fonctions polymorphes et les FFI, puis régénérer et mesurer LazyEvaluation avec le runner complet : **11 tests passent**, `bin/rust/run -c` réussit, **14 résultats corrects**. Sur trois runs avant/après : LazyEvaluation **220,394 → 67,315 ms (−69,5 %)** ; total **330,603 → 174,147 ms (−47,3 %)**.
- [ ] Après cette intégration, mesurer les allocations restantes avant de reprendre les adaptateurs de thunks.

La suppression des allocations de `Unit` économise environ **6,42 Go d'octets demandés cumulés** par passage dans le prototype, pas 6,42 Go de mémoire simultanément résidente.

Premier baby step validé le 8 septembre 2026 : le test génère un module `UnitValues`, compile son Rust avec la vraie FFI `Data.Unit`, puis vérifie identité, réutilisation, nombre d'appels et résultats des continuations (entiers, booléen et fonction renvoyée sans exécution prématurée). Sur 1 000 constructions : **1 000 allocations, 56 000 octets demandés et 1 000 libérations** ; transmettre 1 000 fois une valeur déjà construite n'alloue rien. Le runtime minimal a un `Record_a` de 48 octets, contre 6 408 dans altbak.pub, où davantage de champs sont collectés. Ce test établit la référence avant le changement de représentation ; il ne fixe pas les allocations actuelles comme résultat à conserver.

Après intégration, le même test exige **zéro allocation** pour 1 000 constructions, passages et allers-retours `()` / `Value`. Il couvre aussi `[unit]`, les records vides distincts de `Unit`, les effets différés et rejouables, les continuations polymorphes et les FFI d'assertion. Les témoins de contraintes `Partial` restent des records vides. Aucun changement de l'algorithme de thunks n'a été intégré.

## 2. RBTree : emprunter lors des lectures de motifs

Constat initial : les tests et extractions clonent fréquemment le pointeur parent avant de le lire. Remplacer `(parent.clone()).as_ref()` par `parent.as_ref()` sur une variable locale fait passer le noyau extrait de **55,928 à 47,642 ms**, soit **14,8 % de temps en moins**, sans changer la représentation des ADT. Ce prototype combine tests de constructeur et extractions de champs ; les deux parties sont maintenant intégrées.

- [x] Traiter d'abord `OpIsTag` sur une variable locale ; vérifier le Rust émis et les utilisations ultérieures du parent. Les locaux `Rc<ADT>` sont empruntés sous les wrappers `Typed` / `TypeApp` qui préservent leur représentation. Les conversions et les opérandes non locaux conservent le chemin précédent. Test : [tag-borrows.mjs](tests/codegen/tag-borrows.mjs).
- [x] Étendre aux extractions de champs en conservant les clones des enfants nécessaires au partage structurel. `GetCtorField` réutilise la règle d'emprunt d'`OpIsTag` ; `f.clone()` reste inchangé. Test : [field-borrows.mjs](tests/codegen/field-borrows.mjs).
- [x] Vérifier les motifs imbriqués, les déplacements après emprunt et les branches alternatives ; mesurer RBTree dans le runner complet. Les tests couvrent aussi les enfants survivant au parent, les conversions et les bases non locales évaluées une seule fois. Le noyau RBTree régénéré passe les contrôles d'ordre, de hauteur noire, de rouges consécutifs, de doublons et de persistance.

Points de départ : `src/Purust/CodeGen.purs`, émission d'`OpIsTag` et des accesseurs de constructeurs.

Validation d'OpIsTag du 8 septembre 2026 : **12 tests passent**, `bin/rust/run -c` réussit avec **14 résultats corrects**. Les tests ciblés couvrent la réutilisation du parent dans les branches, les lectures répétées, le partage et les appels évalués une seule fois. RBTree perd **14 occurrences statiques de `.clone()`**. Sur trois runs avant/après : **60,445 → 57,148 ms (−5,5 %)** pour RBTree ; total **180,281 → 179,837 ms**, globalement stable. Il s'agit d'une nouvelle série de mesures, distincte de celle d'Unit natif ci-dessus ; détails et logs dans le [rapport OpIsTag](../../altbak.pub-purust/scratch/rust-tag-borrow-20260908/REPORT.md).

Validation des extractions de champs du 8 septembre 2026 : **13 tests passent**, `bin/rust/run -c` réussit avec **14 résultats corrects**. RBTree perd **149 clones de parents supplémentaires** (426 → 277 occurrences statiques), tout en conservant ses **260 clones de champs**. Sur trois nouveaux runs avant/après : RBTree **54,426 → 45,978 ms (−15,5 %)** ; total **170,980 → 163,252 ms (−4,5 %)**. Les autres gros benchmarks restent proches de leur référence dans cette série. Les écarts des séries successives ne s'additionnent pas ; détails et scripts dans le [rapport GetCtorField](../../altbak.pub-purust/scratch/rust-field-borrow-20260908/REPORT.md).

## 3. RBTree : enums sans charge utile en valeur

Constat : `Color = R | B` devient un `Rc<Color>`. Le prototype utilisant un enum `Copy` en valeur élimine **499 934 allocations** et passe de **55,928 à 46,493 ms** (**−16,9 %**). Combiné aux emprunts : **41,349 ms**, soit **−26,1 %**. Ces gains ne s'additionnent pas. La taille mesurée de `Tree` reste 32 octets.

- [x] Déterminer depuis `dataDecls` l'éligibilité des enums dont tous les constructeurs sont sans charge utile ; couvrir `Color` dans un cas minimal. [DataLayout.purs](src/Purust/DataLayout.purs) fournit `isNullaryEnum` : au moins un constructeur, tous sans champs. Le [test TAST](tests/tast/nullary-enums.mjs) compile un [module PureScript minimal](tests/tast/fixtures/nullary-enums.purs) avec le fork, puis décode les métadonnées avec PBO.
- [x] Émettre une représentation en valeur et `Copy` ; aligner déclarations, signatures, champs, constructeurs et tests de motifs. Émission locale validée via `codegenModuleWithValueEnums`, avec un contexte explicite de types qualifiés issu de `dataDecls`. Test : [value-enums.mjs](tests/codegen/value-enums.mjs).
- [x] Propager le contexte des enums en valeur à tous les modules et aux signatures FFI dans `Main` ; vérifier les échanges entre modules et les conversions aux frontières dynamiques et FFI, puis activer ce chemin dans le runner. `valueEnumsForModules` fournit le contexte commun ; les FFI de comparaison du prélude et des chaînes reçoivent et renvoient `Ordering` en valeur. Test du pipeline complet : [value-enums-interop.mjs](tests/tast/value-enums-interop.mjs).
- [x] Mesurer séparément puis avec les emprunts ; contrôler ordre des clés, hauteurs noires, absence de rouges consécutifs, doublons et conservation d'une ancienne version de l'arbre. Après les prototypes isolés, l'intégration sur la base contenant déjà les emprunts est mesurée dans le runner ; les deux noyaux générés passent aussi les contrôles des quatre rotations et de persistance.

Validation de l'éligibilité du 8 septembre 2026 : `Color`, un autre enum à deux constructeurs, un singleton et un type à paramètre fantôme sont éligibles. `Tree`, un enum mélangeant constructeur vide et constructeur avec champ, et un type sans constructeur sont exclus. Le test contrôle aussi les types décodés des quatre champs de `Tree.T`, dont `Color`. La règle retrouve **Color = éligible, Tree = exclu** dans le TAST réel d'altbak.pub.

Commande depuis Purust : `PURS="$PWD/../../altbak.pub-purust/run/bak/js/node_modules/.bin/purs" npm run test:tast`. `PURS` sélectionne explicitement le fork TAST ; le binaire installé dans le `node_modules` de Purust produit actuellement du CoreFn standard. Le nouveau script `test:tast` complète `test:codegen`. Lors de l'étape d'éligibilité, **13 tests de génération + 1 test TAST passaient** ; `bin/rust/run -c` réussissait avec **14 résultats corrects**. Les empreintes des **301 sources Rust générées étaient identiques** avant/après ([validation](../../altbak.pub-purust/scratch/rust-nullary-eligibility-20260908/validation.json), [log du runner](../../altbak.pub-purust/scratch/rust-nullary-eligibility-20260908/clean-run.log)).

Validation de l'émission locale du 8 septembre 2026 : `Color` devient un enum `Copy` d'**un octet** dans le cas minimal. **1 000 itérations** de construction, passage et lecture des couleurs et de `Unit` font **zéro allocation** ; construire un nœud alloue **une seule fois** pour son `Rc<Tree>`. Les constructeurs définis et saturés, les champs, les tests de motifs locaux et sur un appel, les callbacks, les captures et la réutilisation des couleurs sont couverts. Le partage des enfants et l'ancienne racine sont préservés ; `Unit` reste `()`.

Lors de la validation locale, **14 tests de génération + 1 test TAST passaient**, et `bin/rust/run -c` donnait les **14 résultats attendus**. Les **301 sources Rust du runner restaient identiques**, le contexte global n'étant pas encore activé dans `Main`. Aucun gain de temps supplémentaire n'était attribué à cette étape préparatoire. [Rapport et preuves](../../altbak.pub-purust/scratch/rust-value-enums-local-20260908/REPORT.md).

Activation globale du 8 septembre 2026 : **huit enums natifs `Copy`** sont vérifiés dans altbak, dont `Color`, `Ordering` et `Proxy`. Le test d'intégration compile les sources PureScript avec le fork TAST, lance le vrai CLI, puis compile les crates Rust et les FFI réelles. Il couvre construction et utilisation entre modules, champs d'arbre, frontière polymorphe `Value`, FFI native, signatures des stubs, `Unit` et partage des arbres. **14 tests de génération + 2 tests TAST passent** ; `bin/rust/run -c` réussit avec **14 sorties correctes**.

Sur trois nouveaux runs avant/après : **RBTree 47,509 → 42,687 ms (−10,1 %)**. Le **total reste stable : 170,025 → 170,126 ms (+0,1 %)** ; Polymorphism, LazyEvaluation et Church ont été plus lents dans cette série, donc aucun gain global n'est revendiqué. Le README officiel relu indique RBTree **62,425 ms** et total **190,94 ms** ; la série avant/après sert à mesurer ce changement précis.

Le comptage séparé sur le noyau généré confirme **499 934 allocations supprimées** pour 100 000 insertions, parcours et destruction : **3 283 867 → 2 783 933** allocations, soit **11 998 416 octets demandés cumulés en moins**. La taille de `Tree` reste **32 octets**. Les invariants passent avant et après, toutes les allocations comptées sont libérées. [Rapport, mesures et scripts](../../altbak.pub-purust/scratch/rust-value-enums-global-20260908/REPORT.md).

Les chiffres des prototypes initiaux provenaient de 15 mesures par variante à `opt-level=1` avec mimalloc ; leur runner de référence était alors à 61,729 ms. Ils restent distincts de cette nouvelle série avec les emprunts déjà intégrés.

## 4. Polymorphism : garder l'accumulateur spécialisé en i64

Constat : dans la boucle chaude, l'appel de dictionnaire est déjà remplacé par `+ 1`, mais l'accumulateur reste un `Value` avec `unwrap_int` et `mk_int` à chaque tour. `mk_int` est une variante immédiate, pas une allocation sur le tas. Gain à mesurer sur ce benchmark représentant désormais 21,2 % du total après l'intégration de Unit natif.

- [ ] Tracer l'instanciation `polyLoop<Int>` depuis `TypeApp` jusqu'au type de l'accumulateur d'une récursion locale minimale.
- [ ] Préserver cette spécialisation dans la boucle et émettre un accumulateur `i64`, avec conversions uniquement aux frontières qui les nécessitent.
- [ ] Couvrir plusieurs instanciations et le cas polymorphe restant, puis mesurer Polymorphism.

Point à examiner : la branche `Syn.TypeApp a ty` de `CodeGen.purs` descend actuellement dans `a` sans exploiter directement `ty` à cet endroit ; vérifier ce qui est déjà transmis par les annotations et PBO avant de modifier cette étape.

## 5. RBTree : factoriser les motifs imbriqués

Constat : les quatre rotations du source deviennent environ 790 lignes et 379 occurrences statiques de `.clone()` dans `balance`. Une version factorisée donne **48,814 ms** contre **55,928 ms** ; avec couleurs en valeur, **42,546 ms**. Son gain recouvre une partie de celui des emprunts.

- [ ] Isoler un motif à deux niveaux avec deux branches et localiser la duplication entre PBO et Purust.
- [ ] Générer une déconstruction empruntée réutilisant les champs et tests déjà établis, en préservant l'ordre des branches.
- [ ] Vérifier les quatre rotations et la persistance, puis mesurer le gain supplémentaire après les étapes 2 et 3.

## 6. Church : éviter les adaptateurs de fonctions inverses

Constat : des allers-retours `Func1<i64, i64>` → `Func1<Value, Value>` → `Func1<i64, i64>` apparaissent dans les constructions des numéraux. Gain non mesuré ; Church représente désormais 6,4 % du total après l'intégration de Unit natif.

- [ ] Reproduire un aller-retour sur une fonction typée et suivre les arguments `TypeApp` et les conversions émises.
- [ ] Préserver la signature instanciée ou supprimer les adaptateurs inverses lorsque leurs sémantiques le permettent.
- [ ] Vérifier ordre d'évaluation, effets et applications partielles, puis mesurer Church.

## 7. RBTree : réutiliser une racine unique

Constat : après le passage des couleurs en valeur, le prototype de recoloration via `Rc::make_mut` économise **100 000 allocations supplémentaires**. Son gain temporel est modeste dans la série exploratoire à O3 : **47,0 à 45,3 ms**. La réutilisation générale des nœuds reste à étudier.

- [ ] Isoler la reconstruction de racine dans `makeBlack` / `insert` et établir les conditions permettant une réutilisation.
- [ ] Générer la mutation d'une racine unique avec copie lorsqu'elle est partagée ; vérifier qu'une ancienne version reste intacte.
- [ ] Mesurer le gain supplémentaire après les autres changements avant d'élargir aux rotations ou à d'autres ADT.

La FFI optimisée à 16,700 ms dans le README utilise une arène préallouée et des indices, avec des durées de vie différentes. Ce score reste un repère, pas une promesse de gain pour l'arbre persistant.

## Pistes à réévaluer seulement sur nouvelles preuves

- **Simplification des thunks :** le prototype à un seul thunk par étape ralentit LazyEvaluation de **230,252 à 300,579 ms**. Ne pas intégrer cette réécriture en l'état ; reprendre la mesure après le travail sur `Unit`.
- **Profil Rust :** O3 seul n'améliore pas le noyau RBTree étudié (**55,3 ms à O1 contre 59,8 ms à O3** dans la série exploratoire). LTO et le nombre d'unités de codegen restent non mesurés. Tester chaque option séparément sur la suite complète avant de changer les valeurs par défaut.
