const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Replace freeVariables
code = code.replace(/  LetRec _ binds body ->\n[\s\S]*?    in Debug\.trace[\s\S]*?       Set\.difference \(Set\.union allValsVars \(freeVariables body\)\) bindsVars/, 
`  LetRec _ binds body ->
    let bindsVars = Array.foldl (\\acc (Tuple (Ident n) _) -> Set.insert (sanitizeIdent n) acc) Set.empty (NonEmptyArray.toArray binds)
        allValsVars = Array.foldl (\\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty (NonEmptyArray.toArray binds)
    in Set.difference (Set.union allValsVars (freeVariables body)) bindsVars`);

code = code.replace(/  Abs params body ->\n    let paramsVars = Array\.foldl[\s\S]*?          _ -> acc\) Set\.empty \(NonEmptyArray\.toArray params\)\n    in Set\.difference \(freeVariables body\) paramsVars/, 
`  Abs params body ->
    let paramsVars = Array.foldl (\\acc (Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> Set.insert (sanitizeIdent n) acc
          Nothing -> Set.insert ("lvl_" <> show (unwrap lvl)) acc) Set.empty (NonEmptyArray.toArray params)
    in Set.difference (freeVariables body) paramsVars
  UncurriedAbs params body ->
    let paramsVars = Array.foldl (\\acc (Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> Set.insert (sanitizeIdent n) acc
          Nothing -> Set.insert ("lvl_" <> show (unwrap lvl)) acc) Set.empty params
    in Set.difference (freeVariables body) paramsVars
  UncurriedEffectAbs params body ->
    let paramsVars = Array.foldl (\\acc (Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> Set.insert (sanitizeIdent n) acc
          Nothing -> Set.insert ("lvl_" <> show (unwrap lvl)) acc) Set.empty params
    in Set.difference (freeVariables body) paramsVars
  UncurriedApp fn args ->
    Array.foldl (\\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) args
  UncurriedEffectApp fn args ->
    Array.foldl (\\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) args`);

// Remove Debug import
code = code.replace(/import Debug as Debug\n/, '');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
