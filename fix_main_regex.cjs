const fs = require('fs');
let code = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');

code = code.replace(/#\!\[allow\(warnings\)\]/g, '');
code = code.replace(/use perceus_ptr::PerceusPtr;/g, '');
code = code.replace(/pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;/g, '');

const dummyTypes = `
pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;
pub type Control_Monad_ST_Internal_ST = UnknownType;
pub type Control_Monad_ST_Internal_STRef = UnknownType;
pub type Data_Array_ST_STArray = UnknownType;
pub type Data_Unit_Unit = UnknownType;
pub type Data_Lazy_Lazy = UnknownType;
pub type Data_Void_Void = UnknownType;
pub type Data_Exists_Exists = UnknownType;
pub type Data_String_Regex_Regex = UnknownType;
pub type Effect_Effect = UnknownType;
pub type Effect_Exception_Error = UnknownType;
pub type Effect_Ref_Ref = UnknownType;
pub type Foreign_Object_Object = UnknownType;
pub type Foreign_Object_ST_STObject = UnknownType;
`;

let cleanCode = code;
let firstUnsafeCoerce = true;
cleanCode = cleanCode.replace(/pub fn unsafe_coerce<T>\(_: T\) -> UnknownType \{[\s\S]*?\}\n\n/g, (match) => {
    if (firstUnsafeCoerce) { firstUnsafeCoerce = false; return 'pub fn unsafe_coerce<T>(x: T) -> T { x }\n\n'; }
    return '';
});

let firstMkInt = true;
cleanCode = cleanCode.replace(/pub fn mk_int\(val: i64\) -> UnknownType \{[\s\S]*?\}\n\n/g, (match) => {
    if (firstMkInt) { firstMkInt = false; return match; }
    return '';
});

let firstLazyForce = true;
cleanCode = cleanCode.replace(/pub fn Data_Lazy_force\(\) -> crate::UnknownType \{ crate::UnknownType::new\(0\) \}\n/g, (match) => {
    if (firstLazyForce) { firstLazyForce = false; return match; }
    return '';
});

let firstLazyDefer = true;
cleanCode = cleanCode.replace(/pub fn Data_Lazy_defer\(\) -> crate::UnknownType \{ crate::UnknownType::new\(0\) \}\n/g, (match) => {
    if (firstLazyDefer) { firstLazyDefer = false; return match; }
    return '';
});

const parts = cleanCode.split('#[derive(Clone)]\npub struct Record_a {');
let newCode = parts[0];
if (parts.length > 1) {
  // Merge all Record_a fields
  const allFields = new Set();
  for (let i = 1; i < parts.length; i++) {
      const endIdx = parts[i].indexOf('}');
      const fieldsText = parts[i].substring(0, endIdx);
      const fields = fieldsText.split('\n');
      for (const f of fields) {
          if (f.trim().length > 0) allFields.add(f);
      }
  }
  allFields.add("    pub proof: Option<UnknownType>,");
  allFields.add("    pub call: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,");
  let recordA = '#[derive(Clone)]\npub struct Record_a {\n' + Array.from(allFields).join('\n') + '\n}';
  recordA = recordA.replace(/r#mod/g, 'mod_kw')
                 .replace(/r#as/g, 'as_kw')
                 .replace(/r#break/g, 'break_kw')
                 .replace(/r#type/g, 'type_kw')
                 .replace(/r#fn/g, 'fn_kw')
                 .replace(/r#gen/g, 'gen_kw')
                 .replace(/r#pub/g, 'pub_kw')
                 .replace(/r#use/g, 'use_kw');
  newCode += recordA;

  for (let i = 1; i < parts.length; i++) {
    const endIdx = parts[i].indexOf('}');
    let partContent = parts[i].substring(endIdx + 1);
    newCode += partContent;
  }
}

// Fix recursive enums by adding Box
newCode = newCode.replace(/Cons\(UnknownType, Control_Monad_Gen_LL\)/g, 'Cons(UnknownType, Box<Control_Monad_Gen_LL>)');
newCode = newCode.replace(/Append\(Data_Foldable_FreeMonoidTree, Data_Foldable_FreeMonoidTree\)/g, 'Append(Box<Data_Foldable_FreeMonoidTree>, Box<Data_Foldable_FreeMonoidTree>)');
newCode = newCode.replace(/Two\(Data_List_Internal_Set, UnknownType, Data_List_Internal_Set\)/g, 'Two(Box<Data_List_Internal_Set>, UnknownType, Box<Data_List_Internal_Set>)');
newCode = newCode.replace(/Cons\(UnknownType, Data_List_Types_List\)/g, 'Cons(UnknownType, Box<Data_List_Types_List>)');

newCode = newCode.replace(/pub fn main\(\)/g, (match, offset, str) => {
  return offset === str.indexOf('pub fn main()') ? match : 'pub fn main_RENAMED()';
});

function wrapArgWithBox(code, enumVariant, argIndices) {
    let searchStr = enumVariant + "(";
    let idx = 0;
    while ((idx = code.indexOf(searchStr, idx)) !== -1) {
        let startParen = idx + searchStr.length;
        let pCount = 1;
        let endParen = startParen;
        while (pCount > 0 && endParen < code.length) {
            if (code[endParen] === '(') pCount++;
            if (code[endParen] === ')') pCount--;
            endParen++;
        }
        let inside = code.substring(startParen, endParen - 1);
        if (inside.includes('..')) {
            idx = endParen;
            continue;
        }

        let args = [];
        let currentArgStart = startParen;
        let depth = 0;
        for (let i = startParen; i < endParen - 1; i++) {
            if (code[i] === '(' || code[i] === '{' || code[i] === '[') depth++;
            if (code[i] === ')' || code[i] === '}' || code[i] === ']') depth--;
            if (code[i] === ',' && depth === 0) {
                args.push(code.substring(currentArgStart, i));
                currentArgStart = i + 1;
            }
        }
        args.push(code.substring(currentArgStart, endParen - 1));

        for (let argIndex of argIndices) {
            if (argIndex < args.length) {
                args[argIndex] = ' Box::new(' + args[argIndex].trim() + ')';
            }
        }

        let replaced = searchStr + args.join(',') + ')';
        code = code.substring(0, idx) + replaced + code.substring(endParen);
        idx = idx + replaced.length;
    }
    return code;
}

newCode = wrapArgWithBox(newCode, 'Control_Monad_Gen_LL::Cons', [1]);
newCode = wrapArgWithBox(newCode, 'Data_Foldable_FreeMonoidTree::Append', [0, 1]);
newCode = wrapArgWithBox(newCode, 'Data_List_Internal_Set::Two', [0, 2]);
newCode = wrapArgWithBox(newCode, 'Data_List_Internal_Set::Three', [0, 2, 4]);
newCode = wrapArgWithBox(newCode, 'Data_List_Types_List::Cons', [1]);
newCode = wrapArgWithBox(newCode, 'Data_Tree_Tree::Node', [0, 2]);

newCode = newCode.replace(/Three\(Data_List_Internal_Set, UnknownType, Data_List_Internal_Set, UnknownType, Data_List_Internal_Set\)/g, 'Three(Box<Data_List_Internal_Set>, UnknownType, Box<Data_List_Internal_Set>, UnknownType, Box<Data_List_Internal_Set>)');

newCode = '#![allow(warnings)]\nuse perceus_ptr::PerceusPtr;\n' + dummyTypes + '\n' + newCode;

fs.writeFileSync('tests/runner/output-test/app/src/main.rs', newCode);
