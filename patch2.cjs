const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Fix Let in codegenExpr
code = code.replace(
  /Let \(Just \(Ident nameRaw\)\) _ val body ->[\s\S]*?Let Nothing _ val body ->[\s\S]*?"\}"/,
  `Let mbId lvl val body ->
    let
      name = case mbId of
        Just (Ident nameRaw) -> sanitizeIdent nameRaw
        Nothing -> "lvl_" <> show (unwrap lvl)
      bodyVars = freeVariables body
      aliveForVal = Set.union alive bodyVars
      valCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound aliveForVal val
      -- if name is not in bodyVars, it's dead immediately
      deadCode = if Set.member name bodyVars then "" else "    " <> name <> ".drop_explicit();\\n"
    in
      "{\\n" <> 
      "    let mut " <> name <> " = " <> valCode <> ";\\n" <>
      deadCode <>
      "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive body <> "\\n" <>
      "}"`
);

// Fix freeVariables for Let
code = code.replace(
  /Let \(Just \(Ident i\)\) _ val body ->\n    Set\.union \(freeVariables val\) \(Set\.delete \(sanitizeIdent i\) \(freeVariables body\)\)\n  Let Nothing _ val body ->\n    Set\.union \(freeVariables val\) \(freeVariables body\)/,
  `Let mbId lvl val body ->
    let name = case mbId of
          Just (Ident i) -> sanitizeIdent i
          Nothing -> "lvl_" <> show (unwrap lvl)
    in Set.union (freeVariables val) (Set.delete name (freeVariables body))`
);

// Fix EffectBind to also handle mbId Nothing
code = code.replace(
  /EffectBind mbIdent _ val body ->\n    case mbIdent of\n      Just \(Ident name\) ->[\s\S]*?Nothing ->[\s\S]*?"\}"/,
  `EffectBind mbIdent lvl val body ->
    let name = case mbIdent of
          Just (Ident n) -> sanitizeIdent n
          Nothing -> "lvl_" <> show (unwrap lvl)
        aliveForVal = Set.union alive (freeVariables body)
        valCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound aliveForVal val
        bodyVars = freeVariables body
        deadCode = if Set.member name bodyVars then "" else "    " <> name <> ".drop_explicit();\\n"
    in
    "{\\n" <>
    "    let " <> name <> " = " <> valCode <> ";\\n" <>
    deadCode <>
    "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound alive body <> "\\n" <>
    "}"`
);

// Fix freeVariables for EffectBind
code = code.replace(
  /EffectBind mbIdent _ val body ->\n    let bodyVars = case mbIdent of\n          Just \(Ident i\) -> Set\.delete \(sanitizeIdent i\) \(freeVariables body\)\n          Nothing -> freeVariables body\n    in Set\.union \(freeVariables val\) bodyVars/,
  `EffectBind mbIdent lvl val body ->
    let name = case mbIdent of
          Just (Ident i) -> sanitizeIdent i
          Nothing -> "lvl_" <> show (unwrap lvl)
        bodyVars = Set.delete name (freeVariables body)
    in Set.union (freeVariables val) bodyVars`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
