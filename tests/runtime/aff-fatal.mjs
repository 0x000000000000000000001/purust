import assert from 'node:assert/strict';
import { globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { command } from '../../../../b8x/run/bak/rust/driver/process.mjs';
import { connectDocker } from '../../../../b8x/run/bak/rust/driver/docker.mjs';
import { candidateClosure, findCompiler, foreignInputs, resolvedFfiInputs, verifyResolutions } from '../../../../b8x/run/bak/rust/driver/profile.mjs';
import { fileRecord, verifyInputs, writeJson } from '../../../../b8x/run/bak/rust/driver/shared.mjs';
const tests = dirname(fileURLToPath(import.meta.url)), compiler = resolve(tests, '../..');
const b8x = resolve(compiler, '../../b8x'), profile = join(b8x, 'run/bak/rust');
const baseline = process.argv.includes('--baseline');
const directory = mkdtempSync(join(profile, 'output/aff-fatal-'));
// Cargo's shared target can retain another workspace's same-named executable.
// Keep dependency caching, but give every generated probe its own binary name.
const example = basename(directory);
const report = { complete: false, baseline, commands: [], cases: [] };
const save = () => writeJson(join(directory, 'report.json'), report);
async function run(label, executable, args, cwd = directory, expected = 0) {
  console.log(label);
  const result = await command(executable, args, { cwd, timeoutMs: 180000, maxOutputBytes: 12 * 1024 * 1024,
    env: { ...process.env, GHCRTS: '-N2' } });
  writeJson(join(directory, label + '.json'), result);
  report.commands.push({ label, status: result.status, elapsedMs: result.elapsedMs }); save();
  assert.equal(result.status, expected, `${label}: ${result.error ?? ''}\n${result.stdout.slice(-4000)}\n${result.stderr.slice(-6000)}`);
  return result;
}
console.log(directory);
try {
  const globs = JSON.parse((await run('sources', join(compiler, 'node_modules/.bin/spago'), ['sources', '--offline', '--json'], profile)).stdout);
  const candidates = [...new Set([...globSync(globs.map(g => resolve(profile, g))), join(tests, 'aff-fatal.purs')])];
  const graph = JSON.parse((await run('graph', findCompiler(b8x), ['graph', ...candidateClosure(candidates, 'AffFatalProbe')])).stdout);
  const selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    selected.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('AffFatalProbe');
  const snapshot = join(directory, 'purust.mjs');
  writeFileSync(snapshot, readFileSync(join(compiler, 'bin/purust.js')));
  report.compilerAtSnapshot = fileRecord(join(compiler, 'bin/purust.js'));
  report.inputs = [snapshot, ...selected.values(), fileURLToPath(import.meta.url), join(tests, 'aff-fatal-cases.rs')].map(fileRecord);
  const resolutions = await foreignInputs(b8x, directory, [...selected].map(([module, path]) => ({ module, ...fileRecord(path) })));
  report.inputs.push(...resolvedFfiInputs(resolutions));
  const tast = join(directory, 'tast'), rust = join(directory, 'rust');
  await run('tast', findCompiler(b8x), ['compile', ...selected.values(), '--codegen', 'corefn', '--output', tast]);
  await run('generate', process.execPath, ['--stack-size=65536', snapshot, '--source', tast, '--out', rust, '--main', 'AffFatalProbe', '--threaded',
    '--ffi-dir', relative(directory, join(profile, 'ffi'))]);
  const crate = join(rust, 'Purs_AffFatalProbe'), manifest = join(crate, 'Cargo.toml');
  assert.match(readFileSync(manifest, 'utf8'), /^tokio = /m);
  mkdirSync(join(crate, 'examples'));
  writeFileSync(join(crate, 'examples', example + '.rs'), readFileSync(join(tests, 'aff-fatal-cases.rs')));
  const docker = await connectDocker(b8x);
  report.platform = docker.platform;
  const remote = '/var/www/b8x/run/bak/rust/' + relative(profile, rust);
  const target = '/var/www/b8x/run/bak/rust/output/aff-fatal-target';
  const prefix = ['exec', '-w', remote, '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0', '-e', 'CARGO_INCREMENTAL=0',
    '-e', 'CARGO_TARGET_DIR=' + target, docker.id];
  await run('build', 'docker', [...prefix, 'timeout', '-k', '2s', '120s', 'cargo', 'build', '-p', 'Purs_AffFatalProbe', '--example', example]);
  for (const name of ['root-pending', 'root-active-fiber', 'fiber-pending', 'native-pending', 'completion-pending', 'microtask-pending',
    'fiber-alone', 'success', 'aff-error', 'handled-aff-error', 'main-error', 'completion-error']) {
    const fatal = name.includes('pending') || name === 'root-active-fiber' || name === 'fiber-alone';
    const success = name === 'success' || name === 'handled-aff-error';
    const expected = baseline && fatal && name !== 'fiber-alone' ? 124 : success ? 0 : 101;
    const result = await run(name, 'docker', [...prefix, 'timeout', '-k', '1s', '3s', target + '/debug/examples/' + example, name], directory, expected);
    if (fatal) {
      assert.match(result.stderr, /AFF_FATAL_/);
      assert.ok(!result.stdout.includes('MAIN_RETURNED'));
      if (!baseline) {
        assert.ok(result.elapsedMs < 2500, 'Fatal panic must not wait for unrelated active work');
        assert.match(result.stdout, /ORIGINAL_PANIC_RETHROWN/);
        if (name.includes('pending')) assert.match(result.stdout, /PENDING_DROPPED/);
      }
    } else {
      assert.match(result.stdout, /NATIVE_CLEANUP/);
      assert.ok(!result.stderr.includes('panicked at'), 'An Aff exception is not a Rust panic');
      assert.equal(result.stdout.includes('MAIN_RETURNED'), success);
      if (success) assert.ok(result.stdout.indexOf('NATIVE_CLEANUP') < result.stdout.indexOf('MAIN_RETURNED'));
      if (name.includes('aff-error')) assert.match(result.stdout, /BRACKET_CLEANUP/);
      if (!success) assert.match(result.stderr, /Error: ordinary Aff failure/);
      if (name === 'handled-aff-error') assert.match(result.stdout, /AFF_ERROR_HANDLED/);
    }
    report.cases.push({ name, status: result.status, elapsedMs: result.elapsedMs }); save();
  }
  await verifyResolutions(b8x, resolutions); verifyInputs(report.inputs); report.complete = true;
} finally { save(); }
