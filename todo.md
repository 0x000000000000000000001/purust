# Purust — accélérer le compilateur natif

Plan du 2 octobre 2026, inspiré des optimisations mesurées de gopurs.
Premier corpus : **purust-aff**, puis auto-reconstruction du compilateur.

## Objectif et référence

Réduire le temps du backend natif, avec les mêmes entrées et résultats que JS.
Premier jalon **atteint dans la troisième campagne : 5 743 ms natif contre
6 292 ms JS, ratio 0,91**. Le ratio natif/JS de **0,3** est une
ambition ultérieure, à établir par des mesures ; sur la référence ci-dessous,
il correspondrait à environ **1,94 s**, soit une accélération native de **8,9×**.

Référence du 1er octobre : 244 modules TAST, 138 448 types, 27 122 224 octets,
`--main Test.Main --threaded`, une chauffe puis cinq passages par backend.

| Phase (médiane) | JavaScript | Rust natif |
|---|---:|---:|
| Chargement TAST + tri | 632 ms | 1 985 ms |
| Préparation | 40 ms | 1 002 ms |
| Optimisation + génération | 4 902 ms | 11 554 ms |
| Finalisation + émission | 848 ms | 2 506 ms |
| **Backend total** | **6 480 ms** | **17 214 ms** |

Ratio natif/JS : **2,66**. Les médianes des phases ne s'additionnent pas.
Validation : 496 fichiers Rust/manifests identiques et 47 checks Aff réussis.

Rapport et mesures :
`../../altbak.pub/docs/benchmark-results/2026-10-01-purust-aff-compilation.{md,json}`.
Runner : `../../altbak.pub/bin/benchmark/compilation-purust-aff.mjs`.

## Première campagne — résultat validé

Le **2 octobre 2026**, sur le même TAST figé, la campagne finale de cinq paires
donne **6 774 ms JS / 10 328 ms natif**, ratio **1,52×**. Le natif utilise O3
sans LTO et 8 workers PBO, avec codegen séquentiel. Les 12 sorties sont identiques
(496 fichiers) et l'application passe les 47 checks Aff. Le premier jalon
« battre JS » reste à atteindre.

La comparaison contrôlée des anciens/nouveaux binaires natifs, cinq passages
chacun sur le snapshot restauré, donne **17 111 → 9 935 ms**, soit **−41,9 %**
(**1,72×** plus rapide). RSS maximal **312 → 458 Mio**. Ce résultat appartient
à une campagne distincte ; le tableau JS/natif publié garde sa médiane 10 328 ms.

Résultats et mesures brutes :
`../../altbak.pub/docs/benchmark-results/2026-10-02-purust-aff-compilation.{md,json}`.
Diagnostic et essais détaillés :
`../../altbak.pub/docs/benchmark-results/2026-10-02-purust-compiler-optimization.{md,json}`.

## Deuxième campagne — résultat final

Le deuxième lot, installé après auto-reconstruction, donne **6 463 ms JS /
8 247 ms natif**, ratio **1,28×**, sur cinq paires avec le même TAST figé.
Le natif utilise désormais **4 PBO + 4 codegen** dans son budget de 8 workers.
Les deux dernières paires ont ralenti ; tous les échantillons sont conservés.
Les 12 sorties contiennent les mêmes 496 fichiers et l'application passe les
47 checks Aff. Battre JS reste le prochain jalon.

La comparaison contrôlée avec le binaire publié après le premier lot donne
**10 419 → 8 189 ms**, soit **−21,4 % / 1,27×** plus rapide. RSS maximal
**465 → 498 Mio**. Cette campagne avant/après est distincte du tableau JS/natif,
qui conserve la médiane native **8 247 ms**.

Rapports et mesures brutes :
`../../altbak.pub/docs/benchmark-results/2026-10-02-purust-aff-codegen-compilation.{md,json}` ;
`../../altbak.pub/docs/benchmark-results/2026-10-02-purust-codegen-optimization.{md,json}`.

## Troisième campagne — résultat final

Le compilateur stage 2 installé donne **6 292 ms JS / 5 743 ms natif** sur
cinq paires avec le même TAST figé : ratio **0,9127**, soit **8,7 % de temps
en moins** côté natif. Le premier jalon « battre JS sur purust-aff » est atteint.
Les 12 sorties ont les mêmes **496 fichiers**, puis l'application passe ses
**47 checks Aff**. Défauts conservés : natif **4 PBO + 4 codegen**, JS séquentiel.

La comparaison contrôlée avec le stage 2 publié après le deuxième lot donne
**7 583 → 5 499 ms**, soit **−27,5 % / 1,38×** plus rapide, RSS maximal
**504 → 485 Mio**. Cette campagne est distincte du tableau JS/natif ; sa médiane
native reste **5 743 ms** dans les READMEs.

Le diagnostic d'allocations du lot complet baisse de **795,4 → 660,0 millions
de requêtes (−17,0 %)** et de **34,39 → 29,04 Go demandés (−15,5 %)**.
Les temps instrumentés ne servent pas à calculer le gain. Auto-reconstruction :
**453 modules / 282 610 types / 914 fichiers identiques** ; smoke **152 modules /
312 fichiers**, `PURUST_NATIVE_OK 42`, suite Aff complète réussie.

Rapports et mesures brutes :
`../../altbak.pub/docs/benchmark-results/2026-10-02-purust-aff-pipeline-compilation.{md,json}` ;
`../../altbak.pub/docs/benchmark-results/2026-10-02-purust-pipeline-optimization.{md,json}`.

## 1 — Diagnostic et profil de compilation

- [x] Préserver les binaires, sources et entrées de référence ; relever leurs
      empreintes, révisions et paramètres de compilation.
- [x] Profiler CPU et allocations du compilateur natif sur le corpus figé.
      Séparer les coûts de PBO, codegen, scanner et finalisation ; relever aussi
      nombre/octets d'allocations et mémoire maximale.
- [x] Comparer `opt-level=1/2/3` sur les mêmes sources Rust du compilateur,
      avec LTO désactivé ; mesurer les binaires hors instrumentation.
- [x] Retenir un profil sur les résultats, puis établir l'ordre des corrections
      à partir des postes dominants observés.

## 2 — Scanner Rust et construction des chaînes

- [x] Mesurer `Purust.Threading` : reconnaissance des chaînes/commentaires,
      découverte des imports et transformation d'ownership.
- [x] Mutualiser les regex, éviter leur reconstruction par segment et filtrer
      les caractères de départ ; conserver exactement les littéraux, commentaires,
      caractères Unicode et lifetimes.
- [ ] Si le profil le justifie, construire les sorties avec un accumulateur
      natif, en limitant les chaînes intermédiaires et recopies.
- [x] Vérifier les sorties exactes JS/Rust et les cas lexicaux sensibles ;
      mesurer le gain sur le backend complet.

## 3 — Maps natives et code généré exécutant PBO

- [ ] Attribuer le coût des Maps, dictionnaires, closures, conversions `Value`,
      tableaux, clones de chaînes et opérations `Arc`.
- [x] Donner à `NativeMaps.rs` des comparateurs/recherches natifs pour les clés
      chaudes `String`, `Int`, `Qualified Ident`. `EvalRef`/`TcoRef` gardent leur
      comparateur fourni, avec parcours natif sans allocation de dictionnaire :
      importer leurs types créerait un cycle entre crates Rust.
- [x] Étendre aux insertions/unions suivant le profil ; préserver persistance,
      partage, ordre des clés et priorité des valeurs.
- [ ] Réduire les allocations du Rust généré aux sites confirmés : conversions
      redondantes, dictionnaires reconstruits, tableaux copiés avant indexation,
      concaténations et captures inutiles.
- [ ] Vérifier les caches d'instanciation/recherche déjà présents : succès,
      coût des clés et portée par module ; garder les références propriétaires.

## 4 — Décodage TAST spécialisé

- [ ] Séparer parsing JSON, résolution de la table de types et construction AST.
- [x] Spécialiser les tables de types dans `CoreFn/Json.rs` : DAG valides en
      natif, erreurs/cycles délégués au décodeur de référence.
- [x] Vérifier types, partage, Unicode et ordre des erreurs : 830 tables
      différentielles, puis égalité intégrale des sorties et auto-reconstruction.
- [ ] Évaluer les autres points d'entrée de `CoreFn/Json.rs` et le parsing dans
      `CoreFn/Json/Text.rs` à partir d'un nouveau profil.
- [x] Comparer le chargement avec 1/2/4/8 workers, mémoire comprise.

## 5 — Parallélisme borné

- [x] Intégrer `buildModulesParallel` déjà présent dans PBO, en conservant
      visibilité par rang, accumulation des directives et publication ordonnée.
- [x] Commencer avec codegen séquentiel ; comparer 1/2/4/8 workers et relever
      tentatives, relances, CPU, allocations et mémoire.
- [x] Rendre l'état de génération propre à chaque module (`globalConsumed`,
      `globalCaptured`) avant toute émission concurrente : ces deux références
      étaient inutilisées et sont supprimées dans la deuxième campagne.
- [x] Ajouter le chevauchement optimisation/émission si les mesures le justifient,
      avec borne de travaux en vol, propagation des erreurs et attente des enfants.

## 6 — Qualification et publication de cette première campagne

- [x] Après chaque correction : tests ciblés significatifs et comparaison des
      sorties JS/natif sur les mêmes TAST ; construire et exécuter l'application.
- [x] Comparer les variantes séquentiellement, avec échauffement, sorties neuves,
      cache de build vide et médianes ; séparer diagnostic instrumenté et mesure.
- [x] Confirmer les corrections retenues par la suite Aff et les régressions
      codegen/runtime concernées.
- [x] Reconstruire le compilateur avec lui-même, comparer les sources et manifests
      JS/stage 2, compiler stage 2 et exécuter le smoke test indépendant.
- [x] Publier les mesures brutes, empreintes, paramètres et résultats validés ;
      mettre à jour la ligne `purust-aff` d'`altbak.pub/README.md`.

Le temps publié inclut chargement TAST, optimisation et émission Rust. Frontend
`purs`, bootstrap, Cargo et tests applicatifs sont chronométrés séparément.
Les pistes peuvent être écartées si leurs essais ne montrent pas de gain ;
consigner alors le résultat plutôt que d'introduire une modification non justifiée.

## Références gopurs

- `../../scratch/gopurs-aff-gap-20260921/rapport.md` : indexation sans conversion
  du tableau entier et chargement parallèle.
- `../../scratch/b8x-pbo-visibility-20260926/todo-journal-20260927.md` : profil
  d'allocations, dictionnaires/reboxing, builder de chaînes et parallélisme.
- `../../scratch/b8x-pbo-visibility-20260926/mapnative/rapport.md` : comparateurs
  natifs, persistance et validation byte-exacte.
- `../../gopurs/gopurs/docs/parallel-emission.md` : pipeline borné et coordination.

## Journal

- **2026-10-02 — démarrage.** Plan installé. Première campagne : référence figée,
  profilage du compilateur et essais isolés scanner/profil de compilation.
- **Référence restaurée.** Les temporaires du 1er octobre avaient disparu.
  Les 548 fichiers ont été recopiés et vérifiés contre le manifeste publié,
  y compris les deux exécutables. Espace durable :
  `../../altbak.pub/var/benchmark/purust-compiler-20261002/`.
- **Profil CPU.** `cpu-baseline/sample.txt` : allocations, clones de Value/String,
  Maps et scanner apparaissent dans les piles ; les familles imbriquées ne sont
  pas additionnables. `cpu-summary.json` conserve leur décompte sur les 7 858
  échantillons du thread exécutant le backend.
- **Profils de compilation** (`profiles.json`, trois passages par variante) :
  médianes O1 **18 509 ms**, O2 **17 394 ms**, O3 **16 063 ms**. Sources Rust
  identiques, LTO désactivé, 496 sorties identiques à chaque passage. Le niveau 3
  est le candidat retenu pour la suite ; ces mesures remplacent une comparaison
  naïve avec le temps historique obtenu à un autre moment.
- **Scanner et Maps** (`scanner-maps.json`, trois passages par variante) :
  O3 témoin **15 475 ms**, scanner **14 963 ms**, scanner + Maps **14 589 ms**.
  496 sorties identiques dans toutes les invocations. Le scanner passe 614 cas
  différentiels JS et des appels concurrents ; il corrige aussi la différence
  préexistante de frontière de mot ASCII/Unicode. Les Maps passent les tests
  différentiels d'insertion, lookup, union, structure AVL exacte, callbacks,
  persistance et clés Unicode/surrogates.
- **Parallélisme en expérimentation.** `Purust.Build` branche le builder PBO
  existant sur un ordonnanceur Aff supervisé. `PURUST_PBO_JOBS=1` reste le défaut
  pendant la comparaison 1/2/4/8 ; le codegen reste ordonné et séquentiel.
- **Allocations** (`allocations.json`) : O3 témoin **848 879 832 requêtes /
  34 990 644 720 octets**, scanner + Maps **814 359 060 / 33 476 249 526**.
  Le compteur inclut allocations et réallocations ; les octets sont un cumul
  demandé, pas la mémoire résidente. Les temps instrumentés sont exclus des
  benchmarks. Les 496 fichiers produits restent identiques au témoin.
- **Régression parallèle corrigée.** Le premier essai à 2 workers produisait
  quatre fichiers différents : le builder parallèle omettait l'inlining forcé
  des symboles privés sans type, déjà présent dans le builder séquentiel.
  PBO reprend désormais ces directives pour le module préparé courant et les
  prédécesseurs finalisés visibles. Le test ciblé échoue avant correction et
  passe ensuite à 2/4/8 ; propagation des erreurs et finalisation des workers
  sont aussi testées. Les mesures de cette variante incorrecte sont écartées.
- **Profil de bootstrap retenu : O3**, LTO désactivé. Le choix est configurable
  par `PURUST_NATIVE_OPT_LEVEL` ; la sortie par `PURUST_NATIVE_OUTPUT`.
- **PBO validé** (`parallel-fixed.json`) : médianes 1/2/4/8 workers
  **14 623 / 12 175 / 11 441 / 10 606 ms**, 496 fichiers identiques dans les
  16 invocations. RSS maximal **310 / 468 / 455 / 463 Mio**. À 8 workers,
  113–121 tentatives sont différées ; le codegen séquentiel prend encore environ
  **5,4 s**. Défaut natif retenu : au plus 8 workers, borné par les CPU disponibles.
- **Chargement** (`loading.json`, PBO fixé à 8) : 1/2/4/8 donnent
  **1 963 / 1 854 / 1 854 / 1 828 ms** pour le chargement, avec des RSS maximaux
  **463 / 472 / 508 / 535 Mio**. Le gain reste faible ; le défaut de chargement
  reste 1. Les sorties sont identiques dans les 16 invocations.
- **Coût des relances** (`parallel-allocations.json`) : 1 worker demande
  **814 359 065 allocations/réallocations, 33 476 287 250 octets**, contre
  **942 478 653 / 37 853 052 893** à 8 workers (**+15,7 % / +13,1 %**).
  Compteurs atomiques par thread pour limiter la contention d'instrumentation,
  116 tentatives différées dans ce diagnostic, sorties identiques. Les durées
  instrumentées ne sont pas utilisées dans les comparaisons de performance.
- **Auto-reconstruction validée.** Le bootstrap O3 génère 451 modules TAST
  (281 964 types), stage 1 reproduit les **910 fichiers Rust/manifests** de JS
  à 8 workers, et Cargo reconstruit stage 2. Le smoke test indépendant compare
  312 fichiers sur 152 modules frais et exécute `PURUST_NATIVE_OK 42`.
  Stage 2 est installé atomiquement dans `bin/purust-native`. Logs et workspaces
  conservés sous `purust-native-build-6VaFml/` ; journal `self-host.log`.
- **Qualification finale.** 86 checks codegen et 43 tests TAST validés, plus
  tests différentiels des Maps et du scheduler. La suite `purust-aff/bin/test`
  passe avec le compilateur installé : 47 checks Aff, 5 tests unitaires Rust,
  concurrence/Ref/AVar, durée de vie des enfants et 9 scénarios d'erreur.
  Résultats publiés dans `altbak.pub` avec les campagnes avant/après, JS/natif,
  diagnostics, empreintes et logs. Les médianes, les 548 empreintes figées et
  les 12 sorties de la campagne JS/natif ont été revérifiées indépendamment.

## Priorité après la première campagne (historique)

Le codegen séquentiel (~5,4 s) devient le poste dominant après le parallélisme
PBO. Cibler d'abord les allocations confirmées de `sanitizeIdent`,
`codegenExprTypeWithValueEnums`, `boxUnbox`, `joinWith` et des Maps génériques.
Le scanner utilise désormais un buffer natif et la découverte des imports
ne reconstruit plus de chaîne inutile. Pour les autres sorties, choisir les
builders natifs ou les corrections du Rust généré à partir des piles mesurées.
Ensuite isoler l'état du codegen pour évaluer son parallélisme, puis spécialiser
le décodage TAST. L'indexation native de tableaux utilise déjà `array_get` et
ne recopie pas tout le tableau : ne pas réimplémenter cette optimisation.

## Deuxième campagne — codegen, 2 octobre 2026

Espace durable : `../../altbak.pub/var/benchmark/purust-codegen-20261002/`.

- [x] Restaurer et vérifier les 548 fichiers de référence. Le binaire installé
      avait changé depuis la publication : conserver aussi cet artefact et le
      comparer, sans supposer sa provenance. Le bundle JS reste identique.
- [x] Spécialiser `sanitizeIdent` en Rust : réutilisation du buffer ASCII,
      échappement UTF-16 en un parcours, référence PureScript conservée pour JS.
      **133 148 cas différentiels** passent, dont toutes les unités UTF-16.
- [x] Mesurer le sanitizer seul (`ident.json`, trois passages par variante) :
      référence publiée **9 644 ms**, binaire installé **9 634 ms**, candidat
      **8 581 ms**, soit **−11,0 %**. Les 12 sorties ont 496 fichiers identiques.
- [x] Supprimer `globalConsumed` et `globalCaptured` : leurs écritures et unions
      n'alimentaient plus les décisions, déjà fondées sur les paramètres locaux.
- [x] Implémenter un codegen borné, sans état global, avec file FIFO de résultats,
      publication ordonnée et supervision couvrant production et vidage final.
      Le mode concurrent réserve ses slots dans le budget PBO commun.
- [x] Tester en JS le désordre d'achèvement, la borne, la durée de vie commune
      PBO/codegen et les erreurs de génération, publication et production.
- [x] Comparer 1/2/4 workers de codegen à budget total constant (`emission.json`) :
      **8 985 / 8 114 / 7 741 ms**, RSS maximal **455 / 500 / 502 Mio**,
      496 fichiers identiques dans les 16 exécutions. Le témoin sanitizer seul
      donne **9 114 ms** dans cette campagne. Le retrait des références inutiles
      et la réorganisation séquentielle apportent un petit écart de **1,4 %**, à
      ne pas surinterpréter face à la dispersion. Le parallèle à 4 réduit de
      **13,8 %** le total par rapport au nouveau chemin séquentiel.
- [x] Retenir le défaut natif : moitié du budget pour codegen, au plus 4 slots,
      soit **4 PBO + 4 codegen** sur cette machine. JS reste séquentiel. Tests
      ciblés des petits budgets, limites et valeurs invalides : **9 tests**.
- [x] Valider les scénarios de l'émetteur dans une application Rust native :
      **12 scénarios** à 1/2/4 workers, **474 fichiers identiques** JS/natif,
      borne, ordre, vidage final et attente des enfants après erreur.
      La construction du générateur est différée dans le worker ; un test JS
      vérifie aussi les exceptions levées avant le retour de l'`Aff`.
- [x] Régressions : suite codegen de **90 tests**, puis tests ciblés des derniers
      changements ; **43 tests TAST** passent après relance du seul test crypto
      qui avait échoué car le conteneur Docker était arrêté.
- [x] Qualifier le candidat retenu : codegen/TAST, suite Aff complète et
      auto-reconstruction. **452 modules / 282 280 types**, **912 fichiers
      identiques** JS/stage 1 ; Cargo reconstruit stage 2, qui passe le smoke test
      indépendant (**152 modules / 312 fichiers**, `PURUST_NATIVE_OK 42`).
      Le premier smoke réussit mais son nettoyage échoue avec `ENOTEMPTY` ;
      après correction du script et relance avec workspace conservé, stage 2
      est installé. La suite Aff complète passe : 47 checks, 5 tests Rust,
      concurrence/Ref/AVar, durée de vie et 9 scénarios d'erreur.
- [x] Comparaison finale JS/natif et avant/après, publication des mesures et
      mise à jour de la table.
- [x] Revérifier les archives : empreintes et médianes, 544 entrées applicatives,
      912 fichiers auto-reconstruits, **52 sorties à 496 fichiers identiques**,
      identité du binaire installé et mesuré.

Le premier bootstrap de l'émetteur a échoué avec `No space left on device`.
Le cache Cargo de l'essai terminé `purust-native-build-9Q9eMi` (première
campagne) a été supprimé après conservation de son exécutable ; les sources,
mesures et logs sont conservés. La reconstruction corrigée utilise un nouvel
espace, journal `bootstrap-emission-deferred.log`.

## Cibles au démarrage de la troisième campagne

Le codegen parallèle est qualifié. Les autres allocations de chaînes/types
(`codegenExprTypeWithValueEnums`, `boxUnbox`, `joinWith`) restent à attribuer et
réduire avec des mesures ciblées. Le chargement TAST (**1 714 ms natif / 601 ms JS**)
et la finalisation (**1 526 / 868 ms**) restent coûteux ; spécialiser le décodage
et les constructions confirmées par le profil. Ces chiffres sont des médianes
de phase de la dernière campagne, non des gains promis.

## Troisième campagne — pipeline, journal

Espace durable : `../../altbak.pub/var/benchmark/purust-pipeline-20261002/`.

- [x] Figer les 548 fichiers de la deuxième campagne. Le natif installé a
      encore changé (`0a45b38c…`) ; le conserver à côté du témoin publié
      (`0a0f2afe…`). Le bundle JS correspond toujours à la publication.
- [x] Reprofiler tous les threads : 16 715 échantillons contenant des frames
      PureScript, dont 866 avec la table de types, 1 552 avec le décodage,
      4 513 avec Maps/Sets et 5 691 avec codegen. Familles inclusives qui se
      recouvrent, non des pourcentages CPU additionnables.
- [x] Mesurer les allocations avec compteurs par thread : **795 375 892
      requêtes / 34 387 965 902 octets demandés**. Chargement : 119 029 955
      requêtes ; préparation : 13 762 123 ; optimisation/génération :
      568 233 862 ; finalisation : 86 652 810. 63 tentatives PBO différées,
      496 fichiers identiques ; temps instrumentés exclus des benchmarks.
- [x] Construire et mesurer le candidat préparation : lectures source/FFI
      mutualisées, regex fixes réutilisées, concaténation répétée supprimée.
      Témoin publié **7 572 ms**, installé **7 904 ms**, candidat **7 748 ms**.
      Préparation **700 → 640 ms**, RSS maximal **503 → 474 Mio** ; le gain
      global n'est pas établi. Ne pas retenir sur la seule petite phase.
- [x] Implémenter une fermeture transitive compacte, avec référence PureScript,
      cycles et feuilles externes conservés, sortie canonique inchangée.
      **422 graphes PS / 417 graphes Rust** passent, dont limites 64/128 bits,
      auto-cycles, Unicode, dépendances absentes et borne du stockage dense.
- [x] Mesurer ce candidat contre préparation et le témoin publié (`graph.json`,
      trois passages) : **7 975 / 7 973 / 7 108 ms**, soit **−10,9 %** pour
      préparation + graphe contre le témoin. Finalisation **1 467 → 747 ms** ;
      les 12 sorties contiennent les mêmes 496 fichiers. Le candidat préparation
      seul reste sans gain global démontré dans cette seconde comparaison.
- [x] Qualifier la résolution native des tables de types : **830 tables /
      151 339 entrées**, dont 648 chemins rapides ; valeurs, erreurs exactes et
      partage des références vérifiés avec le runtime généré réel. Chemin rapide
      pour les DAG valides ; cycles et erreurs passent par le décodeur de
      référence pour préserver leur résolution/priorité.
- [x] Première comparaison du compilateur avec tables natives (`types.json`) :
      référence **14 838 ms**, graphe **12 377 ms**, tables **8 837 ms** ;
      chargement graphe/tables **3 709 → 1 491 ms**. Toutes les sorties sont
      identiques, mais la charge système est de **33–40** et les échantillons
      fortement dispersés. Une autre campagne gopurs était active ; ces mesures
      exploratoires sont conservées, avec confirmation ultérieure après baisse
      de la contention.
- [x] Implémenter la recherche native des faits de représentation : parcourir
      l'AVL existant en empruntant les paires de chaînes, sans Tuple/Ordering
      temporaire ni copie des clés à chaque nœud. **12 996 recherches
      différentielles**, versions persistantes, Unicode UTF-16 et 8 lecteurs
      concurrents passent.
- [x] Confirmation après baisse de la charge (`layout.json`, trois passages) :
      référence **7 693 ms**, graphe **6 904 ms**, tables **6 039 ms**, recherches
      natives **5 771 ms**. Lot complet **−25,0 %**, tables **−12,5 %** contre
      graphe, recherches **−4,4 %** contre tables. **16 sorties × 496 fichiers
      identiques**. RSS maximal témoin/candidat **498 / 483 Mio**. Candidat
      complet retenu ; préparation conservée pour la mémoire/les allocations,
      sans lui attribuer un gain total autonome.
- [x] Régressions codegen : **94 tests** passent (90 immédiatement, puis les
      quatre scénarios dépendants de Docker après remise en route du service).
- [x] Les **11 régressions TAST** ciblant layouts, FFI et manifests passent.
- [x] Après ajustement de la frontière FFI, le bundle JS se reconstruit et les
      **3 tests ciblés** (value-enums, dépendances, types étrangers) passent.
- [x] Retenir les variantes justifiées et refaire les allocations.
- [x] Qualifier le compilateur : **453 modules / 282 610 types**, **914 fichiers
      identiques** entre JS initial, bundle JS final et stage 1 natif. Cargo
      construit stage 2 ; smoke indépendant **152 modules / 312 fichiers**,
      `PURUST_NATIVE_OK 42`. Stage 2 installé (`96cf27f0…`). Suite Aff complète :
      **47 checks, 5 tests Rust, 9 scénarios d'erreur**, concurrence/Ref/AVar et
      durée de vie des enfants.
- [x] Mesurer cinq paires JS/natif et cinq passages avant/après natifs.
      Les **544 entrées applicatives vivantes** sont revérifiées identiques à
      la référence avant le gel final. JS/natif **6 292 / 5 743 ms**, ratio
      **0,9127** ; avant/après **7 583 / 5 499 ms**, soit **−27,5 %**.
- [x] Archives revérifiées : empreintes/médianes, **544 entrées applicatives**,
      **76 sorties × 496 fichiers identiques**, plus les deux sorties
      instrumentées ; **914 fichiers auto-reconstruits**, identité du binaire
      installé et mesuré. Rapports/JSON et les deux READMEs à jour.

Le candidat complet compile après reprise de Cargo. Le diagnostic d'allocations
(`alloc-layout.json`) donne **660 042 927 requêtes / 29 042 761 492 octets**,
soit **−17,0 % / −15,5 %** contre le diagnostic initial. Chargement :
53 755 455 requêtes ; préparation : 13 163 439 ; optimisation/génération :
540 509 978 ; finalisation : 44 916 908. Il y a 66 tentatives PBO différées
contre 63 dans le témoin ; les 496 fichiers restent identiques. Sources et
exécutable instrumentés restaurés byte pour byte. La comparaison des quatre
binaires a ensuite été réalisée hors instrumentation.

Le premier test natif des tables de types a été interrompu par `ENOSPC`.
D'anciens caches Cargo terminés ont été nettoyés après conservation des
exécutables ; les sources et logs sont conservés. La relance et le benchmark
du graphe ont réussi, puis le candidat cumulant les tables natives a été construit.

La première construction du candidat « layout » a détecté un décalage d'ABI à
la frontière FFI du newtype `Set` (Value au lieu de Map). La signature utilise
désormais explicitement la Map sous-jacente, avec `Set.toMap` au point d'appel.
Les sources/logs de l'échec sont conservés ; reconstruction et diagnostic des
allocations ont ensuite réussi. L'algorithme Rust testé n'a pas été modifié.

La relance corrigée a ensuite atteint la limite disque (`ENOSPC`, 231 Mio
libres) pendant Cargo. Les caches du candidat tables et de deux constructions
terminées ont été nettoyés ; exécutables, sources et logs conservés, **9,4 Gio
libérés/disponibles** avant reprise de Cargo. La charge concurrente est retombée.
La qualification a réutilisé le stage 1 mesuré, revérifié ses sources avec
le bundle JS final, puis libéré son cache avant de construire stage 2.

## Après le troisième lot

Le diagnostic du candidat complet laisse **540,5 millions de requêtes
d'allocation** dans optimisation/génération, contre **53,8 millions** au
chargement et **44,9 millions** en finalisation. Les prochains essais devront
réattribuer le temps après ces corrections, puis cibler les constructions de
chaînes/types (`codegenExprTypeWithValueEnums`, `boxUnbox`, `joinWith`) et les
allocations de PBO restantes. Le parsing JSON et le décodage des modules et
annotations conservent leur implémentation actuelle ; leur spécialisation
reste à justifier par un nouveau profil. Le seuil ambitieux natif/JS de 0,3
n'est pas établi par ce lot.

## Comparaison gopurs-aff — 2 octobre 2026

À la demande de comparaison Go/Rust, le même TAST original de **gopurs-aff**
est figé pour les quatre compilateurs : **238 modules / 136 604 types /
26 606 491 octets**, distinct du corpus `purust-aff` des trois lots précédents.
Les compilateurs installés sont copiés ; Purust reste le stage 2 `96cf27f0…`.

- [x] Adapter localement six FFI Rust aux interfaces PureScript de gopurs,
      sans changer le TAST chronométré. Sources/FFI et exécutables empreintés.
- [x] Construire et exécuter les applications. La suite originale est instable
      côté Rust : **Go 5/5, Rust 2/5** dans le diagnostic fixé à cinq passages.
      Échecs de scheduling documentés, ainsi que les trois échecs préliminaires.
- [x] Qualifier séparément les adaptateurs avec les synchronisations explicites
      déjà présentes dans `purust-aff` et une lecture post-bracket : seul
      `Test.Main` change, les **237 autres TAST sont identiques**. **5/5 passages
      par cible**, chacun avec 45 checks et le stress AVar de 1 000 échanges.
- [x] Mesurer les quatre variantes séquentiellement, une chauffe puis cinq
      passages avec ordre tournant : **gopurs.js 7 630 ms / Go natif 2 146 ms /
      purust.js 6 238 ms / Rust natif 5 495 ms**. Rust prend **2,56×** le temps
      du Go natif, mais **11,9 % de moins** que Purust JS sur ce corpus.
- [x] Vérifier **12 sorties Go × 294 fichiers**, **12 sorties Rust × 484 fichiers**,
      identiques JS/natif dans chaque cible ; archive finale **1 032 fichiers
      figés / 26 sorties avec références / 10 114 fichiers générés**.
- [x] Publier rapport/JSON et ajouter la colonne Rust à `altbak.pub/README.md`.
      Seule la ligne Aff est mesurée ; réserve explicite sur les tests originaux.

Médianes natives : chargement TAST **56 ms Go / 804 ms Rust**, préparation
**703 / 613 ms**, optimisation/émission Go **1 386 ms**, optimisation/génération
Rust **3 299 ms** puis finalisation **681 ms**. Les phases diffèrent entre
backends ; les médianes ne s'additionnent pas. Prochain lot à justifier par
profil : décodage modules/annotations et parsing JSON, puis allocations PBO,
conversions types/Value et chaînes. Rejoindre 2 146 ms demanderait environ
**61 % de réduction** sur ce corpus, pas un gain acquis.

Une première chauffe a révélé une différence de résolution de `--ffi-dir`
absolu entre JS et natif. Le harness passe désormais un chemin relatif ; la
tentative et ses trois échantillons restent archivés, exclus des médianes.
La campagne finale repasse toutes les comparaisons exactes.

Rapport :
`../../altbak.pub/docs/benchmark-results/2026-10-02-gopurs-aff-go-rust-compilation.{md,json}`.
Harness : `../../altbak.pub/bin/benchmark/gopurs-aff/`.
Archive : `../../altbak.pub/var/benchmark/gopurs-purust-aff-20261002/`.
Les **5 495 ms sur gopurs-aff** ne sont pas un gain à comparer directement aux
**5 743 ms sur purust-aff** : le compilateur est identique, le corpus diffère.

## Quatrième campagne — JSON vers TAST, terminée

Lot approuvé après la comparaison Go/Rust. Utiliser `Test.JsonTypedAst` comme
banc de diagnostic du vrai `parseModule` de PBO, puis confirmer chaque gain
sur le chargement et le backend Aff complets.

- [x] Activer le pilote Rust de `JsonTypedAst` et le lier au fork PBO Purust,
      avec le runtime threadé et le profil O3 sans LTO du compilateur natif.
      Préserver le fonctionnement de la suite `JsonDecoding` existante.
- [x] Figer une référence JS/Go/Rust : corpus historique **12 modules /
      5 545 093 octets**, puis corpus original **238 modules gopurs-aff**.
      Garder les oracles structurels complets et tous les échantillons.
- [x] Distinguer parsing, décodage du JSON pré-parsé, chemin texte complet,
      libération des résultats et allocations ; profiler hors fingerprint.
- [x] Implémenter les seules optimisations justifiées par ce profil, puis
      vérifier valeurs, erreurs, Unicode, tables de types et source-usage.
- [x] Confirmer le gain sur les deux corpus isolés puis la compilation Aff
      complète, avec sorties sources/manifests identiques.
- [x] Qualifier les changements retenus : régressions ciblées, suite Aff et
      auto-reconstruction JS → stage 1 → stage 2 → smoke indépendant.
- [x] Publier les références/mesures, compléter la ligne Rust « JSON to Typed
      AST » et actualiser les comparaisons de compilation correspondantes.

Archive : `../../altbak.pub/var/benchmark/purust-tast-20261002/`.
Référence native installée au démarrage : `96cf27f0…`. Au début du lot, le chemin
texte Rust appelle le parsing JSON puis le décodage de référence ; la résolution
native des tables de types du troisième lot est déjà active.

Préparation initiale de la qualification :
`../../altbak.pub/bin/benchmark/purust-tast/` contient le wrapper du bootstrap
auto-hébergé (exécutable candidat archivé) et la comparaison backend sur une
copie vérifiée des 238 modules. Celle-ci conserve les adaptateurs FFI figés,
vérifie chaque sortie contre la référence déjà qualifiée et utilise une chauffe
puis cinq passages tournants. À cette étape, la syntaxe est vérifiée et les
mesures backend restent à effectuer.

**Référence isolée terminée.** Empreintes JSON et TAST conformes à l'oracle JS
pour les 238 modules dans les trois runtimes, et à l'oracle historique pour
les 12 modules (JS/Go/Rust/C). Statistique historique : médiane des trois
minima de processus, deux chauffes puis cinq passages par phase.

| Corpus / runtime | Parse | Decode | Combined |
|---|---:|---:|---:|
| 12 / JS | 20,345 ms | 59,083 ms | 80,647 ms |
| 12 / Go | 19,377 ms | 11,601 ms | 20,237 ms |
| 12 / Rust | 18,608 ms | 125,987 ms | 151,162 ms |
| 238 / JS | 101,633 ms | 289,095 ms | 392,464 ms |
| 238 / Go | 95,415 ms | 60,142 ms | 101,347 ms |
| 238 / Rust | 90,380 ms | 595,734 ms | 717,886 ms |

Rust 238 : **46 413 892 allocations / 1 596 925 637 octets** pour decode,
**52 382 610 / 2 092 673 148** pour combined. Libération finale séparée :
environ **20,8 ms** pour combined. Les profils CPU dédiés excluent les
empreintes et confirment la domination des allocations/libérations et des
copies ; le parseur n'est pas la première cible. Début du candidat natif
`decodeArrayImpl` + `decodeAnnWithUsageImpl`, avec repli de l'annotation entière
sur la référence PS pour conserver les erreurs. Les modifications suivantes
seront décidées sur la comparaison des exécutables avant/après gelés.

Les 14 empreintes d'`artifacts/SHA256SUMS` ont été revérifiées. La référence C
238 diffère sur la canonicalisation numérique d'un module ; son diagnostic
est conservé et elle n'est pas utilisée comme oracle de ce corpus.

La préservation du runner `JsonDecoding` est également vérifiée par un build
frais et **neuf processus** (trois Go, trois JS, trois Rust) : les **17 cas**,
dont cinq chronométrés, conservent toutes les empreintes attendues. Ce contrôle
est archivé dans `json-decoding-regression{,-results}/` ; ses temps ne remplacent
pas les mesures publiées de cette autre suite.

**Candidat tableaux/annotations validé en isolation.** 82 cas de tableaux,
70 cas d'annotations et **110 909 annotations / 238 modules** conformes à PS,
avec zéro repli sur les annotations du corpus. Erreurs exactes, ordre et nombre
des callbacks, Unicode, ownership et partage des types vérifiés.

Avant/après contrôlé (médiane de trois minima) : combined **692,722 → 565,790 ms
sur 238 modules (−18,3 %)**, **145,331 → 116,851 ms sur 12 (−19,6 %)**. Decode
238 **580,648 → 455,077 ms (−21,6 %)**. Les empreintes de tous les processus
restent conformes aux oracles. **11 300 087 requêtes / 378 807 712 octets**
d'allocation sont supprimés par passage. Le gain de compilation complète reste
à établir ; bootstrap, régressions et comparaisons backend sont lancés dans
`run-qualification.sh`, séquentiellement.

Le premier passage codegen donne **90/94 succès** ; les quatre échecs concernent
uniquement le socket Docker/OrbStack absent. Le service a été redémarré et seuls
ces quatre tests sont relancés par `run-qualification-resume.sh`, qui enchaîne
ensuite tables de types, bootstrap, suite Aff et mesures. Le log initial est
conservé dans `logs/codegen.log`.

Les **94 checks codegen passent désormais** (90 initiaux + quatre relancés).
Il fallait également redémarrer le conteneur existant `core-api-cli-1` ; le
diagnostic intermédiaire reste archivé. Le test des tables de types a ensuite
rencontré le répertoire `Prim`, qui n'a pas de `corefn.json` dans le corpus 238 :
le harness ignore maintenant ces répertoires, exige au moins une table et lie
`perceus_ptr` pour le FFI enrichi. `logs/type-table-prim-diagnostic.log` conserve
l'échec initial ; la qualification reprend après codegen, sans relancer ses
94 checks déjà réussis.

Le contrôle des tables de types passe ensuite : **824 tables différentielles /
149 495 entrées**, dont **642 chemins rapides** et les 238 tables du corpus
Aff ; erreurs exactes et références partagées conformes. Le bootstrap utilise
un snapshot de sources/FFI/frontend et conserve ses deux générations natives.

**Qualification fonctionnelle réussie, régression globale détectée.** Bootstrap
453 modules / 282 610 types, 914 fichiers identiques, stage 2 + smoke frais et
suite Aff complète passent (47 checks, 5 tests Rust, 9 scénarios d'erreur).
Stage 2 candidat `002ed7b5…`, non installé. Sur 238 modules : chargement
**788 → 640 ms (−18,8 %)**, mais optimisation/génération **2 668 → 3 195 ms** et
backend **4 865 → 5 266 ms (+8,2 %)**. Les 18 sorties × 484 fichiers sont exactes.
Les tentatives PBO différées passent de 65–72 à 70–73 ; diagnostic nécessaire
avant rétention. La confirmation 244 a d'abord visé un répertoire sans
`manifest.json` : l'erreur de chemin est archivée et la campagne reprend avec
le snapshot `purust-pipeline-20261002/reference`.

La confirmation 244 passe : **5 540 → 5 399 ms (−2,5 %)**, JS **6 181 ms**,
18 sorties × 496 fichiers exactes. Chargement **796 → 643 ms**,
optimisation/génération **3 291 → 3 305 ms**. Contrôle 238 avec un seul worker :
**8 966 → 8 887 ms**, chargement **770 → 613 ms** ; la régression globale
initiale n'y apparaît pas. Une ablation dans un même exécutable compare les
deux chemins natifs séparément au décodeur de référence, sans modifier les
sources de production ni l'exécutable installé.

Relecture indépendante : aucun défaut sémantique identifié. Tests enrichis
avec égalité structurelle des arbres d'erreur, **52 annotations numériques**
(`Value::Int`, vrai `-0.0`, non-finis) et **16 tableaux compacts**, tous conformes,
en plus des 82/70 cas et 110 909 annotations initiales. Contrats PBO : **7 tests
de champs, 12 de source-usage, 5 de négation numérique** et le script de tables
de types passent contre les modules JS reconstruits. Logs dans
`native-tast-extended.log` et `pbo-*.log`.

**Confirmation étendue et rétention.** L'ablation établit que les régimes
rapide/lent apparaissent aussi avec le décodeur de référence dans un même
exécutable ; les deux chemins natifs gagnent chacun sur le chargement. La
confirmation fixée à **21 paires avant/après** donne **5 342 → 5 189 ms (−2,9 %)**,
moyenne **5 210,5 → 5 072,1 ms (−2,7 %)**, **16 paires favorables / 21**. Le
chargement médian passe de **782 à 635 ms**, optimisation/génération de
**3 158 à 3 135 ms**. Les 44 sorties × 484 fichiers sont exactes. La première
campagne défavorable, le contrôle séquentiel et les 20 sorties d'ablation sont
conservés ; aucun échantillon n'est retiré de leur série.

Le candidat est retenu sur les deux corpus et le stage 2 **`002ed7b5…` est
installé**. JavaScript reste le bundle `969bf49f…`, le lanceur conserve le natif
par défaut et `PURUST_JS=1` comme sélection explicite. Vérification finale :
**5 429 empreintes d'artefacts/entrées**, **112 sorties / 54 424 fichiers générés**,
empreintes structurelles et médianes recalculées, identité du stage 2 qualifié,
mesuré et installé. Les 914 sources auto-reconstruites et le smoke frais
152 modules / 312 fichiers sont qualifiés. Le script d'installation vérifie
également le marqueur applicatif dans le log enfant du smoke ; une première
recherche dans le log parent est conservée comme diagnostic de harness.

Publication : `../../altbak.pub/docs/benchmark-results/2026-10-02-rust-json-typed-ast.{md,json}`,
ligne Rust « JSON to Typed AST » complétée (**116 850,71 µs**), résultats de
compilation et READMEs actualisés. Le gain global est **2,5–2,9 %**, distinct
des **18,3–19,6 %** du décodeur isolé. La suite de l'optimisation devra profiler
le travail spéculatif PBO rejeté et ses dépendances ; ce lot conserve son
ordonnancement actuel.

Clôture : contrôles de syntaxe Python/JS, whitespace, valeurs README/JSON,
liens locaux et cellules Rust non mesurées passent. Après conservation et
vérification des exécutables, le cache Cargo stage 2 de ce lot est supprimé
(`cache-cleanup-after-publication.json`) : **4,3 Gio libérés**, **7,7 Gio**
disponibles. Sources générées, snapshots, binaires, profils et logs restent
archivés.
