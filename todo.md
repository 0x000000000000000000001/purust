# Plan de performance de Purust

Mis à jour le 9 septembre 2026. Objectif : réduire le travail autour des cellules déjà réutilisées, en priorité dans RBTree. Les gains des étapes à venir restent à mesurer.

## Point de départ

| Benchmark | Rust compilé, README officiel | Rust natif optimisé, dernière colonne |
| --- | ---: | ---: |
| RBTree | 18,985 ms | 36,070 ms |
| Church | 1,506 ms | 0,001 ms |
| Deep Record Updates | 0,980 ms | 0,004 ms |
| LazyEvaluation | 0,001 ms | ≈ 0 ms, arrondi |
| **Total** | **21,82 ms** | **36,13 ms** |

Source : [README du checkout normal d'altbak.pub](../../altbak.pub/README.md#rust), relevé le 9 septembre. Celui du worktree peut être plus ancien. RBTree représente environ 87 % du total ; gagner 10 % dessus retirerait environ 1,9 ms au total, sans constituer une prévision de gain.

La dernière [série appariée](../../altbak.pub-purust/scratch/rust-function-fusion-20260909/REPORT.md), après fusion du producteur de fonctions de Church, donne **19,691 ms au total**, contre **21,053 ms** avant, dont **Church 1,439 → 0,164 ms**. Elle reste distincte du README. Les 20 tests de génération, 12 tests TAST et 14 résultats du runner passent à cette étape. La série précédente de [recoloration](../../altbak.pub-purust/scratch/rust-recolor-field-20260909/REPORT.md) donnait **20,977 → 20,354 ms** ; les temps de deux sessions différentes ne constituent pas une comparaison appariée.

Acquis : ADT typés, enums sans champs en valeur, transferts au dernier usage, emprunts locaux, réutilisation des cellules uniques et des rotations, copie des cellules partagées. Le [comptage RBTree](../../altbak.pub-purust/scratch/rust-existing-empty-20260909/REPORT.md) donne **100 001 allocations et libérations pour 100 000 nœuds utiles et une cellule vide**. La fusion des thunks immédiatement forcés est intégrée pour les entrées entières fermées dont l'exécution est prouvée sûre.

## Méthode commune

- Travailler dans ce checkout Purust, avec `altbak.pub-purust` et `purescript-backend-optimizer-purust`. Conserver les checkouts normaux d'altbak.pub et de PBO intacts.
- Exploiter le TAST : `ann.type`, `dataDecls`, `classDecls`, `TypeApp`. Les types et layouts définissent les règles générales ; l'unicité et la dernière utilisation demandent aussi une analyse des usages.
- Commencer chaque piste par une expérience isolée et courte sur le Rust réellement généré. Examiner le code machine si LLVM peut déjà supprimer le coût supposé. Les occurrences statiques de `.clone()` ne mesurent pas le travail exécuté.
- Chronométrer sans instrumentation ; compter allocations, libérations et opérations de comptage séparément. Conserver sources, révisions, profil O1, allocateur mimalloc et entrées identiques entre variantes.
- Après une intégration : `npm run build`, tests de génération et TAST, puis `bin/rust/run -c` depuis `altbak.pub-purust` avec les 14 résultats vérifiés. Sélectionner explicitement le fork pour les tests TAST : `PURS="$PWD/../../altbak.pub-purust/run/bak/js/node_modules/.bin/purs" npm run test:tast` depuis Purust.
- Mesurer cinq paires alternées de runners complets, documenter dispersion et médianes, et comparer au README officiel relu. Un gain local doit être confirmé dans la suite ; en l'absence de gain mesurable, noter le résultat et réévaluer la priorité.

## 1. Rendre le comptage plus précis, branche par branche

Les premiers comptages sont établis. Une première spécialisation de reconstruction est intégrée à l'étape 2, après les deux expériences ci-dessous sans gain temporel suffisamment établi.

- [x] Instrumenter le Rust généré de RBTree : distinguer créations, clones, relâchements, tests d'unicité et consommations sur les chemins uniques et partagés.
- [x] Isoler une paire temporaire dans une fixture TAST fraîche et comparer un prototype empruntant l'enfant pendant les tests de motifs. Vérifier les branches, la persistance, les références faibles et les durées de vie ; chronométrer séparément.
- [x] Choisir une règle locale dont le prototype améliore effectivement le temps, puis intégrer avec les preuves de dernières utilisations, d'ordre d'évaluation et de libération. Les cas opaques gardent leur chemin actuel.
- [x] Mesurer dans la suite complète et vérifier les effets sur la réutilisation des cellules. Une représentation intermédiaire générale des opérations de propriété demande plusieurs cas démontrés.

Diagnostic du 9 septembre : la construction de 100 000 nœuds exécute **3 060 100 clones**, **2 960 100 relâchements temporaires** et **4 967 864 tests d'unicité réussis**. Le prototype supprime les **2 960 100 paires** de projections immédiatement lues, avec les mêmes **100 001 allocations/libérations** et décisions d'unicité. La fixture TAST et les quatre rotations/200 versions persistantes passent.

**Prototype non retenu :** trois paires isolées, 15 mesures par processus, O1/mimalloc sans instrumentation : **19,737 → 20,563 ms (+4,2 %)**. Aucun changement du générateur ni gain sur le runner complet. Les nombres d'opérations logiques ne sont pas un décompte d'instructions machine. [Rapport, comptage, fixture et mesures](../../altbak.pub-purust/scratch/rust-perceus-counts-20260909/REPORT.md).

**Recoloration intégrée, étape 2.** Le gain vient de la suppression de l'extraction/reconstruction de tout le nœud. La seule conservation d'une preuve d'unicité, mesurée séparément à l'étape 4, ne justifiait pas une intégration. La prochaine extension à un enfant modifié par un appel demande sa propre expérience.

## 2. Spécialiser les reconstructions : ne modifier que les champs changés

Le chemin unique de recoloration dans `Test_RBTree_insert` ne modifie désormais que la couleur ; il n'extrait plus tout le nœud avec `__purust_take` et ne reconstruit plus `T`. C'est une première application de la « reuse specialization » décrite dans [Perceus, section 2.5](https://www.microsoft.com/en-us/research/wp-content/uploads/2020/11/perceus-tr-v4.pdf).

- [x] **Prototype de cette piste :** isoler la recoloration actuelle et une variante qui ne modifie que la couleur. Vérifier racines uniques et partagées, références faibles et anciennes versions ; examiner le code machine et mesurer le noyau RBTree. Ne changer le générateur qu'après cette preuve.
- [x] Reconnaître une reconstruction du même constructeur où tous les champs sauf un sont des projections inchangées du même parent. Commencer par un champ scalaire, sans appel ni conversion ; utiliser l'identité du constructeur et son layout TAST.
- [x] Émettre une modification du seul champ sur le chemin unique, avec reconstruction sur le chemin partagé. Couvrir les champs inchangés, enfants partagés, usages ultérieurs et ordre d'évaluation ; valider puis mesurer la suite.
- [ ] Étendre ensuite à un enfant modifié par un appel, seulement si la preuve de propriété survit à cet appel. Isoler d'abord le cas hors rotation ; vérifier callbacks et libérations sur exception avant de couvrir les rotations.

**Résultat du 9 septembre :** prototype **−1,5 %**, puis **−1,8 %** sur sept paires de confirmation. Après intégration, cinq paires de runners complets donnent **RBTree 18,237 → 17,644 ms (−3,3 %)** et **total 20,977 → 20,354 ms (−3,0 %)**. **100 000 extractions/reconstructions et retests supprimés**, toujours 100 001 allocations/libérations et le même nombre de clones. La règle s'applique aussi aux quatre setters de `Data.Time`. [Règle](src/Purust/ReuseFields.purs), [fixture TAST](tests/tast/field-updates.mjs), [rapport et mesures](../../altbak.pub-purust/scratch/rust-recolor-field-20260909/REPORT.md).

## 3. Étendre les emprunts aux parcours en lecture

Constat : `Test_RBTree_depth` reçoit un `Rc<Tree>` possédé et clone ses enfants avant les appels récursifs. Le parcours pourrait emprunter l'arbre ; le coût de sa destruction doit rester inclus dans la comparaison.

- [ ] Comparer le parcours actuel à un worker empruntant `&Tree`, sur le même arbre, avec construction et destruction identiques. Compter les incréments/décréments supprimés séparément du chronométrage.
- [ ] Inférer un paramètre en lecture pour une fonction native directe : aucun stockage, retour, capture ou transfert opaque du paramètre. Commencer par une fonction récursive et une signature concrète issue du TAST.
- [ ] Garder l'interface possédée aux frontières publiques et FFI, appeler le worker emprunté lorsque possible. Couvrir appels répétés, partages, résultats, destruction et usages ultérieurs ; intégrer puis mesurer.
- [ ] Étendre aux fonctions voisines ou à plusieurs paramètres uniquement après avoir identifié un coût exécuté supplémentaire.

## 4. Retests d'unicité : expérience réalisée, intégration en attente

Constat confirmé dans l'assembleur : certains chemins appellent `Rc::get_mut` pour extraire les champs, puis à nouveau pour reconstruire la même cellule. Le comptage initial observe **2 483 932 retests** après extraction sur la construction de 100 000 nœuds.

- [x] Identifier un test répété encore présent dans le code machine d'un chemin unique et mesurer sa fréquence séparément des temps.
- [x] Prototyper un emprunt mutable conservé localement ; mesurer séparément son passage au worker privé. Préserver les refus de partage et de références faibles, les anciennes versions et les durées de vie.
- [ ] Reprendre l'intégration seulement après un prototype au gain confirmé, avec fixture TAST et mesure de la suite. Le cas local et le passage au worker restent distincts ; aucun alias du propriétaire ne peut apparaître pendant l'emprunt.

**Résultat du 9 septembre :** l'emprunt local supprime **100 000 retests** ; le premier relevé donne −1,7 %, puis cinq paires donnent **19,555 → 19,398 ms (−0,8 %)**, avec trois paires favorables et deux défavorables. Le worker supprime **2 183 976 retests**, mais ralentit le noyau : **19,282 → 20,778 ms (+7,8 %)**. Allocations et clones identiques ; contrôles natifs et instrumentés réussis, dont 200 versions conservées et 512 insertions avec partage mixte. **Aucune variante intégrée.** [Rapport et mesures](../../altbak.pub-purust/scratch/rust-uniqueness-proof-20260909/REPORT.md).

## 5. Reclasser les autres coûts après RBTree

- [x] **Church : fusionner un producteur de fonctions avec son application saturée.** Le coût mesuré était la construction répétée d'une chaîne de closures par `fromInt`, avant son application. Le motif TAST `build 0 = identity; build n = let previous = build (n - 1) in \f x -> f (previous f x)` émet maintenant une boucle pour `n >= 0`, avec le chemin original pour les compteurs négatifs. La règle accepte seulement le type concret `Int -> (Int -> Int) -> Int -> Int` et une base identité locale prouvée ; elle ne dépend d'aucun nom de benchmark. **Church 1,439 → 0,164 ms (−88,6 %)**, **133 641 → 309 allocations/libérations** pour 100 000 applications ; **total 21,053 → 19,691 ms (−6,5 %)** sur cinq paires. Fonctions conservées, captures, ordre des callbacks, exceptions, débordements et appels intermodules vérifiés. [Règle](src/Purust/FunctionFusion.purs), [fixture TAST](tests/tast/function-fusion.mjs), [rapport](../../altbak.pub-purust/scratch/rust-function-fusion-20260909/REPORT.md). Cela étend le périmètre partiel de B3/B4 ; aucune monomorphisation générale n'est ajoutée.
- [ ] **Church résiduel, environ 0,16 ms :** les 309 allocations restantes et les appels indirects des combinateurs demandent un nouveau comptage. Isoler une seule suppression de fermeture ou d'adaptateur encore exécutée ; le natif du README est à environ 0,001 ms avec une boucle arithmétique sans callbacks.
- [ ] **Records, environ 1 ms :** compter copies et allocations sur une mise à jour imbriquée, comparer au natif, puis essayer une seule amélioration de représentation ou de propriété guidée par le TAST.
- [ ] **Fusion de thunks :** envisager les entrées inconnues seulement pour un cas utile mesuré, avec une preuve plus générale de terminaison et de sûreté arithmétique. Le benchmark LazyEvaluation actuel n'offre presque plus de gain.

## Pistes en réserve

- **Sticky sharing :** `PerceusPtr` possède déjà un compteur saturant à `u32::MAX`, alors que RBTree utilise `std::rc::Rc`. Aucun gain n'est établi pour un remplacement du pointeur ou une immortalisation supplémentaire. Revenir à cette piste seulement avec des compteurs montrant un coût pertinent.
- **Factorisation des motifs de balance :** une série antérieure donnait 40,472 ms contre 40,312 ms, sans gain temporel. Ne pas déduire un gain de la seule réduction du Rust généré ; réévaluer sur de nouvelles preuves.
- **Profil de compilation :** un ancien essai O3 n'améliorait pas RBTree. LTO et le nombre d'unités de codegen restent à mesurer séparément ; conserver O1 comme référence pour les transformations ci-dessus.

Les rapports historiques restent dans [scratch d'altbak.pub-purust](../../altbak.pub-purust/scratch/) et l'ancien todo dans l'historique Git.
