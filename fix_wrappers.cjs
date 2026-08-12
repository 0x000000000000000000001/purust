const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// 1. Add mk_bool, mk_number, mk_string, mk_char, mk_array to preamble
const preambleTarget = `"pub fn mk_int(val: i64) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: val, ..Default::default() }) }\\n\\n" <>`;
const preambleReplacement = `"pub fn mk_int(val: i64) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: val, ..Default::default() }) }\\n" <>
    "pub fn mk_bool(val: bool) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_bool: Some(val), ..Default::default() }) }\\n" <>
    "pub fn mk_number(val: f64) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_number: Some(val), ..Default::default() }) }\\n" <>
    "pub fn mk_string(val: &'static str) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_string: Some(val), ..Default::default() }) }\\n" <>
    "pub fn mk_char(val: char) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_char: Some(val), ..Default::default() }) }\\n" <>
    "pub fn mk_array(val: Vec<UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_array: Some(std::rc::Rc::new(val)), ..Default::default() }) }\\n\\n" <>`;

code = code.replace(preambleTarget, preambleReplacement);

// 2. Fix literals
code = code.replace(/    LitNumber n -> show n <> " \/\* f64 \*\/"/, `    LitNumber n -> "crate::mk_number(" <> show n <> ")"`);
code = code.replace(/    LitString s -> "unsafe_coerce\\(r#\\"" <> s <> "\\"#\\)"/, `    LitString s -> "crate::mk_string(r#\\"" <> s <> "\\"#)"`);
code = code.replace(/    LitChar c -> show c/, `    LitChar c -> "crate::mk_char(" <> show c <> ")"`);
code = code.replace(/    LitBoolean b -> if b then "true" else "false"/, `    LitBoolean b -> if b then "crate::mk_bool(true)" else "crate::mk_bool(false)"`);
code = code.replace(/      in "vec!\[" <> String.joinWith ", " arrCode <> "\]"/, `      in "crate::mk_array(vec![" <> String.joinWith ", " arrCode <> "])"`);

// 3. Fix PrimOp returning booleans to use mk_bool
code = code.replace(/      OpIntOrd OpEq -> "\\(\\(" <> aStr <> "\\)\\.a == \\(" <> bStr <> "\\)\\.a\\)"/, `      OpIntOrd OpEq -> "crate::mk_bool((" <> aStr <> ").a == (" <> bStr <> ").a)"`);
code = code.replace(/      OpIntOrd OpNotEq -> "\\(" <> aStr <> " != " <> bStr <> "\\)"/, `      OpIntOrd OpNotEq -> "crate::mk_bool(" <> aStr <> " != " <> bStr <> ")"`);
code = code.replace(/      OpIntOrd OpGt -> "\\(" <> aStr <> " > " <> bStr <> "\\)"/, `      OpIntOrd OpGt -> "crate::mk_bool(" <> aStr <> " > " <> bStr <> ")"`);
code = code.replace(/      OpIntOrd OpGte -> "\\(" <> aStr <> " >= " <> bStr <> "\\)"/, `      OpIntOrd OpGte -> "crate::mk_bool(" <> aStr <> " >= " <> bStr <> ")"`);
code = code.replace(/      OpIntOrd OpLt -> "\\(" <> aStr <> " < " <> bStr <> "\\)"/, `      OpIntOrd OpLt -> "crate::mk_bool(" <> aStr <> " < " <> bStr <> ")"`);
code = code.replace(/      OpIntOrd OpLte -> "\\(" <> aStr <> " <= " <> bStr <> "\\)"/, `      OpIntOrd OpLte -> "crate::mk_bool(" <> aStr <> " <= " <> bStr <> ")"`);
code = code.replace(/      OpNumberOrd OpEq -> "\\(\\(" <> aStr <> "\\) == \\(" <> bStr <> "\\)\\)"/, `      OpNumberOrd OpEq -> "crate::mk_bool((" <> aStr <> ") == (" <> bStr <> "))"`);
code = code.replace(/      OpNumberOrd OpNotEq -> "\\(\\(" <> aStr <> "\\) != \\(" <> bStr <> "\\)\\)"/, `      OpNumberOrd OpNotEq -> "crate::mk_bool((" <> aStr <> ") != (" <> bStr <> "))"`);
code = code.replace(/      OpNumberOrd OpLt -> "\\(\\(" <> aStr <> "\\) < \\(" <> bStr <> "\\)\\)"/, `      OpNumberOrd OpLt -> "crate::mk_bool((" <> aStr <> ") < (" <> bStr <> "))"`);
code = code.replace(/      OpNumberOrd OpLte -> "\\(\\(" <> aStr <> "\\) <= \\(" <> bStr <> "\\)\\)"/, `      OpNumberOrd OpLte -> "crate::mk_bool((" <> aStr <> ") <= (" <> bStr <> "))"`);
code = code.replace(/      OpNumberOrd OpGt -> "\\(\\(" <> aStr <> "\\) > \\(" <> bStr <> "\\)\\)"/, `      OpNumberOrd OpGt -> "crate::mk_bool((" <> aStr <> ") > (" <> bStr <> "))"`);
code = code.replace(/      OpNumberOrd OpGte -> "\\(\\(" <> aStr <> "\\) >= \\(" <> bStr <> "\\)\\)"/, `      OpNumberOrd OpGte -> "crate::mk_bool((" <> aStr <> ") >= (" <> bStr <> "))"`);
code = code.replace(/      OpStringOrd OpEq -> "\\(\\(" <> aStr <> "\\) == \\(" <> bStr <> "\\)\\)"/, `      OpStringOrd OpEq -> "crate::mk_bool((" <> aStr <> ") == (" <> bStr <> "))"`);
code = code.replace(/      OpStringOrd OpNotEq -> "\\(\\(" <> aStr <> "\\) != \\(" <> bStr <> "\\)\\)"/, `      OpStringOrd OpNotEq -> "crate::mk_bool((" <> aStr <> ") != (" <> bStr <> "))"`);
code = code.replace(/      OpCharOrd OpEq -> "\\(\\(" <> aStr <> "\\) == \\(" <> bStr <> "\\)\\)"/, `      OpCharOrd OpEq -> "crate::mk_bool((" <> aStr <> ") == (" <> bStr <> "))"`);
code = code.replace(/      OpCharOrd OpNotEq -> "\\(\\(" <> aStr <> "\\) != \\(" <> bStr <> "\\)\\)"/, `      OpCharOrd OpNotEq -> "crate::mk_bool((" <> aStr <> ") != (" <> bStr <> "))"`);
code = code.replace(/      OpBooleanOrd OpEq -> "\\(\\(" <> aStr <> "\\) == \\(" <> bStr <> "\\)\\)"/, `      OpBooleanOrd OpEq -> "crate::mk_bool((" <> aStr <> ") == (" <> bStr <> "))"`);
code = code.replace(/      OpBooleanOrd OpNotEq -> "\\(\\(" <> aStr <> "\\) != \\(" <> bStr <> "\\)\\)"/, `      OpBooleanOrd OpNotEq -> "crate::mk_bool((" <> aStr <> ") != (" <> bStr <> "))"`);
code = code.replace(/      OpBooleanAnd -> "\\(" <> aStr <> " && " <> bStr <> "\\)"/, `      OpBooleanAnd -> "crate::mk_bool(" <> aStr <> " && " <> bStr <> ")"`);
code = code.replace(/      OpBooleanOr -> "\\(" <> aStr <> " || " <> bStr <> "\\)"/, `      OpBooleanOr -> "crate::mk_bool(" <> aStr <> " || " <> bStr <> ")"`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
