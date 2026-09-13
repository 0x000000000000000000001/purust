// Fresh TAST, type-only FFI resolution, isolated negative controls and relocated exports.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/ffi-cargo/', import.meta.url));
const directory = mkdtempSync(join(process.env.PURUST_FFI_CARGO_KEEP_OUTPUT ?? tmpdir(), 'purust-ffi-cargo-'));
const commands = [], modes = [];
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const originalInputs = [...globSync('*', { cwd: fixture }).map(p => join(fixture, p)), join(root, 'bin/purust.js')]
  .map(path => ({ path, sha256: hash(path) }));
function run(executable, args, cwd = directory, expected = 0) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ executable, args, cwd, status: result.status, signal: result.signal,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.signal, null);
  if (expected === 'nonzero') assert.ok(Number.isInteger(result.status) && result.status !== 0, result.stdout);
  else assert.equal(result.status, expected, `${executable}: ${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  const input = join(directory, 'input'); cpSync(fixture, input, { recursive: true });
  const sidecar = join(input, 'CargoValue.rs.cargo.json'), declaration = readFileSync(sidecar);
  const sources = [...globSync('*.purs', { cwd: input }).map(p => join(input, p)),
    ...['prelude', 'effect'].flatMap(name => globSync('**/*.purs', { cwd: resolve(root, `../purust-${name}/src`) })
      .map(p => resolve(root, `../purust-${name}/src`, p)))];
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run(purs, ['graph', ...sources]).stdout), selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name); selected.set(name, resolve(directory, graph[name].path));
    graph[name].depends.forEach(visit);
  }
  visit('CargoDependency');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...selected.values(), '--codegen', 'corefn', '--output', tast]);
  const typed = JSON.parse(readFileSync(join(tast, 'CargoValue/corefn.json')));
  assert.ok(Array.isArray(typed.typeTable) && Array.isArray(typed.dataDecls));
  assert.deepEqual(typed.foreign, [], 'Exercise FFI dependencies even without foreign value declarations.');
  const compiler = join(directory, 'standalone compiler'); mkdirSync(compiler);
  const bundle = join(compiler, 'purust.mjs'); cpSync(join(root, 'bin/purust.js'), bundle);
  const generate = (out, threaded, expected = 0) => run(process.execPath, ['--stack-size=65536', bundle,
    '--source', tast, '--out', out, '--main', 'CargoDependency', ...(threaded ? ['--threaded'] : [])], directory, expected);
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', original = join(directory, `generated-${mode}`);
    generate(original, threaded);
    const relocated = join(directory, `relocated ${mode}`); renameSync(original, relocated);
    assert.equal(existsSync(original), false);
    const manifests = globSync(['Cargo.toml', '*/Cargo.toml'], { cwd: relocated });
    assert.deepEqual(manifests.filter(p => /num-bigint-dig\s*=/.test(readFileSync(join(relocated, p), 'utf8'))),
      ['Purs_CargoValue/Cargo.toml'], 'Only the resolved type-only FFI crate may receive the registry dependency.');
    const metadata = JSON.parse(run('cargo', ['metadata', '--offline', '--format-version', '1'], relocated).stdout);
    const pkg = metadata.packages.find(p => p.name === 'num-bigint-dig');
    assert.equal(pkg.version, '0.8.6'); assert.match(pkg.source, /^registry\+/);
    const native = metadata.packages.find(p => p.name === 'Purs_CargoValue');
    const dependency = native.dependencies.find(d => d.name === 'num-bigint-dig');
    assert.equal(dependency.req, '=0.8.6'); assert.equal(dependency.uses_default_features, false);
    assert.deepEqual(dependency.features, ['i128']);
    assert.deepEqual(metadata.resolve.nodes.find(n => n.id === pkg.id).features, ['i128']);
    for (const path of manifests) assert.ok(!readFileSync(join(relocated, path), 'utf8').includes(directory));
    assert.equal(run('cargo', ['run', '--offline', '--locked', '--quiet'], relocated).stdout, 'FFI_CARGO_OK\n');
    modes.push({ mode, relocated, lockSha256: hash(join(relocated, 'Cargo.lock')), checks: 'metadata, scoping, relocation, native execution' });
    console.log(`${mode}: ${selected.size} fresh TAST modules; relocated native execution passed`);
  }
  rmSync(sidecar);
  const missing = join(directory, 'missing-dependency'); generate(missing, false);
  assert.ok(!readFileSync(join(missing, 'Purs_CargoValue/Cargo.toml'), 'utf8').includes('num-bigint-dig'));
  assert.match(run('cargo', ['check', '--offline', '-p', 'Purs_CargoValue', '--message-format=short'], missing, 101).stderr,
    /unresolved import `num_bigint_dig`/);
  // Reusing an export cannot preserve a removed declaration.
  const reused = modes[0].relocated; generate(reused, false);
  assert.ok(!readFileSync(join(reused, 'Purs_CargoValue/Cargo.toml'), 'utf8').includes('num-bigint-dig'));
  writeFileSync(sidecar, declaration); generate(reused, false);
  for (const [name, value] of [['malformed', '{bad'], ['reserved', '{"schema":1,"dependencies":{"purust_core":{"version":"=1.0.0"}}}']]) {
    writeFileSync(sidecar, value);
    const out = join(directory, `invalid-${name}`);
    assert.match(generate(out, false, 'nonzero').stderr, /Invalid FFI Cargo declaration/);
    assert.equal(existsSync(join(out, 'Cargo.toml')), false);
  }
  writeFileSync(sidecar, declaration);
  for (const file of originalInputs) assert.equal(hash(file.path), file.sha256);
  writeFileSync(join(directory, 'report.json'), JSON.stringify({ complete: true, freshModules: selected.size, modes,
    originalInputs, negativeControls: ['missing dependency E0432', 'removed declaration refresh', 'malformed JSON', 'reserved name'] }, null, 2) + '\n');
} finally {
  if (process.env.PURUST_FFI_CARGO_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
