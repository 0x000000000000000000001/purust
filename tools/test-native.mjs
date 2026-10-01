import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareGeneratedSources, findTypedCompiler, nativeWorkspaceConfig, verifyTypedOutput } from './native-workspace.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.PURUST_NATIVE ? resolve(process.env.PURUST_NATIVE) : join(root, 'bin/purust-native');
assert.ok(existsSync(binary), `Build ${binary} with npm run build:native first`);
const workspace = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-native-test-'));
const compiler = findTypedCompiler(root, process.env.PURUST_PURS);
const env = { ...process.env, PATH: [dirname(compiler), join(root, 'node_modules/.bin'), process.env.PATH ?? ''].join(delimiter) };
function run(stage, command, args) {
  const result = spawnSync(command, args, { cwd: workspace, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(workspace, stage + '.log'), result.stdout + result.stderr);
  assert.equal(result.status, 0, `${stage}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  console.log(`${stage}: passed`);
  return result.stdout;
}
let success = false;
try {
  const config = nativeWorkspaceConfig(root);
  writeFileSync(join(workspace, 'spago.yaml'), 'package:\n  name: native-smoke\n  dependencies: [prelude, effect, console, arrays]\n' + config.slice(config.indexOf('workspace:')));
  symlinkSync(join(root, 'tests/native'), join(workspace, 'src'), 'dir');
  run('typed-corefn', 'spago', ['build']);
  const metadata = verifyTypedOutput(join(workspace, 'output'));
  for (const [name, command, prefix] of [
    ['node', process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js')]],
    ['native', binary, []],
  ]) {
    run(`${name}-generate`, command, [...prefix, '--source', 'output', '--out', `${name}-rust`, '--main', 'Main']);
  }
  const files = compareGeneratedSources(join(workspace, 'node-rust'), join(workspace, 'native-rust'));
  const stdout = run('native-application', 'cargo', ['run', '--quiet', '--release', '--config', 'profile.release.lto=false',
    '--manifest-path', 'native-rust/Cargo.toml']);
  assert.equal(stdout.trim(), 'PURUST_NATIVE_OK 42');
  console.log(`Native smoke: ${metadata.modules} fresh TAST modules, ${files} identical generated files, application result verified.`);
  success = true;
} finally {
  if (success && !process.argv.includes('--keep-workspace')) rmSync(workspace, { recursive: true, force: true });
  else console.log(`Workspace and logs retained: ${workspace}`);
}
