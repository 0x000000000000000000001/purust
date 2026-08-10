const fs = require('fs');
let code = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');

code = code.replace(/#\!\[allow\(warnings\)\]/g, '');
code = code.replace(/use perceus_ptr::PerceusPtr;/g, '');
code = code.replace(/pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;/g, '');

const dummyTypes = `
pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;
pub type Control_Monad_ST_Internal_ST = UnknownType;
pub type Data_Array_ST_STArray = UnknownType;
pub type Data_Unit_Unit = UnknownType;
pub type Data_Lazy_Lazy = UnknownType;
pub type Effect_Effect = UnknownType;
`;

const parts = code.split('#[derive(Clone)]\npub struct Record_a {');
let newCode = parts[0];
if (parts.length > 1) {
  const structContentEndIdx = parts[1].indexOf('}');
  const structContent = parts[1].substring(0, structContentEndIdx);
  let recordA = '#[derive(Clone)]\npub struct Record_a {' + structContent + '}';
  
  recordA = recordA.replace(/r#mod/g, 'mod_kw')
                 .replace(/r#as/g, 'as_kw')
                 .replace(/r#break/g, 'break_kw')
                 .replace(/r#type/g, 'type_kw')
                 .replace(/r#fn/g, 'fn_kw')
                 .replace(/r#gen/g, 'gen_kw')
                 .replace(/r#pub/g, 'pub_kw')
                 .replace(/r#use/g, 'use_kw');

  newCode += recordA + parts[1].substring(structContentEndIdx + 1);

  for (let i = 2; i < parts.length; i++) {
    const endIdx = parts[i].indexOf('}');
    // Remove unsafe_coerce and mk_int from subsequent parts (they are on a single line)
    let partContent = parts[i].substring(endIdx + 1);
    partContent = partContent.replace(/pub fn unsafe_coerce<T>\(_: T\) -> UnknownType \{.*\}\n*/g, '');
    partContent = partContent.replace(/pub fn mk_int\(val: i64\) -> UnknownType \{.*\}\n*/g, '');
    newCode += partContent;
  }
}

newCode = newCode.replace(/pub fn main\(\)/g, (match, offset, str) => {
  return offset === str.indexOf('pub fn main()') ? match : 'pub fn main_RENAMED()';
});

newCode = '#![allow(warnings)]\nuse perceus_ptr::PerceusPtr;\n' + dummyTypes + '\n' + newCode;

fs.writeFileSync('tests/runner/output-test/app/src/main.rs', newCode);
