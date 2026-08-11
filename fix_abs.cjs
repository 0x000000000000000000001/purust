const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regex = /  Abs params body -> \n    let\n      paramsArr = map \(\\\(Tuple mbId lvl\) -> case mbId of\n        Just \(Ident n\) -> sanitizeIdent n\n        Nothing -> "lvl_" <> show \(unwrap lvl\)\) \(NonEmptyArray\.toArray params\)\n      paramsCode = String\.joinWith ", " \(map \(\\p -> \(if p == "_" then "" else "mut "\) <> p <> ": UnknownType"\) paramsArr\)\n      bodyVars = freeVariables body\n      capturedVars = let \n          unfiltered = Array\.fromFoldable bodyVars :: Array String\n          filtered = Array\.filter \(\\v -> not \(Map\.member v aritiesMap\) && not \(Set\.member v allZeroArity\) && not \(Array\.elem v paramsArr\)\) unfiltered\n        in filtered\n      clones = String\.joinWith "" \(map \(\\v -> "    let mut " <> v <> " = " <> v <> "\.clone\(\);\\n"\) capturedVars\)\n      drops = String\.joinWith "" \(map \(\\p -> if p \/= "_" && not \(Set\.member p bodyVars\) then "    " <> p <> "\.drop_explicit\(\);\\n" else ""\) paramsArr\)\n    in "perceus_ptr::PerceusPtr::new\(Record_a { call: Some\(std::rc::Rc::new\(move |" <> paramsCode <> "| -> UnknownType {\\n" <>\n       clones <> drops <>\n       "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound Set\.empty body <> "\\n" <>\n       "    }\)\), \.\.Default::default\(\) }\)"/;

const replacement = `  Abs params body -> 
    let
      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
      bodyVars = freeVariables body
      
      generateNested :: Array String -> String
      generateNested arr = 
        if Array.null arr then
          "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound Set.empty body <> "\\n"
        else
          let p = Partial.Unsafe.unsafePartial (Array.unsafeIndex arr 0)
              rest = Array.drop 1 arr
              pCode = (if p == "_" then "" else "mut ") <> p <> ": UnknownType"
              
              freeInRest = Set.difference bodyVars (Set.fromFoldable rest)
              captured = Array.filter (\\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity) && v /= p && Set.member v freeInRest) (Array.fromFoldable freeInRest)
              
              clonesCode = String.joinWith "" (map (\\v -> "    let mut " <> v <> " = " <> v <> ".clone();\\n") captured)
              dropsCode = if Array.length rest == 0 then 
                            String.joinWith "" (map (\\px -> if px /= "_" && not (Set.member px bodyVars) then "    " <> px <> ".drop_explicit();\\n" else "") paramsArr)
                          else ""
              
              innerCode = generateNested rest
          in "perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |" <> pCode <> "| -> UnknownType {\\n" <>
             clonesCode <> dropsCode <>
             innerCode <>
             "    })), ..Default::default() })"
    in generateNested paramsArr`;

if (!code.match(regex)) {
    console.error("Could not find Abs regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Successfully replaced Abs codegen!");
