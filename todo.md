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
- [ ] Comparer le chargement avec 1/2/4/8 workers, mémoire comprise.

## 5 — Parallélisme borné

- [x] Intégrer `buildModulesParallel` déjà présent dans PBO, en conservant
      visibilité par rang, accumulation des directives et publication ordonnée.
- [ ] Commencer avec codegen séquentiel ; comparer 1/2/4/8 workers et relever
      tentatives, relances, CPU, allocations et mémoire.
- [ ] Rendre l'état de génération propre à chaque module (`globalConsumed`,
      `globalCaptured`) avant toute émission concurrente.
- [ ] Ajouter le chevauchement optimisation/émission si les mesures le justifient,
      avec borne de travaux en vol, propagation des erreurs et attente des enfants.

## 6 — Qualification et publication

- [ ] Après chaque correction : tests ciblés significatifs et comparaison des
      sorties JS/natif sur les mêmes TAST ; construire et exécuter l'application.
- [ ] Comparer les variantes séquentiellement, avec échauffement, sorties neuves,
      cache de build vide et médianes ; séparer diagnostic instrumenté et mesure.
- [ ] Confirmer les corrections retenues par la suite Aff et les régressions
      codegen/runtime concernées.
- [ ] Reconstruire le compilateur avec lui-même, comparer les sources et manifests
      JS/stage 2, compiler stage 2 et exécuter le smoke test indépendant.
- [ ] Publier les mesures brutes, empreintes, paramètres et résultats validés ;
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
  pas additionnables. Instrumentation d'allocations en cours.
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
