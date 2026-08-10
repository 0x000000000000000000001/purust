const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Add Level to imports
code = code.replace(
  'BackendOperatorOrd(..), Pair(..))',
  'BackendOperatorOrd(..), Pair(..), Level(..))'
);

// Fix Local in codegenExpr
code = code.replace(
  /Local \(Just \(Ident nameRaw\)\) _ -> \n    let name = sanitizeIdent nameRaw in\n    if Set\.member name alive then name <> "\.dup\(\)" else name/,
  `Local mbId lvl -> 
    let name = case mbId of
          Just (Ident nameRaw) -> sanitizeIdent nameRaw
          Nothing -> "lvl_" <> show (unwrap lvl)
    in if Set.member name alive then name <> ".dup()" else name`
);

// Fix freeVariables for Local
code = code.replace(
  /Local \(Just \(Ident nameRaw\)\) _ -> Set\.singleton \(sanitizeIdent nameRaw\)/,
  `Local mbId lvl -> Set.singleton (case mbId of
      Just (Ident nameRaw) -> sanitizeIdent nameRaw
      Nothing -> "lvl_" <> show (unwrap lvl))`
);

// Fix freeVariables for LetRec
code = code.replace(
  /EffectPure val -> freeVariables val/,
  `EffectPure val -> freeVariables val
  LetRec _ binds body ->
    let bindsVars = Array.foldl (\\acc (Tuple (Ident n) _) -> Set.insert (sanitizeIdent n) acc) Set.empty (NonEmptyArray.toArray binds)
        allValsVars = Array.foldl (\\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty (NonEmptyArray.toArray binds)
    in Set.union allValsVars (Set.difference (freeVariables body) bindsVars)`
);

// Fix freeVariables for Fail
code = code.replace(
  /Lit \(LitArray arr\) -> /,
  `Fail _ -> Set.empty
  Lit (LitArray arr) -> `
);

// Fix Op1
code = code.replace(
  /OpNumberNegate -> "-" <> aStr\n      _ -> "\/\/ Unsupported Op1"/,
  `OpNumberNegate -> "-" <> aStr
      OpArrayLength -> "((" <> aStr <> ").len() as i32)"
      _ -> "// Unsupported Op1"`
);

// Fix Op2
code = code.replace(
  /OpBooleanAnd -> "\(" <> aStr <> " && " <> bStr <> "\)"/,
  `OpNumberOrd OpEq -> "((" <> aStr <> ") == (" <> bStr <> "))"
      OpNumberOrd OpNotEq -> "((" <> aStr <> ") != (" <> bStr <> "))"
      OpNumberOrd OpLt -> "((" <> aStr <> ") < (" <> bStr <> "))"
      OpNumberOrd OpLte -> "((" <> aStr <> ") <= (" <> bStr <> "))"
      OpNumberOrd OpGt -> "((" <> aStr <> ") > (" <> bStr <> "))"
      OpNumberOrd OpGte -> "((" <> aStr <> ") >= (" <> bStr <> "))"
      OpStringOrd OpEq -> "((" <> aStr <> ") == (" <> bStr <> "))"
      OpStringOrd OpNotEq -> "((" <> aStr <> ") != (" <> bStr <> "))"
      OpCharOrd OpEq -> "((" <> aStr <> ") == (" <> bStr <> "))"
      OpCharOrd OpNotEq -> "((" <> aStr <> ") != (" <> bStr <> "))"
      OpBooleanOrd OpEq -> "((" <> aStr <> ") == (" <> bStr <> "))"
      OpBooleanOrd OpNotEq -> "((" <> aStr <> ") != (" <> bStr <> "))"
      OpBooleanAnd -> "(" <> aStr <> " && " <> bStr <> ")"`
);

// Fix Abs params
code = code.replace(
  /paramsArr = map \(\\\(Tuple mbId _\) -> case mbId of\n        Just \(Ident n\) -> sanitizeIdent n\n        _ -> "_"\) \(NonEmptyArray\.toArray params\)/,
  `paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)`
);

// Fix freeVariables for Abs params
code = code.replace(
  /paramsVars = Array\.foldl \(\\\a\c\c \(Tuple mbId _\) -> case mbId of\n          Just \(Ident n\) -> Set\.insert \(sanitizeIdent n\) acc\n          _ -> acc\) Set\.empty \(NonEmptyArray\.toArray params\)/,
  `paramsVars = Array.foldl (\\acc (Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> Set.insert (sanitizeIdent n) acc
          Nothing -> Set.insert ("lvl_" <> show (unwrap lvl)) acc) Set.empty (NonEmptyArray.toArray params)`
);

// Fix LetRec in codegenExpr
code = code.replace(
  /LetRec _ _ inner -> "\/\/ Unsupported Expr: LetRec\(..., " <> printAST inner <> "\)"/,
  `LetRec _ binds body ->
    let bindsCode = String.joinWith "\\n" (map (\\(Tuple (Ident nameRaw) val) -> 
          let name = sanitizeIdent nameRaw
              aliveForVal = Set.union alive (freeVariables body)
              valCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound aliveForVal val
          in "    let mut " <> name <> " = " <> valCode <> ";"
        ) (NonEmptyArray.toArray binds))
    in "{\\n" <> bindsCode <> "\\n    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive body <> "\\n}"`
);

// Fix Fail in codegenExpr
code = code.replace(
  /Fail _ -> "\/\/ Unsupported Expr: Fail\(Failed pattern match\)"/,
  `Fail msg -> "unimplemented!(\\"Failed pattern match: " <> String.replaceAll (Pattern "\\"") (Replacement "\\\\\\"") msg <> "\\")"`
);

// Fix UncurriedApp
code = code.replace(
  /UncurriedApp fn _args -> "\/\/ Unsupported Expr: UncurriedApp\(" <> printAST fn <> "\)"/,
  `UncurriedApp fn args ->
    let fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive fn
        argsCode = String.joinWith ", " (map (\\a -> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive a) args)
    in "(" <> fnCode <> ")(" <> argsCode <> ")"`
);

// Fix UncurriedEffectApp
code = code.replace(
  /UncurriedEffectApp fn _args -> "\/\/ Unsupported Expr: UncurriedEffectApp\(" <> printAST fn <> "\)"/,
  `UncurriedEffectApp fn args ->
    let fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive fn
        argsCode = String.joinWith ", " (map (\\a -> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive a) args)
    in "(" <> fnCode <> ")(" <> argsCode <> ")"`
);

// Fix UncurriedAbs
code = code.replace(
  /UncurriedAbs _ inner -> "\/\/ Unsupported Expr: UncurriedAbs\(..., " <> printAST inner <> "\)"/,
  `UncurriedAbs params body ->
    let paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> sanitizeIdent n
          Nothing -> "lvl_" <> show (unwrap lvl)) params
        paramsCode = String.joinWith ", " (map (\\p -> (if p == "_" then "" else "mut ") <> p <> ": UnknownType") paramsArr)
        bodyVars = freeVariables body
        drops = String.joinWith "" (map (\\p -> if p /= "_" && not (Set.member p bodyVars) then "    " <> p <> ".drop_explicit();\\n" else "") paramsArr)
    in "unsafe_coerce(std::rc::Rc::new(move |" <> paramsCode <> "| -> UnknownType {\\n" <> drops <> "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound Set.empty body <> "\\n}))"`
);

// Fix UncurriedEffectAbs
code = code.replace(
  /UncurriedEffectAbs _ inner -> "\/\/ Unsupported Expr: UncurriedEffectAbs\(..., " <> printAST inner <> "\)"/,
  `UncurriedEffectAbs params body ->
    let paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> sanitizeIdent n
          Nothing -> "lvl_" <> show (unwrap lvl)) params
        paramsCode = String.joinWith ", " (map (\\p -> (if p == "_" then "" else "mut ") <> p <> ": UnknownType") paramsArr)
        bodyVars = freeVariables body
        drops = String.joinWith "" (map (\\p -> if p /= "_" && not (Set.member p bodyVars) then "    " <> p <> ".drop_explicit();\\n" else "") paramsArr)
    in "unsafe_coerce(std::rc::Rc::new(move |" <> paramsCode <> "| -> UnknownType {\\n" <> drops <> "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound Set.empty body <> "\\n}))"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
