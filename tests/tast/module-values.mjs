// Fresh typed input and unmodified generator output; real Ref/Unsafe FFI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = join(root, 'tests/tast/fixtures/module-values');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const names = new Set(), native = new Set(['prelude', 'effect', 'refs', 'unsafe-coerce', 'st', 'partial']);
function visitPackage(name) {
  if (names.has(name)) return;
  assert.ok(packages[name], name); names.add(name); packages[name].dependencies.forEach(visitPackage);
}
visitPackage('refs');
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
roots.forEach(path => assert.ok(existsSync(path), path));
const directory = mkdtempSync(join(process.env.PURUST_MODULE_VALUES_KEEP_OUTPUT ?? tmpdir(), 'purust-module-values-'));
console.log(`Diagnostic: ${directory}`);
const commands = [], hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function run(command, args, timeout = 90_000) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, status: result.status, signal: result.signal, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
let succeeded = false;
try {
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run(purs, ['graph', join(fixture, 'ModuleInitProbe.purs'), join(fixture, 'Counter.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]));
  const modules = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || modules.has(name)) return;
    assert.ok(graph[name], name); modules.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('ModuleInitProbe');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...modules.values(), '--codegen', 'corefn,js', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'ModuleInitProbe/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.classDecls));
  const ffi = ['refs/src/Effect/Ref', 'effect/src/Effect/Unsafe'].flatMap(path => ['js', 'rs'].map(ext => resolve(root, `../purust-${path}.${ext}`)));
  const provenance = { purs, bundleSha256: hash(join(root, 'bin/purust.js')),
    sources: [...modules].map(([module, path]) => ({ module, path, sha256: hash(path) })),
    ffi: [...ffi, join(fixture, 'Counter.js'), join(fixture, 'Counter.rs')].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  console.log(run(process.execPath, [join(fixture, 'js-probe.mjs'), tast]).trim());
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
      '--out', rust, '--main', 'ModuleInitProbe', ...(threaded ? ['--threaded'] : [])]);
    const generated = readFileSync(join(rust, 'Purs_ModuleInitProbe/src/lib.rs'), 'utf8');
    assert.match(generated, /module_values::Cell<i64>/, 'native values must not be erased for storage');
    const examples = join(rust, 'Purs_ModuleInitProbe/examples'); mkdirSync(examples);
    const native = readFileSync(join(fixture, 'native.rs'), 'utf8');
    writeFileSync(join(examples, 'module-values.rs'), threaded ? threadedRust(native) : native);
    writeFileSync(join(examples, 'cell-checks.rs'), readFileSync(join(fixture, 'cell-checks.rs'), 'utf8'));
    if (threaded) writeFileSync(join(examples, 'threaded.rs'), readFileSync(join(fixture, 'threaded.rs'), 'utf8'));
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_ModuleInitProbe']);
    run('cargo', ['build', '--offline', '--manifest-path', manifest, '-p', 'Purs_ModuleInitProbe', '--examples']);
    for (const name of ['shared', 'factory', 'action', 'dependent', 'native']) {
      run(join(rust, 'target/debug/examples/module-values'), [name]);
    }
    if (threaded) run(join(rust, 'target/debug/examples/threaded'), []);
    for (const name of ['poison', 'cycle', 'cross-cycle', 'concurrent-poison', 'concurrent-dependency']) {
      run(join(rust, 'target/debug/examples/cell-checks'), [name], 10_000);
    }
    console.log(`${mode}: ${modules.size} fresh TAST modules, module-value probes passed`);
  }
  assert.equal(hash(join(root, 'bin/purust.js')), provenance.bundleSha256);
  [...provenance.sources, ...provenance.ffi].forEach(source => assert.equal(hash(source.path), source.sha256));
  succeeded = true;
} finally {
  if (!succeeded || process.env.PURUST_MODULE_VALUES_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
