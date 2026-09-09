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

La dernière [série appariée](../../altbak.pub-purust/scratch/rust-thunk-fusion-20260909/REPORT.md) donne **21,395 ms au total**, dont **18,597 ms pour RBTree**. Elle reste distincte du README. Les 19 tests de génération, 10 tests TAST et 14 résultats du runner passent à cette étape.

Acquis : ADT typés, enums sans champs en valeur, transferts au dernier usage, emprunts locaux, réutilisation des cellules uniques et des rotations, copie des cellules partagées. Le [comptage RBTree](../../altbak.pub-purust/scratch/rust-existing-empty-20260909/REPORT.md) donne **100 001 allocations et libérations pour 100 000 nœuds utiles et une cellule vide**. La fusion des thunks immédiatement forcés est intégrée pour les entrées entières fermées dont l'exécution est prouvée sûre.

## Méthode commune

- Travailler dans ce checkout Purust, avec `altbak.pub-purust` et `purescript-backend-optimizer-purust`. Conserver les checkouts normaux d'altbak.pub et de PBO intacts.
- Exploiter le TAST : `ann.type`, `dataDecls`, `classDecls`, `TypeApp`. Les types et layouts définissent les règles générales ; l'unicité et la dernière utilisation demandent aussi une analyse des usages.
- Commencer chaque piste par une expérience isolée et courte sur le Rust réellement généré. Examiner le code machine si LLVM peut déjà supprimer le coût supposé. Les occurrences statiques de `.clone()` ne mesurent pas le travail exécuté.
- Chronométrer sans instrumentation ; compter allocations, libérations et opérations de comptage séparément. Conserver sources, révisions, profil O1, allocateur mimalloc et entrées identiques entre variantes.
- Après une intégration : `npm run build`, tests de génération et TAST, puis `bin/rust/run -c` depuis `altbak.pub-purust` avec les 14 résultats vérifiés. Sélectionner explicitement le fork pour les tests TAST : `PURS="$PWD/../../altbak.pub-purust/run/bak/js/node_modules/.bin/purs" npm run test:tast` depuis Purust.
- Mesurer cinq paires alternées de runners complets, documenter dispersion et médianes, et comparer au README officiel relu. Un gain local doit être confirmé dans la suite ; en l'absence de gain mesurable, noter le résultat et réévaluer la priorité.

## 1. Spécialiser les reconstructions : ne modifier que les champs changés

Constat : la recoloration dans `Test_RBTree_insert` extrait tout le nœud avec `__purust_take`, place temporairement `E`, reconstruit `T`, puis réécrit la cellule. Le chemin unique pourrait ne modifier que la couleur. C'est le principe de « reuse specialization » décrit dans [Perceus, section 2.5](https://www.microsoft.com/en-us/research/wp-content/uploads/2020/11/perceus-tr-v4.pdf).

- [ ] **Premier baby step :** isoler la recoloration actuelle et une variante qui ne modifie que la couleur. Vérifier racines uniques et partagées, références faibles et anciennes versions ; examiner le code machine et mesurer le noyau RBTree. Ne changer le générateur qu'après cette preuve.
- [ ] Reconnaître une reconstruction du même constructeur où tous les champs sauf un sont des projections inchangées du même parent. Commencer par un champ scalaire, sans appel ni conversion ; utiliser l'identité du constructeur et son layout TAST.
- [ ] Émettre une modification du seul champ sur le chemin unique, avec reconstruction sur le chemin partagé. Couvrir les champs inchangés, enfants partagés, usages ultérieurs et ordre d'évaluation ; valider puis mesurer la suite.
- [ ] Étendre ensuite à un enfant modifié par un appel, seulement si la preuve de propriété survit à cet appel. Isoler d'abord le cas hors rotation ; vérifier callbacks et libérations sur exception avant de couvrir les rotations.

## 2. Éviter de retester une unicité déjà établie

Constat : certains chemins appellent `Rc::get_mut` pour extraire les champs, puis à nouveau pour reconstruire la même cellule. Le compilateur Rust peut en supprimer une partie ; le coût restant est à établir.

- [ ] Identifier un test répété encore présent dans le code machine d'un chemin unique et mesurer sa fréquence séparément des temps.
- [ ] Prototyper la conservation d'un emprunt mutable ou d'une preuve d'unicité dans un bloc strict local, sans appel intermédiaire. Préserver les règles de `Rc`, notamment les références faibles.
- [ ] Si le gain est confirmé, intégrer ce seul cas avec un test TAST, puis mesurer. Traiter séparément un éventuel passage par un worker privé ; invalider la preuve dès qu'un alias peut être créé ou exposé.

## 3. Étendre les emprunts aux parcours en lecture

Constat : `Test_RBTree_depth` reçoit un `Rc<Tree>` possédé et clone ses enfants avant les appels récursifs. Le parcours pourrait emprunter l'arbre ; le coût de sa destruction doit rester inclus dans la comparaison.

- [ ] Comparer le parcours actuel à un worker empruntant `&Tree`, sur le même arbre, avec construction et destruction identiques. Compter les incréments/décréments supprimés séparément du chronométrage.
- [ ] Inférer un paramètre en lecture pour une fonction native directe : aucun stockage, retour, capture ou transfert opaque du paramètre. Commencer par une fonction récursive et une signature concrète issue du TAST.
- [ ] Garder l'interface possédée aux frontières publiques et FFI, appeler le worker emprunté lorsque possible. Couvrir appels répétés, partages, résultats, destruction et usages ultérieurs ; intégrer puis mesurer.
- [ ] Étendre aux fonctions voisines ou à plusieurs paramètres uniquement après avoir identifié un coût exécuté supplémentaire.

## 4. Rendre le comptage plus précis, branche par branche

Objectif : compléter les déplacements et emprunts existants par la spécialisation des libérations et l'élimination des paires incrément/décrément encore exécutées. Le runtime `PerceusPtr` ne suffit pas à fournir toutes les analyses de Perceus.

- [ ] Instrumenter un seul chemin chaud restant après les étapes précédentes : distinguer copies utiles, copies temporaires, libérations et tests d'unicité. Choisir la première paire réellement évitable.
- [ ] Isoler une fixture où un parent consommé et ses champs provoquent encore du comptage inutile. Prototyper le déplacement des opérations dans les seules branches qui en ont besoin, puis leur suppression par paires.
- [ ] Intégrer une règle locale tenant compte des dernières utilisations et sorties de branche. Vérifier partages, captures, ordre des effets et libérations normales ou sur exception ; conserver les cas opaques sur leur chemin actuel.
- [ ] Mesurer le gain et les effets sur la réutilisation des cellules. N'introduire une représentation intermédiaire générale des opérations de propriété que si plusieurs cas démontrés le justifient.

## 5. Reclasser les autres coûts après RBTree

- [ ] **Church, environ 1,5 ms :** retrouver dans le code actuel un aller-retour `Func1<i64, i64>` → `Func1<Value, Value>` → `Func1<i64, i64>`. Isoler et mesurer sa suppression ; couvrir effets, captures et applications partielles avant une règle générale.
- [ ] **Records, environ 1 ms :** compter copies et allocations sur une mise à jour imbriquée, comparer au natif, puis essayer une seule amélioration de représentation ou de propriété guidée par le TAST.
- [ ] **Fusion de thunks :** envisager les entrées inconnues seulement pour un cas utile mesuré, avec une preuve plus générale de terminaison et de sûreté arithmétique. Le benchmark LazyEvaluation actuel n'offre presque plus de gain.

## Pistes en réserve

- **Sticky sharing :** `PerceusPtr` possède déjà un compteur saturant à `u32::MAX`, alors que RBTree utilise `std::rc::Rc`. Aucun gain n'est établi pour un remplacement du pointeur ou une immortalisation supplémentaire. Revenir à cette piste seulement avec des compteurs montrant un coût pertinent.
- **Factorisation des motifs de balance :** une série antérieure donnait 40,472 ms contre 40,312 ms, sans gain temporel. Ne pas déduire un gain de la seule réduction du Rust généré ; réévaluer sur de nouvelles preuves.
- **Profil de compilation :** un ancien essai O3 n'améliorait pas RBTree. LTO et le nombre d'unités de codegen restent à mesurer séparément ; conserver O1 comme référence pour les transformations ci-dessus.

Les rapports historiques restent dans [scratch d'altbak.pub-purust](../../altbak.pub-purust/scratch/) et l'ancien todo dans l'historique Git.
