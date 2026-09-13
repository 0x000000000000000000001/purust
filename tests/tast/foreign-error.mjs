// Real Foreign sources and fresh TAST; no historical b8x diagnostic required.
// Retain the report to run b8x/run/bak/rust/tests/foreign-error-guard.mjs too.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = join(root, 'tests/tast/fixtures/foreign-error');
const source = resolve(root, '../purust-foreign/src/Foreign.purs');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = new Set(['foreign', 'prelude', 'unsafe-coerce', 'effect', 'exceptions', 'refs', 'partial', 'st',
  'integers', 'numbers', 'functions', 'foldable-traversable', 'unfoldable', 'strings']);
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  assert.ok(packages[name], name); names.add(name); packages[name].dependencies.forEach(visitPackage);
}
['foreign', 'refs'].forEach(visitPackage);
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
roots.forEach(path => assert.ok(existsSync(path), path));
const directory = mkdtempSync(join(process.env.PURUST_FOREIGN_ERROR_KEEP_OUTPUT ?? tmpdir(), 'purust-foreign-error-'));
console.log(`Diagnostic: ${directory}`);
const report = { complete: false, commands: [], modes: [] };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function run(label, executable, args) {
  const result = spawnSync(executable, args, { cwd: directory, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ command: executable, args, status: result.status, signal: result.signal,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr }, null, 2) + '\n');
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run('graph', purs, ['graph', join(fixtures, 'ForeignProbe.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const sources = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || sources.has(name)) return;
    assert.ok(graph[name], name);
    assert.ok(!/^(Test|Util|Effect\.Aff|Data\.Variant|JS\.BigInt)(\.|$)/.test(name), name);
    sources.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('ForeignProbe'); assert.equal(sources.get('Foreign'), source);
  report.sources = [...sources].map(([module, path]) => ({ module, path, sha256: hash(path) }));
  const inputs = [...sources.values(), ...[...sources.values()].flatMap(path => ['.js', '.rs', '.rs.cargo.json']
    .map(ext => path.replace(/\.purs$/, ext)).filter(existsSync)), join(root, 'spago.lock'), join(root, 'bin/purust.js'),
    fileURLToPath(import.meta.url), ...['checks.rs', 'js-checks.mjs'].map(f => join(fixtures, f))];
  report.inputs = [...new Set(inputs)].map(path => ({ path, sha256: hash(path) }));
  report.purs = { path: purs, version: run('purs-version', purs, ['--version']).stdout.trim() };
  const tast = join(directory, 'tast');
  run('tast', purs, ['compile', ...sources.values(), '--codegen', 'corefn,js', '--output', tast]);
  const t = JSON.parse(readFileSync(join(tast, 'Foreign/corefn.json')));
  assert.ok(Array.isArray(t.typeTable) && Array.isArray(t.dataDecls) && Array.isArray(t.classDecls));
  const error = t.typeTable.findIndex(x => x.fqn?.join('.') === 'Foreign.ForeignError');
  const carrier = t.typeTable.findIndex(x => x.fqn?.join('.') === 'Foreign.Foreign');
  assert.ok(error >= 0 && carrier >= 0 && error !== carrier);
  const layout = t.dataDecls.find(d => d.name === 'ForeignError'); assert.ok(layout);
  assert.ok(!t.dataDecls.some(d => d.name === 'Foreign'));
  assert.deepEqual(layout.constructors.map(c => [c.name, c.fields.map(i => i === error ? 'ForeignError' : t.typeTable[i].type)]),
    [['ForeignError', ['String']], ['TypeMismatch', ['String', 'String']], ['ErrorAtIndex', ['Int', 'ForeignError']], ['ErrorAtProperty', ['String', 'ForeignError']]]);
  const ctorType = t.typeTable[t.decls.find(d => d.identifier === 'ErrorAtIndex').expression.annotation.type];
  assert.deepEqual(ctorType.args.map(i => i === error ? 'ForeignError' : t.typeTable[i].type), ['Int', 'ForeignError']);
  assert.equal(ctorType.ret, error);
  for (const ann of Object.values(t.foreignAnnotations)) assert.deepEqual(t.typeTable[ann.type].args, [carrier]);
  const sites = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'TypeApp' && [error, carrier].includes(node.typeArgument)) sites.add(node.typeArgument);
    Object.values(node).forEach(walk);
  }
  walk(t.decls); assert.ok(sites.has(error) && sites.has(carrier));
  report.tast = tast; report.foreignNames = t.foreign;
  assert.deepEqual([...t.foreign].sort(), ['isArray', 'isNull', 'isUndefined', 'tagOf', 'typeOf']); save();
  assert.match(run('reference', process.execPath, [join(fixtures, 'js-checks.mjs'), tast]).stdout, /JS: 10 contract groups passed/);
  for (const mode of ['normal', 'threaded']) {
    const rust = join(directory, mode), cache = join(directory, 'host-cache', mode);
    run(`generate-${mode}`, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
      '--out', rust, '--main', 'ForeignProbe', ...(mode === 'threaded' ? ['--threaded'] : [])]);
    const cargo = ['--offline', '--manifest-path', join(rust, 'Cargo.toml'), '--target-dir', cache, '-p', 'Purs_ForeignProbe'];
    run(`check-${mode}`, 'cargo', ['check', ...cargo, '--lib']);
    const code = readFileSync(join(rust, 'Purs_Foreign/src/lib.rs'), 'utf8');
    assert.match(code, new RegExp(`ErrorAtIndex\\(i64, std::${mode === 'threaded' ? 'sync::Arc' : 'rc::Rc'}<crate::ForeignError>\\)`));
    // These operations are unported. Cargo success must not qualify their stubs.
    for (const name of ['isArray', 'isNull', 'isUndefined']) assert.ok(code.includes(`pub fn Foreign_${name}(mut a0: crate::UnknownType) -> bool { false }`));
    for (const name of ['tagOf', 'typeOf']) assert.ok(code.includes(`pub fn Foreign_${name}(mut a0: crate::UnknownType) -> String { String::new() }`));
    const tests = join(rust, 'Purs_ForeignProbe/tests'); mkdirSync(tests);
    const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'checks.rs'), mode === 'threaded' ? threadedRust(checks) : checks);
    assert.match(run(`tests-${mode}`, 'cargo', ['test', ...cargo, '--locked', '--tests', '--', '--test-threads=1']).stdout, /10 passed; 0 failed/);
    report.modes.push({ mode, rust, tests: 10, lockSha256: hash(join(rust, 'Cargo.lock')),
      generated: globSync(['**/*.rs', '**/*.toml'], { cwd: rust }).map(path => ({ path, sha256: hash(join(rust, path)) })) }); save();
    console.log(`${mode}: ${sources.size} fresh modules, 10 native contracts passed; Foreign FFI remain unported`);
  }
  for (const input of report.inputs) assert.equal(hash(input.path), input.sha256, input.path);
  report.complete = true; save();
} finally {
  if (!report.complete || process.env.PURUST_FOREIGN_ERROR_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
