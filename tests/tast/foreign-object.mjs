// Actual Object FFI, generated PureScript callers and fatal residual-stub guards.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = join(root, 'tests/tast/fixtures/foreign-object');
const foreignRoot = resolve(root, '../purust-foreign-object');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = new Set(['prelude', 'st', 'unsafe-coerce', 'effect', 'refs', 'partial',
  'foreign-object', 'arrays', 'foldable-traversable', 'functions', 'unfoldable']);
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  assert.ok(packages[name], name); names.add(name); packages[name].dependencies.forEach(visitPackage);
}
visitPackage('foreign-object');
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
roots.forEach(path => assert.ok(existsSync(path), path));
const directory = mkdtempSync(join(process.env.PURUST_FOREIGN_OBJECT_KEEP_OUTPUT ?? tmpdir(), 'purust-foreign-object-'));
const commands = [], hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function run(command, args, expected = 0) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 90_000, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, status: result.status, signal: result.signal, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.status, expected, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
const marker = 'PURUST_OBJECT_FALLBACK_REACHED:';
// Every Object entry point is native now. Keep the scan so a re-introduced
// residual stub fails with its symbol name instead of a silent fallback.
function guardObject(code, foreign) {
  const guards = [];
  for (const name of foreign) {
    const symbol = `Foreign_Object_${name}`;
    assert.ok(new RegExp(`^pub fn ${symbol}\\(`, 'm').test(code), `Missing Object FFI entry point: ${symbol}`);
    const pattern = new RegExp(`^pub fn ${symbol}\\((.*)\\) -> (.+) \\{ (unimplemented!\\(\\)|false|0) \\}$`, 'm');
    const match = code.match(pattern);
    if (match) guards.push({ symbol, original: match[0] });
  }
  return { code, guards };
}
let succeeded = false;
try {
  const purs = process.env.PURS ?? 'purs';  const graph = JSON.parse(run(purs, ['graph', join(fixture, 'ObjectProbe.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const modules = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || modules.has(name)) return;
    assert.ok(graph[name], name); modules.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('ObjectProbe');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...modules.values(), '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Foreign.Object/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.classDecls));
  assert.equal(input.modulePath, join(foreignRoot, 'src/Foreign/Object.purs'));
  const ffiFiles = ['Object.rs', 'Object/ST.rs'].map(file => join(foreignRoot, 'src/Foreign', file));
  ffiFiles.forEach(path => assert.ok(existsSync(path), `Missing actual Object Rust FFI: ${path}`));
  const provenance = { purs, pursVersion: run(purs, ['--version']).stdout.trim(), bundleSha256: hash(join(root, 'bin/purust.js')),
    ffi: ffiFiles.map(path => ({ path, sha256: hash(path) })),
    sources: [...modules].map(([module, path]) => ({ module, path, sha256: hash(path) })) };
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
      '--out', rust, '--main', 'ObjectProbe', ...(threaded ? ['--threaded'] : [])]);
    for (const [index, module] of ['Foreign_Object', 'Foreign_Object_ST'].entries()) {
      const code = readFileSync(join(rust, `Purs_${module}/src/lib.rs`), 'utf8'), ffi = readFileSync(ffiFiles[index], 'utf8');
      assert.ok(code.includes(threaded ? threadedRust(ffi) : ffi), `Must include the actual ${module} FFI`);
    }
    const file = join(rust, 'Purs_Foreign_Object/src/lib.rs');
    const original = readFileSync(file, 'utf8');
    const { code, guards } = guardObject(original, input.foreign);
    assert.equal(guards.length, 0, `Residual Object stubs: ${guards.map(guard => guard.symbol).join(', ')}`);
    writeFileSync(join(directory, `${mode}-guards.json`), JSON.stringify(guards, null, 2) + '\n');
    writeFileSync(file, code);
    const tests = join(rust, 'Purs_ObjectProbe/tests'); mkdirSync(tests);
    const checks = readFileSync(join(fixture, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'foreign_object.rs'), threaded ? threadedRust(checks) : checks);
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_ObjectProbe']);
    const tested = run('cargo', ['test', '--offline', '--manifest-path', manifest, '-p', 'Purs_ObjectProbe',
      '--test', 'foreign_object', '--', '--test-threads=1']);
    assert.match(tested.stdout, /11 passed; 0 failed/); assert.ok(!tested.stderr.includes(marker));
    console.log(`${mode}: ${modules.size} fresh TAST modules, 11 native tests and no residual Object fallbacks`);
  }
  assert.equal(hash(join(root, 'bin/purust.js')), provenance.bundleSha256);
  [...provenance.sources, ...provenance.ffi].forEach(source => assert.equal(hash(source.path), source.sha256));
  succeeded = true;
} finally {
  if (!succeeded || process.env.PURUST_FOREIGN_OBJECT_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
