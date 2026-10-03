import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

assert(process.argv[2], 'test-native-directives.mjs GENERATED_COMPILER_RUST');
const rust = resolve(process.argv[2]);
const source = readFileSync(join(rust, 'Purs_PureScript_Backend_Optimizer_Directives/src/lib.rs'), 'utf8');
assert(source.includes('parseDirectiveLinePS') && source.includes('purust_directive_ascii'));
const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-directives-'));
mkdirSync(join(directory, 'src'));
const modules = ['purust_core', 'Purs_Data_Either', 'Purs_Data_Maybe', 'Purs_Data_Tuple',
  'Purs_PureScript_Backend_Optimizer_CoreFn', 'Purs_PureScript_Backend_Optimizer_Semantics',
  'Purs_PureScript_Backend_Optimizer_Directives', 'Purs_PureScript_Backend_Optimizer_Directives_Defaults'];
writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_directives_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-directives.rs', import.meta.url)));
console.log(`Retained directives test workspace: ${directory}`);
for (const [stage, command, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_directives_test'), []],
]) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  console.log(result.stdout.trim());
}
