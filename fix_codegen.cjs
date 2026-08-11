const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Update signature
code = code.replace(
  'codegenExpr :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> String',
  'codegenExpr :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> String'
);

// Update definition
code = code.replace(
  'codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive (NeutralExpr expr) = case expr of',
  'codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive (NeutralExpr expr) = case expr of'
);

// Update recursive calls inside codegenExpr
code = code.replace(/codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound/g, 'codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound');

// Update codegenBindingGroup calls
code = code.replace(/codegenExpr modNameStr allZeroArity allMacroBindings mbLoop \(Map.union bound aritiesMap\)/g, 'codegenExpr modNameStr allZeroArity allMacroBindings mbLoop aritiesMap (Map.union bound aritiesMap)');
code = code.replace(/codegenExpr modNameStr allZeroArity allMacroBindings Nothing aritiesMap Set.empty/g, 'codegenExpr modNameStr allZeroArity allMacroBindings Nothing aritiesMap aritiesMap Set.empty');

// Update ExprVar
code = code.replace(/isZeroArity = case Map.lookup fullName bound of\n        Just \(Func _ _\) -> false\n        Just _ -> true\n        Nothing -> fullName \/= "Effect_Console_log"/g, `isZeroArity = case Map.lookup fullName bound of
        Just (Func _ _) -> false
        Just _ -> true
        Nothing -> case Map.lookup fullName aritiesMap of
          Just (Func _ _) -> false
          Just _ -> true
          Nothing -> fullName /= "Effect_Console_log"`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
