import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /let firstNArgs = Array.take n boxedArgs\n\s+remainingArgs = Array.drop n argsCodeArray\n\s+baseCall = fullName <> "\(" <> String.joinWith ", " firstNArgs <> "\)"\n\s+in Array.foldl \(\\acc arg -> "\(" <> acc <> "\).call.clone\(\).unwrap\(\)\(" <> arg <> "\)"\) baseCall \(Array.drop n boxedClosureArgs\)/,
    `let firstNArgs = Array.take n boxedArgs
                                     remainingArgs = Array.drop n argsCodeArray
                                     baseCall = fullName <> "(" <> String.joinWith ", " firstNArgs <> ")"
                                     callResult = Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") baseCall (Array.drop n boxedClosureArgs)
                                 in boxUnbox Any (inferTypeExpr currentMod aritiesMap bound (App fn args)) callResult`
);

code = code.replace(
    /else\n\s+-- Arity 0 or not a Func\n\s+Array.foldl \(\\acc arg -> "\(" <> acc <> "\).call.clone\(\).unwrap\(\)\(" <> arg <> "\)"\) fnCode boxedClosureArgs/,
    `else
                               -- Arity 0 or not a Func
                               let callResult = Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode boxedClosureArgs
                               in boxUnbox Any (inferTypeExpr currentMod aritiesMap bound (App fn args)) callResult`
);

code = code.replace(
    /else\n\s+-- Not found in aritiesMap\n\s+Array.foldl \(\\acc arg -> "\(" <> acc <> "\).call.clone\(\).unwrap\(\)\(" <> arg <> "\)"\) fnCode boxedClosureArgs/,
    `else
                             -- Not found in aritiesMap
                             let callResult = Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode boxedClosureArgs
                             in boxUnbox Any (inferTypeExpr currentMod aritiesMap bound (App fn args)) callResult`
);

code = code.replace(
    /_ -> \n\s+-- Not a Var\n\s+Array.foldl \(\\acc arg -> "\(" <> acc <> "\).call.clone\(\).unwrap\(\)\(" <> arg <> "\)"\) fnCode boxedClosureArgs/,
    `_ -> 
                   -- Not a Var
                   let callResult = Array.foldl (\\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") fnCode boxedClosureArgs
                   in boxUnbox Any (inferTypeExpr currentMod aritiesMap bound (App fn args)) callResult`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
