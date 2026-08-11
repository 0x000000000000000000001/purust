const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Fix printAST
code = code.replace(
    /  UncurriedApp fn args \-\>[\s\S]*?in fnCode \<\> "\(" \<\> argsCode \<\> "\)"/,
    `  UncurriedApp fn _ -> "UncurriedApp(" <> printAST fn <> ")"`
);

// Add UncurriedApp support in codegenExpr
code = code.replace(
    /  UncurriedApp fn _args \-\> \n    case inferTypeExpr currentMod aritiesMap bound fn of\n      Func _ retTy \-\> retTy\n      _ \-\> Any/,
    `  UncurriedApp fn args ->
    let
      argsArray = NonEmptyArray.toArray args
      argsFree = map (\\a -> freeVariables a) argsArray
      aliveForFn = Set.union alive (Array.foldl Set.union Set.empty argsFree)
      fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForFn fn
      argsCodeArray = Array.mapWithIndex (\\i arg -> 
          let subsequentArgsFree = Array.drop (i + 1) argsFree
              aliveForArg = Set.union alive (Array.foldl Set.union Set.empty subsequentArgsFree)
          in codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForArg arg
        ) argsArray
      argsCode = String.joinWith ", " argsCodeArray
    in fnCode <> "(" <> argsCode <> ")"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("CodeGen.purs fixed.");
