# Roadmap d'Optimisation pour purust (Backend Rust)

L'objectif de cette roadmap est de transformer `purust` d'un générateur dynamique (façon JavaScript) à un générateur typé et performant, en s'inspirant des techniques développées pour `gopurs` via le TAST (`tcorefn`).

## 1. Inlining des Type Classes pour les Primitives

**Objectif :** Résoudre le goulot d'étranglement du benchmark *Polymorphism* (qui prend > 7 secondes en Rust contre 17ms en Go) causé par le dispatch dynamique des dictionnaires (closures). 
Bonne nouvelle : L'AST de l'optimiseur (`NeutralExpr`) nous transmet **déjà** les types via le constructeur `Typed ExprType inner` ou via les variables globales nommées explicitement (ex: `Data_Eq_eqInt`). `purust` l'ignorait jusqu'à présent !

### Baby steps pour la Step 1 :
- [ ] **Step 1.1 :** Dans `Purust.CodeGen` (fonction `codegenExpr_`), identifier le pattern de l'application (`App`) lorsqu'elle cible une fonction de typeclass primitive (comme `Data_Eq_eqInt`, `Data_Ord_compareInt`, `Data_Ring_addInt`).
- [ ] **Step 1.2 :** Émettre directement l'opération native Rust correspondante (ex: `a == b`, `a < b`, `a + b`) en extrayant la valeur primitive avec `.unwrap()`, au lieu de générer un lourd `.call` de closure.
- [ ] **Step 1.3 :** Lancer `bin/rust/run -c` pour compiler et valider que les benchmarks (notamment `Polymorphism`) ont drastiquement réduit leur temps d'exécution.

## 2. Exploiter le TAST pour un Vrai Typage (Unboxing)

**Objectif :** Ne plus utiliser `UnknownType` (qui wrappe tout dans `Record_a`). Se servir du constructeur `Typed t inner` (déjà présent dans l'AST) pour déclarer de vraies variables `i64`, `bool`, `String` en Rust, et économiser toutes les allocations sur le tas.

## 3. Enums Natifs pour les ADT (Suppression du Record_a)

**Objectif :** Résoudre le temps du benchmark *Red-Black Tree* (3 secondes en Rust) causé par l'allocation de mega-structures `Record_a` sur le tas (heap) via `Rc`. Utiliser `dataDecls` pour générer des `enum` Rust stricts.

### Baby steps pour la Step 3 :
- [ ] **Step 3.1 :** Dans la fonction `codegenModule`, parcourir `backendMod.dataTypes` pour générer le code source des `enum` Rust (ex: `pub enum List { Nil, Cons(UnknownType, PerceusPtr<UnknownType>) }`).
- [ ] **Step 3.2 :** Mettre à jour `CtorSaturated` dans `codegenExpr_` pour instancier directement ces `enum` natifs au lieu d'initialiser un lourd `Record_a`.
- [ ] **Step 3.3 :** Mettre à jour `Branch` (Pattern Matching) pour utiliser un vrai `match` Rust sur ces enums au lieu de vérifier la chaîne de caractères `val.tag == "Cons"`.
- [ ] **Step 3.4 :** Valider via les tests (Red-Black Tree, etc.) que le temps d'exécution s'effondre grâce à la légèreté des enums natifs.