import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareGeneratedSources, findTypedCompiler, nativeWorkspaceConfig } from './native-workspace.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.PURUST_NATIVE ? resolve(process.env.PURUST_NATIVE) : join(root, 'bin/purust-native');
const workspace = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-emission-test-'));
const compiler = findTypedCompiler(root, process.env.PURUST_PURS);
const env = { ...process.env, PATH: [dirname(compiler), join(root, 'node_modules/.bin'), process.env.PATH ?? ''].join(delimiter) };
console.log(`Retained emission test workspace: ${workspace}`);
function run(stage, command, args) {
  const result = spawnSync(command, args, { cwd: workspace, env, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(workspace, stage + '.log'), result.stdout + result.stderr);
  assert.equal(result.status, 0, `${stage}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
const config = nativeWorkspaceConfig(root);
writeFileSync(join(workspace, 'spago.yaml'), 'package:\n  name: emission-test\n  dependencies: [prelude, aff, arrays, console, effect, either, maybe, refs, exceptions, foldable-traversable, datetime]\n' + config.slice(config.indexOf('workspace:')));
mkdirSync(join(workspace, 'src'));
symlinkSync(join(root, 'src/Purust/Emission.purs'), join(workspace, 'src/Emission.purs'));
symlinkSync(join(root, 'tests/native-emission'), join(workspace, 'src/Test'));
run('typed-corefn', 'spago', ['build']);
const flags = ['--source', 'output', '--main', 'Test.Emission', '--threaded'];
run('js-generate', process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), ...flags, '--out', 'js-rust']);
run('native-generate', binary, [...flags, '--out', 'native-rust']);
const files = compareGeneratedSources(join(workspace, 'js-rust'), join(workspace, 'native-rust'));
run('cargo-build', 'cargo', ['build', '--offline', '--manifest-path', 'native-rust/Cargo.toml']);
const execution = run('native-run', join(workspace, 'native-rust/target/debug/purust_output'), []);
assert.equal(execution.stdout, 'EMISSION_NATIVE_OK 12 scenarios\n');
assert.equal(execution.stderr, '');
console.log(`${files} identical generated files; ${execution.stdout.trim()}`);
