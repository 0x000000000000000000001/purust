// The real Aff FFI uses the threaded runtime. Rc/Arc dictionary representation
// is tested separately in tests/codegen/aff-class.mjs, without simulating Aff.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(new URL('fixtures/aff-class/', import.meta.url));
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = ['aff', 'arrays', 'avar', 'console', 'effect', 'enums', 'exceptions',
  'foldable-traversable', 'integers', 'lazy', 'numbers', 'partial', 'prelude', 'refs',
  'st', 'strings', 'unfoldable', 'unsafe-coerce'];
const packageNames = new Set();
function visitPackage(name) {
  if (packageNames.has(name)) return;
  assert.ok(packages[name], name);
  packageNames.add(name);
  for (const dependency of packages[name].dependencies) visitPackage(dependency);
}
visitPackage('aff');
const roots = [...packageNames].map(name => native.includes(name)
  ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
for (const sourceRoot of roots) assert.ok(existsSync(sourceRoot), sourceRoot);
const directory = mkdtempSync(join(process.env.PURUST_AFF_CLASS_KEEP_OUTPUT ?? tmpdir(), 'purust-aff-class-tast-'));
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
  const graph = JSON.parse(run(purs, ['graph', join(fixtures, 'AffClassProbe.purs'),
    ...roots.flatMap(sourceRoot => globSync('**/*.purs', { cwd: sourceRoot }).map(file => join(sourceRoot, file)))]));
  const selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name);
    selected.set(name, resolve(directory, graph[name].path));
    for (const dependency of graph[name].depends) visit(dependency);
  }
  visit('AffClassProbe');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...selected.values(), '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Effect.Aff.Class/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.classDecls), 'Use the TAST fork.');
  assert.ok(input.classDecls.some(decl => decl.name === 'MonadAff'));
  assert.equal(input.modulePath, join(roots[0], 'Effect/Aff/Class.purs'));
  const ffiFile = join(roots[0], 'Effect/Aff.rs');
  const ffi = readFileSync(ffiFile, 'utf8');
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify({
    purs, version: run(purs, ['--version']).trim(),
    bundleSha256: sha256(join(root, 'bin/purust.js')), ffiFile, ffiSha256: sha256(ffiFile),
    sources: [...selected].map(([module, source]) => ({ module, source, sha256: sha256(source) })),
  }, null, 2) + '\n');
  const rust = join(directory, 'rust');
  run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
    '--source', tast, '--out', rust, '--main', 'AffClassProbe', '--threaded']);
  const code = readFileSync(join(rust, 'Purs_Effect_Aff_Class/src/lib.rs'), 'utf8');
  assert.match(code, /pub fn Effect_Aff_Class_monadAffAff\(\) -> std::sync::Arc<crate::MonadAff>/);
  assert.ok(readFileSync(join(rust, 'Purs_Effect_Aff/src/lib.rs'), 'utf8').includes(threadedRust(ffi)));
  const manifest = join(rust, 'Cargo.toml');
  run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_AffClassProbe']);
  const tests = join(rust, 'Purs_AffClassProbe/tests');
  mkdirSync(tests);
  writeFileSync(join(tests, 'aff_class.rs'), readFileSync(join(fixtures, 'checks.rs')));
  const result = run('cargo', ['test', '--offline', '--manifest-path', manifest,
    '-p', 'Purs_AffClassProbe', '--test', 'aff_class', '--', '--test-threads=1']);
  console.log(`MonadAff, ${selected.size} fresh modules: ${result.trim().split('\n').at(-1)}`);
} finally {
  if (process.env.PURUST_AFF_CLASS_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
