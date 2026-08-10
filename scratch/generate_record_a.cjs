const fs = require('fs');

const code = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');

const regex = /\.[a-zA-Z0-9_]+\.clone\(\)\.unwrap\(\)/g;
const matches = [...code.matchAll(regex)];

const props = new Set();
for (const m of matches) {
    const propName = m[0].substring(1, m[0].length - 17);
    props.add(propName);
}

// Also add a, b, c, ccc, d, x, etc. just in case
props.add("a");
props.add("b");
props.add("c");
props.add("d");
props.add("x");

// Add some known fns
for(let i=1; i<=10; i++) props.add("fn" + i);

let recordA = "#[derive(Clone)]\npub struct Record_a {\n";

const fnTypes = {};
fnTypes["fn1"] = "Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>";
fnTypes["fn2"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn3"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn4"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn5"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn6"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn7"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn8"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn9"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>";
fnTypes["fn10"] = "Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>";

const propList = Array.from(props).sort();
for (const p of propList) {
    let type = "Option<UnknownType>";
    if (fnTypes[p]) {
        type = fnTypes[p];
    }
    // we need to handle reserved keywords in struct fields by prefixing with r#
    let fieldName = p;
    if (["mod", "as", "break", "use", "pub", "type", "ref", "mut", "move", "match", "loop"].includes(p)) {
        fieldName = "r#" + p;
    }
    recordA += "    pub " + fieldName + ": " + type + ",\n";
}
recordA += "}";

const noneFields = propList.map(p => {
    let fieldName = p;
    if (["mod", "as", "break", "use", "pub", "type", "ref", "mut", "move", "match", "loop"].includes(p)) {
        fieldName = "r#" + p;
    }
    return fieldName + ": None";
}).join(", ");

const noneFieldsStr = "Record_a { a: 0, " + noneFields.replace("r#a: None, ", "") + " }";
const noneFieldsIntStr = "Record_a { a: val, " + noneFields.replace("r#a: None, ", "") + " }";

console.log(recordA);
// save to a file
fs.writeFileSync('scratch/Record_a_dyn.txt', recordA + '\n\n' + noneFieldsStr + '\n\n' + noneFieldsIntStr);
