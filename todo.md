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

## 3. Ce qui vient d'être résolu (Succès Historique !)
- **Refactor des appels de fonction (`App`)** : Corrigé en uniformisant les champs de `Record_a` vers `Option<UnknownType>`.
- **Correction des Records (`LitRecord`)** : Le wrapper erroné `Rc::new(|_| ...)` a été retiré, les champs sont maintenant assignés proprement.
- **Correction des Constructeurs (`CtorSaturated`)** : Corrigé avec `unsafe_coerce_type(...)`.
- **Correction des variables globales (`Var`) et FFI** : Toutes les références aux fonctions globales émettent maintenant `()`, et un binding FFI natif pour `Effect_Console_log` a été injecté.
- 🎉 **RÉSULTAT : Le TOUT PREMIER TEST (`1110.purs`) a compilé ET S'EST EXÉCUTÉ avec succès en Rust (`[OK]`) !** C'est une étape massive.

## 4. Ce qu'il reste à faire dans l'immédiat (Next Baby Steps)
- 🎉 **SUCCÈS : Le test 1185.purs (Pattern Matching et ADTs) a compilé et s'est exécuté avec succès en Rust (`[OK]`) !**
- Le mécanisme des constructeurs (`CtorSaturated`) a été mis à jour pour stocker les champs de l'enum directement dans le `Record_a` (unboxing via Universal Box).
- Le mécanisme d'accès (`Accessor`) déréférence désormais correctement les champs du `Record_a`.
- Les opérations booléennes et de chaîne ont été unifiées sous `UnknownType` avec `mk_bool` et `mk_string`.

Prochaine étape : Faire passer toute la suite de tests ou s'attaquer à un nouveau test spécifique.

## 4. Le plan à plus long terme (TCO & Uncurrying)
*(Le refactor vers `TcoExpr` n'a en réalité pas encore été fait dans `CodeGen.purs`, il utilise toujours `NeutralExpr` et l'uncurrying est bancal).*
1. **Intégration de l'analyse TCO** : Importer et utiliser `PureScript.Backend.Optimizer.Codegen.Tco (TcoExpr(..), tcoAnalysisOf)` pour obtenir des fermetures aplaties (TcoAbs) et des appels TCO (TcoApp).
2. **Monomorphisation** : Activer la passe `Monomorphize` du compilateur pour éliminer le besoin de `Record_a` et générer du Rust statiquement typé.