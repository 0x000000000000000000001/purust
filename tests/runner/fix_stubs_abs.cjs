const fs = require('fs');
function append(file, stub) {
    let dir = file.split('/').slice(0, -1).join('/');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, '\n' + stub + '\n');
}
append('/Users/0x1/Documents/htdocs/purust-console/src/Effect/Console.rs', 'pub fn Effect_Console_error() -> crate::UnknownType { crate::mk_int(0) }');
append('/Users/0x1/Documents/htdocs/purust-prelude/src/Data/Eq.rs', 'pub fn Data_Eq_eqIntImpl() -> crate::UnknownType { crate::mk_int(0) }');
append('/Users/0x1/Documents/htdocs/purust-prelude/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeSet() -> crate::UnknownType { crate::mk_int(0) }');
append('/Users/0x1/Documents/htdocs/purust-prelude/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeGet() -> crate::UnknownType { crate::mk_int(0) }');
append('/Users/0x1/Documents/htdocs/purust-prelude/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeDelete() -> crate::UnknownType { crate::mk_int(0) }');
