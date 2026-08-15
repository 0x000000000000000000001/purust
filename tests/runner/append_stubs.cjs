const fs = require('fs');

function append(file, stub) {
    if (fs.existsSync(file)) {
        fs.appendFileSync(file, '\n' + stub + '\n');
    } else {
        console.log("File not found: " + file);
    }
}

append('../purust-console/src/Effect/Console.rs', 'pub fn Effect_Console_error() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-console/src/Effect/Console.rs', 'pub fn Effect_Console_group() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-console/src/Effect/Console.rs', 'pub fn Effect_Console_groupEnd() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-console/src/Effect/Console.rs', 'pub fn Effect_Console_debug() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-arrays/src/Data/Array.rs', 'pub fn Data_Array_fromFoldableImpl() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-prelude/src/Data/Eq.rs', 'pub fn Data_Eq_eqIntImpl() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-record/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeSet() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-record/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeGet() -> crate::UnknownType { crate::mk_int(0) }');
append('../purust-record/src/Record/Unsafe.rs', 'pub fn Record_Unsafe_unsafeDelete() -> crate::UnknownType { crate::mk_int(0) }');
