// Only the cache's _xxhash64 export; original JS, actual Promise/Exception runtime.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mount = resolve(root, '../../b8x/run/bak');
const directory = mkdtempSync(join(mount, 'rust/output/purust-crypto-hash-'));
const remote = path => '/var/www/b8x/run/bak/' + relative(mount, path);
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest = JSON.parse(read('../../b8x/src/Util/Crypto/Hash.rs.cargo.json'));
const report = { complete: false, commands: [], modes: [], inputs: [
  'output/Purust.CodeGen/index.js', 'src/Purust/RecordFields.js', 'src/Purust/Utf16.js', 'src/Purust/Threading.js',
  'src/Purust/Microtasks.rs', 'tests/codegen/crypto-hash-ffi.mjs', 'tests/runtime/perceus_ptr/src/lib.rs',
  'tests/runtime/perceus_ptr/src/local.rs', 'tests/runtime/perceus_ptr/src/threaded.rs',
  '../purust-exceptions/src/Effect/Exception.rs', '../purust-js-promise/src/Promise/Internal.rs',
  '../../b8x/src/Util/Crypto/Hash.js', '../../b8x/src/Util/Crypto/Hash.rs', '../../b8x/src/Util/Crypto/Hash.rs.cargo.json',
].map(p => { const path = resolve(root, p); return { path, sha256: hash(path) }; }) };
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
console.log(directory);
function run(label, args) {
  const result = spawnSync('docker', args, { cwd: directory, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ args, status: result.status,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr }, null, 2));
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
const referenceScript = `
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire('/var/www/b8x/run/bak/js/package.json');
const entry=require.resolve('xxhash-wasm');
const request=JSON.parse(readFileSync(process.argv[1],'utf8'));
assert.equal((request.source.match(/import\\('xxhash-wasm'\\)/g)??[]).length,1);
const source=request.source.replace("import('xxhash-wasm')",'import('+JSON.stringify(pathToFileURL(entry).href)+')');
const ffi=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const values=[];
for (const input of request.inputs) {
  const action=ffi._xxhash64(input);
  assert.equal(typeof action,'function');
  const first=action(),second=action();
  assert.ok(first instanceof Promise); assert.ok(second instanceof Promise); assert.notStrictEqual(first,second);
  let delivered=false; first.then(()=>{delivered=true;}); assert.equal(delivered,false);
  const value=await first; assert.equal(await second,value); assert.match(value,/^[0-9a-f]{1,16}$/);
  values.push(value);
}
const packagePath='/var/www/b8x/run/bak/js/node_modules/xxhash-wasm/package.json';
console.log(JSON.stringify({version:JSON.parse(readFileSync(packagePath)).version,entry,
  inputs:[packagePath,entry].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),values}));
`;
const inputs = ['', 'a', 'abc', 'hello', 'é', 'e\u0301', '😀', '中文', '\0\b\n\r\t', '\ufeff',
  '\ud800a', 'a\udfff', '\ud800\ud800', '\udfff\ud800', '\ud800\udc00\udfff', '😀\ud800', '\udfff😀',
  JSON.stringify({ type: 'RaisedInt', value: 42 }), JSON.stringify({ subject: 'é😀', n: 1 }), 'v1', '0'];
for (let n = 0; n <= 96; n++) inputs.push('x'.repeat(n), '😀é'.repeat(n));
for (const n of [127, 128, 129, 255, 256, 257, 1023, 1024, 1025, 4095, 4096, 4097, 65536]) inputs.push('a'.repeat(n));
for (let unit = 0xd800; unit <= 0xdfff; unit++) inputs.push(String.fromCharCode(unit));
for (let start = 0; start < 65536; start += 256) inputs.push(String.fromCharCode(...Array.from({ length: 256 }, (_, i) => start + i)));
let state = 0x12345678;
for (let n = 0; n < 512; n++) inputs.push(String.fromCharCode(...Array.from({ length: n % 128 }, () => {
  state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state & 0xffff;
})));
const hex = value => Array.from({ length: value.length }, (_, i) => value.charCodeAt(i).toString(16).padStart(4, '0')).join('');
const checks = `
fn decode(hex: &str) -> String {
    purust_string_from_utf16(&hex.as_bytes().chunks_exact(4).map(|chunk|
        u16::from_str_radix(std::str::from_utf8(chunk).unwrap(),16).unwrap()).collect::<Vec<_>>())
}
fn main() {
    let queue=microtasks::Queue::new(|| {});
    let mut count=0;
    for line in include_str!("cases.tsv").lines() {
        let (input,expected)=line.split_once('\\t').unwrap();
        // Constructing the Effect does not require a Promise scope or hash yet.
        let action=ffi::Util_Crypto_Hash__xxhash64(decode(input));
        assert!(matches!(action,Value::Func1(_)));
        let (first,second)=queue.turn(|| (action.unwrap_func1()(Value::Unit),action.unwrap_func1()(Value::Unit)));
        assert!(!std::rc::Rc::ptr_eq(first.unwrap_class::<std::rc::Rc<promise::Promise>>(),second.unwrap_class::<std::rc::Rc<promise::Promise>>()));
        let delivered=std::rc::Rc::new(std::sync::Mutex::new(Vec::<String>::new()));
        for value in [first,second] {
            let delivered=delivered.clone();
            queue.turn(|| { promise::Promise_Internal_then_().unwrap_func2()(Value::Func1(Func1::Shared(std::rc::Rc::new(move |value| {
                delivered.lock().unwrap().push(value.unwrap_string()); Value::Unit
            }))),value); });
        }
        assert!(delivered.lock().unwrap().is_empty(),"Promise callback ran synchronously");
        queue.drain();
        assert_eq!(*delivered.lock().unwrap(),vec![expected.to_owned(),expected.to_owned()],"vector {}",count);
        assert!(!queue.has_jobs()); count+=1;
    }
    #[cfg(feature="threaded")]
    {
        let action=ffi::Util_Crypto_Hash__xxhash64(purust_string_from_utf8("concurrent😀"));
        let workers=(0..8).map(|_| { let action=action.clone(); std::thread::spawn(move || {
            let queue=microtasks::Queue::new(|| {});
            for _ in 0..64 { queue.turn(|| {
                let first=action.unwrap_func1()(Value::Unit); let second=action.unwrap_func1()(Value::Unit);
                assert!(!std::rc::Rc::ptr_eq(first.unwrap_class::<std::rc::Rc<promise::Promise>>(),second.unwrap_class::<std::rc::Rc<promise::Promise>>()));
            }); queue.drain(); }
        }) }).collect::<Vec<_>>();
        for worker in workers { worker.join().unwrap(); }
    }
    println!("xxhash64: {} JS differential vectors, Effect replay and asynchronous Promise reactions passed",count);
}
`;
try {
  const request = join(directory, 'reference-request.json');
  writeFileSync(request, JSON.stringify({ source: read('../../b8x/src/Util/Crypto/Hash.js'), inputs }));
  const reference = JSON.parse(run('reference', ['exec', 'core-api-cli-1', 'node', '--input-type=module', '-e', referenceScript, remote(request)]).stdout);
  assert.equal(reference.values.length, inputs.length);
  report.reference = { version: reference.version, entry: reference.entry, inputs: reference.inputs };
  report.vectors = { total: inputs.length, shortenedHex: reference.values.filter(v => v.length < 16).length, isolatedSurrogates: 2048 };
  assert.ok(report.vectors.shortenedHex > 0, 'Exercise unpadded hex'); save();
  const prelude = codegenPrelude(fromFoldable(foldableArray)(ordString)(['']));
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', dir = join(directory, mode); mkdirSync(dir);
    const adapt = source => threaded ? threadedRust(source) : source;
    const code = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
extern crate self as Purs_Effect_Exception;
extern crate self as Purs_Promise_Internal;
mod perceus_ptr { ${read('tests/runtime/perceus_ptr/src/lib.rs').replace('mod local;', `mod local { ${read('tests/runtime/perceus_ptr/src/local.rs')} }`).replace('mod threaded;', `mod threaded { ${read('tests/runtime/perceus_ptr/src/threaded.rs')} }`)} }
pub mod microtasks { ${adapt(read('src/Purust/Microtasks.rs'))} }
mod exception { ${adapt(read('../purust-exceptions/src/Effect/Exception.rs'))} }
pub use exception::*;
mod promise { ${adapt(read('../purust-js-promise/src/Promise/Internal.rs'))} }
pub use promise::*;
mod ffi { ${adapt(read('../../b8x/src/Util/Crypto/Hash.rs'))} }
${adapt(checks)}`;
    writeFileSync(join(dir, 'main.rs'), code);
    writeFileSync(join(dir, 'cases.tsv'), inputs.map((input, i) => hex(input) + '\t' + reference.values[i]).join('\n'));
    const dep = manifest.dependencies['xxhash-rust'];
    writeFileSync(join(dir, 'Cargo.toml'), `[package]\nname="crypto_hash_ffi"\nversion="0.0.0"\nedition="2021"\n[[bin]]\nname="crypto_hash_ffi"\npath="main.rs"\n[features]\nthreaded=[]\n[dependencies]\nxxhash-rust={version=${JSON.stringify(dep.version)},default-features=false,features=${JSON.stringify(dep.features)}}\n`);
    if (!threaded) run('fetch', ['exec', '-w', remote(dir), 'core-api-cli-1', 'cargo', 'fetch']);
    const tested = run(`native-${mode}`, ['exec', '-w', remote(dir), '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0',
      '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo', 'run', '--offline', '--quiet', ...(threaded ? ['--features', 'threaded'] : [])]);
    assert.equal(tested.stderr, '', 'No panic or warning expected');
    report.modes.push({ mode, vectors: inputs.length, replayedEffects: 2 * inputs.length, nativePromise: true, callbacksDeferred: true }); save();
    console.log(`${mode}: ${tested.stdout.trim()}`);
  }
  report.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, `input changed: ${input.path}`));
  report.complete = true;
} finally { save(); }
