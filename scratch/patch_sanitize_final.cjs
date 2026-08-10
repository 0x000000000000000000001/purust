const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const newSanitize = `sanitizeIdent :: String -> String
sanitizeIdent s = 
  let s1 = String.replaceAll (Pattern "'") (Replacement "_prime") s
      s2 = String.replaceAll (Pattern "$") (Replacement "_dollar_") s1
  in if s2 == "type" then "type_kw" 
     else if s2 == "fn" then "fn_kw" 
     else if s2 == "break" then "break_kw"
     else if s2 == "mod" then "mod_kw"
     else if s2 == "as" then "as_kw"
     else if s2 == "gen" then "gen_kw"
     else if s2 == "use" then "use_kw"
     else if s2 == "pub" then "pub_kw"
     else if s2 == "ref" then "ref_kw"
     else if s2 == "mut" then "mut_kw"
     else if s2 == "move" then "move_kw"
     else if s2 == "match" then "match_kw"
     else if s2 == "loop" then "loop_kw"
     else s2`;

code = code.replace(/sanitizeIdent :: String -> String[\s\S]+?else s2/, newSanitize);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
