const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const replaceAbs = `  Abs params body -> 
    let
      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
      paramsCode = String.joinWith ", " (map (\\p -> (if p == "_" then "" else "mut ") <> p <> ": UnknownType") paramsArr)
      bodyVars = freeVariables body
      capturedVars = Array.filter (\\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity) && not (Array.elem v paramsArr)) (Array.fromFoldable bodyVars :: Array String)
      clones = String.joinWith "" (map (\\v -> "    let mut " <> v <> " = " <> v <> ".clone();\\n") capturedVars)
      drops = String.joinWith "" (map (\\p -> if p /= "_" && not (Set.member p bodyVars) then "    // DEBUG: bodyVars=" <> show (Array.fromFoldable bodyVars :: Array String) <> " p=" <> p <> "\\n    " <> p <> ".drop_explicit();\\n" else "") paramsArr)
    in "perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, proof: None, call: Some(std::rc::Rc::new(move |" <> paramsCode <> "| -> UnknownType {\\n" <>
       clones <> drops <>
       "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound Set.empty body <> "\\n" <>
       "})) })"`;

const targetAbsRegex = /  Abs params body -> [\s\S]*?"\}\)\) \}\)"/;
code = code.replace(targetAbsRegex, replaceAbs);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
