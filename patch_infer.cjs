const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

// Update inferTypeExpr signature
code = code.replace(/inferTypeExpr :: String -> Map.Map String ExprType -> NeutralExpr -> ExprType/m, 'inferTypeExpr :: String -> Map.Map String ExprType -> Map.Map String ExprType -> NeutralExpr -> ExprType');
code = code.replace(/inferTypeExpr :: String -> Map String ExprType -> NeutralExpr -> ExprType/m, 'inferTypeExpr :: String -> Map.Map String ExprType -> Map.Map String ExprType -> NeutralExpr -> ExprType');

// Update inferTypeExpr implementation
code = code.replace(/inferTypeExpr currentMod bound \(NeutralExpr expr\) = case expr of/m, 'inferTypeExpr currentMod aritiesMap bound (NeutralExpr expr) = case expr of');

// Update Var branch in inferTypeExpr
code = code.replace(/Var \(Qualified _ \(Ident name\)\) -> \n\s*case Map\.lookup name bound of\n\s*Just ty -> ty\n\s*Nothing -> Any/m, `Var (Qualified mbMod (Ident name)) -> 
     let
       modPrefix = case mbMod of
         Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
         Nothing -> ""
       fullName = modPrefix <> sanitizeIdent name
     in case Map.lookup name bound of
       Just ty -> ty
       Nothing -> case Map.lookup fullName aritiesMap of
         Just ty -> ty
         Nothing -> Any`);

// Update recursive calls in inferTypeExpr
code = code.replaceAll('inferTypeExpr currentMod bound', 'inferTypeExpr currentMod aritiesMap bound');
code = code.replaceAll('inferTypeExpr modNameStr bound', 'inferTypeExpr modNameStr aritiesMap bound');
code = code.replaceAll('inferTypeExpr modNameStr Map.empty', 'inferTypeExpr modNameStr aritiesMap Map.empty');
code = code.replaceAll('inferTypeExpr currentMod Map.empty', 'inferTypeExpr currentMod aritiesMap Map.empty');

fs.writeFileSync(file, code);
