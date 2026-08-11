const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Fix CtorDef
code = code.replace(
  'CtorDef _ _ _ _ -> "unsafe_coerce(0)"',
  'CtorDef _ _ _ _ -> "perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, proof: None, call: None })"'
);

// Fix codegenBindingGroup
code = code.replace(
  `let fnCode = codegenExpr modNameStr allZeroArity allMacroBindings mbLoop aritiesMap (Map.union bound aritiesMap) Set.empty innerExpr
                       argsCode = String.joinWith ", " (map (\\p -> sanitizeIdent p <> ".clone()") deduped)
                   in "(" <> fnCode <> ")(" <> argsCode <> ")"`,
  `let fnCode = codegenExpr modNameStr allZeroArity allMacroBindings mbLoop aritiesMap (Map.union bound aritiesMap) Set.empty innerExpr
                       argsCodeArray = map (\\p -> sanitizeIdent p <> ".clone()") deduped
                   in Array.foldl (\\acc argCode -> "(" <> acc <> ").call.clone().unwrap()(" <> argCode <> ")") fnCode argsCodeArray`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
