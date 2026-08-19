import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const oldBranch = `  Branch branches def ->
    let defTy = inferTypeExpr currentMod aritiesMap bound def
    in case defTy of
      Any -> inferTypeExpr currentMod aritiesMap bound (Tuple.snd (NonEmptyArray.head branches))
      _ -> defTy`;

const newBranch = `  Branch branches def ->
    let defTy = inferTypeExpr currentMod aritiesMap bound def
    in case defTy of
      Any -> 
        let Pair _ body = NonEmptyArray.head branches
        in inferTypeExpr currentMod aritiesMap bound body
      _ -> defTy`;

code = code.replace(oldBranch, newBranch);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
