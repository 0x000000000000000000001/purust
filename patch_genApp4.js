import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    'genApp :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> Array NeutralExpr -> String',
    'genApp :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Map.Map String ExprType -> Set.Set String -> ExprType -> NeutralExpr -> Array NeutralExpr -> String'
);

code = code.replace(
    'genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn argsArray =',
    'genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive appTy fn argsArray ='
);

code = code.replace(
    'genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn (NonEmptyArray.toArray args)',
    'let appTy = inferTypeExpr currentMod aritiesMap bound (App fn args)\n    in genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive appTy fn (NonEmptyArray.toArray args)'
);

code = code.replace(
    'genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn args',
    'let appTy = inferTypeExpr currentMod aritiesMap bound (UncurriedApp fn args)\n    in genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive appTy fn args'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
