const fs = require('fs');
let code = fs.readFileSync('fix_main_regex.cjs', 'utf8');

const newFields = `
    pub fn1: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,
    pub fn2: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType) -> UnknownType>>,
    pub fn3: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>>,
    pub fn4: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>,
    pub fn5: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>,
`;

code = code.replace(
    /pub discard: Option<std::rc::Rc<dyn Fn\(UnknownType, UnknownType, UnknownType\) -> UnknownType>>,\n/,
    "pub discard: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>>,\n" + newFields
);

const newInits = `fn1: None, fn2: None, fn3: None, fn4: None, fn5: None`;
code = code.replace(/discard: None \}\)/g, `discard: None, ${newInits} })`);

const mkFns = `
pub fn mk_fn1(f: std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: Some(f), fn2: None, fn3: None, fn4: None, fn5: None }) }
pub fn mk_fn2(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: Some(f), fn3: None, fn4: None, fn5: None }) }
pub fn mk_fn3(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: Some(f), fn4: None, fn5: None }) }
pub fn mk_fn4(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: None, fn4: Some(f), fn5: None }) }
pub fn mk_fn5(f: std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, fn1: None, fn2: None, fn3: None, fn4: None, fn5: Some(f) }) }
`;

if (!code.includes('pub fn mk_fn1')) {
    code = code.replace(/pub fn mk_int[^\n]+\n/, match => match + mkFns);
}

fs.writeFileSync('fix_main_regex.cjs', code);
