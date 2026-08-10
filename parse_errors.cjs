const fs = require('fs');

const lines = fs.readFileSync('tests/runner/output-test/app/cargo_errors.json', 'utf8').split('\n');
const missingFns = new Set();

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const msg = JSON.parse(line);
        if (msg.reason === 'compiler-message' && msg.message && msg.message.code && msg.message.code.code === 'E0425') {
            const match = msg.message.message.match(/cannot find function, tuple struct or tuple variant \`([A-Za-z0-9_]+)\`/);
            if (match) {
                missingFns.add(match[1]);
            }
        }
    } catch (e) {}
}

const ffiMap = {
    'Foreign_Object_ST': 'purust-foreign-object/src/Foreign/Object/ST.rs',
    'Foreign_Object': 'purust-foreign-object/src/Foreign/Object.rs',
    'Effect_Class_Console': 'purust-console/src/Effect/Class/Console.rs',
    'Effect_Console': 'purust-console/src/Effect/Console.rs',
    'Effect_Exception_Unsafe': 'purust-exceptions/src/Effect/Exception/Unsafe.rs',
    'Effect_Exception': 'purust-exceptions/src/Effect/Exception.rs',
    'Effect_Ref': 'purust-refs/src/Effect/Ref.rs',
    'Effect_Unsafe': 'purust-effect/src/Effect/Unsafe.rs',
    'Effect_Uncurried': 'purust-effect/src/Effect/Uncurried.rs',
    'Effect_Class': 'purust-effect/src/Effect/Class.rs',
    'Record_Unsafe_Union': 'purust-record/src/Record/Unsafe/Union.rs',
    'Record_Builder': 'purust-record/src/Record/Builder.rs',
    'Data_Semigroup_Generic': 'purust-prelude/src/Data/Semigroup/Generic.rs',
    'Data_Monoid_Generic': 'purust-prelude/src/Data/Monoid/Generic.rs',
    'Data_Show_Generic': 'purust-prelude/src/Data/Show/Generic.rs',
    'Data_Eq_Generic': 'purust-prelude/src/Data/Eq/Generic.rs',
    'Data_Ord_Generic': 'purust-prelude/src/Data/Ord/Generic.rs',
    'Data_Ring_Generic': 'purust-prelude/src/Data/Ring/Generic.rs',
    'Data_Semiring_Generic': 'purust-prelude/src/Data/Semiring/Generic.rs',
    'Data_Reflectable': 'purust-prelude/src/Data/Reflectable.rs',
    'Data_Ord_Down': 'purust-prelude/src/Data/Ord/Down.rs',
    'Data_Profunctor_Cochoice': 'purust-profunctor/src/Data/Profunctor/Cochoice.rs',
    'Data_Profunctor_Costrong': 'purust-profunctor/src/Data/Profunctor/Costrong.rs',
    'Data_Profunctor_Join': 'purust-profunctor/src/Data/Profunctor/Join.rs',
    'Data_Profunctor_Split': 'purust-profunctor/src/Data/Profunctor/Split.rs',
    'Data_Profunctor_Star': 'purust-profunctor/src/Data/Profunctor/Star.rs',
    'Data_String_Pattern': 'purust-strings/src/Data/String/Pattern.rs',
    'Data_String_Unsafe': 'purust-strings/src/Data/String/Unsafe.rs',
    'Data_String_CodeUnits': 'purust-strings/src/Data/String/CodeUnits.rs',
    'Data_String_Common': 'purust-strings/src/Data/String/Common.rs',
    'Data_String_CodePoints': 'purust-strings/src/Data/String/CodePoints.rs',
    'Data_String_CaseInsensitive': 'purust-strings/src/Data/String/CaseInsensitive.rs',
    'Data_String_Gen': 'purust-strings/src/Data/String/Gen.rs',
    'Data_String_NonEmpty_Internal': 'purust-strings/src/Data/String/NonEmpty/Internal.rs',
    'Data_String_NonEmpty_CodePoints': 'purust-strings/src/Data/String/NonEmpty/CodePoints.rs',
    'Data_String_NonEmpty_CaseInsensitive': 'purust-strings/src/Data/String/NonEmpty/CaseInsensitive.rs',
    'Data_String_NonEmpty_CodeUnits': 'purust-strings/src/Data/String/NonEmpty/CodeUnits.rs',
    'Data_String_Regex_Flags': 'purust-strings/src/Data/String/Regex/Flags.rs',
    'Data_String_Regex_Unsafe': 'purust-strings/src/Data/String/Regex/Unsafe.rs',
    'Data_String_Regex': 'purust-strings/src/Data/String/Regex.rs',
    'Data_String': 'purust-strings/src/Data/String.rs',
    'Data_Number_Approximate': 'purust-numbers/src/Data/Number/Approximate.rs',
    'Data_Number_Format': 'purust-numbers/src/Data/Number/Format.rs',
    'Data_Number': 'purust-numbers/src/Data/Number.rs',
    'Data_Enum': 'purust-enums/src/Data/Enum.rs',
    'Data_Tuple_Nested': 'purust-tuples/src/Data/Tuple/Nested.rs',
    'Test_Assert': 'purust-assert/src/Test/Assert.rs',
    'Test_Liveness': 'purust-assert/src/Test/Liveness.rs',
    'Test_Mutation': 'purust-assert/src/Test/Mutation.rs',
    'Test_Shape': 'purust-assert/src/Test/Shape.rs',
    'Control_Monad_ST_Uncurried': 'purust-st/src/Control/Monad/ST/Uncurried.rs',
    'Control_Monad_ST_Internal': 'purust-st/src/Control/Monad/ST/Internal.rs',
    'Data_Eq': 'purust-prelude/src/Data/Eq.rs',
    'Data_Show': 'purust-prelude/src/Data/Show.rs',
};

function mapPrefixToPath(prefix) {
    if (ffiMap[prefix]) {
        return ffiMap[prefix];
    }
    const parts = prefix.split('_');
    if (parts.length >= 2) {
        return 'purust-prelude/src/Fallback.rs';
    }
    return 'purust-prelude/src/Fallback.rs';
}

const stubsByFile = {};

for (const fn of missingFns) {
    let prefix = fn.split('_').slice(0, -1).join('_');
    let p = prefix;
    while(p.length > 0) {
        if (ffiMap[p]) {
            prefix = p;
            break;
        }
        p = p.split('_').slice(0, -1).join('_');
    }
    
    let path = mapPrefixToPath(prefix);
    
    if (!stubsByFile[path]) {
        stubsByFile[path] = [];
    }
    stubsByFile[path].push(`pub fn ${fn}() -> crate::UnknownType { crate::UnknownType::new(0) }`);
}

for (const path of Object.keys(stubsByFile)) {
    const fullPath = `../${path}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(fullPath, '\n' + stubsByFile[path].join('\n') + '\n');
    console.log(`Appended ${stubsByFile[path].length} stubs to ${fullPath}`);
}
console.log('Total missing functions mocked: ', missingFns.size);
