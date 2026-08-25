# Roadmap d'Optimisation pour purust (Backend Rust)

L'objectif de cette roadmap est d'exploiter à 100% le plein potentiel du compilateur Rust (`rustc`) pour atteindre les performances du code natif ("cheatcode"). L'intégration récente du **TAST v3** et de l'optimiseur centralisé (`purescript-backend-optimizer`) a déjà éradiqué le surcoût des dictionnaires de Type Classes via la monomorphisation.

> **L'ère du TAST v3 et de `TypeApp`** : 
> Historiquement, le polymorphisme forçait l'utilisation de pointeurs dynamiques ou de génériques opaques. Grâce aux `TypeApp` fournis par le TAST v3, nous connaissons le type exact de chaque expression à son point d'appel. Cela débloque la génération de code Rust parfaitement typé et statique (Zero-Cost Abstraction).

## État des lieux (Accompli) :
- [x] **Monomorphisation des Type Classes** : Les dictionnaires dynamiques (v-tables) ont été éliminés. Les résolutions d'instances se font de manière statique au moment de la compilation via `purescript-backend-optimizer`. Le benchmark Polymorphism tourne désormais de manière optimale (sous les 40 ms).
- [x] **Unification du pipeline de Build** : Migration vers `spago bundle` et branchement direct à l'AST v3.

## Prochaines étapes (Optimisation ciblée) :

- [ ] **Step 1 (Exploitation du Turbofish `::<T>`) :**
  - **Action** : Profiter des `TypeApp` présents dans le TAST v3 pour injecter explicitement les types lors de l'appel de fonctions génériques (ex: `mempty::<i32>()`).
  - **Bénéfice** : Soulager massivement l'inférence de `rustc`, accélérer drastiquement les temps de compilation Rust, et éviter les erreurs fatales "type annotations needed" sur des expressions fortement polymorphes.

- [ ] **Step 2 (Unboxing : Primitives natives) :**
  - **Action** : Le TAST v3 certifiant l'utilisation d'un type primitif natif, la génération de code doit forcer l'allocation sur la pile (passage par valeur native `i64`, `f64`, `bool`).
  - **Bénéfice** : Bannir l'enrobage (boxing) dans un `Rc` ou un pointeur sur la heap pour ces primitives. Tirer pleinement parti du trait `Copy` natif de Rust.

- [ ] **Step 3 (Mutation en place - Algorithme Perceus) :**
  - C'est le cœur des performances pour les structures de données fonctionnelles (Listes, Arbres).
  - **Action** : Puisque les ADTs ont désormais un typage fort, il faut exploiter au maximum le comptage de références (`Rc`) en utilisant `Rc::make_mut`.
  - **Bénéfice** : Muter les nœuds **sur place** sans réallocation si leur `refcount` est strictement égal à 1. Cela élimine les allocations inutiles lors des modifications d'arbres ou de listes, atteignant des vitesses similaires aux structures impératives.
