const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Replace freeVariables LetRec
code = code.replace(/  LetRec _ binds body ->\n    let bindsVars = Array.foldl[\s\S]*?    in Set.difference \(Set.union allValsVars \(freeVariables body\)\) bindsVars/, 
`  LetRec _ binds body ->
    let bindsVars = Array.foldl (\\acc (Tuple (Ident n) _) -> Set.insert (sanitizeIdent n) acc) Set.empty (NonEmptyArray.toArray binds)
        allValsVars = Array.foldl (\\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty (NonEmptyArray.toArray binds)
    in Debug.trace ("LetRec bindsVars: " <> show bindsVars <> ", allValsVars: " <> show allValsVars <> ", bodyVars: " <> show (freeVariables body)) \\_ ->
       Set.difference (Set.union allValsVars (freeVariables body)) bindsVars`);

code = "import Debug as Debug\n" + code;

fs.writeFileSync('src/Purust/CodeGen.purs', code);
