const fs = require('fs');

const log = fs.readFileSync('/Users/0x1/.gemini/antigravity-ide/brain/c2c3b212-770d-4c77-aca0-82ec3eca0193/.system_generated/tasks/task-1134.log', 'utf8');
const regex = /error\[E0425\]: cannot find function, tuple struct or tuple variant \`([A-Za-z0-9_]+)\`/g;

let missing = new Set();
let match;
while ((match = regex.exec(log)) !== null) {
  missing.add(match[1]);
}

const pkgMap = {
  'Effect_Exception': 'purust-exceptions/src/Effect/Exception.rs',
  'Effect_Ref': 'purust-refs/src/Effect/Ref.rs',
  'Data_Show': 'purust-prelude/src/Data/Show.rs',
  'Control_Monad_ST_Internal': 'purust-st/src/Control/Monad/ST/Internal.rs',
  'Data_String_CodePoints': 'purust-strings/src/Data/String/CodePoints.rs',
  'Data_String_CodeUnits': 'purust-strings/src/Data/String/CodeUnits.rs',
  'Data_String_Common': 'purust-strings/src/Data/String/Common.rs',
  'Data_String_Regex': 'purust-strings/src/Data/String/Regex.rs',
  'Data_String_Unsafe': 'purust-strings/src/Data/String/Unsafe.rs',
  'Data_Symbol': 'purust-prelude/src/Type/Data/Symbol.rs',
  'Effect_Console': 'purust-console/src/Effect/Console.rs',
  'Effect_Unsafe': 'purust-effect/src/Effect/Unsafe.rs',
  'Record_Unsafe_Union': 'purust-record/src/Record/Unsafe/Union.rs',
  'Record_Unsafe': 'purust-record/src/Record/Unsafe.rs',
  'Record_Builder': 'purust-record/src/Record/Builder.rs',
  'Unsafe_Coerce': 'purust-unsafe-coerce/src/Unsafe/Coerce.rs',
  'Test_Assert': 'purust-assert/src/Test/Assert.rs',
  'Data_Array_ST_Iterator': 'purust-arrays/src/Data/Array/ST/Iterator.rs',
  'Data_Array_NonEmpty_Internal': 'purust-arrays/src/Data/Array/NonEmpty/Internal.rs',
  'Data_Array_ST': 'purust-arrays/src/Data/Array/ST.rs',
  'Data_Array': 'purust-arrays/src/Data/Array.rs',
  'Math': 'purust-math/src/Math.rs',
  'Data_Int': 'purust-integers/src/Data/Int.rs',
  'Data_Number_Format': 'purust-numbers/src/Data/Number/Format.rs',
  'Data_Ord_Unsafe': 'purust-prelude/src/Data/Ord/Unsafe.rs',
  'Data_Ord': 'purust-prelude/src/Data/Ord.rs',
  'Partial_Unsafe': 'purust-partial/src/Partial/Unsafe.rs',
  'Data_Function_Uncurried': 'purust-functions/src/Data/Function/Uncurried.rs',
  'Data_Lazy': 'purust-lazy/src/Data/Lazy.rs'
};

function getFileForFunc(funcName) {
  for (let prefix of Object.keys(pkgMap).sort((a,b) => b.length - a.length)) {
    if (funcName.startsWith(prefix)) {
      return pkgMap[prefix];
    }
  }
  return null;
}

let files = {};

for (let func of missing) {
  let f = getFileForFunc(func);
  if (f) {
    if (!files[f]) files[f] = [];
    files[f].push(`pub fn ${func}() -> crate::UnknownType { crate::mk_int(0) }`);
  } else {
    console.log("Unknown prefix for: " + func);
  }
}

for (let f of Object.keys(files)) {
  let fullPath = '../' + f;
  let dir = fullPath.split('/').slice(0, -1).join('/');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(fullPath, '\n' + files[f].join('\n') + '\n');
  console.log("Appended to " + f);
}

