import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '"pub fn mk_bool(val: bool) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_bool: Some(val), ..Default::default() }) }\\n" <>',
    `"pub fn mk_bool(val: bool) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_bool: Some(val), ..Default::default() }) }\\n" <>
  "pub fn mk_char(val: char) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_char: Some(val), ..Default::default() }) }\\n" <>`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
