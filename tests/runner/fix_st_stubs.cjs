const fs = require('fs');
function append(file, stub) {
    let dir = file.split('/').slice(0, -1).join('/');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, '\n' + stub + '\n');
}
append('/Users/0x1/Documents/htdocs/purust-st/src/Control/Monad/ST/Internal.rs', 'pub fn Control_Monad_ST_Internal_while() -> crate::UnknownType { crate::UnknownType::new(0) }');
