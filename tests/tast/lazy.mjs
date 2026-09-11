// Fresh TAST and Cargo tests for the real Data.Lazy library and its dictionary.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(new URL('fixtures/lazy/', import.meta.url));
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = ['lazy', 'prelude', 'foldable-traversable', 'unsafe-coerce'];
const packageNames = new Set();
function visitPackage(name) {
  if (packageNames.has(name)) return;
  assert.ok(packages[name], name);
  packageNames.add(name);
  for (const dependency of packages[name].dependencies) visitPackage(dependency);
}
visitPackage('lazy');
const roots = [...packageNames].map(name => native.includes(name)
  ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
for (const sourceRoot of roots) assert.ok(existsSync(sourceRoot), sourceRoot);
const directory = mkdtempSync(join(process.env.PURUST_LAZY_KEEP_OUTPUT ?? tmpdir(), 'purust-lazy-tast-'));
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
  const graph = JSON.parse(run(purs, ['graph', join(fixtures, 'LazyProbe.purs'),
    ...roots.flatMap(sourceRoot => globSync('**/*.purs', { cwd: sourceRoot }).map(file => join(sourceRoot, file)))]));
  const selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name);
    selected.set(name, resolve(directory, graph[name].path));
    for (const dependency of graph[name].depends) visit(dependency);
  }
  visit('LazyProbe');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...selected.values(), '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Data.Lazy/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.classDecls), 'Use the TAST fork.');
  assert.equal(input.modulePath, join(roots[0], 'Data/Lazy.purs'));
  const ffiFile = join(roots[0], 'Data/Lazy.rs');
  const ffi = readFileSync(ffiFile, 'utf8');
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify({
    purs, version: run(purs, ['--version']).trim(),
    bundleSha256: sha256(join(root, 'bin/purust.js')), ffiFile, ffiSha256: sha256(ffiFile),
    sources: [...selected].map(([module, source]) => ({ module, source, sha256: sha256(source) })),
  }, null, 2) + '\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'LazyProbe', ...(threaded ? ['--threaded'] : [])]);
    const code = readFileSync(join(rust, 'Purs_Data_Lazy/src/lib.rs'), 'utf8');
    assert.ok(code.includes(threaded ? threadedRust(ffi) : ffi), 'The actual FFI must be copied.');
    for (const name of ['defer', 'force']) {
      assert.equal([...code.matchAll(new RegExp(`pub fn Data_Lazy_${name}\\(`, 'g'))].length, 1);
      assert.doesNotMatch(code, new RegExp(`pub fn Data_Lazy_${name}[^\\n]*unimplemented!`));
    }
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_LazyProbe']);
    const tests = join(rust, 'Purs_LazyProbe/tests');
    mkdirSync(tests);
    const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'lazy.rs'), threaded ? threadedRust(checks) + `
#[test]
fn generated_lazy_can_cross_threads() {
    let value = LazyProbe_construct(42);
    std::thread::spawn(move || assert_eq!(LazyProbe_consume(value), 42)).join().unwrap();
}
` : checks);
    const result = run('cargo', ['test', '--offline', '--manifest-path', manifest,
      '-p', 'Purs_LazyProbe', '--test', 'lazy', '--', '--test-threads=1']);
    console.log(`${mode}, ${selected.size} fresh modules: ${result.trim().split('\n').at(-1)}`);
  }
} finally {
  if (process.env.PURUST_LAZY_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
