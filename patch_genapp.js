import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Replace the Map.member branch:
// Array.foldl (\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode argsCodeArray
code = code.replace(/                        Array\.foldl \(\\acc arg -> "\(" <> acc <> "\)\.call\.clone\(\)\.unwrap\(\)\(" <> arg <> "\)"\) fnCode argsCodeArray/,
`                        let boxedArgs = Array.mapWithIndex (\\i argCode -> 
                              let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray i)
                                  argTy = inferTypeExpr currentMod aritiesMap bound argExpr
                              in boxUnbox Any argTy argCode
                            ) argsCodeArray
                        in Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode boxedArgs`);

// Replace the top-level function branch
// let n = lookupArity fullName
// in if n > 0 then
//   if m == n then
//     fullName <> "(" <> String.joinWith ", " argsCodeArray <> ")"
code = code.replace(/                             let n = lookupArity fullName\n                             in if n > 0 then\n                               if m == n then\n                                 fullName <> "\(" <> String\.joinWith ", " argsCodeArray <> "\)"/,
`                             let n = lookupArity fullName
                                 fnTy = fromMaybe Any (Map.lookup (if fullName == "main" then "main" else fullName) aritiesMap)
                                 expectedArgTys = extractAllArgTypes fnTy
                                 boxedArgs = Array.mapWithIndex (\\i argCode -> 
                                    let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray i)
                                        argTy = inferTypeExpr currentMod aritiesMap bound argExpr
                                        expectedTy = fromMaybe Any (Array.index expectedArgTys i)
                                    in boxUnbox expectedTy argTy argCode
                                 ) argsCodeArray
                             in if n > 0 then
                               if m == n then
                                 fullName <> "(" <> String.joinWith ", " boxedArgs <> ")"`);

// Also update the curried case: letArgsCode and innerCall
// evalArgs = Array.mapWithIndex (\i _ -> "eval_arg_" <> show i) argsCodeArray
// letArgsCode = Array.mapWithIndex (\i argCode -> "        let mut eval_arg_" <> show i <> " = " <> argCode <> ";\n") argsCodeArray
code = code.replace(/                                     let missingCount = n - m\n                                     etaArgs = Array\.mapWithIndex \(\\i _ -> "eta_" <> show i\) \(Array\.replicate missingCount unit\)\n                                     evalArgs = Array\.mapWithIndex \(\\i _ -> "eval_arg_" <> show i\) argsCodeArray\n                                     letArgsCode = Array\.mapWithIndex \(\\i argCode -> "        let mut eval_arg_" <> show i <> " = " <> argCode <> ";\\n"\) argsCodeArray/,
`                                     let missingCount = n - m
                                     etaArgs = Array.mapWithIndex (\\i _ -> "eta_" <> show i) (Array.replicate missingCount unit)
                                     evalArgs = Array.mapWithIndex (\\i _ -> "eval_arg_" <> show i) boxedArgs
                                     letArgsCode = Array.mapWithIndex (\\i argCode -> "        let mut eval_arg_" <> show i <> " = " <> argCode <> ";\\n") boxedArgs`);

// And the fallback branch when it's not a Var:
//                  _ -> Array.foldl (\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode argsCodeArray
code = code.replace(/                 _ -> Array\.foldl \(\\acc arg -> "\(" <> acc <> "\)\.call\.clone\(\)\.unwrap\(\)\(" <> arg <> "\)"\) fnCode argsCodeArray/,
`                 _ -> 
                   let boxedArgs = Array.mapWithIndex (\\i argCode -> 
                         let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray i)
                             argTy = inferTypeExpr currentMod aritiesMap bound argExpr
                         in boxUnbox Any argTy argCode
                       ) argsCodeArray
                   in Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode boxedArgs`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
