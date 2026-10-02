# Purust — accélérer le compilateur natif

Plan du 2 octobre 2026, inspiré des optimisations mesurées de gopurs.
Premier corpus : **purust-aff**, puis auto-reconstruction du compilateur.

## Objectif et référence

Réduire le temps du backend natif, avec les mêmes entrées et résultats que JS.
Premier jalon : passer sous le temps JS. Le ratio natif/JS de **0,3** est une
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
- [ ] Introduire des chemins Rust spécialisés derrière les points d'entrée
      `CoreFn/Json.rs` et `CoreFn/Json/Text.rs`, selon les coûts mesurés.
- [ ] Préserver types, partage, validation des usages, Unicode et ordre des
      erreurs ; comparaison différentielle avec le décodeur de référence.
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

## Prochaines cibles

Le codegen parallèle est qualifié. Les autres allocations de chaînes/types
(`codegenExprTypeWithValueEnums`, `boxUnbox`, `joinWith`) restent à attribuer et
réduire avec des mesures ciblées. Le chargement TAST (**1 714 ms natif / 601 ms JS**)
et la finalisation (**1 526 / 868 ms**) restent coûteux ; spécialiser le décodage
et les constructions confirmées par le profil. Ces chiffres sont des médianes
de phase de la dernière campagne, non des gains promis.

## Troisième campagne — pipeline, en cours

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
- [ ] Mesurer le compilateur cumulant préparation, graphe et tables natives.
- [ ] Retenir uniquement les variantes justifiées, refaire les allocations,
      qualifier le compilateur et publier cinq paires JS/natif et avant/après.

Le premier test natif des tables de types a été interrompu par `ENOSPC`.
D'anciens caches Cargo terminés ont été nettoyés après conservation des
exécutables ; les sources et logs sont conservés. La relance et le benchmark
du graphe ont réussi. Le candidat cumulant les tables natives est en construction.
