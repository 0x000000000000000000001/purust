# Roadmap d'Optimisation pour purust (Backend Rust)

L'objectif de cette nouvelle roadmap est d'atteindre (voire dépasser) les performances de `gopurs` en tirant parti des fondations déjà posées, mais en résolvant les goulots d'étranglement majeurs identifiés par les benchmarks empiriques (allocations excessives et closures dynamiques).

> **Note sur le Typage et "UnknownType"** : 
> Suite à une expérimentation approfondie, l'éradication globale de `UnknownType` via les génériques stricts de Rust s'est avérée impossible en AOT. Le TAST (PureScript) ne fournit pas les arguments génériques aux points d'appels (`Var`), ce qui provoque des erreurs d'inférence inévitables en Rust (`E0282`). Le type polymorphe dynamique (`Value`) est donc maintenu par nécessité architecturale.

## Prochaines étapes (Optimisation ciblée) :

- [ ] **Step 1 (Heuristiques des fonctions et Closures) :**
  - Le goulot d'étranglement majeur (ex: benchmark Polymorphism, Lazy) est l'utilisation pessimiste de `Func::Shared` qui alloue systématiquement un `Rc<dyn Fn>` sur le tas.
  - **Stratégie** : Utiliser des pointeurs de fonctions natifs (`Func::Static` via `fn(...) -> ...`) chaque fois qu'une fonction ne capture pas de contexte (fonctions pures, constructeurs, etc.). Zéro allocation, et cela ne casse pas Perceus (pas de refcount impliqué).

- [ ] **Step 2 (Passage par valeur pour Primitives et petits ADTs) :**
  - Arrêter d'allouer systématiquement avec `Rc` pour les types primitifs (`Int`, `Number`, `Boolean`) et les enums sans payload (ex: `enum Color { R, B }`).
  - **Stratégie** : Exploiter le trait `Copy` pour ces types afin de les allouer sur la pile (stack). Un `i64` est plus rapide à copier qu'à incrémenter via `Rc`. Ne casse pas Perceus.

- [ ] **Step 3 (Mutation en place - Perceus) :**
  - C'est le cœur des performances pour les structures récursives partagées (Listes, Arbres).
  - Actuellement, les types complexes subissent un `.clone()` profond des pointeurs et des allocations constantes.
  - **Stratégie** : Conserver obligatoirement le `Rc` pour les ADT complexes (comme `RBTree` ou `List`), et exploiter le comptage de références (`Rc::make_mut` ou `Rc::try_unwrap`) pour muter le nœud **sur place** sans réallocation si son `refcount` est à 1.
