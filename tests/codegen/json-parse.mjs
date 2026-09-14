// Native Yoga.JSON against its unchanged JavaScript FFI, with real Error/Object/BigInt carriers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';
import { rustStringLiteral as literal } from '../../src/Purust/Utf16.js';
import { _parseJSON, _unsafeStringify, _unsafePrettyStringify } from '../../../purust-yoga-json/src/Yoga/JSON.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const directory = mkdtempSync(join(process.env.PURUST_JSON_OUTPUT ?? tmpdir(), 'purust-json-parse-'));
const prelude = codegenPrelude(fromFoldable(foldableArray)(ordString)(['', 'a']));
const report = { complete: false, commands: [], assertions: 0, inputs: [
  'output/Purust.CodeGen/index.js', 'src/Purust/RecordFields.js', 'src/Purust/Utf16.js', 'src/Purust/Threading.js',
  'tests/codegen/json-parse.mjs', 'tests/runtime/perceus_ptr/src/lib.rs', 'tests/runtime/perceus_ptr/src/local.rs',
  'tests/runtime/perceus_ptr/src/threaded.rs', '../purust-exceptions/src/Effect/Exception.rs',
  '../purust-effect/src/Effect/Uncurried.rs', '../purust-foreign-object/src/Foreign/Object/ST.rs',
  '../purust-foreign-object/src/Foreign/Object.rs', '../purust-js-bigints/src/JS/BigInt.rs',
  '../purust-js-bigints/src/JS/BigInt.rs.cargo.json', '../purust-yoga-json/src/Yoga/JSON.rs',
  '../purust-yoga-json/src/Yoga/JSON.rs.cargo.json', '../purust-yoga-json/src/Yoga/JSON.js',
].map(p => { const path = resolve(root, p); return { path, sha256: hash(path) }; }) };

function describe(value) {
  if (value === null) return ['null'];
  if (typeof value === 'number') return ['number', Object.is(value, -0) ? '-0' : String(value)];
  if (typeof value === 'bigint') return ['bigint', String(value)];
  if (typeof value === 'string') return ['string', value];
  if (typeof value === 'boolean') return ['boolean', value];
  if (Array.isArray(value)) return ['array', value.map(describe)];
  return ['object', Object.keys(value).map(k => [k, describe(value[k])])];
}
const cases = [];
let passed = 0, rejected = 0;
function add(payload) {
  let value;
  try { value = _parseJSON(payload); }
  catch (error) {
    cases.push(`reject(${literal(payload)}, ${literal(error.name)});`);
    rejected++; return;
  }
  cases.push(`check(${literal(payload)}, ${literal(_unsafeStringify(describe(value)))}, ${literal(_unsafeStringify(value))});`);
  passed++;
}
[
  'null', 'true', 'false', '0', '-0', '-0.0', '1e400', '-1e400', '1e-400', '9007199254740993',
  '1.7976931348623157e308', '5e-324', '1e+20', '1E-2', '""', '"\\ud800"', '"\\udfff"',
  '"\\ud800\\udfff"', '"\\ud800A\\udfff"', '"😀"', '"\ud800"', '"\\u0000"',
  '"\\b\\f\\n\\r\\t\\/\\\\\\\""', '"\u2028\u2029"', '\n\t\r null ', '[]', '{}',
  '[1,{"a":[true,null,"hi"]}]', '{"2":2,"10":10,"01":1,"a":3,"4294967295":4,"0":0}',
  '{"a":1,"b":2,"a":3}', '{"__proto__": {"polluted":true}, "constructor":42}',
  '{"\\ud800":"\\udfff","a":1}', '{"big":"invalid","big":42}',
  '{"big":{"big":1},"big":false}', '{"big":[],"a":{"big":10}}',
  ...['0', '42', '1.5', 'null', 'true', 'false', '1e400', '-0', '9007199254740993', '1e100',
    '"1234567890123456789012345678901234567890"', '"0xFf"', '"0b101"', '"0O17"',
    '"+001"', '"-000"', '""', '"  "', '"\\ufeff12\\u00a0"', '"\\u008512"',
    '"+0x12"', '"-0x12"', '"1_000"', '"1e3"', '"12.0"', '"0x"', '"--1"', '"+-1"',
    '[]', '[null]', '[12]', '[[[12]]]', '[1,2]', '{}', '{"toString":12}', '{"valueOf":12}',
    '{"toString":null}', '{"big":1}', '[{"big":2}]', '[[null]]', '[true]',
  ].map(value => `{"big":${value}}`),
  '', ' ', 'undefined', 'NaN', 'Infinity', '-Infinity', '+1', '.1', '01', '-01', '--1', '1.',
  '1e', '1E+', '-', '1 2', 'truefalse', 'NULL', '[1,]', '[,]', '[1', '[[', '{', '{a:1}',
  '{"a" 1}', '{"a":}', '{"a":1,}', '"', '"\\x20"', '"\\u"', '"\\u00G0"', '"a\nb"',
  '"a\0b"', 'null\u00a0', '\ufeffnull', '/* comment */null', '"a"junk', '{"a":1 "b":2}',
].forEach(add);
// Cover every UTF-16 code unit, including isolated surrogates, literally and escaped.
for (let i = 0; i < 65536; i += 256) {
  const text = String.fromCharCode(...Array.from({ length: 256 }, (_, n) => i + n));
  add(JSON.stringify(text));
  add('"' + Array.from({ length: 256 }, (_, n) => '\\u' + (i + n).toString(16).padStart(4, '0')).join('') + '"');
}
let seed = 0x412fed;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const bits = new DataView(new ArrayBuffer(8));
for (let i = 0; i < 1000; i++) {
  bits.setUint32(0, random()); bits.setUint32(4, random()); add(JSON.stringify(bits.getFloat64(0)));
}
const alphabet = '{}[],:"\\ntf0123456789 .+-e';
for (let i = 0; i < 600; i++) {
  add(Array.from({ length: random() % 24 }, () => alphabet[random() % alphabet.length]).join(''));
}
const prettyCases = [null, true, 2, 'é😀\ud800', [], {}, [1, { a: [null, 'x"\\'], empty: [] }],
  { '10': 10, z: {}, a: { b: 1 }, '2': 2 }, { big: 12345678901234567890n }];
for (const value of prettyCases) for (const spaces of [-100, -1, 0, 1, 2, 10, 12, 100]) {
  // The reviver reconstructs bigint from its decimal string before pretty printing.
  cases.push(`assert_eq!(json::Yoga_JSON__unsafePrettyStringify(${spaces}, parse(${literal(_unsafeStringify(value))})), ${literal(_unsafePrettyStringify(spaces)(value))});`);
}
// Keep the historical 1,287 stringify vectors in the fully linked JSON harness.
// The original json-ffi.mjs also retains its native property-order checks.
function expression(value) {
  if (value === null) return 'Value::Null';
  if (typeof value === 'string') return `mk_string(&${literal(value)})`;
  if (typeof value === 'number') return `mk_number(${Number.isNaN(value) ? 'f64::NAN' : value === Infinity ? 'f64::INFINITY' : value === -Infinity ? 'f64::NEG_INFINITY' : Object.is(value, -0) ? '-0.0' : value.toExponential()})`;
  if (typeof value === 'boolean') return `mk_bool(${value})`;
  if (Array.isArray(value)) return `mk_array(vec![${value.map(expression)}])`;
  return `{ let mut fields = RecordFields::new(); ${Object.keys(value).map(k => `fields.insert(${literal(k)}, ${expression(value[k])});`).join(' ')} Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields)) }`;
}
let stringifyCases = 0;
function addStringify(value) {
  cases.push(`assert_eq!(json::Yoga_JSON__unsafeStringify(${expression(value)}), ${literal(_unsafeStringify(value))});`);
  stringifyCases++;
}
['', 'hello', 'é😀', '\ud800\udfff', '\ud800A\udfff', '\0\b\f\n\r\t"\\', '\u2028\u2029', '\ue000\uffff'].forEach(addStringify);
[0, -0, 1, -42, 1e-7, 1e-6, 1e20, 1e21, 1.2345, Number.MIN_VALUE, Number.MAX_VALUE, NaN, Infinity, -Infinity].forEach(addStringify);
seed = 0x81234;
for (let i = 0; i < 1000; i++) { bits.setUint32(0, random()); bits.setUint32(4, random()); addStringify(bits.getFloat64(0)); }
for (let i = 0; i < 65536; i += 256) addStringify(String.fromCharCode(...Array.from({ length: 256 }, (_, n) => i + n)));
[null, { value: null, list: [null, 1] }, true, false, [], [1, 'x', false], { value: { custom: 100 }, type: 'baz' },
  { z: 1, '10': 10, '2': 2, a: 3, '01': 1, '4294967295': 5 }, { a: { b: [42, 'x'] } }].forEach(addStringify);
assert.equal(stringifyCases, 1287);
report.assertions = cases.length;
report.valid = passed; report.invalid = rejected; report.stringify = stringifyCases;
const checks = `
fn parse(text: String) -> Value {
    let action = uncurried::Effect_Uncurried_runEffectFn1(json::Yoga_JSON__parseJSON(), Value::String(text));
    action.unwrap_func1()(Value::Unit)
}
fn describe(value: Value) -> Value {
    let (tag, payload) = match value.resolve() {
        Value::Null => return mk_array(vec![mk_string("null")]),
        Value::Number(n) => ("number", mk_string(&if *n == 0.0 && n.is_sign_negative() { "-0".into() } else { ryu_js::Buffer::new().format(*n).to_owned() })),
        Value::Bool(_) => ("boolean", value.clone()),
        Value::String(_) => ("string", value.clone()),
        Value::Array(items) => ("array", mk_array(items.iter().cloned().map(describe).collect())),
        Value::Class(native) => if let Some(n) = native.downcast_ref::<std::rc::Rc<BigInt>>() {
            ("bigint", mk_string(&n.to_string()))
        } else {
            let object = native.downcast_ref::<std::rc::Rc<Object>>().expect("real Object carrier");
            ("object", mk_array(object.entries().into_iter().map(|(k,v)| mk_array(vec![mk_string(&k), describe(v)])).collect()))
        },
        _ => panic!("unexpected parser carrier"),
    };
    mk_array(vec![mk_string(tag), payload])
}
fn check(text: String, expected: String, compact: String) {
    let value = match exception::purust_exception_try(|| parse(text.clone())) {
        Ok(value) => value,
        Err(error) => panic!("unexpected {}: {} for {:?}", exception::Effect_Exception_name(error.clone()), exception::Effect_Exception_message(error), text),
    };
    assert_eq!(json::Yoga_JSON__unsafeStringify(describe(value.clone())), expected, "parse {:?}", text);
    assert_eq!(json::Yoga_JSON__unsafeStringify(value), compact, "stringify {:?}", text);
}
fn reject(text: String, name: String) {
    let result = exception::purust_exception_try(|| parse(text.clone()));
    let Err(error) = result else { panic!("accepted malformed JSON {:?}", text); };
    assert_eq!(exception::Effect_Exception_name(error.clone()), name, "error type {:?}", text);
    assert!(!exception::Effect_Exception_message(error).is_empty());
}
fn main() {
    ${cases.join('\n')}
    assert!(matches!(json::Yoga_JSON__undefined(), Value::Unit));
    assert!(matches!(parse("null".into()), Value::Null));
    // Parse errors are raised when the Effect executes, not when it is constructed.
    let action = uncurried::Effect_Uncurried_runEffectFn1(json::Yoga_JSON__parseJSON(), mk_string("{"));
    assert!(exception::purust_exception_try(|| action.unwrap_func1()(Value::Unit)).is_err());
    let object = Object::empty(); object.insert("absent".into(), Value::Unit); object.insert("null".into(), Value::Null);
    assert_eq!(json::Yoga_JSON__unsafeStringify(Value::Class(std::rc::Rc::new(std::rc::Rc::new(object)))), "{\\\"null\\\":null}");
    assert_eq!(json::Yoga_JSON__unsafeStringify(mk_array(vec![Value::Unit, Value::Null, Value::Func1(Func1::Static(|v|v))])), "[null,null,null]");
    println!("JSON: ${passed} valid, ${rejected} rejected, ${prettyCases.length * 8} pretty-print and ${stringifyCases} stringify cases passed");
}`;
try {
  const mount = resolve(root, '../../b8x/run/bak'), docker = process.argv.includes('--docker');
  if (docker) assert.ok(!relative(mount, directory).startsWith('..'));
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', dir = join(directory, mode); mkdirSync(dir);
    const adapt = source => threaded ? threadedRust(source) : source;
    const code = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
extern crate self as Purs_Foreign_Object_ST;
extern crate self as Purs_Foreign_Object;
extern crate self as Purs_JS_BigInt;
extern crate self as Purs_Effect_Exception;
mod perceus_ptr { ${read('tests/runtime/perceus_ptr/src/lib.rs').replace('mod local;', `mod local { ${read('tests/runtime/perceus_ptr/src/local.rs')} }`).replace('mod threaded;', `mod threaded { ${read('tests/runtime/perceus_ptr/src/threaded.rs')} }`)} }
mod object_st { ${adapt(read('../purust-foreign-object/src/Foreign/Object/ST.rs'))} }
pub use object_st::STObject;
mod object { ${adapt(read('../purust-foreign-object/src/Foreign/Object.rs'))} }
pub use object::Object;
mod bigint { ${adapt(read('../purust-js-bigints/src/JS/BigInt.rs'))} }
pub use bigint::BigInt;
mod exception { ${adapt(read('../purust-exceptions/src/Effect/Exception.rs'))} }
pub use exception::{purust_exception_raise, Effect_Exception_errorWithName};
mod uncurried { use crate::{UnknownType, Value}; ${adapt(read('../purust-effect/src/Effect/Uncurried.rs'))} }
mod json { ${adapt(read('../purust-yoga-json/src/Yoga/JSON.rs'))} }
${adapt(checks)}`;
    writeFileSync(join(dir, 'main.rs'), code);
    const manifest = JSON.parse(read('../purust-yoga-json/src/Yoga/JSON.rs.cargo.json'));
    const bigintManifest = JSON.parse(read('../purust-js-bigints/src/JS/BigInt.rs.cargo.json'));
    writeFileSync(join(dir, 'Cargo.toml'), `[package]\nname="json_parse"\nversion="0.0.0"\nedition="2021"\n[[bin]]\nname="json_parse"\npath="main.rs"\n[features]\nthreaded=[]\n[dependencies]\nryu-js="${manifest.dependencies['ryu-js'].version}"\nnum-bigint-dig={version="${bigintManifest.dependencies['num-bigint-dig'].version}",default-features=false}\n`);
    const remote = '/var/www/b8x/run/bak/' + relative(mount, dir);
    const prefix = docker ? ['exec', '-w', remote, '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0', '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo'] : [];
    const result = spawnSync(docker ? 'docker' : 'cargo', [...prefix, 'run', '--offline', '--quiet', ...(threaded ? ['--features', 'threaded'] : [])], {
      cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, CARGO_BUILD_JOBS: '1', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_INCREMENTAL: '0' },
    });
    report.commands.push({ mode, status: result.status, stdout: result.stdout, stderr: result.stderr });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.equal(result.stderr, '', 'handled syntax exceptions must not print Rust panic diagnostics');
    console.log(`${mode}: ${result.stdout.trim()}`);
  }
  report.inputs.forEach(p => assert.equal(hash(p.path), p.sha256, `input changed: ${p.path}`));
  report.complete = true;
} finally { writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2)); console.log(directory); }
