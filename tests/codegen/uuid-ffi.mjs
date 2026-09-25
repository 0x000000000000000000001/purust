// Compare all four unchanged Data.UUID JS exports with the installed b8x uuid.
// Compile only a small native fixture with the actual runtime and Exception FFI.
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
const output = process.env.PURUST_UUID_OUTPUT ?? join(mount, 'rust/output');
const directory = mkdtempSync(join(output, 'purust-uuid-'));
assert.ok(!relative(mount, directory).startsWith('..'), 'The isolated fixture must be in the Docker mount.');
const remote = path => '/var/www/b8x/run/bak/' + relative(mount, path);
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const fixtureSource = read('../purust-uuid/src/Data/UUID.js');
const manifest = JSON.parse(read('../purust-uuid/src/Data/UUID.rs.cargo.json'));
const prelude = codegenPrelude(fromFoldable(foldableArray)(ordString)(['']));
const report = { complete: false, commands: [], modes: [], inputs: [
  'output/Purust.CodeGen/index.js', 'src/Purust/RecordFields.js', 'src/Purust/Utf16.js', 'src/Purust/Threading.js',
  'tests/codegen/uuid-ffi.mjs', 'tests/runtime/perceus_ptr/src/lib.rs', 'tests/runtime/perceus_ptr/src/local.rs',
  'tests/runtime/perceus_ptr/src/threaded.rs', '../purust-exceptions/src/Effect/Exception.rs',
  '../purust-uuid/src/Data/UUID.js', '../purust-uuid/src/Data/UUID.rs', '../purust-uuid/src/Data/UUID.rs.cargo.json',
].map(p => { const path = resolve(root, p); return { path, sha256: hash(path) }; }) };
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
console.log(directory);
function run(label, args) {
  const result = spawnSync('docker', args, { cwd: directory, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ args, status: result.status, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr }, null, 2));
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
const referenceScript = `
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const packageRoot='/var/www/b8x/run/bak/js/node_modules/uuid';
const require=createRequire('/var/www/b8x/run/bak/js/package.json');
const entry=require.resolve('uuid');
const request=JSON.parse(readFileSync(process.argv[1],'utf8'));
assert.equal((request.source.match(/from "uuid"/g)??[]).length,1);
// Only module resolution changes; execute the original four exported functions.
const source=request.source.replace('from "uuid"','from '+JSON.stringify(pathToFileURL(entry).href));
const ffi=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.deepEqual(Object.keys(ffi).sort(),['getUUID3Impl','getUUID5Impl','getUUIDImpl','validateV4UUID']);
const results=request.cases.map(item=>{
  try {
    const value=item.kind==='validate'?ffi.validateV4UUID(item.value):ffi[item.kind==='v3'?'getUUID3Impl':'getUUID5Impl'](item.name)(item.namespace);
    return {ok:true,value};
  } catch(error) {return {ok:false,name:error.name,message:error.message};}
});
const generated=new Set();
const action=ffi.getUUIDImpl;
for(let i=0;i<(request.v4Samples??0);i++) {
  const value=(i%2===0?action:ffi.getUUIDImpl)();
  assert.ok(ffi.validateV4UUID(value)); assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(!generated.has(value),'v4 replay must generate a fresh UUID'); generated.add(value);
}
function files(dir) {return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
const inputs=[join(packageRoot,'package.json'),...files(join(packageRoot,'dist-node'))].sort().map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
console.log(JSON.stringify({version:JSON.parse(readFileSync(join(packageRoot,'package.json'),'utf8')).version,entry,inputs,results,v4Unique:generated.size}));
`;
const cases = [], dns = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const nil = '00000000-0000-0000-0000-000000000000', max = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const validate = value => cases.push({ kind: 'validate', value });
const named = (name, namespace) => ['v3', 'v5'].forEach(kind => cases.push({ kind, name, namespace }));
const validNamespaces = [dns, dns.toUpperCase(), nil, max, max.toUpperCase(),
  ...Array.from({ length: 8 }, (_, i) => `01234567-89ab-${i + 1}def-8123-456789abcdef`)];
for (const version of '0123456789abcdef') for (const variant of '0123456789abcdef') {
  const value = `01234567-89ab-${version}def-${variant}123-456789abcdef`;
  validate(value); validate(value.toUpperCase());
}
const malformed = ['', 'not-a-uuid', dns.replaceAll('-', ''), `{${dns}}`, `urn:uuid:${dns}`, `URN:UUID:${dns}`,
  dns.slice(1), dns + '0', ' ' + dns, dns + ' ', dns + '\n', dns + '\r\n', '\0' + dns,
  dns.replace('-', '–'), '０' + dns.slice(1), 'é' + dns.slice(1), '\ud800' + dns.slice(1),
  dns + '\udfff', max.slice(0, -1) + 'e', nil.slice(0, -1) + '1'];
validNamespaces.forEach(validate); malformed.forEach(validate);
for (let i = 0; i < dns.length; i++) for (const replacement of ['_', ' ', '\0', 'g', '\n']) {
  validate(dns.slice(0, i) + replacement + dns.slice(i + 1));
}
const names = ['', 'hello', 'www.example.com', 'purescript', 'é', 'e\u0301', '😀', '𝄞', '中文',
  '\0\b\f\n\r\t', '\u2028\u2029', '\ud7ff\ue000\uffff', '\ufeff', 'x'.repeat(4097),
  '\ud800\udc00', '\udbff\udfff', '\ud800\udc00\udbff\udfff'];
for (const name of names) for (const namespace of validNamespaces) named(name, namespace);
for (const namespace of malformed) { named('valid name', namespace); named('\ud800', namespace); }
// Every isolated high/low surrogate, both with valid and invalid namespace.
for (let unit = 0xd800; unit <= 0xdfff; unit++) {
  const name = String.fromCharCode(unit);
  named(name, dns); named(name, 'invalid namespace');
}
for (const name of ['\ud800a', 'a\udfff', '\ud800\ud800', '\udfff\ud800',
  '\ud800\udc00\udfff', '😀\ud800', '\udfff😀']) {
  named(name, dns); named(name, 'invalid namespace');
}
for (let start = 0; start < 65536; start += 256) {
  named(String.fromCharCode(...Array.from({ length: 256 }, (_, i) => start + i)), dns);
}
const hex = value => Array.from({ length: value.length }, (_, i) => value.charCodeAt(i).toString(16).padStart(4, '0')).join('');
const checks = `
fn decode(hex: &str) -> String {
    let units = hex.as_bytes().chunks_exact(4).map(|chunk| u16::from_str_radix(std::str::from_utf8(chunk).unwrap(),16).unwrap()).collect::<Vec<_>>();
    purust_string_from_utf16(&units)
}
fn check_v4(value: &str) {
    assert!(ffi::Data_UUID_validateV4UUID(value.into()));
    assert_eq!(value.len(),36); assert_eq!(value.as_bytes()[14],b'4');
    assert!(b"89ab".contains(&value.as_bytes()[19]));
    assert!(value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b==b'-'));
}
fn main() {
    let mut tested=0;
    for line in include_str!("cases.tsv").lines() {
        let fields=line.split('\\t').collect::<Vec<_>>();
        if fields[0]=="validate" {
            assert_eq!(ffi::Data_UUID_validateV4UUID(decode(fields[1])),fields[2]=="true","validate vector {}",tested);
        } else {
            let name=decode(fields[1]); let namespace=decode(fields[2]);
            let result=exception::purust_exception_try(|| Value::String(if fields[0]=="v3" {
                ffi::Data_UUID_getUUID3Impl(name,namespace)
            } else { ffi::Data_UUID_getUUID5Impl(name,namespace) }));
            match (fields[3],result) {
                ("ok",Ok(value))=>assert_eq!(value.unwrap_string(),decode(fields[4]),"{} vector {}",fields[0],tested),
                ("error",Err(error))=>{
                    assert_eq!(exception::Effect_Exception_name(error.clone()),decode(fields[4]),"error class vector {}",tested);
                    assert_eq!(exception::Effect_Exception_message(error),decode(fields[5]),"error message vector {}",tested);
                },
                (_,Err(error))=>panic!("unexpected {}: {} at vector {}",exception::Effect_Exception_name(error.clone()),exception::Effect_Exception_message(error),tested),
                _=>panic!("expected exception at vector {}",tested),
            }
        }
        tested+=1;
    }
    let action=ffi::Data_UUID_getUUIDImpl();
    assert!(matches!(action,Value::Func1(_)),"getUUIDImpl is an Effect, not a cached UUID");
    let replay=action.unwrap_func1();
    let mut values=std::collections::HashSet::new();
    let mut generated=Vec::new();
    for i in 0..8192 {
        let value=if i%2==0 { replay(Value::Unit) } else { ffi::Data_UUID_getUUIDImpl().unwrap_func1()(Value::Unit) }.unwrap_string();
        check_v4(&value); assert!(values.insert(value.clone()),"v4 replay reused a UUID"); generated.push(value);
    }
    #[cfg(feature="threaded")]
    {
        let workers=(0..8).map(|_|{
            let shared=action.clone();
            std::thread::spawn(move || (0..512).map(|_| shared.unwrap_func1()(Value::Unit).unwrap_string()).collect::<Vec<_>>())
        }).collect::<Vec<_>>();
        for worker in workers { for value in worker.join().unwrap() {
            check_v4(&value); assert!(values.insert(value.clone()),"concurrent v4 reused a UUID"); generated.push(value);
        } }
    }
    std::fs::write("v4.tsv",generated.join("\\n")).unwrap();
    println!("UUID: {} differential vectors, {} unique native v4 UUIDs passed",tested,generated.len());
}`;
try {
  const request = join(directory, 'reference-request.json');
  writeFileSync(request, JSON.stringify({ source: fixtureSource, cases, v4Samples: 8192 }));
  const reference = JSON.parse(run('reference', ['exec', 'core-api-cli-1', 'node', '--input-type=module', '-e', referenceScript, remote(request)]).stdout);
  assert.equal(reference.results.length, cases.length); assert.equal(reference.v4Unique, 8192);
  report.reference = { version: reference.version, entry: reference.entry, inputs: reference.inputs, v4Unique: reference.v4Unique };
  report.vectors = { total: cases.length, validate: cases.filter(c => c.kind === 'validate').length,
    v3: cases.filter(c => c.kind === 'v3').length, v5: cases.filter(c => c.kind === 'v5').length,
    uriErrors: reference.results.filter(r => !r.ok && r.name === 'URIError').length,
    typeErrors: reference.results.filter(r => !r.ok && r.name === 'TypeError').length };
  const vectors = cases.map((item, i) => {
    const result = reference.results[i];
    if (item.kind === 'validate') { assert.ok(result.ok); return ['validate', hex(item.value), result.value].join('\t'); }
    return [item.kind, hex(item.name), hex(item.namespace), ...(result.ok ? ['ok', hex(result.value)] : ['error', hex(result.name), hex(result.message)])].join('\t');
  }).join('\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', dir = join(directory, mode); mkdirSync(dir);
    const adapt = source => threaded ? threadedRust(source) : source;
    const code = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
extern crate self as Purs_Effect_Exception;
mod perceus_ptr { ${read('tests/runtime/perceus_ptr/src/lib.rs').replace('mod local;', `mod local { ${read('tests/runtime/perceus_ptr/src/local.rs')} }`).replace('mod threaded;', `mod threaded { ${read('tests/runtime/perceus_ptr/src/threaded.rs')} }`)} }
mod exception { ${adapt(read('../purust-exceptions/src/Effect/Exception.rs'))} }
pub use exception::{purust_exception_raise,Effect_Exception_errorWithName};
mod ffi { ${adapt(read('../purust-uuid/src/Data/UUID.rs'))} }
${adapt(checks)}`;
    writeFileSync(join(dir, 'main.rs'), code); writeFileSync(join(dir, 'cases.tsv'), vectors);
    const dependency = manifest.dependencies.uuid;
    writeFileSync(join(dir, 'Cargo.toml'), `[package]\nname="uuid_ffi"\nversion="0.0.0"\nedition="2021"\n[[bin]]\nname="uuid_ffi"\npath="main.rs"\n[features]\nthreaded=[]\n[dependencies]\nuuid={version=${JSON.stringify(dependency.version)},features=${JSON.stringify(dependency.features)}}\n`);
    if (!threaded) run(`fetch-${mode}`, ['exec', '-w', remote(dir), 'core-api-cli-1', 'cargo', 'fetch']);
    const native = run(`native-${mode}`, ['exec', '-w', remote(dir), '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0',
      '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo', 'run', '--offline', '--quiet', ...(threaded ? ['--features', 'threaded'] : [])]);
    assert.equal(native.stderr, '', 'handled exceptions must not emit Rust panic diagnostics');
    const generated = readFileSync(join(dir, 'v4.tsv'), 'utf8').split('\n');
    assert.equal(generated.length, threaded ? 12288 : 8192);
    const crossRequest = join(directory, `${mode}-v4-request.json`);
    writeFileSync(crossRequest, JSON.stringify({ source: fixtureSource, cases: generated.map(value => ({ kind: 'validate', value })) }));
    const cross = JSON.parse(run(`native-v4-reference-${mode}`, ['exec', 'core-api-cli-1', 'node', '--input-type=module', '-e', referenceScript, remote(crossRequest)]).stdout);
    assert.deepEqual(cross.inputs, reference.inputs, 'installed JS package changed during validation');
    assert.ok(cross.results.every(result => result.ok && result.value === true));
    report.modes.push({ mode, vectors: cases.length, nativeV4Unique: generated.length, allNativeV4AcceptedByJS: true }); save();
    console.log(`${mode}: ${native.stdout.trim()}; all accepted by JS uuid ${reference.version}`);
  }
  report.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, `input changed: ${input.path}`));
  report.complete = true;
} finally { save(); }
