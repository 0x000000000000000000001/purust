const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const replacement = `  LetRec _ binds body ->
    let bindsVars = Array.foldl (\\acc (Tuple (Ident n) _) -> Set.insert (sanitizeIdent n) acc) Set.empty (NonEmptyArray.toArray binds)
        allValsVars = Array.foldl (\\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty (NonEmptyArray.toArray binds)
        res = Set.difference (Set.union allValsVars (freeVariables body)) bindsVars
    in Debug.trace ("LetRec bindsVars: " <> show (Set.toUnfoldable bindsVars :: Array String) <> ", res: " <> show (Set.toUnfoldable res :: Array String)) \\_ -> res`;

code = code.replace(`  LetRec _ binds body ->
    let bindsVars = Array.foldl (\\acc (Tuple (Ident n) _) -> Set.insert (sanitizeIdent n) acc) Set.empty (NonEmptyArray.toArray binds)
        allValsVars = Array.foldl (\\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty (NonEmptyArray.toArray binds)
    in Set.difference (Set.union allValsVars (freeVariables body)) bindsVars`, replacement);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
