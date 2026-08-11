const fs = require('fs');
let code = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');

// Find an example of E0057
let match = code.match(/\(unsafe_coerce\(std::rc::Rc::new\(move \|mut [^:]+: UnknownType\| -> UnknownType \{\n[\s\S]{1,500}\}\)\)\)\([^)]+, [^)]+\)/);
if (match) {
    console.log(match[0]);
} else {
    console.log("Not found");
}
