// Real Variant.Internal sources, fresh TAST/JS and unmodified positive exports.
// The alias-only negative uses a renamed carrier in isolated source copies,
// deliberately outside the exact native mapping; no historical bundle needed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = join(root, 'tests/tast/fixtures/variant-case');
const source = resolve(root, '../purust-variant/src/Data/Variant/Internal.purs');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = new Set(['prelude', 'unsafe-coerce', 'effect', 'refs', 'partial', 'foldable-traversable', 'unfoldable']);
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  assert.ok(packages[name], name); names.add(name); packages[name].dependencies.forEach(visitPackage);
}
// Imports of the real Internal module, plus Ref used by the native overrides.
['control', 'lists', 'maybe', 'partial', 'record', 'type-equality', 'unsafe-coerce', 'refs'].forEach(visitPackage);
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
roots.forEach(path => assert.ok(existsSync(path), path));
const directory = mkdtempSync(join(process.env.PURUST_VARIANT_CASE_KEEP_OUTPUT ?? tmpdir(), 'purust-variant-case-'));
console.log(`Diagnostic: ${directory}`);
const report = { complete: false, commands: [], modes: [], negatives: [] };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function run(label, executable, args, expected = 0) {
  const result = spawnSync(executable, args, { cwd: directory, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ command: executable, args, status: result.status, signal: result.signal,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr }, null, 2) + '\n');
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, expected, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function generate(label, tast, rust, mode) {
  run(label, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
    '--out', rust, '--main', 'VariantProbe', ...(mode === 'threaded' ? ['--threaded'] : [])]);
}
function installTests(rust, mode) {
  const tests = join(rust, 'Purs_VariantProbe/tests'); mkdirSync(tests);
  const code = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
  writeFileSync(join(tests, 'variant.rs'), mode === 'threaded' ? threadedRust(code) : code);
}
const cargoArgs = rust => ['--offline', '--manifest-path', join(rust, 'Cargo.toml'),
  // Equal package names in distinct exports must never share fingerprints or binaries.
  '--target-dir', join(directory, 'host-cache', relative(directory, rust)), '-p', 'Purs_VariantProbe'];
try {
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run('graph', purs, ['graph', source, join(fixtures, 'VariantProbe.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const sources = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || sources.has(name)) return;
    assert.ok(graph[name], name); assert.ok(!/^(Test|Util|Effect\.Aff|Control\.Monad\.Aff)\./.test(name), name);
    sources.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('VariantProbe'); assert.equal(sources.get('Data.Variant.Internal'), source);
  report.sources = [...sources].map(([module, path]) => ({ module, path, sha256: hash(path) }));
  const inputs = [...sources.values(), ...[...sources.values()].flatMap(path => ['.js', '.rs', '.rs.cargo.json']
    .map(ext => path.replace(/\.purs$/, ext)).filter(existsSync)), join(root, 'spago.lock'), join(root, 'bin/purust.js'),
    fileURLToPath(import.meta.url), ...['checks.rs', 'js-checks.mjs'].map(f => join(fixtures, f))];
  report.inputs = [...new Set(inputs)].map(path => ({ path, sha256: hash(path) }));
  report.purs = { path: purs, version: run('purs-version', purs, ['--version']).stdout.trim() };
  const tast = join(directory, 'tast');
  run('tast', purs, ['compile', ...sources.values(), '--codegen', 'corefn,js', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Data.Variant.Internal/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls) && Array.isArray(input.classDecls));
  const carrier = input.typeTable.findIndex(t => t.type === 'Adt' && t.fqn.join('.') === 'Data.Variant.Internal.VariantCase');
  assert.ok(carrier >= 0); assert.deepEqual(input.foreign, []);
  const sites = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Accessor' && node.fieldName === 'value') {
      assert.equal(node.annotation.type, carrier); sites.push('payload');
    }
    if (node.type === 'TypeApp' && node.expression?.value?.identifier === 'lookup') {
      assert.deepEqual(input.typeTable[node.typeArgument].args, [carrier, carrier]); sites.push('callback');
    }
    for (const [k, v] of Object.entries(node)) if (k !== 'annotation') walk(v);
  }
  for (const name of ['lookupEq', 'lookupOrd']) walk(input.decls.find(d => d.identifier === name).expression);
  assert.equal(sites.filter(s => s === 'payload').length, 4); assert.equal(sites.filter(s => s === 'callback').length, 2);
  report.tast = tast; save();
  const js = run('reference', process.execPath, [join(fixtures, 'js-checks.mjs'), tast]);
  assert.match(js.stdout, /JS: 10 contracts passed/);
  for (const mode of ['normal', 'threaded']) {
    const rust = join(directory, mode); generate(`generate-${mode}`, tast, rust, mode);
    run(`check-${mode}`, 'cargo', ['check', ...cargoArgs(rust), '--lib']);
    for (const name of ['Data_Variant_Internal', 'VariantProbe']) {
      assert.doesNotMatch(readFileSync(join(rust, `Purs_${name}/src/lib.rs`), 'utf8'), /::VariantCase\b/);
    }
    installTests(rust, mode);
    const tests = run(`tests-${mode}`, 'cargo', ['test', ...cargoArgs(rust), '--locked', '--tests', '--', '--test-threads=1']);
    assert.match(tests.stdout, /10 passed; 0 failed/);
    report.modes.push({ mode, rust, tests: 10, lockSha256: hash(join(rust, 'Cargo.lock')),
      generated: globSync(['**/*.rs', '**/*.toml'], { cwd: rust })
        .map(path => ({ path, sha256: hash(join(rust, path)) })) }); save();
    console.log(`${mode}: ${sources.size} fresh modules, 10 native contracts passed`);
  }
  // Recreate generic Rc/Arc<carrier> lowering through a fresh, unrecognized
  // foreign type. Only diagnostic copies are renamed; actual package API stays intact.
  const negative = join(directory, 'alias-only'), copiedSource = join(negative, 'src/Data/Variant/Internal.purs');
  mkdirSync(join(negative, 'src/Data/Variant'), { recursive: true });
  const rename = text => text.replace(/\bVariantCase\b/g, 'VariantCaseAliasProbe');
  writeFileSync(copiedSource, rename(readFileSync(source, 'utf8')));
  writeFileSync(copiedSource.replace(/\.purs$/, '.rs'), 'pub type VariantCaseAliasProbe = purust_core::Value;\n');
  const copiedProbe = join(negative, 'VariantProbe.purs');
  writeFileSync(copiedProbe, rename(readFileSync(join(fixtures, 'VariantProbe.purs'), 'utf8')));
  const negativeTast = join(negative, 'tast');
  run('alias-tast', purs, ['compile', ...[...sources.values()].map(path => path === source ? copiedSource
    : path === join(fixtures, 'VariantProbe.purs') ? copiedProbe : path), '--codegen', 'corefn', '--output', negativeTast]);
  for (const mode of ['normal', 'threaded']) {
    const rust = join(negative, mode); generate(`alias-generate-${mode}`, negativeTast, rust, mode);
    run(`alias-check-${mode}`, 'cargo', ['check', ...cargoArgs(rust), '--lib']);
    installTests(rust, mode);
    const tests = run(`alias-tests-${mode}`, 'cargo', ['test', ...cargoArgs(rust), '--locked', '--tests', '--', '--test-threads=1'], 101);
    assert.match(tests.stdout, /5 passed; 5 failed/); assert.match(tests.stdout, /Expected Class/);
    report.negatives.push({ mode, rust, checkStatus: 0, nativeStatus: 101, failedTests: 5 }); save();
    console.log(`alias-only ${mode}: Cargo passes, 5 runtime failures confirmed`);
  }
  for (const input of report.inputs) assert.equal(hash(input.path), input.sha256, input.path);
  report.complete = true; save();
} finally {
  if (!report.complete || process.env.PURUST_VARIANT_CASE_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
