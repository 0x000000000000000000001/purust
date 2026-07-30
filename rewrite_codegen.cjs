const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/codegenExpr :: Maybe \{ name :: String, params :: Array String \} -> NeutralExpr -> String/g, "codegenExpr :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> NeutralExpr -> String");

code = code.replaceAll('codegenExpr mbLoop', 'codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound');

// In codegenBindingGroup, we don't have currentMod etc., we have modNameStr
code = code.replace(/codegenExpr :: BackendBindingGroup Ident NeutralExpr -> String/g, "codegenBindingGroup :: String -> Set.Set String -> Set.Set String -> Map.Map String ExprType -> BackendBindingGroup Ident NeutralExpr -> { code :: String, arities :: Map.Map String ExprType }");
// We need to completely replace codegenBindingGroup implementation

fs.writeFileSync(file, code);
