// Original JS _foldM vs real Object/ST/Exception FFI and Rc/Arc runtime.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';
import { rustStringLiteral } from '../../src/Purust/Utf16.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mount = resolve(root, '../../b8x/run/bak');
const directory = mkdtempSync(join(mount, 'rust/output/purust-object-foldm-'));
const remote = path => '/var/www/b8x/run/bak/' + relative(mount, path);
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = { complete: false, commands: [], modes: [], inputs: [
  'output/Purust.CodeGen/index.js', 'src/Purust/RecordFields.js', 'src/Purust/Utf16.js', 'src/Purust/Threading.js',
  'tests/codegen/foreign-object-foldm.mjs', 'tests/codegen/fixtures/foreign-object-foldm.rs',
  'tests/runtime/perceus_ptr/src/lib.rs', 'tests/runtime/perceus_ptr/src/local.rs', 'tests/runtime/perceus_ptr/src/threaded.rs',
  '../purust-exceptions/src/Effect/Exception.rs', '../purust-foreign-object/src/Foreign/Object.rs',
  '../purust-foreign-object/src/Foreign/Object/ST.rs', '../purust-foreign-object/src/Foreign/Object.js',
].map(p => { const path = resolve(root, p); return { path, sha256: hash(path) }; }) };
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
console.log(directory);
const source = read('../purust-foreign-object/src/Foreign/Object.js');
const { _foldM } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const immediate = z => next => next(z), deferred = action => next => () => next(action())();
const hex = value => Array.from({ length: value.length }, (_, i) => value.charCodeAt(i).toString(16).padStart(4, '0')).join('');
const describe = value => typeof value === 'string' ? 's:' + hex(value) : String(value);
const collect = z => k => v => z + hex(k) + '=' + describe(v) + ';';
const own = entries => {
  const object = Object.create({ inherited: 999 });
  for (const [key, value] of entries) Object.defineProperty(object, key, { value, writable: true, configurable: true, enumerable: true });
  return object;
};
const cases = [[]];
const keys = ['z', '10', '2', '01', '4294967294', '4294967295', '-1', '1.0', 'NaN', '__proto__', 'constructor',
  'hasOwnProperty', 'toString', '', '\0', 'é', '😀', '\ud800', '\udfff', 'a\ud800b'];
const values = [undefined, null, true, false, 0, -42, '', 'é😀', '\ud800a\udfff'];
cases.push(keys.map((key, i) => [key, values[i % values.length]]));
for (const value of values) cases.push([['value', value]]);
let state = 0x8fa1543c;
const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
for (let n = 0; n < 256; n++) cases.push(Array.from({ length: n % 24 }, () => [keys[random() % keys.length], values[random() % values.length]]));
const reference = { vectors: cases.map(entries => _foldM(immediate)(collect)('seed;')(own(entries))) };
const initial = {}; assert.strictEqual(_foldM(() => { throw new Error('empty bind'); })(() => { throw new Error('empty callback'); })(initial)({}), initial);
const eagerObject = { a: 1, b: 2, c: 3 };
reference.eager = _foldM(immediate)(z => k => v => {
  if (k === 'a') { eagerObject.b = 20; delete eagerObject.c; eagerObject.d = 4; }
  return collect(z)(k)(v);
})('seed;')(eagerObject);
const lazyObject = { a: 1, b: 2, c: 3 }; let lazyCalls = 0;
const lazy = _foldM(deferred)(z => k => v => { lazyCalls++; return () => collect(z)(k)(v); })(() => 'seed;')(lazyObject);
assert.equal(lazyCalls, 0); lazyObject.b = 20; delete lazyObject.c; lazyObject.d = 4;
reference.deferredFirst = lazy(); lazyObject.a = 10; lazyObject.c = 30; reference.deferredSecond = lazy(); assert.equal(lazyCalls, 6);
const repeatedObject = { a: 1 };
reference.repeated = _foldM(z => next => { const first = next(z); repeatedObject.a = 2; return [first, next(z)]; })(collect)('seed;')(repeatedObject);
let shortBinds = 0; const marker = [];
assert.strictEqual(_foldM(z => () => { shortBinds++; return z; })(() => { throw new Error('short callback'); })(marker)({ a: null, b: undefined }), marker);
reference.shortBinds = shortBinds;
const child = {}; assert.strictEqual(_foldM(immediate)(() => () => value => value)(null)({ payload: child }), child);
for (const isLazy of [false, true]) {
  const error = new TypeError('fold callback'); let calls = 0;
  assert.throws(() => {
    const result = _foldM(isLazy ? deferred : immediate)(() => () => () => { calls++; throw error; })(isLazy ? () => undefined : undefined)({ a: 1, b: 2 });
    if (isLazy) result();
  }, caught => caught === error); assert.equal(calls, 1);
}
const bindError = new Error('bind failure');
assert.throws(() => _foldM(() => { throw bindError; })(() => { throw new Error('callback'); })(null)({ a: 1 }), error => error === bindError);
writeFileSync(join(directory, 'reference.json'), JSON.stringify(reference, null, 2));
report.jsReference = { passed: true, vectors: cases.length, eager: reference.eager,
  deferred: [reference.deferredFirst, reference.deferredSecond], repeated: reference.repeated, shortBinds };
save();
const rustValue = value => value === undefined ? 'Value::Unit' : value === null ? 'Value::Null' :
  typeof value === 'boolean' ? `Value::Bool(${value})` : typeof value === 'number' ? `mk_int(${value})` : `Value::String(${rustStringLiteral(value)})`;
const vectors = `#[test]\nfn javascript_own_property_vectors() {\n${cases.map((entries, i) => `
    let object=Rc::new(Object::from_entries(vec![${entries.map(([k,v]) => `(${rustStringLiteral(k)},${rustValue(v)})`).join(',')}]));
    assert_eq!(fold_m(immediate(),Func3::Static(collect),mk_string("seed;"),object).unwrap_string(),${JSON.stringify(reference.vectors[i])},"vector ${i}");`).join('\n')}\n}`;
const constants = `const EXPECTED_EAGER:&str=${JSON.stringify(reference.eager)};
const EXPECTED_DEFERRED_FIRST:&str=${JSON.stringify(reference.deferredFirst)};
const EXPECTED_DEFERRED_SECOND:&str=${JSON.stringify(reference.deferredSecond)};
const EXPECTED_REPEATED:&[&str]=&${JSON.stringify(reference.repeated)};
const EXPECTED_SHORT_CIRCUIT_BINDS:usize=${reference.shortBinds};\n`;
const prelude = codegenPrelude(fromFoldable(foldableArray)(ordString)(['']));
try {
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', dir = join(directory, mode); mkdirSync(dir);
    const adapt = source => threaded ? threadedRust(source) : source;
    const code = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
extern crate self as Purs_Foreign_Object_ST;
mod perceus_ptr { ${read('tests/runtime/perceus_ptr/src/lib.rs').replace('mod local;', `mod local { ${read('tests/runtime/perceus_ptr/src/local.rs')} }`).replace('mod threaded;', `mod threaded { ${read('tests/runtime/perceus_ptr/src/threaded.rs')} }`)} }
mod object_st { ${adapt(read('../purust-foreign-object/src/Foreign/Object/ST.rs'))} }
pub use object_st::STObject;
mod object { ${adapt(read('../purust-foreign-object/src/Foreign/Object.rs'))} }
use object::Object;
mod exception { ${adapt(read('../purust-exceptions/src/Effect/Exception.rs'))} }
${constants}${adapt(read('tests/codegen/fixtures/foreign-object-foldm.rs'))}
${adapt(vectors)}`;
    writeFileSync(join(dir, 'checks.rs'), code);
    writeFileSync(join(dir, 'Cargo.toml'), '[package]\nname="object_foldm_ffi"\nversion="0.0.0"\nedition="2021"\n[lib]\npath="checks.rs"\n[features]\nthreaded=[]\n');
    const args = ['exec', '-w', remote(dir), '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0', '-e', 'CARGO_PROFILE_TEST_DEBUG=0',
      '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo', 'test', '--offline', '--quiet', ...(threaded ? ['--features', 'threaded'] : []), '--lib', '--', '--test-threads=1'];
    const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
    writeFileSync(join(directory, `test-${mode}.json`), JSON.stringify({ args, status: result.status, error: result.error?.message,
      stdout: result.stdout, stderr: result.stderr }, null, 2));
    report.commands.push({ mode, status: result.status }); save();
    assert.equal(result.status, 0, `${mode}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    // The local perceus_ptr source also contributes four native unit tests.
    const foldTests = threaded ? 11 : 10, runtimeTests = threaded ? 0 : 4;
    const expected = foldTests + runtimeTests;
    assert.match(result.stdout, new RegExp(`${expected} passed; 0 failed`));
    report.modes.push({ mode, tests: expected, foldTests, runtimeTests, vectors: cases.length, concurrentReplays: threaded ? 512 : 0 }); save();
    console.log(`${mode}: ${expected} tests, ${cases.length} original JS vectors passed`);
  }
  report.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, `input changed: ${input.path}`));
  report.complete = true;
} finally { save(); }
