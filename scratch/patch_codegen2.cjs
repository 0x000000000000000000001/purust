const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// 1. Add getTyPrefix helper
const getTyPrefixCode = `
getTyPrefix :: forall a. String -> Qualified a -> String
getTyPrefix currentMod (Qualified mbMod _) = case mbMod of
  Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
  Nothing -> String.replaceAll (Pattern ".") (Replacement "_") currentMod <> "_"
`;
code = code.replace(/codegenExpr :: String ->/, getTyPrefixCode + '\ncodegenExpr :: String ->');

// 2. Fix codegenDataDecl
code = code.replace(/"\/\/ Enum for ADT: " <> decl\.typeName <> "\\n" <>\n\s*"#\[derive\(Clone\)\]\\npub enum " <> decl\.typeName <> " \{\\n"/,
`"// Enum for ADT: " <> decl.typeName <> "\\n" <>
        "#[derive(Clone)]\\npub enum " <> String.replaceAll (Pattern ".") (Replacement "_") (unwrap backendMod.name) <> "_" <> decl.typeName <> " {\\n"`);

// 3. Fix codegenExprType
code = code.replace(/ADT name _ -> Array\.last name # fromMaybe "UnknownType"/,
`ADT name _ -> String.joinWith "_" name`);

// 4. Fix CtorSaturated
code = code.replace(/CtorSaturated _ _ \(ProperName tyNameStr\) \(Ident ctorName\) fields ->/g,
`CtorSaturated qId _ (ProperName tyNameStr) (Ident ctorName) fields ->`);
code = code.replace(/in tyNameStr <> "::" <> ctorName <> fieldsCode/g,
`let fullTyName = getTyPrefix currentMod qId <> tyNameStr
    in fullTyName <> "::" <> ctorName <> fieldsCode`);

// 5. Fix GetCtorField
code = code.replace(/Accessor base \(GetCtorField qId ctorType \(ProperName tyNameStr\) \(Ident ctorName\) propName fieldIdx\) ->/,
`Accessor base (GetCtorField qId ctorType (ProperName tyNameStr) (Ident ctorName) propName fieldIdx) ->`);
code = code.replace(/in "\(match " <> baseStr <> " \{ " <> tyNameStr <> "::" <> ctorName <> "\(" <> prefix <> "val, \.\.\) => val, _ => unimplemented\!\(\) \}\)"/,
`let fullTyName = getTyPrefix currentMod qId <> tyNameStr
    in "(match " <> baseStr <> " { " <> fullTyName <> "::" <> ctorName <> "(" <> prefix <> "val, ..) => val, _ => unimplemented!() })"`);

// 6. Fix CtorDef
code = code.replace(/CtorDef _ \(ProperName tyNameStr\) \(Ident ctorName\) fields ->/g,
`CtorDef qId (ProperName tyNameStr) (Ident ctorName) fields ->`);
code = code.replace(/modPrefix = String\.replaceAll \(Pattern "\."\) \(Replacement "_"\) currentMod <> "_"/g,
`modPrefix = getTyPrefix currentMod qId`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
