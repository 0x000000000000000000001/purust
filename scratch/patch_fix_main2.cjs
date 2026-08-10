const fs = require('fs');
let code = fs.readFileSync('fix_main_regex.cjs', 'utf8');

const recordADyn = fs.readFileSync('scratch/Record_a_dyn.txt', 'utf8');
const parts = recordADyn.split('\n\n');
const newRecordA = parts[0].replace(/r#mod/g, 'mod_kw').replace(/r#as/g, 'as_kw').replace(/r#break/g, 'break_kw');
const newNoneFieldsStr = parts[1].replace(/r#mod/g, 'mod_kw').replace(/r#as/g, 'as_kw').replace(/r#break/g, 'break_kw');
const newNoneFieldsIntStr = parts[2].replace(/r#mod/g, 'mod_kw').replace(/r#as/g, 'as_kw').replace(/r#break/g, 'break_kw');

// Replace the const recordA = `...`; with the new one
code = code.replace(/const recordA = `[^`]+`;/, 'const recordA = `\n' + newRecordA + '\n`;');

// Replace the mkFns to use newNoneFieldsStr
const oldMkFns = `pub fn unsafe_coerce<T>(_: T) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: None, fn4: None, fn5: None }) }
pub fn mk_int(val: i64) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: val, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: None, fn4: None, fn5: None }) }
pub fn mk_fn1(f: std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: Some(f), fn2: None, fn3: None, fn4: None, fn5: None }) }
pub fn mk_fn2(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: Some(f), fn3: None, fn4: None, fn5: None }) }
pub fn mk_fn3(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: Some(f), fn4: None, fn5: None }) }
pub fn mk_fn4(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: None, fn4: Some(f), fn5: None }) }
pub fn mk_fn5(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: None, fn4: None, fn5: Some(f) }) }`;

const newMkFnsStr = `pub fn unsafe_coerce<T>(_: T) -> UnknownType { perceus_ptr::PerceusPtr::new(${newNoneFieldsStr}) }
pub fn mk_int(val: i64) -> UnknownType { perceus_ptr::PerceusPtr::new(${newNoneFieldsIntStr}) }
pub fn mk_fn1(f: std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(${newNoneFieldsStr.replace('fn1: None', 'fn1: Some(f)')}) }
pub fn mk_fn2(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(${newNoneFieldsStr.replace('fn2: None', 'fn2: Some(f)')}) }
pub fn mk_fn3(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(${newNoneFieldsStr.replace('fn3: None', 'fn3: Some(f)')}) }
pub fn mk_fn4(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(${newNoneFieldsStr.replace('fn4: None', 'fn4: Some(f)')}) }
pub fn mk_fn5(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(${newNoneFieldsStr.replace('fn5: None', 'fn5: Some(f)')}) }`;

code = code.replace(oldMkFns, newMkFnsStr);

// Rename extra mains
code = code.replace(/let lines = code\.split\('\\n'\);/, `let lines = code.split('\\n');
let mainCount = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('pub fn main()')) {
        mainCount++;
        if (mainCount > 1) {
            lines[i] = 'pub fn main_' + mainCount + '() {';
        }
    }
}`);

fs.writeFileSync('fix_main_regex.cjs', code);
