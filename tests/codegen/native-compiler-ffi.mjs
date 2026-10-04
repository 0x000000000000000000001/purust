// Differential checks for the host services used by the self-hosted compiler.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';
import { threadedRust, threadedPrelude, rustModules } from '../../src/Purust/Threading.js';
import { foreignTypeForwards, foreignUnboundTypes } from '../../src/Purust/ForeignTypes.js';
import { rustStringLiteral, rustStrLiteral, rustCharLiteral } from '../../src/Purust/Utf16.js';
import { loadFfiCargo } from '../../src/Purust/FfiCargo.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-native-ffi-'));
const read = path => readFileSync(resolve(root, path), 'utf8');
const str = rustStringLiteral;
const vector = values => values.length ? `vec![${values.map(str).join(', ')}]` : 'Vec::<String>::new()';
const checks = [];
for (const text of [
  'use std::rc::Rc;\nfn f(x: impl Fn() + \'static) {}',
  '"Purs_Fake::call() std::rc::Rc"; Purs_Real::call();',
  'r###"Purs_Raw::call() std::rc::Rc"###; /* nested /* Purs_No:: */ */ Purs_Yes::f();',
  '// Purs_No::\nfn f<\'a>(x: &\'a Purs_Real::Type) {}',
  '"é😀\\\""; \'🦀\'; \'\\\\\'; std::rc::Rc::new(1);',
  'fn f(x: impl Fn() + Send + Sync + \'static) {}',
  'Class(std::rc::Rc<dyn std::any::Any>),\nStatic(fn(A) -> R>),',
]) {
  checks.push(`assert_eq!(threading::Purust_Threading_threadedRust(${str(text)}), ${str(threadedRust(text))});`);
  checks.push(`assert_eq!(threading::Purust_Threading_threadedPrelude(${str(text)}), ${str(threadedPrelude(text))});`);
  checks.push(`assert_eq!(strings(threading::Purust_Threading_rustModules(${str(text)})), ${vector(rustModules(text))});`);
}
const source = 'module Example where\nforeign import data Handle :: Type\nforeign import data Box :: Type -> Type\n';
for (const rust of ['', 'pub struct Handle { value: i32 }', 'pub enum Handle { A }',
  'pub type Handle = i32;', 'pub use native::Handle;', 'pub use native::Other as Handle;',
  'pub use native::{Other as Handle, X};']) {
  checks.push(`assert_eq!(foreign::Purust_ForeignTypes_foreignTypeForwards(${str(source)}, ${str(rust)}), ${str(foreignTypeForwards(source)(rust))});`);
  checks.push(`assert_eq!(strings(foreign::Purust_ForeignTypes_foreignUnboundTypes(${str(source)}, ${str(rust)})), ${vector(foreignUnboundTypes(source)(rust))});`);
}
const hidden = '-- foreign import data Hidden :: Type\n{- a {- foreign import data Hidden :: Type -} -}\ntext = """\nforeign import data Hidden :: Type\n"""\n';
checks.push(`assert_eq!(foreign::Purust_ForeignTypes_foreignTypeForwards(${str(hidden)}, String::new()), "");`);
// Scanning a large module with no declarations, or a binding near its end,
// must not depend on a backtracking engine's search budget.
const stressSources = [
  source.replaceAll('::', '∷'),
  'value = unit\n'.repeat(100_000),
  'value = unit\n'.repeat(100_000) + hidden + source,
  'foreign\n import\n data Handle :: Type\n' + hidden,
];
for (const [index, text] of stressSources.entries()) {
  const path = join(directory, `foreign-stress-${index}.purs`); writeFileSync(path, text);
  const loaded = `std::fs::read_to_string(${str(path)}).unwrap()`;
  checks.push(`assert_eq!(foreign::Purust_ForeignTypes_foreignTypeForwards(${loaded}, String::new()), ${str(foreignTypeForwards(text)(''))});`);
  checks.push(`assert_eq!(strings(foreign::Purust_ForeignTypes_foreignUnboundTypes(${loaded}, String::new())), ${vector(foreignUnboundTypes(text)(''))});`);
}
const largeRust = 'fn value() {}\n'.repeat(100_000) + 'pub use native::{Other as Handle, Box};\n';
const largeRustPath = join(directory, 'foreign-stress.rs'); writeFileSync(largeRustPath, largeRust);
checks.push(`assert_eq!(strings(foreign::Purust_ForeignTypes_foreignUnboundTypes(${str(source)}, std::fs::read_to_string(${str(largeRustPath)}).unwrap())), ${vector(foreignUnboundTypes(source)(largeRust))});`);
const primed = "foreign import data Handle' :: Type\nforeign import data Handle'' :: Type\nforeign import data Mid'dle :: Type\n";
checks.push(`assert_eq!(strings(foreign::Purust_ForeignTypes_foreignUnboundTypes(${str(primed)}, String::new())), ${vector(["Handle'", "Handle''", "Mid'dle"])});`);
checks.push(`assert_eq!(strings(foreign::Purust_ForeignTypes_foreignUnboundTypes(${str(primed.replaceAll('::', '∷'))}, String::new())), ${vector(["Handle'", "Handle''", "Mid'dle"])});`);
for (const native of ['', 'pub type Handle_prime = Native;', 'pub use native::{Handle_prime, Handle_prime_prime};', 'pub struct Handle {}']) {
  checks.push(`assert_eq!(strings(foreign::Purust_ForeignTypes_foreignUnboundTypes(${str(primed)}, ${str(native)})), ${vector(foreignUnboundTypes(primed)(native))});`);
  checks.push(`assert_eq!(foreign::Purust_ForeignTypes_foreignTypeForwards(${str(primed)}, ${str(native)}), ${str(foreignTypeForwards(primed)(native))});`);
}
if (process.env.PURUST_FFI_CORPUS) for (const path of globSync(join(process.env.PURUST_FFI_CORPUS, '**/*.purs')).sort()) {
  const text = readFileSync(path, 'utf8'), loaded = `std::fs::read_to_string(${str(path)}).unwrap()`;
  checks.push(`assert_eq!(strings(foreign::Purust_ForeignTypes_foreignUnboundTypes(${loaded}, String::new())), ${vector(foreignUnboundTypes(text)(''))}, ${rustStrLiteral(path)});`);
}
for (const text of ['', 'ascii "\\\'', 'é😀', '\ud800A\udfff', '\ue000\uffff', '\0\n\r\t']) {
  checks.push(`assert_eq!(utf16::Purust_Utf16_rustStrLiteral(${str(text)}), ${str(rustStrLiteral(text))});`);
  checks.push(`assert_eq!(utf16::Purust_Utf16_rustStringLiteral(${str(text)}), ${str(rustStringLiteral(text))});`);
  if (text) checks.push(`assert_eq!(utf16::Purust_Utf16_rustCharLiteral(${rustCharLiteral(text[0])}), ${str(rustCharLiteral(text[0]))});`);
}
mkdirSync(join(directory, 'src'));
const valid = { schema: 1, dependencies: {
  example: { version: '=1.2.3', 'default-features': false, features: ['abc', 'X_y+z'] },
} };
const invalid = [null, [], {}, { schema: 2, dependencies: {} }, { ...valid, extra: 1 },
  { schema: 1, dependencies: { example: { version: '*' } } },
  { schema: 1, dependencies: { tokio: { version: '=1.0.0' } } },
  { schema: 1, dependencies: { 'some-crate': { version: '=1.0.0' }, some_crate: { version: '=1.0.0' } } },
  { schema: 1, dependencies: { example: { version: '=1.0.0', features: ['a', 'a'] } } }];
for (const [index, value] of [valid, ...invalid].entries()) {
  const path = join(directory, `ffi-${index}.rs`);
  writeFileSync(`${path}.cargo.json`, JSON.stringify(value));
  if (index === 0) checks.push(`assert_eq!(run(cargo::Purust_FfiCargo_loadFfiCargo(${str(path)})).unwrap_string(), ${str(loadFfiCargo(path)())});`);
  else {
    assert.throws(() => loadFfiCargo(path)());
    checks.push(`assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| run(cargo::Purust_FfiCargo_loadFfiCargo(${str(path)})))).is_err());`);
  }
}
const modules = [
  ['threading', 'src/Purust/Threading.rs'], ['foreign', process.env.PURUST_FFI_SOURCE ?? 'src/Purust/ForeignTypes.rs'],
  ['utf16', 'src/Purust/Utf16.rs'], ['cargo', 'src/Purust/FfiCargo.rs'], ['metrics', 'src/Purust/Metrics.rs'],
  ['memo', '../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/BoundedMemo.rs'],
];
const main = `
// This standalone host-services fixture only exercises primitive string memo
// keys. Declare the two opaque compiler tree identities needed to compile the
// FFI; real ExprType/BackendSyntax identity and ownership are covered against
// generated compiler crates by tools/test-native-memo.mjs.
mod Purs_PureScript_Backend_Optimizer_CoreFn { pub enum ExprType {} }
mod Purs_PureScript_Backend_Optimizer_Syntax { pub enum BackendSyntax {} }
fn run(effect: Value) -> Value { effect.unwrap_func1()(Value::Unit) }
fn strings(value: Value) -> Vec<String> { value.unwrap_array().iter().map(|v| v.unwrap_string()).collect() }
fn main() {
    ${checks.join('\n    ')}
    let calls = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let count = calls.clone();
    let calculate = Value::Func2(Func2::Shared(std::sync::Arc::new(move |a, b| {
        count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        Value::String(a.unwrap_string() + &b.unwrap_string())
    })));
    let action = memo::PureScript_Backend_Optimizer_BoundedMemo_createStringMemo(1, calculate);
    let cache = run(action.clone()).unwrap_func2();
    for _ in 0..2 { assert_eq!(cache(mk_string("a"), mk_string("b")).unwrap_string(), "ab"); }
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
    cache(mk_string("c"), mk_string("d"));
    cache(mk_string("a"), mk_string("b"));
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 3);
    run(action).unwrap_func2()(mk_string("a"), mk_string("b"));
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 4);
    let start = run(metrics::Purust_Metrics_now()).unwrap_number();
    assert!(run(metrics::Purust_Metrics_now()).unwrap_number() >= start);
    println!("NATIVE_COMPILER_FFI_OK");
}
`;
try {
  writeFileSync(join(directory, 'Cargo.toml'), `[package]\nname = "native_compiler_ffi_checks"\nversion = "0.1.0"\nedition = "2021"\n[dependencies]\nfancy-regex = "0.13"\nregex = "=1.13.1"\nserde_json = "=1.0.145"\nperceus_ptr = { path = ${JSON.stringify(join(root, 'tests/runtime/perceus_ptr'))}, features = ["threaded"] }\n`);
  writeFileSync(join(directory, 'src/main.rs'), threadedPrelude(codegenPrelude(empty)) + '\nextern crate self as purust_core;\n' +
    modules.map(([name, path]) => `mod ${name} { use super::*;\n${threadedRust(read(path))}\n}\n`).join('') + main);
  const result = spawnSync('cargo', ['run', '--quiet'], { cwd: directory, encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, RUSTFLAGS: '-Awarnings' } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'NATIVE_COMPILER_FFI_OK');
  console.log(`Native compiler FFI: ${checks.length} JS/Rust differential assertions; bounded cache lifetime and monotonic clock passed.`);
} finally {
  if (process.env.PURUST_FFI_KEEP === '1') console.log(`Native FFI workspace retained: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
