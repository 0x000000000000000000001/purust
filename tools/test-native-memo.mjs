// After regenerating the native compiler Rust:
//   node tools/test-native-memo.mjs GENERATED_COMPILER_RUST
//
// Differential contract for the BoundedMemo FFI on the threaded Arc model.
// The native cases mirror test/bounded-memo.mjs (JavaScript contract) and
// bounded-memo-native_test.go (Go/FFI contract), plus the compiler-tree
// reboxing fixed in BoundedMemo.rs: Semantics recreates the outer
// Rc<dyn Any> on every instantiateNeutral invocation, so the memo key must be
// the shared inner Rc<ExprType> / Rc<BackendSyntax> allocation.
//
// The generated crate is required to embed that inner-tree keying; a stale
// GENERATED_COMPILER_RUST fails before cargo runs.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [rustArg] = process.argv.slice(2);
assert(rustArg, 'Usage: node tools/test-native-memo.mjs GENERATED_COMPILER_RUST');
const rust = resolve(rustArg);

const sources = new Map();
const generatedSource = (module, required) => {
  if (!sources.has(module)) {
    const path = join(rust, module, 'src/lib.rs');
    assert.ok(existsSync(path), `GENERATED_COMPILER_RUST lacks ${module}/src/lib.rs; rebuild the native compiler first`);
    sources.set(module, readFileSync(path, 'utf8'));
  }
  const content = sources.get(module);
  for (const needle of [].concat(required)) {
    assert.ok(content.includes(needle),
      `GENERATED_COMPILER_RUST is stale: ${module} must contain ${JSON.stringify(needle)}`);
  }
  return content;
};

generatedSource('Purs_PureScript_Backend_Optimizer_BoundedMemo', [
  'PureScript_Backend_Optimizer_BoundedMemo_createBoundedMemo',
  'PureScript_Backend_Optimizer_BoundedMemo_createStringMemo',
  'downcast_ref::<Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>>()',
  'downcast_ref::<Rc<Purs_PureScript_Backend_Optimizer_Syntax::BackendSyntax>>()',
  'Pointer(3,',
  'Pointer(4,',
]);
generatedSource('Purs_PureScript_Backend_Optimizer_CoreFn', 'pub enum ExprType');
generatedSource('Purs_PureScript_Backend_Optimizer_Syntax', ['pub enum BackendSyntax', 'PrimUndefined']);
// The native compiler is generated with --threaded; the test source mirrors
// the Arc model with `use std::sync::Arc as Rc`.
generatedSource('purust_core', 'std::sync::Arc');

const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-native-memo-'));
mkdirSync(join(directory, 'src'));
const modules = ['purust_core', 'Purs_PureScript_Backend_Optimizer_CoreFn',
  'Purs_PureScript_Backend_Optimizer_Syntax', 'Purs_PureScript_Backend_Optimizer_BoundedMemo'];
writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_memo_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-memo.rs', import.meta.url), 'utf8'));
console.log(`Retained native memo test workspace: ${directory}`);
for (const [stage, executable, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_memo_test'), []],
]) {
  const run = spawnSync(executable, args, { encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), run.stdout + run.stderr);
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  if (run.stdout.trim()) console.log(run.stdout.trim());
}
