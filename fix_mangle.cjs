const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// 1. Mangle LitRecord
const litRecordRegex = /Lit \(LitRecord props\) ->\n      let fields = String\.joinWith ", " \(map \(\\\(Prop k v\) -> sanitizeIdent k <> ": Some\(" <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound Set\.empty v <> "\)"\) props\)/;
const litRecordReplacement = `Lit (LitRecord props) ->
      let fields = String.joinWith ", " (map (\\(Prop k v) -> 
            let ty = inferTypeExpr currentMod aritiesMap bound v
                suffix = case ty of
                  Boolean -> "_bool"
                  Int -> "_i64"
                  Number -> "_f64"
                  String -> "_str"
                  _ -> ""
            in sanitizeIdent k <> suffix <> ": Some(" <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound Set.empty v <> ")") props)`;

code = code.replace(litRecordRegex, litRecordReplacement);

// 2. Mangle Accessor
const accessorRegex = /Accessor base \(GetProp k\) -> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive base <> "\." <> sanitizeIdent k <> "\.clone\(\)\.unwrap\(\)/;
const accessorReplacement = `Accessor base (GetProp k) -> 
    let ty = inferTypeExpr currentMod aritiesMap bound (NeutralExpr expr)
        suffix = case ty of
          Boolean -> "_bool"
          Int -> "_i64"
          Number -> "_f64"
          String -> "_str"
          _ -> ""
    in codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive base <> "." <> sanitizeIdent k <> suffix <> ".clone().unwrap()`;

code = code.replace(accessorRegex, accessorReplacement);

// 3. Mangle Update
const updateRegex = /propsCode = map \(\\\(Prop k v\) -> "_mut\." <> k <> " = Some\(std::rc::Rc::new\(\\|_\\| " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive v <> "\)\);"\) props/;
const updateReplacement = `propsCode = map (\\(Prop k v) -> 
          let ty = inferTypeExpr currentMod aritiesMap bound v
              suffix = case ty of
                Boolean -> "_bool"
                Int -> "_i64"
                Number -> "_f64"
                String -> "_str"
                _ -> ""
          in "_mut." <> k <> suffix <> " = Some(std::rc::Rc::new(|_| " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive v <> "));") props`;

code = code.replace(updateRegex, updateReplacement);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Mangled primitives in records!");
