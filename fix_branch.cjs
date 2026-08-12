const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const target = `  Branch branches def ->
    let
      branchCode = map (\\(Pair cond body) -> 
        let aliveForCond = Set.union alive (freeVariables body)
        in "if " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForCond cond <> " {\\n        " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive body <> "\\n    }") (NonEmptyArray.toArray branches)`;

const replacement = `  Branch branches def ->
    let
      branchCode = map (\\(Pair cond body) -> 
        let aliveForCond = Set.union alive (freeVariables body)
            condCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForCond cond
            isLit = case cond of
              NeutralExpr (Typed _ (NeutralExpr (Lit (LitBoolean _)))) -> true
              NeutralExpr (Lit (LitBoolean _)) -> true
              _ -> false
            condFinal = if isLit then condCode else "(" <> condCode <> ").init_bool.unwrap()"
        in "if " <> condFinal <> " {\\n        " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive body <> "\\n    }") (NonEmptyArray.toArray branches)`;

if (code.includes(target)) {
  fs.writeFileSync('src/Purust/CodeGen.purs', code.replace(target, replacement));
  console.log("Patched Branch");
} else {
  console.log("Could not find target");
}
