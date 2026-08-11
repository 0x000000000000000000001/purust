const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regex = /        argsCodeArray = Array\.mapWithIndex \(\\i arg -> \n            let subsequentArgsFree = Array\.drop \(i \+ 1\) argsFree\n                aliveForArg = Set\.union alive \(Array\.foldl Set\.union Set\.empty subsequentArgsFree\)\n            in codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForArg arg\n          \) argsArray/;

const replacement = `        argsCodeArray = Array.mapWithIndex (\\i arg -> 
            let subsequentArgsFree = Array.drop (i + 1) argsFree
                aliveForArg = Set.union alive (Array.foldl Set.union Set.empty subsequentArgsFree)
                argCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForArg arg
                ty = inferTypeExpr currentMod aritiesMap bound arg
            in case ty of
              Boolean -> "crate::mk_bool(" <> argCode <> ")"
              Int -> "crate::mk_int(" <> argCode <> ")"
              Number -> "crate::mk_f64(" <> argCode <> ")"
              String -> "crate::mk_str(" <> argCode <> ")"
              _ -> argCode
          ) argsArray`;

if (!code.match(regex)) {
    console.error("Could not find App args regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Fixed App args boxing!");
