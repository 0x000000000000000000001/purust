# Purust — rejoindre les performances du compilateur Go

Plan du **2 octobre 2026**. Priorité : réduire le travail PBO rejeté, puis
les allocations des passes dominantes du compilateur natif.

## Objectif et point de départ

Viser la parité avec gopurs natif sur le TAST figé de **gopurs-aff**, en
conservant les résultats du compilateur et les sorties générées exactes.

- Campagne commune historique, 238 modules : **Go 2 146 ms / Rust 5 495 ms**,
  soit **2,56×** le temps Go.
- Dernier Rust qualifié, campagne ultérieure de 21 paires : **5 189 ms**,
  dont **635 ms de chargement TAST** et **3 135 ms d'optimisation/génération**.
  Les médianes des phases ne s'additionnent pas.
- Rejoindre l'ordre de grandeur des 2,1 secondes demanderait encore environ
  **59 % de réduction**. La parité est un objectif à démontrer par une nouvelle
  campagne commune ; ces deux campagnes distinctes ne mesurent pas un gain
  contrôlé Go/Rust actuel.
- À coût inchangé du reste du pipeline, supprimer tout le chargement TAST ne
  récupérerait qu'environ **12 %** du total. L'essentiel du gain doit donc venir
  de PBO, de la génération et de leurs représentations mémoire.

Référence native qualifiée :
`002ed7b50aaa2eb58c844fada98c715ebdaa1378ee8f62d1a23473d5f5e25639`.
Profil de départ : **O3 sans LTO, Arc, mimalloc, quatre workers PBO et quatre
workers de génération**. Le natif reste le défaut ; `PURUST_JS=1` sélectionne
explicitement JavaScript.

## Corpus et protocole communs aux lots

- [ ] Figer et empreinter les compilateurs réellement utilisés, leurs sources,
      FFI, paramètres et entrées avant toute modification.
- [ ] Utiliser comme corpus principal le TAST original de **gopurs-aff :
      238 modules / 136 604 types / 26 606 491 octets**. Manifeste SHA-256 :
      `6a30fb919f104df813feb7f6a884fca0a7f768e44a99f1129884d8992b832149`.
- [ ] Confirmer les changements retenus sur le corpus distinct **purust-aff :
      244 modules / 138 448 types / 27 122 224 octets**. Comparer chaque corpus
      à sa propre référence.
- [ ] Remesurer Go et le Rust actuel dans une même campagne pour établir la
      nouvelle référence inter-backends. Documenter les budgets de workers et
      de mémoire, ainsi que `GOGC=off` et la limite Go de 10 Gio.
- [ ] Mesurer `backend total` : chargement/tri, préparation, optimisation,
      génération/émission et attente finale des workers. Exclure frontend
      `purs`, bootstrap, Cargo/Go builds, exécution applicative et démarrage/
      sortie du processus.
- [ ] Employer des processus et sorties neufs, caches de compilation applicatifs
      supprimés, une chauffe puis au moins cinq mesures avec ordre tournant.
      En cas de forte variabilité, fixer le protocole de confirmation étendue
      avant de lancer ses mesures.
- [ ] Séparer les profils instrumentés des chronométrages de performance.
      Rapporter médianes, moyennes, dispersion, écarts appariés, CPU, allocations
      et RSS ; distinguer octets cumulés alloués et mémoire résidente.
- [ ] Exécuter les builds et campagnes longues en arrière-plan avec logs
      durables. Terminer les builds avant les mesures et éviter les compilations
      concurrentes pendant celles-ci.
- [ ] Conserver tous les échantillons, empreintes, artefacts et diagnostics
      d'échec dans une nouvelle archive sous `altbak.pub/var/benchmark/`.

## Lot 1 — Réduire le travail PBO rejeté

**Premier lot à réaliser.** Les campagnes précédentes ont observé environ
65 à 73 tentatives différées pour 238 modules. Une conversion qui rencontre
une dépendance indisponible peut être achevée, rejetée, puis recommencée.
Le mécanisme existe aussi côté Go ; son poids dans l'écart reste à mesurer.

Fichier principal :
`../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/Builder.purs`.

### Diagnostic

- [ ] Profiler le compilateur actuel par phase et par module, avec attribution
      distincte des tentatives acceptées et rejetées : CPU, durée murale,
      allocations, dépendances manquantes, attentes et nombre de relances.
- [ ] Mesurer l'occupation des workers et le chemin critique, ainsi que le coût
      du coordinateur et des résultats retenus en attente de publication.
- [ ] Vérifier la conservation des modules encore prêts lors d'une finalisation.
      La reconstruction de `ready` dans `step` est une piste de code à tester,
      pas une cause de ralentissement déjà quantifiée.
- [ ] Comparer les régimes rapides/lents et un contrôle à un seul worker pour
      distinguer coût de conversion et effets d'ordonnancement.

`attempts-ms` additionne des durées murales de tâches concurrentes : ce compteur
ne représente ni du temps CPU ni un gain récupérable directement sur le total.

### Candidats, évalués séparément

- [ ] Préserver correctement l'ensemble des modules prêts et donner priorité
      aux conversions dont les dépendances sont disponibles.
- [ ] Améliorer les dépendances d'ordonnancement à partir des lectures observées,
      et limiter les lancements spéculatifs qui provoquent des relances coûteuses.
- [ ] Évaluer un arrêt anticipé lorsqu'une conversion rencontre `ExternPending`,
      plutôt que de terminer un résultat qui sera rejeté.
- [ ] Conserver la visibilité par rang, les vues fixes des dépendances, les
      directives accumulées, la publication canonique et la progression en cas
      de blocage des heuristiques de dépendances.
- [ ] Vérifier les cas de dépendances manquantes, réveils, relances et ordre de
      publication, puis l'identité des sorties sur les corpus figés.
- [ ] Retenir chaque candidat sur son gain de compilation complète, avec coût
      CPU et allocations à l'appui, puis effectuer la qualification commune.

## Lot 2 — Réduire les allocations de PBO et de la génération

Le diagnostic complet du lot précédent, sur les **244 modules**, comptait
encore **660 millions de requêtes / 29,04 Go cumulés**, dont **540,5 millions
de requêtes dans optimisation/génération**. Ces chiffres historiques motivent
un nouveau profil ; ils ne constituent pas les compteurs du binaire actuel.

Cibles : les passes PBO, leurs FFI natives et
`src/Purust/CodeGen.purs`, `src/Purust/CodeGen.rs`, `src/Purust/Emission.purs`.

- [ ] Réattribuer les coûts après le lot PBO : copies de chaînes, `Value`,
      boxing/unboxing, closures, dictionnaires, Maps et opérations `Arc`.
- [ ] Examiner les sites chauds de `codegenExprTypeWithValueEnums`, `boxUnbox`
      et des concaténations/`joinWith`, à partir des piles mesurées.
- [ ] Remplacer les copies temporaires confirmées par des emprunts sûrs dans
      les spécialisations natives des passes du compilateur.
- [ ] Construire les textes dans des buffers natifs réutilisables, en conservant
      exactement les octets émis et la sémantique Unicode.
- [ ] Réduire les conversions `Value`, captures et dictionnaires reconstruits
      aux sites identifiés ; conserver les garanties de partage et de concurrence.
- [ ] Mesurer les taux de succès, coûts de clés et durées de vie des caches
      d'instanciation, de recherche et de rendu des types, puis ajuster ceux
      qui réduisent réellement le travail total.
- [ ] Comparer les candidats un par un sur allocations et backend complet,
      puis qualifier l'ensemble retenu.

## Lot 3 — Compléter le décodage natif du TAST

Le parsing JSON isolé Rust était déjà comparable au Go. Le dernier lot a
spécialisé les tableaux et annotations ; le module complet, la validation
des faits d'usage et le chemin texte offrent encore des pistes natives.

Fichiers principaux dans le fork PBO Purust :
`CoreFn/Json.rs`, `CoreFn/Usage.rs` et `CoreFn/Json/Text.rs`.

- [ ] Reprofiler les coûts restants du décodage du module et de la validation.
- [ ] Spécialiser les chemins justifiés de `decodeModuleImpl` et de validation
      des faits d'usage, avec la référence PureScript comme oracle.
- [ ] Évaluer un chemin texte direct inspiré du curseur Go, évitant la
      construction d'un arbre JSON générique intermédiaire.
- [ ] Préserver les valeurs, le partage des types, les règles numériques,
      les optionnels absents/`null`, Unicode et la structure/priorité des erreurs.
- [ ] Réutiliser les tests différentiels et oracles des corpus 12 et 238 modules ;
      mesurer séparément parse, decode, combined et destruction finale, avec
      les empreintes calculées hors chronométrage.
- [ ] Confirmer le gain sur le chargement et sur le compilateur complet, puis
      effectuer la qualification commune.

## Lot 4 — Recaler le parallélisme

À réaliser après réduction du travail et des allocations : la meilleure
répartition peut changer lorsque le coût des passes évolue.

- [ ] Comparer les budgets PBO/génération autour du défaut quatre + quatre,
      avec un contrôle séquentiel et des budgets bornés adaptés à la machine.
- [ ] Mesurer temps total, CPU, attentes, tentatives rejetées, allocations et
      RSS pour chaque configuration.
- [ ] Utiliser les comparaisons à budget comparable pour le diagnostic et
      publier les réglages de production effectivement retenus.
- [ ] Vérifier propagation des erreurs, fin des workers et durée de vie des
      tâches enfants, puis qualifier les réglages retenus.

## Qualification et publication de chaque lot retenu

- [ ] Comparer exactement les sources et manifests générés à la référence
      de chaque cible et corpus, y compris entre exécution JS et native.
- [ ] Exécuter les régressions codegen/PBO/runtime pertinentes et les tests
      différentiels des chemins spécialisés.
- [ ] Exécuter la suite Aff complète, les scénarios d'erreur, Ref/AVar et les
      tests de durée de vie des enfants. Pour gopurs-aff, conserver la validation
      applicative synchronisée séparée du TAST original chronométré.
- [ ] Qualifier l'auto-reconstruction **JS → stage 1 natif → stage 2 natif →
      smoke dans un projet frais** et vérifier les sorties JS/native attendues.
- [ ] Mesurer le stage 2 qualifié, relier son empreinte aux résultats et vérifier
      l'identité du binaire installé.
- [ ] Publier les résultats avant/après et la comparaison Go/Rust commune,
      avec les échantillons bruts, paramètres et résultats de qualification.
- [ ] Actualiser ce plan et les tableaux de performance avec les seuls gains
      établis sur les corpus correspondants.

## Références et outils

- Comparaison commune Go/Rust :
  `../../altbak.pub/docs/benchmark-results/2026-10-02-gopurs-aff-go-rust-compilation.{md,json}`.
- Dernier lot TAST et stage 2 qualifié :
  `../../altbak.pub/docs/benchmark-results/2026-10-02-rust-json-typed-ast.{md,json}`.
- Diagnostic historique du pipeline et des allocations :
  `../../altbak.pub/docs/benchmark-results/2026-10-02-purust-pipeline-optimization.{md,json}`.
- Harness : `../../altbak.pub/bin/benchmark/gopurs-aff/`,
  `../../altbak.pub/bin/benchmark/purust-tast/` et `tools/`.
- Corpus principal et référence Go :
  `../../altbak.pub/var/benchmark/gopurs-purust-aff-20261002/`.
- Corpus 244 figé :
  `../../altbak.pub/var/benchmark/purust-pipeline-20261002/reference/`.
- Dernières mesures, diagnostics et qualification :
  `../../altbak.pub/var/benchmark/purust-tast-20261002/`.
