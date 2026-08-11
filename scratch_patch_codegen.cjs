const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Replace App
code = code.replace(
    /  App fn arg \-\>[\s\S]*?in "__PURUST_APP__!\(" \<\> fnCode \<\> ", \[" \<\> argsCode \<\> "\]\)"/,
    `  App fn arg ->
    let
      aliveForFn = Set.union alive (freeVariables arg)
      fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForFn fn
      argCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive arg
    in "(" <> fnCode <> ").call.clone().unwrap()(" <> argCode <> ")"`
);

// Add UncurriedApp support replacing the catch-all
code = code.replace(
    /  UncurriedApp fn _ \-\> "UncurriedApp\(" \<\> printAST fn \<\> "\)"/,
    `  UncurriedApp fn args ->
    let
      argsArray = NonEmptyArray.toArray args
      argsFree = Array.map (\\a -> freeVariables a) argsArray
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

// Replace Var
code = code.replace(
    /  Var \(Qualified mbMod \(Ident name\)\) \-\>[\s\S]*?in if isAlive then varCode \<\> "\.clone\(\)" else varCode/,
    `  Var (Qualified mbMod (Ident name)) ->
    let
      modPrefix = case mbMod of
        Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
        Nothing -> ""
      fullName = sanitizeIdent (modPrefix <> name)
      isBound = Map.member fullName bound
      isZeroArity = case Map.lookup fullName bound of
        Just (Func _ _) -> false
        Just _ -> true
        Nothing -> case Map.lookup fullName aritiesMap of
          Just (Func _ _) -> false
          Just _ -> true
          Nothing -> fullName /= "Effect_Console_log"
      isAlive = Set.member fullName alive
      
      ty = if isBound then Map.lookup fullName bound else Map.lookup fullName aritiesMap
      
      etaExpand :: ExprType -> Int -> String -> String
      etaExpand (Func _ ret) idx acc = 
        "perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |mut eta_" <> show idx <> ": UnknownType| -> UnknownType {\\n    " <> etaExpand ret (idx + 1) acc <> "\\n})), ..Default::default() })"
      etaExpand _ idx acc = 
        let argsCode = if idx == 0 then "" else String.joinWith ", " (map (\\i -> "eta_" <> show i <> ".clone()") (Data.Array.range 0 (idx - 1)))
        in acc <> "(" <> argsCode <> ")"

      varCode = 
        if isBound then fullName
        else if isZeroArity then fullName <> "()"
        else case ty of
          Just funcTy@(Func _ _) -> etaExpand funcTy 0 fullName
          _ -> fullName
    in if isAlive then varCode <> ".clone()" else varCode`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("CodeGen.purs patched successfully.");
