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

**Objectif :** Ne plus utiliser `UnknownType` (qui wrappe tout dans `Record_a`). Se servir des types (`ExprType`) pour déclarer de vraies variables `i64` ou `bool` en Rust, et économiser toutes les allocations sur le tas. C'est un prérequis strict avant de pouvoir créer des Enums ou des Structs natifs.

### Baby steps pour la Step 2 :
- [ ] **Step 2.1 (Traduction des Types) :** Créer une fonction `rustType :: ExprType -> String` dans `CodeGen.purs` qui convertit `Int` en `i64`, `Boolean` en `bool`, `Number` en `f64`, `String` en `String`, et tout le reste (dont les variables de type `a`) en `UnknownType`.
- [ ] **Step 2.2 (Typage des Fonctions) :** Mettre à jour `genAbs` pour que les arguments de fonction (et le type de retour) utilisent `rustType` plutôt que de forcer `UnknownType` partout.
- [ ] **Step 2.3 (Typage des Variables Locales) :** Mettre à jour `Let` et `LetRec` pour que la génération des variables (`let mut x = ...`) utilise le type réel inféré de l'expression.
- [ ] **Step 2.4 (Frontières de Boxing/Unboxing) :** Mettre à jour `genApp` (l'appel de fonction). Si une fonction polymorphique attend un `UnknownType` mais qu'on lui passe un argument `i64`, générer automatiquement l'emballage `purust_core::mk_int(val)`. À l'inverse, générer `.init_int.unwrap()` quand on reçoit un `UnknownType` là où un `i64` est attendu.