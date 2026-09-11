// Fresh TAST for record arithmetic and the actual Test.Spec.Summary library.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(new URL('fixtures/record-set/', import.meta.url));
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = ['prelude', 'foldable-traversable', 'unsafe-coerce', 'lazy', 'st', 'arrays', 'integers', 'numbers', 'exceptions', 'effect', 'partial', 'strings', 'unfoldable'];
const packageNames = new Set();
function visitPackage(name) {
  if (packageNames.has(name)) return;
  assert.ok(packages[name], name);
  packageNames.add(name);
  for (const dependency of packages[name].dependencies) visitPackage(dependency);
}
for (const name of ['arrays', 'datetime', 'exceptions', 'transformers', 'unsafe-coerce', 'ansi', 'strings']) visitPackage(name);
const roots = [...packageNames].map(name => native.includes(name)
  ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
for (const sourceRoot of roots) assert.ok(existsSync(sourceRoot), sourceRoot);
const directory = mkdtempSync(join(process.env.PURUST_RECORD_SET_KEEP_OUTPUT ?? tmpdir(), 'purust-record-set-tast-'));
const commands = [];
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8',
    timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, status: result.status, error: result.error?.message,
    signal: result.signal, stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run(purs, ['graph', join(fixtures, 'RecordSetProbe.purs'),
    ...['Summary', 'Result', 'Tree', 'Speed', 'Style'].map(name => resolve(root, `../purust-spec/src/Test/Spec/${name}.purs`)),
    ...roots.flatMap(sourceRoot => globSync('**/*.purs', { cwd: sourceRoot }).map(file => join(sourceRoot, file)))]));
  const selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name);
    selected.set(name, resolve(directory, graph[name].path));
    for (const dependency of graph[name].depends) visit(dependency);
  }
  visit('RecordSetProbe');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...selected.values(), '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Test.Spec.Summary/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls), 'Use the TAST fork.');
  assert.equal(input.modulePath, resolve(root, '../purust-spec/src/Test/Spec/Summary.purs'));
  const ffiFile = resolve(root, '../purust-prelude/src/Record/Unsafe.rs');
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify({
    purs, version: run(purs, ['--version']).trim(),
    bundleSha256: sha256(join(root, 'bin/purust.js')), ffiFile, ffiSha256: sha256(ffiFile),
    sources: [...selected].map(([module, source]) => ({ module, source, sha256: sha256(source) })),
  }, null, 2) + '\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'RecordSetProbe', ...(threaded ? ['--threaded'] : [])]);
    const ffi = readFileSync(ffiFile, 'utf8');
    const code = readFileSync(join(rust, 'Purs_Record_Unsafe/src/lib.rs'), 'utf8');
    assert.ok(code.includes(threaded ? threadedRust(ffi) : ffi));
    assert.equal([...code.matchAll(/pub fn Record_Unsafe_unsafeSet\(/g)].length, 1);
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_RecordSetProbe']);
    const tests = join(rust, 'Purs_RecordSetProbe/tests');
    mkdirSync(tests);
    const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'record_set.rs'), threaded ? threadedRust(checks) : checks);
    const result = run('cargo', ['test', '--offline', '--manifest-path', manifest,
      '-p', 'Purs_RecordSetProbe', '--test', 'record_set', '--', '--test-threads=1']);
    console.log(`${mode}, ${selected.size} fresh modules: ${result.trim().split('\n').at(-1)}`);
  }
} finally {
  if (process.env.PURUST_RECORD_SET_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
