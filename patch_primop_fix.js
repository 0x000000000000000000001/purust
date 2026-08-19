import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// The replacement added:
//       OpStringAppend -> "format!(\\"{}{}\\", " <> aStrStr <> ", " <> bStrStr <> ")"
//       _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */"
// and then the rest of the old block was left.
// Let's remove from `      OpArrayIndex -> "(" <> aStr <> ").init_array.as_ref()` to `      _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */"`

code = code.replace(/      OpArrayIndex -> "\(" <> aStr <> "\).init_array.as_ref\(\).unwrap\(\)\[\("\s*<>\s*bStr\s*<>\s*"\).init_int.unwrap\(\) as usize\].clone\(\)"\n(?:.*?\n)+?      _ -> "{ let _t: crate::UnknownType = unimplemented!\(\); _t } \/\* Unsupported Op2 \*\/"\n/, '');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
