const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regex = /  App fn args -> [\s\S]*?       else\n         Array\.foldl \(\\\acc argCode -> "\(" <> acc <> "\)\.call\.clone\(\)\.unwrap\(\)\(" <> argCode <> "\)"\) fnCode argsCodeArray/;

const replacement = `  App fn args -> 
    let getInner :: NeutralExpr -> NeutralExpr
        getInner (NeutralExpr (Typed _ inner)) = getInner inner
        getInner e = e
        
        argsArray = NonEmptyArray.toArray args
        argsFree = map freeVariables argsArray
        aliveForFn = Set.union alive (Array.foldl Set.union Set.empty argsFree)
        fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForFn fn
        
        argsCodeArray = Array.mapWithIndex (\\i arg -> 
            let subsequentArgsFree = Array.drop (i + 1) argsFree
                aliveForArg = Set.union alive (Array.foldl Set.union Set.empty subsequentArgsFree)
                argCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForArg arg
                ty = inferTypeExpr currentMod aritiesMap bound arg
                tyStr = case ty of
                  Boolean -> "bool"
                  Int -> "i64"
                  Number -> "f64"
                  String -> "str"
                  _ -> "unk"
            in argCode <> " /*" <> tyStr <> "*/"
          ) argsArray
        argsCode = String.joinWith ", " argsCodeArray
    in "__PURUST_APP__!(" <> fnCode <> ", [" <> argsCode <> "])"`;

if (!code.match(regex)) {
    console.error("Could not find App regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Fixed App to use __PURUST_APP__!");
