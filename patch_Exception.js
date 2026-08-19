import fs from 'fs';
let code = fs.readFileSync('tests/purust-exceptions/src/Effect/Exception.rs', 'utf8');

code = code.replace(
    'pub fn Effect_Exception_showErrorImpl() -> crate::UnknownType { crate::mk_int(0) }',
    'pub fn Effect_Exception_showErrorImpl(a0: crate::UnknownType) -> String { String::from("error") }'
);

fs.writeFileSync('tests/purust-exceptions/src/Effect/Exception.rs', code);
