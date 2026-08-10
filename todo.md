# Purust - État des Lieux et Todo (10 Août 2026)

## 1. Ce qui était en cours juste avant l'interruption
- **Résolution des erreurs `cargo check` sur le monolithe `main.rs`.**
- **Correction de `E0425` (Types manquants)** : Le compilateur paniquait sur les Foreign Data Types. Résolu en injectant automatiquement des alias globaux via `fix_main_regex.cjs` (`pub type Control_Monad_ST_Internal_ST = UnknownType;`, `Data_Array_ST_STArray`, `Data_Unit_Unit`, `Data_Lazy_Lazy`, `Effect_Effect`).
- **Correction de `E0428` (Définitions multiples)** : Chaque fichier concaténé embarquait ses propres fonctions utilitaires `unsafe_coerce` et `mk_int`. Résolu en modifiant le script pour ne garder que la toute première définition de ces fonctions au début du fichier.
- **En plein debug d'une erreur de syntaxe (`) }` orpheline)** : La regex qui supprimait les helpers laissait traîner la fermeture de l'instanciation de `Record_a`. La regex a été corrigée (`/pub fn unsafe_coerce<T>\(_: T\) -> UnknownType \{.*\}\n*/g`) et j'étais **sur le point de relancer le build** pour vérifier.

## 2. Ce qu'il reste à faire dans l'immédiat
- Lancer le pipeline de build (`node ../../bin/purust.js run` + `fix_main_regex.cjs` + `cargo check`) pour confirmer que la syntaxe est propre.
- Récupérer les vraies erreurs d'arité et de typage (`E0061`) qui étaient jusqu'à présent masquées par les erreurs de syntaxe et de types manquants. 

## 3. Le plan pour régler le problème d'uncurrying (Refactor Majeur)
L'actuel `CodeGen.purs` de Purust tente d'aplatir (uncurry) les fonctions "à la main" en lisant les types inférés, tout en continuant d'utiliser l'AST brut (`NeutralExpr`). Résultat : la signature de la fonction attend `X` arguments natifs, mais son corps génère les fermetures imbriquées (`unsafe_coerce(Rc::new(...))`) du CoreFn classique.

Pour résoudre cela de manière robuste, nous allons **aligner l'architecture sur celle de `gopurs`** :
1. **Intégration de l'analyse TCO** : 
   - Importer `PureScript.Backend.Optimizer.Codegen.Tco (TcoExpr(..), tcoAnalysisOf)` dans `Purust/CodeGen.purs`.
2. **Transformation de l'AST** : 
   - Au lieu de passer directement `NeutralExpr` au générateur de code, exécuter `tcoAnalysisOf` sur les bindings. Cela transforme automatiquement et sans erreur les `Abs` imbriqués en `TcoAbs` (fonctions aplaties à plusieurs paramètres) et les appels en `TcoApp`.
3. **Refonte de `codegenExpr`** :
   - Réécrire le pattern matching de `codegenExpr` pour matcher sur l'enum `TcoExpr` au lieu de `NeutralExpr`.
   - Cela réglera non seulement les problèmes de fermetures imbriquées, mais apportera en bonus **la Tail-Call Optimization (TCO)** native pour les fonctions récursives, indispensable pour des performances de haut niveau en Rust.

## 4. Bilan architectural (Les ambitions initiales vs la réalité actuelle)
À la lumière de l'analyse du code source actuel, voici le diagnostic scientifique du backend `purust` face aux 6 grands piliers prévus par son concepteur :

1. **Supériorité du TAST (Monomorphisation sans pointeur)** ❌ *Échec actuel*
   - Le parsing des `dataDecls` est fait (on génère bien des `pub enum`), mais le générateur ne passe pas par la passe d'optimisation `Monomorphize`. Résultat : les fonctions tombent dans le plus grand commun dénominateur (`UnknownType`) et chaque `enum` finit enfermé dans un `unsafe_coerce(Rc::new(Record_a { ... }))`.
2. **Moteur Perceus (Analyse de vivacité et Liveness)** ⚠️ *Partiel*
   - L'analyse est fournie par le framework (`UsageAnalysis`), mais `purust` ne l'exploite pas pleinement pour émettre des `dup()`/`drop()` chirurgicaux, préférant un `.clone()` massif des arguments capturés par les fermetures.
3. **FBIP (Functional But In-Place)** ❌ *Non implémenté*
   - Aucune trace de code généré du style `Rc::make_mut` pour muter en place les objets ayant un compteur de référence à 1.
4. **"Sticky Sharing" (Pointeur intelligent PerceusPtr)** ✅ *Validé*
   - `purust` s'appuie effectivement sur un `perceus_ptr::PerceusPtr<Record_a>` embarqué qui gère la logique de comptage de référence customisée (court-circuitant le Borrow Checker strict).
5. **Optimisation TCO via boucles natives** ❌ *Totalement absent*
   - Comme `purust` n'utilise pas `TcoExpr` (contrairement à `gopurs`), la récursion terminale produit de bêtes appels de fermetures qui provoqueront inévitablement un Stack Overflow en Rust.
6. **Passage de Dictionnaires (Type Classes monomorphisées)** ❌ *Absent*
   - Le backend omet totalement la passe `Monomorphize`, les dictionnaires continuent donc d'exister en tant que pointeurs à l'exécution.

**Conclusion :** `purust` est actuellement une "V1 / Preuve de concept". L'auteur a brillamment branché la plomberie externe (parsing TAST, exécution de Cargo, pointeur Perceus), mais a complètement esquivé les passes d'optimisation internes de `purescript-backend-optimizer` (`TcoExpr`, `Monomorphize`) au profit d'un hack global de contournement de type (`UnknownType`). L'étape 3 du refactor (intégration de `TcoExpr`) est la première clé pour déverrouiller ce potentiel gâché.