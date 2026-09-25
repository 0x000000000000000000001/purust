// Fresh PS -> _xxhash64 Effect -> native Promise -> original Promise.Aff.toAffE.
// Aff's native executor requires Arc; the separate differential test covers Rc too.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const b8x = resolve(root, '../../b8x'), profile = join(b8x, 'run/bak/rust'), mount = resolve(profile, '..');
const fixture = join(root, 'tests/tast/fixtures/crypto-hash/CryptoHashProbe.purs');
const source = join(b8x, 'src/Util/Crypto/Hash.purs');
const lock = JSON.parse(readFileSync(join(profile, 'spago.lock')));
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  const pkg = lock.packages[name]; assert.ok(pkg, name);
  names.add(name); pkg.dependencies.forEach(visitPackage);
}
visitPackage('js-promise-aff');
const roots = [...names].map(name => {
  const pkg = lock.packages[name];
  return pkg.type === 'local' ? resolve(profile, pkg.path, 'src') : join(profile, `.spago/p/${name}-${pkg.version}/src`);
});
const directory = mkdtempSync(join(profile, 'output/purust-crypto-hash-tast-'));
const remote = path => '/var/www/b8x/run/bak/' + relative(mount, path);
const report = { complete: false, commands: [], mode: 'Arc Linux (Aff executor)' };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
console.log(directory);
function run(label, executable, args, cwd = directory, expected = 0) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GHCRTS: '-N2' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ executable, args, status: result.status,
    stdout: result.stdout, stderr: result.stderr, error: result.error?.message }, null, 2));
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, expected, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  const fork = resolve(root, '../../purescript/.stack-work/dist');
  const candidates = globSync('**/build/purs/purs', { cwd: fork });
  if (!process.env.PURS) assert.equal(candidates.length, 1);
  const purs = process.env.PURS ?? join(fork, candidates[0]);
  const graph = JSON.parse(run('graph', purs, ['graph', fixture, source,
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const sources = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || sources.has(name)) return;
    assert.ok(graph[name], name); sources.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('CryptoHashProbe');
  const snapshot = join(directory, 'purust.mjs'); writeFileSync(snapshot, readFileSync(join(root, 'bin/purust.js')));
  report.bundleAtStart = hash(join(root, 'bin/purust.js'));
  report.inputs = [purs, snapshot, fileURLToPath(import.meta.url), join(profile, 'spago.lock'), ...sources.values(),
    ...[...sources.values()].flatMap(path => ['.js', '.rs', '.rs.cargo.json'].map(ext => path.replace(/\.purs$/, ext)).filter(existsSync))]
    .map(path => ({ path, sha256: hash(path) }));
  const tast = join(directory, 'tast'), rust = join(directory, 'rust');
  run('tast', purs, ['compile', ...sources.values(), '--codegen', 'corefn,js', '--output', tast]);
  const typed = JSON.parse(readFileSync(join(tast, 'Util.Crypto.Hash/corefn.json')));
  assert.ok(typed.typeTable.length > 0); assert.equal(typed.modulePath, source);
  report.modules = sources.size;
  const referenceInputs = ['', 'abc', 'é😀', '\ud800', '\udfff', '\ud800a\udc00',
    JSON.stringify({ type: 'RaisedInt', value: 42 }), JSON.stringify({ subject: 'é😀', n: 1 }), 'v1', '0'];
  const request = join(directory, 'reference-request.json');
  writeFileSync(request, JSON.stringify({ inputs: referenceInputs, source: readFileSync(source.replace(/\.purs$/, '.js'), 'utf8') }));
  const reference = JSON.parse(run('reference', 'docker', ['exec', 'core-api-cli-1', 'node', '--input-type=module', '-e', `
import {readFileSync} from 'node:fs'; import {createRequire} from 'node:module'; import {pathToFileURL} from 'node:url';
const require=createRequire('/var/www/b8x/run/bak/js/package.json');
const request=JSON.parse(readFileSync(process.argv[1],'utf8'));
const source=request.source.replace("import('xxhash-wasm')",'import('+JSON.stringify(pathToFileURL(require.resolve('xxhash-wasm')).href)+')');
const ffi=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
console.log(JSON.stringify(await Promise.all(request.inputs.map(input=>ffi._xxhash64(input)()))));`, remote(request)]).stdout);
  assert.equal(reference.length, referenceInputs.length); report.reference = reference;
  run('generate', process.execPath, ['--stack-size=65536', snapshot, '--source', tast, '--out', rust, '--main', 'CryptoHashProbe', '--threaded']);
  const ffiFile = join(rust, 'Purs_Util_Crypto_Hash/src/lib.rs');
  let code = readFileSync(ffiFile, 'utf8');
  assert.ok(code.includes(threadedRust(readFileSync(source.replace(/\.purs$/, '.rs'), 'utf8'))));
  assert.match(code, /pub fn Util_Crypto_Hash__xxhash64\(input: String\) -> crate::UnknownType/);
  const guards = ['_md5', '_sha256', 'hmacSha256'];
  for (const name of guards) {
    const pattern = new RegExp(`^pub fn Util_Crypto_Hash_${name}\\((.*)\\) -> String \\{ [^\\n]* \\}$`, 'm');
    const stub = code.match(pattern); assert.ok(stub, `Unported ${name} must have an identifiable fallback`);
    code = code.replace(stub[0], `pub fn Util_Crypto_Hash_${name}(${stub[1]}) -> String { eprintln!("HASH_FATAL_GUARD:${name}"); std::process::exit(86) }`);
  }
  writeFileSync(ffiFile, code);
  const hex = input => Array.from({ length: input.length }, (_, i) => input.charCodeAt(i).toString(16).padStart(4, '0')).join('');
  const crate = join(rust, 'Purs_CryptoHashProbe'); mkdirSync(join(crate, 'examples'));
  const checks = `
use purust_core::{Value, Func1}; use std::sync::{Arc,Mutex};
fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("_md5") => { Purs_Util_Crypto_Hash::Util_Crypto_Hash__md5(String::new()); return; }
        Some("_sha256") => { Purs_Util_Crypto_Hash::Util_Crypto_Hash__sha256(String::new()); return; }
        Some("hmacSha256") => { Purs_Util_Crypto_Hash::Util_Crypto_Hash_hmacSha256(String::new(),String::new()); return; }
        _ => {}
    }
    let results=Arc::new(Mutex::new(Vec::<String>::new()));
    let expected=vec![${reference.map(v => JSON.stringify(v) + '.to_owned()').join(',')}];
    let inputs=vec![${referenceInputs.map(v => JSON.stringify(hex(v))).join(',')}];
    Purs_Effect_Aff::purust_aff_run_main(|| {
        for input in inputs {
            let text=purust_core::purust_string_from_utf16(&input.as_bytes().chunks_exact(4).map(|v|
                u16::from_str_radix(std::str::from_utf8(v).unwrap(),16).unwrap()).collect::<Vec<_>>());
            let results=results.clone();
            let complete=Func1::Shared(Arc::new(move |value: String| {
                let results=results.clone();
                Value::Func1(Func1::Shared(Arc::new(move |_| { results.lock().unwrap().push(value.clone()); Value::Unit })))
            }));
            let effect=Purs_CryptoHashProbe::CryptoHashProbe_run(text,complete);
            effect.unwrap_func1()(Value::Unit);
        }
        Value::Unit
    });
    let mut actual=results.lock().unwrap().clone(); actual.sort(); let mut expected=expected; expected.sort();
    assert_eq!(actual,expected); println!("10 hashes passed through original PS xxhash64/toAffE with native Promise");
}`;
  writeFileSync(join(crate, 'examples/hash_pipeline.rs'), checks);
  const prefix = ['exec', '-w', remote(rust), '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0',
    '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1'];
  run('fetch', 'docker', [...prefix, 'cargo', 'fetch']);
  run('build', 'docker', [...prefix, 'cargo', 'build', '--offline', '--quiet', '-p', 'Purs_CryptoHashProbe', '--example', 'hash_pipeline']);
  const binary = remote(join(rust, 'target/debug/examples/hash_pipeline'));
  const tested = run('pipeline', 'docker', [...prefix, 'timeout', '-k', '1s', '10s', binary]);
  assert.match(tested.stdout, /10 hashes passed/); assert.equal(tested.stderr, '');
  for (const name of guards) {
    const guarded = run(`guard-${name}`, 'docker', [...prefix, binary, name], directory, 86);
    assert.equal(guarded.stderr, `HASH_FATAL_GUARD:${name}\n`);
  }
  report.cases = reference.length; report.fatalGuards = guards;
  report.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, `input changed: ${input.path}`));
  report.complete = true;
} finally { save(); }
