const fs = require('fs');
function append(file, stub) {
    let dir = file.split('/').slice(0, -1).join('/');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, '\n' + stub + '\n');
}
append('/Users/0x1/Documents/htdocs/purust-console/src/Effect/Console.rs', 'pub fn Effect_Console_log() -> crate::UnknownType { crate::mk_int(0) }');
