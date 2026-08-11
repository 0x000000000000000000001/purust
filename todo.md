# Purust - État des Lieux et Todo (11 Août 2026)

## 1. Ce qui a été accompli récemment
- **Résolution du "faux problème" de parsing JSON :** Le compilateur plantait avec `At object key 'typeName': No value was found.` car le binaire `bin/purust.js` n'avait pas été recompilé. Un `npm run build` a corrigé ce décalage.
- **Résolution du crash `Empty binding group` :** Corrigé dans `src/Purust/CodeGen.purs` en gérant correctement les groupes de liaisons vides filtrés par le compilateur.
- **Le build a été relancé (`cargo check`) sur la base de code générée :**
  - **Résultat :** Le code Rust est bien généré pour `Main`, mais il échoue à la compilation avec 7 erreurs (essentiellement `E0308`, `E0425`, `E0618`).

## 2. L'état actuel des erreurs Rust (Les vrais problèmes de CodeGen)
Les erreurs actuelles ne sont plus des problèmes de plomberie externe, mais des bugs directs dans `src/Purust/CodeGen.purs` qui génère du Rust invalide :
1. **E0308 (Type Mismatch) sur les Enums (CtorSaturated) :**
   - Le code génère `Main_X::X`, mais la signature de la fonction attend un `PerceusPtr<Record_a>`.
   - Il manque un wrapper du type `unsafe_coerce(Main_X::X)` ou `PerceusPtr::new(...)` pour convertir l'ADTs natif en pointeur universel.
2. **E0308 (Type Mismatch) sur les champs de `LitRecord` :**
   - Le code génère `c: Some(std::rc::Rc::new(|_| ...))` pour les champs des records.
   - Mais les champs de `Record_a` attendent des `Option<PerceusPtr<Record_a>>`. Le `Rc::new(|_| ...)` (thunk) est de trop ou mal typé.
3. **E0618 (Expected function, found `PerceusPtr`) sur les appels de closure (`App`) :**
   - Le code génère `.call.clone().unwrap()(arg)`.
   - `.unwrap()` renvoie un `PerceusPtr<Record_a>`, qui n'est *pas* une fonction Rust appelable avec `()`. La structure attendue pour les closures n'est pas correctement implémentée ou castée.
4. **E0425 (Cannot find value) :**
   - `Effect_Console_log` n'est pas trouvé. Les alias/bindings FFI manquent encore pour certaines fonctions de base.

## 3. Ce qu'il reste à faire dans l'immédiat (Next Baby Steps)
- **Refactor des appels de fonction (`App`)** : Modifier `codegenExpr` pour que les appels de `.call` s'exécutent correctement (ex: en stockant une vraie closure `Rc<dyn Fn...>` dans le `Record_a`, ou en castant via `unsafe_coerce`).
- **Correction des Records (`LitRecord`)** : Enlever le `Rc::new(|_| ...)` superflu lors de la création de champs de records.
- **Correction des Constructeurs (`CtorSaturated`)** : Wrapper les instanciations d'enum pour respecter le type de retour `UnknownType` (`PerceusPtr<Record_a>`).

## 4. Le plan à plus long terme (TCO & Uncurrying)
*(Le refactor vers `TcoExpr` n'a en réalité pas encore été fait dans `CodeGen.purs`, il utilise toujours `NeutralExpr` et l'uncurrying est bancal).*
1. **Intégration de l'analyse TCO** : Importer et utiliser `PureScript.Backend.Optimizer.Codegen.Tco (TcoExpr(..), tcoAnalysisOf)` pour obtenir des fermetures aplaties (TcoAbs) et des appels TCO (TcoApp).
2. **Monomorphisation** : Activer la passe `Monomorphize` du compilateur pour éliminer le besoin de `Record_a` et générer du Rust statiquement typé.