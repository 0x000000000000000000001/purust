// Compare native JSON and property order with the actual Yoga.JSON JS FFI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';
import { rustStringLiteral } from '../../src/Purust/Utf16.js';
import { _unsafeStringify } from '../../../purust-yoga-json/src/Yoga/JSON.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = mkdtempSync(join(process.env.PURUST_JSON_OUTPUT ?? tmpdir(), 'purust-json-'));
const prelude = codegenPrelude(fromFoldable(foldableArray)(ordString)(['', 'a', 'type,value']));
const read = path => readFileSync(resolve(root, path), 'utf8');
const manifest = JSON.parse(read('../purust-yoga-json/src/Yoga/JSON.rs.cargo.json'));
const bigintManifest = JSON.parse(read('../purust-js-bigints/src/JS/BigInt.rs.cargo.json'));
const foreignManifest = JSON.parse(read('../purust-foreign/src/Foreign.rs.cargo.json'));
assert.deepEqual(foreignManifest.dependencies['num-bigint-dig'], bigintManifest.dependencies['num-bigint-dig']);
const report = { complete: false, commands: [], assertions: 0 };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
report.inputs = ['bin/purust.js', 'output/Purust.CodeGen/index.js', 'src/Purust/RecordFields.js', 'src/Purust/Utf16.js',
  'src/Purust/Threading.js', 'tests/codegen/json-ffi.mjs', 'tests/runtime/perceus_ptr/src/lib.rs',
  'tests/runtime/perceus_ptr/src/local.rs', 'tests/runtime/perceus_ptr/src/threaded.rs',
  '../purust-foreign-object/src/Foreign/Object.rs', '../purust-foreign-object/src/Foreign/Object/ST.rs',
  '../purust-record/src/Record/Builder.rs', '../purust-foreign/src/Foreign.rs', '../purust-foreign/src/Foreign/Index.rs',
  '../purust-foreign/src/Foreign.rs.cargo.json', '../purust-exceptions/src/Effect/Exception.rs',
  '../purust-js-bigints/src/JS/BigInt.rs', '../purust-js-bigints/src/JS/BigInt.rs.cargo.json',
  '../purust-yoga-json/src/Yoga/JSON.rs', '../purust-yoga-json/src/Yoga/JSON.rs.cargo.json', '../purust-yoga-json/src/Yoga/JSON.js']
  .map(p => { const path = resolve(root, p); return { path, sha256: hash(path) }; });
const cases = [];
const number = n => Number.isNaN(n) ? 'f64::NAN' : n === Infinity ? 'f64::INFINITY' : n === -Infinity ? 'f64::NEG_INFINITY' : `${Object.is(n, -0) ? '-0.0' : n.toExponential()}`;
function expression(value) {
  if (value === null) return 'Value::Null';
  if (typeof value === 'string') return `mk_string(&${rustStringLiteral(value)})`;
  if (typeof value === 'number') return `mk_number(${number(value)})`;
  if (typeof value === 'boolean') return `mk_bool(${value})`;
  if (Array.isArray(value)) return `mk_array(vec![${value.map(expression)}])`;
  return `{ let mut fields = RecordFields::new(); ${Object.keys(value).map(k => `fields.insert(${rustStringLiteral(k)}, ${expression(value[k])});`).join(' ')} Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields)) }`;
}
function add(value) { cases.push(`assert_eq!(json::Yoga_JSON__unsafeStringify(${expression(value)}), ${rustStringLiteral(_unsafeStringify(value))});`); }
['', 'hello', 'é😀', '\ud800\udfff', '\ud800A\udfff', '\0\b\f\n\r\t"\\', '\u2028\u2029', '\ue000\uffff'].forEach(add);
[0, -0, 1, -42, 1e-7, 1e-6, 1e20, 1e21, 1.2345, Number.MIN_VALUE, Number.MAX_VALUE, NaN, Infinity, -Infinity].forEach(add);
let seed = 0x81234;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const bits = new DataView(new ArrayBuffer(8));
for (let i = 0; i < 1000; i++) { bits.setUint32(0, random()); bits.setUint32(4, random()); add(bits.getFloat64(0)); }
for (let i = 0; i < 65536; i += 256) add(String.fromCharCode(...Array.from({ length: 256 }, (_, n) => i + n)));
[null, { value: null, list: [null, 1] }, true, false, [], [1, 'x', false], { value: { custom: 100 }, type: 'baz' },
  { z: 1, '10': 10, '2': 2, a: 3, '01': 1, '4294967295': 5 }, { a: { b: [42, 'x'] } }].forEach(add);
report.assertions = cases.length;
const checks = `fn main() {
${cases.join('\n')}
let mut fields = RecordFields::new();
fields.insert("z".into(), mk_int(1)); fields.insert("a".into(), mk_int(2));
fields.insert("z".into(), mk_int(3));
assert_eq!(fields.entries().iter().map(|x| x.0.as_str()).collect::<Vec<_>>(), ["z", "a"]);
fields.remove("z"); fields.insert("z".into(), mk_int(4));
assert_eq!(fields.entries().iter().map(|x| x.0.as_str()).collect::<Vec<_>>(), ["a", "z"]);
let object = std::rc::Rc::new(Object::from_entries(fields.entries()));
let value = Value::Class(std::rc::Rc::new(object.clone()));
assert_eq!(json::Yoga_JSON__unsafeStringify(value), "{\\\"a\\\":2,\\\"z\\\":4}");
let snapshot = object.snapshot();
assert_eq!(snapshot.entries().len(), 2);
let empty = Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a::default()));
let built = builder::Record_Builder_unsafeInsert("z".into(), mk_int(1), builder::Record_Builder_copyRecord(empty.clone()));
let built = builder::Record_Builder_unsafeInsert("a".into(), mk_int(2), built);
assert_eq!(json::Yoga_JSON__unsafeStringify(built), "{\\\"z\\\":1,\\\"a\\\":2}");
assert_eq!(empty.__purust_record_fields().unwrap().entries().len(), 0);
// The optimizer removes copyRecord on a fresh empty record.
let encoded = empty.clone();
let encoded = builder::Record_Builder_unsafeInsert("value".into(), mk_int(42), encoded);
let encoded = builder::Record_Builder_unsafeInsert("type".into(), mk_string("bar"), encoded);
assert_eq!(json::Yoga_JSON__unsafeStringify(encoded), "{\\\"value\\\":42,\\\"type\\\":\\\"bar\\\"}");
let read = index::Foreign_Index_unsafeReadPropImpl().unwrap_func4();
let identity = Value::Func1(Func1::Static(|v| v));
assert_eq!(read(mk_int(-1), identity.clone(), mk_string("a"), Value::Class(std::rc::Rc::new(object.clone()))).unwrap_int(), 2);
assert!(matches!(read(mk_int(-1), identity.clone(), mk_string("absent"), Value::Class(std::rc::Rc::new(object.clone()))), Value::Unit));
assert_eq!(read(mk_int(-1), identity.clone(), mk_string("a"), Value::Unit).unwrap_int(), -1);
assert_eq!(read(mk_int(-1), identity.clone(), mk_string("a"), Value::Null).unwrap_int(), -1);
assert_eq!(read(mk_int(-1), identity.clone(), mk_int(1), mk_array(vec![mk_int(2), mk_int(3)])).unwrap_int(), 3);
assert_eq!(read(mk_int(-1), identity.clone(), mk_string("length"), mk_string(&purust_string_from_utf8("😀"))).unwrap_int(), 2);
assert_eq!(foreign::Foreign_tagOf(mk_int(42)), "Number");
assert_eq!(mk_int(42).unwrap_number(), 42.0);
assert_eq!(mk_int(i32::MIN as i64).unwrap_number(), -2147483648.0);
assert_eq!(mk_number(42.5).unwrap_number(), 42.5);
assert!(std::panic::catch_unwind(|| mk_bool(true).unwrap_number()).is_err());
assert_eq!(foreign::Foreign_tagOf(mk_number(42.5)), "Number");
assert_eq!(foreign::Foreign_tagOf(Value::Unit), "Undefined");
assert_eq!(foreign::Foreign_typeOf(Value::Unit), "undefined");
assert_eq!(foreign::Foreign_typeOf(Value::Null), "object");
assert_eq!(foreign::Foreign_tagOf(Value::Null), "Null");
assert!(foreign::Foreign_isNull(Value::Null));
assert!(!foreign::Foreign_isUndefined(Value::Null));
assert!(!foreign::Foreign_isNull(Value::Unit));
assert!(foreign::Foreign_isUndefined(Value::Unit));
assert!(foreign::Foreign_isArray(mk_array(vec![])));
assert!(!foreign::Foreign_isArray(Value::Null));
let big = Value::Class(std::rc::Rc::new(std::rc::Rc::new("123456789012345678901234567890".parse::<BigInt>().unwrap())));
assert_eq!(foreign::Foreign_tagOf(big.clone()), "BigInt");
assert_eq!(foreign::Foreign_typeOf(big.clone()), "bigint");
assert_eq!(json::Yoga_JSON__unsafeStringify(big), "\\\"123456789012345678901234567890\\\"");
assert_eq!(foreign::Foreign_tagOf(Value::Class(std::rc::Rc::new(object.clone()))), "Object");
assert_eq!(foreign::Foreign_typeOf(Value::Class(std::rc::Rc::new(object.clone()))), "object");
let copied = object.snapshot();
object.insert("new".into(), mk_int(9));
assert!(copied.get("new").is_none());
// The callback re-enters the source object; mapWithKey must release its lock.
let source = Value::Class(std::rc::Rc::new(object.clone()));
let callback = Value::Func1(Func1::Shared(std::rc::Rc::new(move |key| {
    assert!(object.get(&key.unwrap_string()).is_some());
    Value::Func1(Func1::Static(|value| value))
})));
let mapped = object::Foreign_Object__mapWithKey().unwrap_func2()(source, callback);
assert_eq!(mapped.unwrap_class::<std::rc::Rc<Object>>().get("new").unwrap().unwrap_int(), 9);
println!("JSON: ${cases.length} differential cases and native property-order checks passed");
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
extern crate self as Purs_Data_Maybe;
extern crate self as Purs_Effect_Exception;
mod maybe { #[derive(Clone)] pub enum Maybe { Nothing, Just(purust_core::Value) } }
pub use maybe::Maybe;
mod perceus_ptr { ${read('tests/runtime/perceus_ptr/src/lib.rs').replace('mod local;', `mod local { ${read('tests/runtime/perceus_ptr/src/local.rs')} }`).replace('mod threaded;', `mod threaded { ${read('tests/runtime/perceus_ptr/src/threaded.rs')} }`)} }
mod object_st { ${adapt(read('../purust-foreign-object/src/Foreign/Object/ST.rs'))} }
pub use object_st::STObject;
mod object { ${adapt(read('../purust-foreign-object/src/Foreign/Object.rs'))} }
pub use object::Object;
mod bigint { ${adapt(read('../purust-js-bigints/src/JS/BigInt.rs'))} }
pub use bigint::BigInt;
mod exception { ${adapt(read('../purust-exceptions/src/Effect/Exception.rs'))} }
pub use exception::{purust_exception_raise, Effect_Exception_errorWithName};
mod builder { use crate::perceus_ptr; ${adapt(read('../purust-record/src/Record/Builder.rs'))} }
mod json { ${adapt(read('../purust-yoga-json/src/Yoga/JSON.rs'))} }
mod foreign { ${adapt(read('../purust-foreign/src/Foreign.rs'))} }
mod index { ${adapt(read('../purust-foreign/src/Foreign/Index.rs'))} }
${adapt(checks)}`;
    writeFileSync(join(dir, 'main.rs'), code);
    writeFileSync(join(dir, 'Cargo.toml'), `[package]\nname="json_ffi"\nversion="0.0.0"\nedition="2021"\n[[bin]]\nname="json_ffi"\npath="main.rs"\n[features]\nthreaded=[]\n[dependencies]\nryu-js="${manifest.dependencies['ryu-js'].version}"\nnum-bigint-dig={version="${bigintManifest.dependencies['num-bigint-dig'].version}",default-features=false}\nnum-traits="${bigintManifest.dependencies['num-traits'].version}"\n`);
    const remote = '/var/www/b8x/run/bak/' + relative(mount, dir);
    const prefix = docker ? ['exec', '-w', remote, '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0', '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo'] : [];
    const result = spawnSync(docker ? 'docker' : 'cargo', [...prefix, 'run', '--offline', '--quiet', ...(threaded ? ['--features', 'threaded'] : [])], {
      cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
      env: { ...process.env, CARGO_BUILD_JOBS: '1', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_INCREMENTAL: '0' }
    });
    report.commands.push({ mode, status: result.status, stdout: result.stdout, stderr: result.stderr });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    console.log(`${mode}: ${result.stdout.trim()}`);
  }
  report.inputs.forEach(p => assert.equal(hash(p.path), p.sha256));
  report.complete = true;
} finally { writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2)); console.log(directory); }
