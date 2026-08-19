import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const oldBranch = `  Branch _ def -> 
    let t = inferTypeExpr currentMod aritiesMap bound def
        _ = Debug.trace ("Branch def type: " <> codegenExprType true t <> " for def: " <> printAST def) \\_ -> unit
    in t`;

const newBranch = `  Branch branches def ->
    let defTy = inferTypeExpr currentMod aritiesMap bound def
    in case defTy of
      Any -> inferTypeExpr currentMod aritiesMap bound (Tuple.snd (NonEmptyArray.head branches))
      _ -> defTy`;

code = code.replace(oldBranch, newBranch);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
