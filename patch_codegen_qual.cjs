const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Replace CtorSaturated
code = code.replace(
    /CtorSaturated _ _ \(ProperName tyNameStr\) \(Ident ctorName\) fields ->\s*let\s*fieldsCode = \(/,
    `CtorSaturated (Qualified mbMod _) _ (ProperName tyNameStr) (Ident ctorName) fields ->
    let
      modPrefix = case mbMod of
        Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
        Nothing -> ""
      fullTyName = modPrefix <> tyNameStr
      fieldsCode = (`
);
code = code.replace(
    /in "std::rc::Rc::new\(" <> tyNameStr <> "::" <> ctorName <> fieldsCode <> "\)"/,
    `in "std::rc::Rc::new(" <> fullTyName <> "::" <> ctorName <> fieldsCode <> ")"`
);

// Replace GetCtorField
code = code.replace(
    /Accessor base \(GetCtorField qId ctorType \(ProperName tyNameStr\) \(Ident ctorName\) propName fieldIdx\) ->\s*let\s*baseStr = codegenExpr currentMod/,
    `Accessor base (GetCtorField (Qualified mbMod _) ctorType (ProperName tyNameStr) (Ident ctorName) propName fieldIdx) ->
    let
      modPrefix = case mbMod of
        Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
        Nothing -> ""
      fullTyName = modPrefix <> tyNameStr
      baseStr = codegenExpr currentMod`
);
code = code.replace(
    /in "\(match &\*" <> baseStr <> " \{ " <> tyNameStr <> "::" <> ctorName <> "\(" <> prefix <> "val, \.\.\) => val\.clone\(\), _ => unimplemented!\(\) \}\)"/,
    `in "(match &*" <> baseStr <> " { " <> fullTyName <> "::" <> ctorName <> "(" <> prefix <> "val, ..) => val.clone(), _ => unimplemented!() })"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
