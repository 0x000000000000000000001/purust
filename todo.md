# Roadmap d'Optimisation pour purust (Backend Rust)

L'objectif de cette nouvelle roadmap est d'atteindre (voire dépasser) les performances de `gopurs` en tirant parti des fondations déjà posées, mais en résolvant les goulots d'étranglement majeurs identifiés par les benchmarks empiriques (allocations excessives et closures dynamiques).

> **Nouvelle ère : Le TAST v2 et `TypeApp`** : 
> Historiquement, l'éradication de `UnknownType` (l'équivalent de `interface{}`) en AOT semblait impossible car les types génériques étaient effacés aux points d'appel. 
> **C'est fini.** Le nouveau TAST (v2) fournit explicitement les `TypeApp` à chaque appel. On connaît désormais les types exacts partout. Cela débloque la monomorphisation stricte (via `Monomorphize.purs` ou les génériques natifs Rust `::<T>`). L'enum `Value` peut être totalement éradiquée.

## Prochaines étapes (Optimisation ciblée) :

- [ ] **Step 1 (Heuristiques des fonctions et Closures) :**
  - *Statut partiel* : L'utilisation de pointeurs de fonctions natifs (`Func::Static` via `fn(...) -> ...`) a été implémentée pour les fonctions pures sans capture.
  - **Nouvelle Stratégie avec `TypeApp`** : Activer `Monomorphize.purs` pour `purust` (ou générer des génériques natifs). Cela permet d'éliminer définitivement le polymorphisme dynamique (`Rc<dyn Fn>`) même pour les closures capturant du contexte, car tout sera strictement typé (`impl Fn(i64) -> i64`).

- [ ] **Step 2 (Passage par valeur pour Primitives et petits ADTs) :**
  - Arrêter d'allouer systématiquement avec `Rc` pour les types primitifs (`Int`, `Number`, `Boolean`) et les enums sans payload (ex: `enum Color { R, B }`).
  - **Nouvelle Stratégie avec `TypeApp`** : Grâce aux types exacts, le compilateur sait qu'il manipule un `Int`. Il faut forcer l'allocation sur la pile (passage par valeur `i64` natif via le trait `Copy`) et bannir l'enrobage dans un `Rc` pour ces primitives.

- [ ] **Step 3 (Mutation en place - Perceus) :**
  - C'est le cœur des performances pour les structures récursives partagées (Listes, Arbres).
  - Actuellement, les types complexes subissent un `.clone()` profond des pointeurs et des allocations constantes.
  - **Stratégie** : Les ADTs auront désormais un typage fort (ex: `Rc<List_i64>`). Conserver le `Rc` pour ces structures complexes, et exploiter le comptage de références (`Rc::make_mut`) pour muter le nœud **sur place** sans réallocation si son `refcount` est à 1.
