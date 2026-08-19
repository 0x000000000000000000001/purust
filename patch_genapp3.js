import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Modify genApp signature
code = code.replace(
    /genApp :: String -> Set.Set String -> Set.Set String -> Maybe \{ name :: String, params :: Array String \} -> Map.Map String ExprType -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> Array String -> String/,
    'genApp :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Map.Map String ExprType -> Set.Set String -> ExprType -> NeutralExpr -> Array String -> String'
);

// Modify genApp definition
code = code.replace(
    /genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn argsCodeArray =/,
    'genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive appTy fn argsCodeArray ='
);

// Modify codegenExpr_ to pass appTy
code = code.replace(
    /in genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn argsCodeArray/,
    'let appTy = inferTypeExpr currentMod aritiesMap bound (App fn args)\n    in genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive appTy fn argsCodeArray'
);

// Modify genApp inside genApp (recursive calls?)
// Wait, is genApp recursive? No!

// Now replace inferTypeExpr currentMod aritiesMap bound (App fn argsArray) with appTy
code = code.replace(
    /\(inferTypeExpr currentMod aritiesMap bound \(App fn argsArray\)\)/g,
    'appTy'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
