const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const letRecImpl = `
  LetRec _ binds body ->
    let
      bindsArray = NonEmptyArray.toArray binds
      
      declCode = String.joinWith "\\n    " (map (\\(Tuple (Ident n) _) -> 
          "let mut " <> sanitizeIdent n <> " = perceus_ptr::PerceusPtr::new(Record_a { ..Default::default() });"
        ) bindsArray)
      
      evalCode = String.joinWith "\\n    " (map (\\(Tuple (Ident n) val) -> 
          let clonesCode = String.joinWith "\\n        " (map (\\(Tuple (Ident cn) _) -> 
                  "let mut " <> sanitizeIdent cn <> " = " <> sanitizeIdent cn <> ".clone();"
                ) bindsArray)
              aliveForVal = Set.union alive (Array.foldl (\\acc (Tuple (Ident bn) _) -> Set.insert (sanitizeIdent bn) acc) Set.empty bindsArray)
              valCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForVal val
          in "let val_" <> sanitizeIdent n <> " = {\\n        " <> clonesCode <> "\\n        " <> valCode <> "\\n    };"
        ) bindsArray)
        
      mutCode = String.joinWith "\\n    " (map (\\(Tuple (Ident n) _) -> 
          "*perceus_ptr::PerceusPtr::make_mut(&mut " <> sanitizeIdent n <> ") = (*val_" <> sanitizeIdent n <> ").clone();"
        ) bindsArray)
        
      bodyCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive body
    in "{\\n    " <> declCode <> "\\n    " <> evalCode <> "\\n    " <> mutCode <> "\\n    " <> bodyCode <> "\\n}"
`;

code = code.replace(/  CtorDef _ _ \(Ident ctorName\) _ -> "perceus_ptr::PerceusPtr::new\(Record_a \{ tag: \\"" <> ctorName <> "\\", \.\.Default::default\(\) \}\)"\n  _ -> "unimplemented!\(\) \/\* Unsupported Expr: " <> printAST \(NeutralExpr expr\) <> " \*\/"/, 
  '  CtorDef _ _ (Ident ctorName) _ -> "perceus_ptr::PerceusPtr::new(Record_a { tag: \\"" <> ctorName <> "\\", ..Default::default() })"\n' +
  letRecImpl + 
  '\n  _ -> "unimplemented!() /* Unsupported Expr: " <> printAST (NeutralExpr expr) <> " */"');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
