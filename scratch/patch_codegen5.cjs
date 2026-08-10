const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
  'import Data.Maybe (Maybe(..), fromMaybe)',
  'import Data.Maybe (Maybe(..), fromMaybe)\nimport Data.Tuple (Tuple(..))'
);

const extractVarType = `
extractVarType :: NeutralExpr -> Maybe (Tuple ExprType (Qualified Ident))
extractVarType (NeutralExpr (Typed ty inner)) = case inner of
  NeutralExpr (Var q) -> Just (Tuple ty q)
  NeutralExpr (Typed _ _) -> extractVarType inner
  _ -> Nothing
extractVarType _ = Nothing

codegenExpr :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> String
codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive e = case extractVarType e of
  Just (Tuple ty (Qualified mbMod (Ident name))) ->
    let
      modPrefix = case mbMod of
        Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
        Nothing -> ""
      fullName = sanitizeIdent (modPrefix <> name)
      isZeroArity = case ty of
        Func _ _ -> false
        _ -> true
      isAlive = Set.member fullName alive
      varCode = if isZeroArity then fullName <> "()" else fullName
    in if isAlive then varCode <> ".clone()" else varCode
  Nothing -> case e of
    NeutralExpr expr -> case expr of
`;

code = code.replace(
  `codegenExpr :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> String\ncodegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive (NeutralExpr expr) = case expr of`,
  extractVarType
);

// We need to also patch the fallback case at the bottom:
code = code.replace(
  `_ -> "unimplemented!() /* Unsupported Expr: " <> printAST (NeutralExpr expr) <> " */"`,
  `_ -> "unimplemented!() /* Unsupported Expr */"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
