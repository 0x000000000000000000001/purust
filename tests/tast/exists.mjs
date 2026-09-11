// Fresh TAST for the actual existential library, then native calls to its exports.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const existsSource = join(root, '.spago/p/exists-6.0.0/src/Data/Exists.purs');
const unsafeSource = fileURLToPath(new URL('../../../purust-unsafe-coerce/src/Unsafe/Coerce.purs', import.meta.url));
for (const source of [existsSource, unsafeSource]) assert.ok(existsSync(source), source);
const directory = mkdtempSync(join(tmpdir(), 'purust-exists-'));
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: directory, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const tast = join(directory, 'tast');
  run(process.env.PURS ?? 'purs', ['compile', existsSource, unsafeSource,
    '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Data.Exists/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls), 'Use the TAST fork.');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'Data.Exists', ...(threaded ? ['--threaded'] : [])]);
    const exists = readFileSync(join(rust, 'Purs_Data_Exists/src/lib.rs'), 'utf8');
    assert.doesNotMatch(exists, /(?:crate|Purs_Data_Exists)::Exists\b/);
    const libraries = new Map();
    function library(name, source, dependencies) {
      const output = join(rust, `lib${name}.rlib`);
      run('rustc', ['--edition=2021', '-Awarnings', '--crate-type=rlib', '--crate-name', name,
        ...(threaded ? ['--cfg', 'feature="threaded"'] : []), source, '-o', output,
        '-L', `dependency=${rust}`, ...dependencies.flatMap(dep => ['--extern', `${dep}=${libraries.get(dep)}`])]);
      libraries.set(name, output);
    }
    library('perceus_ptr', join(root, 'tests/runtime/perceus_ptr/src/lib.rs'), []);
    library('purust_core', join(rust, 'purust_core/src/lib.rs'), ['perceus_ptr']);
    library('Purs_Unsafe_Coerce', join(rust, 'Purs_Unsafe_Coerce/src/lib.rs'), ['perceus_ptr', 'purust_core']);
    library('Purs_Data_Exists', join(rust, 'Purs_Data_Exists/src/lib.rs'), ['perceus_ptr', 'purust_core', 'Purs_Unsafe_Coerce']);
    const checks = `
use purust_core::*;
use Purs_Data_Exists::*;
use std::rc::Rc;
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
fn main() {
    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let consume = Func1::Shared(Rc::new(move |value: Value| {
        seen.fetch_add(1, Ordering::SeqCst);
        mk_int(value.unwrap_int() + 1)
    }));
    let payload = Data_Exists_mkExists(mk_int(41));
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(Data_Exists_runExists(consume.clone(), payload.clone()).unwrap_int(), 42);
    assert_eq!(Data_Exists_runExists(consume, payload).unwrap_int(), 42);
    assert_eq!(calls.load(Ordering::SeqCst), 2);

    let text = Data_Exists_mkExists(mk_string("same value"));
    let identity = Func1::Static(|value: Value| value);
    assert_eq!(Data_Exists_runExists(identity.clone(), text).unwrap_string(), "same value");
    let array = Rc::new(vec![mk_int(7)]);
    let hidden = Data_Exists_mkExists(Value::Array(array.clone()));
    let returned = Data_Exists_runExists(identity.clone(), hidden).unwrap_array();
    assert!(Rc::ptr_eq(&array, &returned), "packing must preserve payload identity");

    let seen = calls.clone();
    let action = Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        mk_int(99)
    }));
    let hidden = Data_Exists_mkExists(Value::Func1(action.clone()));
    let returned = Data_Exists_runExists(identity, hidden).unwrap_func1();
    assert_eq!(calls.load(Ordering::SeqCst), 2, "returning a function must not execute it");
    match (&action, &returned) {
        (Func1::Shared(a), Func1::Shared(b)) => assert!(Rc::ptr_eq(a, b)),
        _ => panic!("packing replaced a captured function"),
    }
    assert_eq!(returned(Value::Unit).unwrap_int(), 99);
    assert_eq!(calls.load(Ordering::SeqCst), 3);
    ${threaded ? `let payload = Data_Exists_mkExists(mk_int(42));
    std::thread::spawn(move || {
        assert_eq!(Data_Exists_runExists(Func1::Static(|x| x), payload).unwrap_int(), 42);
    }).join().unwrap();` : ''}
}
`;
    const source = join(rust, 'checks.rs');
    writeFileSync(source, threaded ? threadedRust(checks) : checks);
    const binary = join(rust, 'checks');
    run('rustc', ['--edition=2021', '-Awarnings', source, '-o', binary, '-L', `dependency=${rust}`,
      ...['purust_core', 'Purs_Data_Exists'].flatMap(name => ['--extern', `${name}=${libraries.get(name)}`])]);
    run(binary, []);
    console.log(`Data.Exists (${mode}): packing, rank-2 callback, payload identity and deferred results passed.`);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
