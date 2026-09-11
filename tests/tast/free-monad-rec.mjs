// Compile the actual free package from fresh TAST, then execute its MonadRec.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(new URL('fixtures/free-monad-rec/', import.meta.url));
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = ['prelude', 'foldable-traversable', 'unsafe-coerce', 'lazy', 'st'];
const packageNames = new Set();
function visitPackage(name) {
  if (packageNames.has(name)) return;
  assert.ok(packages[name], name);
  packageNames.add(name);
  for (const dependency of packages[name].dependencies) visitPackage(dependency);
}
visitPackage('free');
visitPackage('identity');
const roots = [...packageNames].map(name => native.includes(name)
  ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
for (const sourceRoot of roots) assert.ok(existsSync(sourceRoot), sourceRoot);
const directory = mkdtempSync(join(process.env.PURUST_FREE_MONAD_REC_KEEP_OUTPUT ?? tmpdir(), 'purust-free-monad-rec-tast-'));
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
  const graph = JSON.parse(run(purs, ['graph', join(fixtures, 'FreeMonadRecProbe.purs'),
    ...roots.flatMap(sourceRoot => globSync('**/*.purs', { cwd: sourceRoot }).map(file => join(sourceRoot, file)))]));
  const selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name);
    selected.set(name, resolve(directory, graph[name].path));
    for (const dependency of graph[name].depends) visit(dependency);
  }
  visit('FreeMonadRecProbe');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...selected.values(), '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Control.Monad.Free/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls), 'Use the TAST fork.');
  assert.equal(input.modulePath, join(roots[0], 'Control/Monad/Free.purs'));
  assert.deepEqual(input.dataDecls.find(decl => decl.name === 'Val').constructors, []);
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify({
    purs, version: run(purs, ['--version']).trim(),
    bundleSha256: sha256(join(root, 'bin/purust.js')),
    sources: [...selected].map(([module, source]) => ({ module, source, sha256: sha256(source) })),
  }, null, 2) + '\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'FreeMonadRecProbe', ...(threaded ? ['--threaded'] : [])]);
    const code = readFileSync(join(rust, 'Purs_Control_Monad_Free/src/lib.rs'), 'utf8');
    assert.doesNotMatch(code, /(?:Rc|Arc)<crate::Val>/);
    assert.ok(code.includes('pub enum Free {') && code.includes('pub enum FreeView {'));
    assert.ok(code.includes(`unwrap_class::<std::${threaded ? 'sync::Arc' : 'rc::Rc'}<Purs_Control_Monad_Rec_Class::Step>>()`),
      'The existential carrier must be checked before matching the native Step.');
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_FreeMonadRecProbe']);
    const tests = join(rust, 'Purs_FreeMonadRecProbe/tests');
    mkdirSync(tests);
    const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'free_monad_rec.rs'), threaded ? threadedRust(checks) : checks);
    const result = run('cargo', ['test', '--offline', '--manifest-path', manifest,
      '-p', 'Purs_FreeMonadRecProbe', '--test', 'free_monad_rec', '--', '--test-threads=1']);
    console.log(`${mode}, ${selected.size} fresh modules: ${result.trim().split('\n').at(-1)}`);
  }
} finally {
  if (process.env.PURUST_FREE_MONAD_REC_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
