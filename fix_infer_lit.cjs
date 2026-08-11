const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const replacement = `  Let (Just (Ident i)) _ val body -> inferTypeExpr currentMod aritiesMap (Map.insert (sanitizeIdent i) (inferTypeExpr currentMod aritiesMap bound val) bound) body
  Lit (LitInt _) -> Int
  Lit (LitNumber _) -> Number
  Lit (LitString _) -> String
  Lit (LitChar _) -> String
  Lit (LitBoolean _) -> Boolean
  _ -> Any`;

code = code.replace("  Let (Just (Ident i)) _ val body -> inferTypeExpr currentMod aritiesMap (Map.insert (sanitizeIdent i) (inferTypeExpr currentMod aritiesMap bound val) bound) body\n  _ -> Any", replacement);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Fixed inferTypeExpr for Lit");
