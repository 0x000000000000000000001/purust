# Roadmap d'Optimisation pour purust (Backend Rust)

L'objectif de cette roadmap est de transformer `purust` d'un générateur dynamique (façon JavaScript) à un générateur typé et performant, en s'inspirant des techniques développées pour `gopurs` via le TAST (`tcorefn`).

## 1. Inlining des Type Classes pour les Primitives (✅ Terminé)
*L'inlining des opérations natives pour les primitives (ex: `Data_Eq_eqInt`, `Data_Semiring_addInt`) a été implémenté dans `CodeGen.purs` avec des appels directs et `boxUnbox`.*

## 2. Exploiter le TAST pour un Vrai Typage (En cours)
*Une première infrastructure (`codegenExprType` / `boxUnbox`) a été mise en place, mais le typage natif n'est appliqué qu'en surface.*
- [x] **Step 2.1 (Traduction des Types) :** `codegenExprType` est implémenté.
- [x] **Step 2.4 (Frontières de Boxing/Unboxing) :** `boxUnbox` est déployé dans les appels (`genApp`) et lors de la définition des variables (`Let`).
- [x] **Step 2.2 (Typage des Closures) :** Mettre à jour `genAbs`. Les closures reçoivent maintenant leurs vrais types natifs via la propagation des noeuds `Typed` dans `inferTypeExpr` (ce qui a résolu l'erreur majeure `E0618` sur `Data.Array` et 13 autres crates).
- [ ] **Step 2.5 (Corrections des Cas Extrêmes de Typage) :** 
  - Résoudre `E0308` dans `Data.Symbol` : Le wrapping `boxUnbox` manque parfois la création d'un `Value::Func(...)` quand le type de retour attendu d'une closure abstraite est `UnknownType`.
  - Résoudre `E0267` (TCO Loop) dans `Test.StateMonad` : La boucle `loop` générée pour la TCO entoure actuellement l'extérieur des closures curriées, ce qui rend les `continue;` illégaux car ils se retrouvent enfermés dans des `Rc<dyn Fn>`. Le `loop` doit être poussé *à l'intérieur* de la dernière closure.

## 3. Éradiquer le "God Struct" (`Record_a`) et le Virtual Dispatch (NOUVEAU - Priorité Absolue)
**Constat (Benchmarking empirique) :** L'approche actuelle utilise un énorme struct global `Record_a` (~280 champs) instancié avec `..Default::default()` pour *absolument chaque valeur*. De plus, chaque closure est enfermée dans un `Rc<dyn Fn...>`, ce qui force des allocations sur la heap et un virtual dispatch systématique (empêchant l'inlining de Rust). Notre benchmark montre une **perte de performance de ~90x** sur de la récursion simple.

### Baby steps pour la Step 3 :
- [x] **Step 3.1 (Stop Default Initialization) :** En attendant de supprimer `Record_a`, arrêter d'appeler `..Default::default()` sur une structure aussi massive juste pour allouer un primitif. Remplacé par un `enum Value` natif en Rust.
- [ ] **Step 3.2 (Structs Natifs pour Type Classes) :** Utiliser les métadonnées de `classDecls` (fournies par le TAST) pour générer des `structs` Rust spécifiques et isolés pour les dictionnaires de classes de types.
- [ ] **Step 3.3 (Enums Natifs pour ADTs) :** Utiliser les métadonnées de `dataDecls` pour générer des `enum` Rust avec les types de champs stricts.
- [ ] **Step 3.4 (Records Anonymes) :** Remplacer le `Record_a` par des structs spécifiques pour les records anonymes purs (générés dynamiquement selon les types utilisés dans le programme).
- [ ] **Step 3.5 (Unboxing des Closures) :** Remplacer les `Rc<dyn Fn>` par des closures natives, des fonctions inlinées ou des pointeurs statiques lorsque c'est possible (ex: fonctions top-level, ou closures qui ne capturent pas l'environnement). Le recours au `Rc<dyn Fn>` (et donc à la heap) doit être l'exception, et non la règle.