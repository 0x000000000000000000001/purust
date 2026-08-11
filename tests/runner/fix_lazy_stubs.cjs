const fs = require('fs');
function append(file, stub) {
    let dir = file.split('/').slice(0, -1).join('/');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, '\n' + stub + '\n');
}
append('/Users/0x1/Documents/htdocs/purust-lazy/src/Data/Lazy.rs', 'pub fn Data_Lazy_force() -> crate::UnknownType { crate::UnknownType::new(0) }');
append('/Users/0x1/Documents/htdocs/purust-lazy/src/Data/Lazy.rs', 'pub fn Data_Lazy_defer() -> crate::UnknownType { crate::UnknownType::new(0) }');
append('/Users/0x1/Documents/htdocs/purust-prelude/src/Data/Symbol.rs', 'pub fn Data_Symbol_unsafeCoerce() -> crate::UnknownType { crate::UnknownType::new(0) }');
