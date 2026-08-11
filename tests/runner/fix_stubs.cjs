const fs = require('fs');
function append(file, stub) {
    let dir = file.split('/').slice(0, -1).join('/');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, '\n' + stub + '\n');
}
append('../purust-console/src/Effect/Console.rs', 'pub fn Effect_Console_error() -> crate::UnknownType { crate::UnknownType::new(0) }');
append('../purust-prelude/src/Data/Eq.rs', 'pub fn Data_Eq_eqIntImpl() -> crate::UnknownType { crate::UnknownType::new(0) }');
append('../purust-prelude/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeSet() -> crate::UnknownType { crate::UnknownType::new(0) }');
append('../purust-prelude/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeGet() -> crate::UnknownType { crate::UnknownType::new(0) }');
append('../purust-prelude/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeDelete() -> crate::UnknownType { crate::UnknownType::new(0) }');
