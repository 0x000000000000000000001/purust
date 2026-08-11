const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const replacement = `  Abs params body -> 
    let
      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
      bodyVars = freeVariables body
      
      generateNested :: Array String -> String
      generateNested arr = 
        case Array.uncons arr of
          Nothing -> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForBody body
          Just { head, tail } -> 
            let
               aliveForBody = Set.union alive bodyVars
               freeInRest = Set.difference bodyVars (Set.fromFoldable tail)
               clonesCode = String.joinWith "" $ map (\\vName ->
                 let v = sanitizeIdent vName in
                 if v == "_" then "" else "    let mut " <> v <> " = " <> v <> ".clone(); /* alive=" <> String.joinWith "," (Set.toUnfoldable alive :: Array String) <> ", bodyVars=" <> String.joinWith "," (Set.toUnfoldable bodyVars :: Array String) <> " */\\n") (Set.toUnfoldable (Set.filter (\\vName -> 
                   let v = sanitizeIdent vName in
                   not (Map.member v aritiesMap) && not (Set.member v allZeroArity) && v /= head && Set.member v freeInRest) (Set.union alive bodyVars)) :: Array String)
`;

code = code.replace(`  Abs params body -> \n    let\n      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of\n        Just (Ident n) -> sanitizeIdent n\n        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)\n      bodyVars = freeVariables body\n      \n      generateNested :: Array String -> String\n      generateNested arr = \n        case Array.uncons arr of\n          Nothing -> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForBody body\n          Just { head, tail } -> \n            let\n               aliveForBody = Set.union alive bodyVars\n               freeInRest = Set.difference bodyVars (Set.fromFoldable tail)\n               clonesCode = String.joinWith "" $ map (\\vName ->\n                 let v = sanitizeIdent vName in\n                 if v == "_" then "" else "    let mut " <> v <> " = " <> v <> ".clone();\\n") (Set.toUnfoldable (Set.filter (\\vName -> \n                   let v = sanitizeIdent vName in\n                   not (Map.member v aritiesMap) && not (Set.member v allZeroArity) && v /= head && Set.member v freeInRest) (Set.union alive bodyVars)) :: Array String)\n`, replacement);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
