const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regex = /  Abs params body -> \n    let\n      paramsArr = map \(\\\(Tuple mbId lvl\) -> case mbId of\n        Just \(Ident n\) -> sanitizeIdent n\n        Nothing -> "lvl_" <> show \(unwrap lvl\)\) \(NonEmptyArray\.toArray params\)\n      paramsCode = String\.joinWith ", " \(map \(\\p -> \(if p == "_" then "" else "mut "\) <> p <> ": UnknownType"\) paramsArr\)\n      bodyVars = freeVariables body\n      capturedVars = let \n          unfiltered = Array\.fromFoldable bodyVars :: Array String\n          filtered = Array\.filter \(\\v -> not \(Map\.member v aritiesMap\) && not \(Set\.member v allZeroArity\) && not \(Array\.elem v paramsArr\)\) unfiltered\n        in filtered\n      capturedCode = String\.joinWith "\\n" \(map \(\\v -> "        let " <> v <> " = " <> \(if Set\.member v alive then v <> "\.clone\(\)" else v\) <> ";"\) capturedVars\)\n      \n      bodyCode = codegenExpr currentMod allZeroArity allMacroBindings Nothing aritiesMap bound Set\.empty body\n    in "perceus_ptr::PerceusPtr::new\(Record_a { call: Some\(std::rc::Rc::new\(move |" <> paramsCode <> "| -> UnknownType {\\n" <>\n       \(if String\.length capturedCode > 0 then capturedCode <> "\\n" else ""\) <>\n      "        " <> bodyCode <> "\\n" <>\n      "    }\)\), \.\.Default::default\(\) }\)"/;

const replacement = `  Abs params body -> 
    let
      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
      bodyVars = freeVariables body
      capturedVars = let 
          unfiltered = Array.fromFoldable bodyVars :: Array String
          filtered = Array.filter (\\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity) && not (Array.elem v paramsArr)) unfiltered
        in filtered
      capturedCode = String.joinWith "\\n" (map (\\v -> "        let " <> v <> " = " <> (if Set.member v alive then v <> ".clone()" else v) <> ";") capturedVars)
      
      bodyCode = codegenExpr currentMod allZeroArity allMacroBindings Nothing aritiesMap bound Set.empty body
      
      -- Generate nested closures
      generateNested = \\pCode innerCode -> 
        "perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |" <> pCode <> "| -> UnknownType {\\n" <>
        "        " <> innerCode <> "\\n" <>
        "    })), ..Default::default() })"
        
      nestedCode = Array.foldr (\\p inner -> 
          let pCode = (if p == "_" then "" else "mut ") <> p <> ": UnknownType"
          in generateNested pCode inner
        ) bodyCode paramsArr
    in (if String.length capturedCode > 0 then "{\\n" <> capturedCode <> "\\n        " <> nestedCode <> "\\n    }" else nestedCode)`;

if (!code.match(regex)) {
    console.error("Could not find Abs regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Successfully replaced Abs codegen!");
