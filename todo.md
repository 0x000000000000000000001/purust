# Plan de performance de Purust

Mis à jour le 10 septembre 2026. La nouvelle extension B13/B14 décide après le calcul de l’enfant si le helper ne ferait que reconstruire le parent. Cinq paires du code réellement généré donnent **16,590 → 12,640 ms** sur la suite (**−3,950 ms, −23,8 %**), dont **RBTree 15,498 → 11,528 ms**. Les cinq paires sont favorables ; les optimisations suivantes restent à mesurer. [Rapport](../../altbak.pub-purust/scratch/rust-post-call-child-integration-20260910/REPORT.md).

## Point de départ

| Benchmark | Rust compilé, README officiel | Rust natif optimisé, dernière colonne |
| --- | ---: | ---: |
| RBTree | 15,956 ms | 36,070 ms |
| Church | 0,174 ms | 0,001 ms |
| Deep Record Updates | 0,647 ms | 0,004 ms |
| LazyEvaluation | ≈ 0 ms, arrondi | ≈ 0 ms, arrondi |
| **Total** | **17,12 ms** | **36,13 ms** |

Source : [README du checkout normal d'altbak.pub](../../altbak.pub/README.md#rust), relevé le 10 septembre. Celui du worktree peut être plus ancien. RBTree représente environ 93 % du total documenté et le compilé est déjà plus rapide que le natif de cette colonne. Le gain de chaque intégration est établi sur sa propre comparaison appariée, avec le même TAST et les mêmes dépendances.

La [réutilisation du chemin jusqu’à la feuille](../../altbak.pub-purust/scratch/rust-record-path-20260909/REPORT.md) donne **Records 0,768 → 0,624 ms (−18,8 %)** sur cinq paires favorables. **10 003 → 3 allocations/libérations** : seules les trois cellules initiales sont allouées. Le total mesuré **19,434 → 19,322 ms (−0,6 %)** reste un petit écart face à la dispersion ; **22 tests de génération, 13 tests TAST et 14 résultats du runner** passent. La règle suit un enfant par niveau, avec copie lorsque les versions sont partagées.

L’étape précédente de [réutilisation d’un enfant de record](../../altbak.pub-purust/scratch/rust-record-child-20260909/REPORT.md) avait donné **Records 0,861 → 0,767 ms (−10,9 %)** sur cinq paires, avec **20 003 → 10 003 allocations/libérations**. Le total **19,735 → 19,733 ms** reste stable dans la dispersion ; **22 tests de génération, 13 tests TAST et 14 résultats du runner** passent. Cette étape précédente réutilisait un seul enfant immédiat et conservait la copie du dernier niveau.

La précédente [mesure appariée](../../altbak.pub-purust/scratch/rust-record-root-move-20260909/REPORT.md), après déplacement de la racine des records au dernier usage, donne **Records 0,938 → 0,837 ms (−10,8 %)** sur dix paires, réparties en deux séries. Le total **19,112 → 19,077 ms** ne démontre pas de gain global au regard de la dispersion. Les **21 tests de génération, 13 tests TAST et 14 résultats du runner** passent. La [fusion de Church](../../altbak.pub-purust/scratch/rust-function-fusion-20260909/REPORT.md) donnait **1,439 → 0,164 ms** sur ce cas ; la [recoloration](../../altbak.pub-purust/scratch/rust-recolor-field-20260909/REPORT.md), **RBTree 18,237 → 17,644 ms**. Chaque expérience conserve sa propre baseline. Le README normal relevé pour cette ancienne étape affichait **19,95 ms au total**, dont **18,449 ms RBTree**, **0,969 ms Records** et **0,173 ms Church** ; ces valeurs restent propres à cette étape historique.

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

**Recoloration intégrée, étape 2.** Le gain vient de la suppression de l'extraction/reconstruction de tout le nœud. La seule conservation d'une preuve d'unicité, mesurée séparément à l'étape 4, ne justifiait pas une intégration. L’extension à un enfant modifié par un appel est désormais intégrée sur un graphe local fermé, avec sa propre expérience et sa mesure ci-dessous.

## 2. Spécialiser les reconstructions : ne modifier que les champs changés

Le chemin unique de recoloration dans `Test_RBTree_insert` ne modifie désormais que la couleur ; il n'extrait plus tout le nœud avec `__purust_take` et ne reconstruit plus `T`. C'est une première application de la « reuse specialization » décrite dans [Perceus, section 2.5](https://www.microsoft.com/en-us/research/wp-content/uploads/2020/11/perceus-tr-v4.pdf).

- [x] **Prototype de cette piste :** isoler la recoloration actuelle et une variante qui ne modifie que la couleur. Vérifier racines uniques et partagées, références faibles et anciennes versions ; examiner le code machine et mesurer le noyau RBTree. Ne changer le générateur qu'après cette preuve.
- [x] Reconnaître une reconstruction du même constructeur où tous les champs sauf un sont des projections inchangées du même parent. Commencer par un champ scalaire, sans appel ni conversion ; utiliser l'identité du constructeur et son layout TAST.
- [x] Émettre une modification du seul champ sur le chemin unique, avec reconstruction sur le chemin partagé. Couvrir les champs inchangés, enfants partagés, usages ultérieurs et ordre d'évaluation ; valider puis mesurer la suite.
- [x] Étendre à un enfant modifié par un appel natif direct fermé, avec une branche de reconstruction du même constructeur prouvée par le TAST. L’emprunt mutable reste valide pendant l’appel ; le parent garde ses champs inchangés et ne réinstalle que l’enfant. Parents partagés/faibles, callbacks, appels opaques et conversions gardent les chemins existants.
- [x] Étendre aux gardes qui dépendent de l’enfant calculé. Les tests de tags et projections dominées sont prouvés à partir du TAST ; le helper reçoit le résultat déjà calculé sur les branches complexes. **1 368 968 extractions/reconstructions complètes supprimées**, avec allocations et appels récursifs inchangés. La règle est générale, validée par une fixture indépendante des benchmarks.
- [ ] Étendre cette spécialisation aux rotations ou à d’autres formes d’appels seulement après une nouvelle preuve et une mesure ; les gains sur les versions fortement persistantes restent à établir.

**Résultat du 9 septembre :** prototype **−1,5 %**, puis **−1,8 %** sur sept paires de confirmation. Après intégration, cinq paires de runners complets donnent **RBTree 18,237 → 17,644 ms (−3,3 %)** et **total 20,977 → 20,354 ms (−3,0 %)**. **100 000 extractions/reconstructions et retests supprimés**, toujours 100 001 allocations/libérations et le même nombre de clones. La règle s'applique aussi aux quatre setters de `Data.Time`. [Règle](src/Purust/ReuseFields.purs), [fixture TAST](tests/tast/field-updates.mjs), [rapport et mesures](../../altbak.pub-purust/scratch/rust-recolor-field-20260909/REPORT.md).

**Enfant par appel intégré, 9 septembre :** cinq blocs comparant les trois binaires réellement générés donnent **RBTree 18,309 → 16,339 → 15,741 ms**, **total 19,419 → 17,442 → 16,835 ms**. La première étape combine reconstruction directe et emprunt unique conservé (**−1,977 ms**) ; la modification du seul enfant apporte ensuite **−0,607 ms**. Les deux étapes sont favorables dans chacun des cinq blocs. **715 030 extractions/reconstructions complètes supprimées**, autant de clones/relâchements temporaires du frère ajoutés ; toujours **100 001 allocations/libérations**. **23 tests de génération, 14 tests TAST et les 14 résultats du runner** passent après `bin/rust/run -c`. Le README officiel relu donne **18,480 ms RBTree / 19,62 ms total** pour le compilé et **36,070 / 36,13 ms** pour le natif optimisé. [Règle d’appel](src/Purust/ChildCalls.purs), [règle de champ](src/Purust/ChildUpdates.purs), [rapport et mesures](../../altbak.pub-purust/scratch/rust-child-field-integration-20260909/REPORT.md). B13/B14 restent partiels.

**Garde après appel intégrée, 10 septembre :** **RBTree 15,498 → 11,528 ms**, **suite 16,590 → 12,640 ms (−3,950 ms, −23,8 %)** sur cinq paires favorables, après reconstruction complète du binaire avant pour écarter un cache Cargo trompeur. **26 tests de génération, 15 tests TAST et 14 résultats du runner** passent ; rotations, partage/Weak, durées de vie et 200 anciennes versions sont vérifiés sur la sortie réelle. Le gain sur les versions fortement persistantes reste à établir ; leur fallback peut effectuer un test d’unicité supplémentaire. [Analyse des branches](src/Purust/ChildBranches.purs), [émission des gardes](src/Purust/ChildBranchPrinter.purs), [rapport, mesures et limites](../../altbak.pub-purust/scratch/rust-post-call-child-integration-20260910/REPORT.md). B13/B14 restent partiels ; les rotations conservent leur reconstruction complète.

## 3. Étendre les emprunts aux parcours en lecture

Constat : `Test_RBTree_depth` reçoit un `Rc<Tree>` possédé et clone ses enfants avant les appels récursifs. Le parcours pourrait emprunter l'arbre ; le coût de sa destruction doit rester inclus dans la comparaison.

- [ ] Comparer le parcours actuel à un worker empruntant `&Tree`, sur le même arbre, avec construction et destruction identiques. Compter les incréments/décréments supprimés séparément du chronométrage.
- [ ] Inférer un paramètre en lecture pour une fonction native directe : aucun stockage, retour, capture ou transfert opaque du paramètre. Commencer par une fonction récursive et une signature concrète issue du TAST.
- [ ] Garder l'interface possédée aux frontières publiques et FFI, appeler le worker emprunté lorsque possible. Couvrir appels répétés, partages, résultats, destruction et usages ultérieurs ; intégrer puis mesurer.
- [ ] Étendre aux fonctions voisines ou à plusieurs paramètres uniquement après avoir identifié un coût exécuté supplémentaire.

## 4. Retests d'unicité : prototypes isolés et intégration ciblée

Constat confirmé dans l'assembleur : certains chemins appellent `Rc::get_mut` pour extraire les champs, puis à nouveau pour reconstruire la même cellule. Le comptage initial observe **2 483 932 retests** après extraction sur la construction de 100 000 nœuds.

- [x] Identifier un test répété encore présent dans le code machine d'un chemin unique et mesurer sa fréquence séparément des temps.
- [x] Prototyper un emprunt mutable conservé localement ; mesurer séparément son passage au worker privé. Préserver les refus de partage et de références faibles, les anciennes versions et les durées de vie.
- [x] Conserver l’emprunt sur le chemin enfant fermé de l’étape 2, après prototype, fixture TAST et mesure de la suite. Son gain combine suppression du helper de balance et du retest ; il ne valide pas à lui seul les anciens prototypes de propagation.
- [ ] Étendre à d’autres chemins seulement avec un gain propre confirmé. Le cas local et le passage au worker restent distincts ; aucun alias du propriétaire ne peut apparaître pendant l’emprunt.

**Résultat du 9 septembre :** l'emprunt local supprime **100 000 retests** ; le premier relevé donne −1,7 %, puis cinq paires donnent **19,555 → 19,398 ms (−0,8 %)**, avec trois paires favorables et deux défavorables. Le worker supprime **2 183 976 retests**, mais ralentit le noyau : **19,282 → 20,778 ms (+7,8 %)**. Allocations et clones identiques ; contrôles natifs et instrumentés réussis, dont 200 versions conservées et 512 insertions avec partage mixte. **Ces deux variantes isolées n’ont pas été intégrées.** L’étape 2 ajoute depuis un chemin fermé différent, dont le gain est mesuré avec son raccourci de reconstruction. [Rapport et mesures](../../altbak.pub-purust/scratch/rust-uniqueness-proof-20260909/REPORT.md).

## 5. Reclasser les autres coûts après RBTree

- [x] **Church : fusionner un producteur de fonctions avec son application saturée.** Le coût mesuré était la construction répétée d'une chaîne de closures par `fromInt`, avant son application. Le motif TAST `build 0 = identity; build n = let previous = build (n - 1) in \f x -> f (previous f x)` émet maintenant une boucle pour `n >= 0`, avec le chemin original pour les compteurs négatifs. La règle accepte seulement le type concret `Int -> (Int -> Int) -> Int -> Int` et une base identité locale prouvée ; elle ne dépend d'aucun nom de benchmark. **Church 1,439 → 0,164 ms (−88,6 %)**, **133 641 → 309 allocations/libérations** pour 100 000 applications ; **total 21,053 → 19,691 ms (−6,5 %)** sur cinq paires. Fonctions conservées, captures, ordre des callbacks, exceptions, débordements et appels intermodules vérifiés. [Règle](src/Purust/FunctionFusion.purs), [fixture TAST](tests/tast/function-fusion.mjs), [rapport](../../altbak.pub-purust/scratch/rust-function-fusion-20260909/REPORT.md). Cela étend le périmètre partiel de B3/B4 ; aucune monomorphisation générale n'est ajoutée.
- [ ] **Church résiduel, environ 0,16 ms :** les 309 allocations restantes et les appels indirects des combinateurs demandent un nouveau comptage. Isoler une seule suppression de fermeture ou d'adaptateur encore exécutée ; le natif du README est à environ 0,001 ms avec une boucle arithmétique sans callbacks.
- [x] **Records : déplacer la racine après les valeurs de remplacement.** Pour une base locale de record fermé, sans conversion ni usage ultérieur, `Update` calcule les valeurs dans l'ordre en gardant la base vivante, puis la déplace avant les setters existants. Les aliases retenus par les valeurs conservent le chemin de copie du runtime. Le code réellement généré supprime **10 000 allocations/libérations : 30 003 → 20 003**. Deux séries de cinq paires confirment **−10,5 %**, puis **−10,1 %** sur Records ; les dix paires réunies donnent **0,938 → 0,837 ms**. Le total est indécis. Racines uniques/partagées, usages ultérieurs, callbacks, captures de l'ancienne racine, exceptions et libérations vérifiés. [Fixture TAST](tests/tast/record-root-move.mjs), [rapport](../../altbak.pub-purust/scratch/rust-record-root-move-20260909/REPORT.md). B14 reste partiel, B22 reste vert.
- [x] **Records : réutiliser un niveau enfant.** Une mise à jour du même enfant d’une racine locale consommée, prouvée par son layout TAST fermé, calcule les RHS avant de détacher puis réinstaller l’enfant. Les setters existants conservent les copies en présence d’alias. **20 003 → 10 003 allocations/libérations**, **0,861 → 0,767 ms (−10,9 %)** sur cinq paires du runner complet ; total indécis. Adresses uniques, partage indépendant de l’enfant, captures des anciennes versions, callbacks et libérations sur exception vérifiés. [Règle](src/Purust/RecordUpdates.purs), [rapport](../../altbak.pub-purust/scratch/rust-record-child-20260909/REPORT.md). B14 reste partiel et B22 reste vert.
- [x] **Records : réutiliser le dernier niveau.** Le plan suit récursivement un enfant par niveau, avec validation du même chemin et du layout fermé TAST. Toutes les valeurs sont calculées avant le déplacement de la racine ; les enfants sont détachés puis réinstallés avec les setters existants. **10 003 → 3 allocations/libérations**, **0,768 → 0,624 ms (−18,8 %)** sur cinq paires ; total **19,434 → 19,322 ms**, petite baisse à relativiser. Les huit combinaisons de partage, les trois adresses uniques, les captures, callbacks et libérations sur exception passent. [Rapport](../../altbak.pub-purust/scratch/rust-record-path-20260909/REPORT.md). B14 reste partiel et B22 reste vert.
- [ ] **Records résiduel : mesurer le coût des accès aux champs.** Le chemin unique n’alloue plus pendant les 10 000 mises à jour. Inspecter le code machine O1 des projections répétées et des champs `Option<Value>`, isoler un coût encore exécuté puis mesurer un prototype conservant les quatre champs du résultat. Les layouts typés/unboxés B21/B23 restent une piste distincte ; aucun gain supplémentaire n’est encore démontré.
- [ ] **Fusion de thunks :** envisager les entrées inconnues seulement pour un cas utile mesuré, avec une preuve plus générale de terminaison et de sûreté arithmétique. Le benchmark LazyEvaluation actuel n'offre presque plus de gain.

## Pistes en réserve

- **Sticky sharing :** `PerceusPtr` possède déjà un compteur saturant à `u32::MAX`, alors que RBTree utilise `std::rc::Rc`. Aucun gain n'est établi pour un remplacement du pointeur ou une immortalisation supplémentaire. Revenir à cette piste seulement avec des compteurs montrant un coût pertinent.
- **Factorisation des motifs de balance :** une série antérieure donnait 40,472 ms contre 40,312 ms, sans gain temporel. Ne pas déduire un gain de la seule réduction du Rust généré ; réévaluer sur de nouvelles preuves.
- **Profil de compilation :** un ancien essai O3 n'améliorait pas RBTree. LTO et le nombre d'unités de codegen restent à mesurer séparément ; conserver O1 comme référence pour les transformations ci-dessus.

Les rapports historiques restent dans [scratch d'altbak.pub-purust](../../altbak.pub-purust/scratch/) et l'ancien todo dans l'historique Git.
