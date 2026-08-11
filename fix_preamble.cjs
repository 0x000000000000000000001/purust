const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regex = /"pub fn mk_int\\(val: i64\\) -> UnknownType \{ perceus_ptr::PerceusPtr::new\\(Record_a \{ a: val, \.\.Default::default\(\) \}\\) \}\\n\\n" <>/;
const replacement = `"pub fn mk_int(val: i64) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: val, ..Default::default() }) }\\n" <>
    "pub fn mk_bool(val: bool) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_bool: Some(val), ..Default::default() }) }\\n" <>
    "pub fn mk_f64(val: f64) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_f64: Some(val), ..Default::default() }) }\\n" <>
    "pub fn mk_str(val: &'static str) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { init_str: Some(val), ..Default::default() }) }\\n\\n" <>`;

if (!code.match(regex)) {
    console.error("Could not find mk_int regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Fixed mk_* functions in preamble");
