import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const oldBranchCond = `            isLit = case cond of
              NeutralExpr (Typed _ (NeutralExpr (Lit (LitBoolean _)))) -> true
              NeutralExpr (Lit (LitBoolean _)) -> true
              _ -> false
            condFinal = if isLit then condCode else "(" <> condCode <> ").init_bool.unwrap()"`;

const newBranchCond = `            condTy = inferTypeExpr currentMod aritiesMap bound cond
            condFinal = boxUnbox Boolean condTy condCode`;

code = code.replace(oldBranchCond, newBranchCond);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
