const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
  'in "unsafe_coerce(std::rc::Rc::new(move |" <> paramsCode <> "| -> UnknownType {\\n" <>',
  'in "perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, proof: None, call: Some(std::rc::Rc::new(move |" <> paramsCode <> "| -> UnknownType {\\n" <>'
);
code = code.replace(
  '"}))"',
  '"})) })"'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
