import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// We will replace all occurrences of `argsCodeArray` that are inside `.call.clone().unwrap()(` folds.
// Actually, let's define `boxedClosureArgs` at the top of `genApp`:
//         m = Array.length argsArray
//         
//         boxedClosureArgs = Array.mapWithIndex (\i argCode ->
//            let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray i)
//                argTy = inferTypeExpr currentMod aritiesMap bound argExpr
//            in boxUnbox Any argTy argCode
//         ) argsCodeArray
//
// And replace all `Array.foldl ... fnCode argsCodeArray` with `Array.foldl ... fnCode boxedClosureArgs`

code = code.replace(/        m = Array\.length argsArray\n        \n        resultCode = case getInner fn of/,
`        m = Array.length argsArray
        
        boxedClosureArgs = Array.mapWithIndex (\\i argCode -> 
            let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray i)
                argTy = inferTypeExpr currentMod aritiesMap bound argExpr
            in boxUnbox Any argTy argCode
        ) argsCodeArray
        
        resultCode = case getInner fn of`);

code = code.replace(/Array\.foldl \(\\acc arg -> "\(" <> acc <> "\)\.call\.clone\(\)\.unwrap\(\)\(" <> arg <> "\)"\) fnCode argsCodeArray/g,
`Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode boxedClosureArgs`);

code = code.replace(/Array\.foldl \(\\acc arg -> "\(" <> acc <> "\)\.call\.clone\(\)\.unwrap\(\)\(" <> arg <> "\)"\) baseCall remainingArgs/g,
`Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") baseCall (Array.drop n boxedClosureArgs)`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
