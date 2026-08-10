const fs = require('fs');

let code = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');

// The repeated blocks we want to remove
const block = `use perceus_ptr::PerceusPtr;

pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;

pub fn unsafe_coerce<T>(_: T) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None }) }

pub fn mk_int(val: i64) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: val, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None }) }

// Data declarations:
#[derive(Clone)]
pub struct Record_a {
    pub a: i64,
    pub b: Option<UnknownType>,
    pub c: Option<UnknownType>,
    pub ccc: Option<UnknownType>,
    pub d: Option<UnknownType>,
    pub x: Option<UnknownType>,
    pub Applicative0: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,
    pub pure: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,
    pub discard: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>>,
    pub show: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,
}`;

// We split by this block, then join with empty string, but prepend ONE instance at the top.
let parts = code.split(block);
if (parts.length > 1) {
  code = block + '\n' + parts.join('');
}

fs.writeFileSync('tests/runner/output-test/app/src/main.rs', code);
