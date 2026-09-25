// Real Foreign sources and fresh TAST; no historical b8x diagnostic required.
// Keep the original representation contracts; qualify native predicates against JS.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const docker = process.argv.includes('--docker');
const mount = resolve(root, '../../b8x/run/bak');
const remote = path => '/var/www/b8x/run/bak/' + relative(mount, path);
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
if (docker) assert.ok(!relative(mount, directory).startsWith('..'), 'For --docker, retain output inside b8x/run/bak.');
console.log(`Diagnostic: ${directory}`);
const report = { complete: false, commands: [], modes: [], execution: docker ? 'linux-docker' : 'host' };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function run(label, executable, args) {
  const result = spawnSync(executable, args, { cwd: directory, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0', CARGO_BUILD_JOBS: '1', CARGO_INCREMENTAL: '0' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ command: executable, args, status: result.status, signal: result.signal,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr }, null, 2) + '\n');
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function cargoRun(label, args) {
  return docker ? run(label, 'docker', ['exec', '-e', 'CARGO_PROFILE_DEV_DEBUG=0', '-e', 'CARGO_PROFILE_TEST_DEBUG=0',
    '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo',
    ...args.map(arg => arg.startsWith(directory + '/') ? remote(arg) : arg)]) : run(label, 'cargo', args);
}
async function predicateTests(tast) {
  const jsPath = join(tast, 'Foreign/foreign.js');
  assert.equal(readFileSync(jsPath, 'utf8'), readFileSync(source.replace(/\.purs$/, '.js'), 'utf8'));
  const js = await import(pathToFileURL(jsPath));
  const cases = [
    ['undefined', undefined, 'Value::Unit'], ['null', null, 'Value::Null'],
    ['false', false, 'mk_bool(false)'], ['true', true, 'mk_bool(true)'],
    ['zero-int', 0, 'mk_int(0)'], ['negative-int', -42, 'mk_int(-42)'],
    ['minimum-int', -2147483648, 'mk_int(-2147483648)'], ['maximum-int', 2147483647, 'mk_int(2147483647)'],
    ['negative-zero', -0, 'mk_number(-0.0)'], ['fraction', 42.5, 'mk_number(42.5)'],
    ['nan', NaN, 'mk_number(f64::NAN)'], ['infinity', Infinity, 'mk_number(f64::INFINITY)'],
    ['negative-infinity', -Infinity, 'mk_number(f64::NEG_INFINITY)'],
    ['empty-string', '', 'mk_string("")'], ['unicode-string', 'é🙂', 'mk_string(&purust_string_from_utf8("é🙂"))'],
    ['lone-surrogate-string', '\ud800', 'mk_string(&purust_string_from_utf16(&[0xd800]))'],
    ['char', 'x', "mk_char('x')"], ['lone-surrogate-char', '\udfff', 'mk_char(purust_char_from_code_unit(0xdfff))'],
    ['empty-array', [], 'mk_array(vec![])'], ['array', [null, undefined, false], 'mk_array(vec![Value::Null, Value::Unit, mk_bool(false)])'],
    ['nested-array', [[]], 'mk_array(vec![mk_array(vec![])])'],
    ['dynamic-record', {}, 'Value::DynamicRecord(perceus_ptr::PerceusPtr::new(RecordFields::new()))'],
    ['typed-record', {}, 'Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a::default()))'],
    ['shared-record', {}, 'Value::Class(Rc::new(Rc::new(SharedRecord::empty())))'],
    ['array-like-record', { 0: null, length: 1 }, '{ let mut fields = RecordFields::new(); fields.insert("0".into(), Value::Null); fields.insert("length".into(), mk_int(1)); Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields)) }'],
    ['bigint-zero', 0n, 'Value::Class(Rc::new(Rc::new(num_bigint_dig::BigInt::from(0))))'],
    ['bigint-negative', -1n, 'Value::Class(Rc::new(Rc::new(num_bigint_dig::BigInt::from(-1))))'],
    ['bigint-large', 123456789012345678901234567890n, 'Value::Class(Rc::new(Rc::new("123456789012345678901234567890".parse::<num_bigint_dig::BigInt>().unwrap())))'],
    ...Array.from({ length: 12 }, (_, i) => [`function-${i + 1}`, () => undefined,
      `Value::Func${i + 1}(Func${i + 1}::Static(|${Array(i + 1).fill('_').join(', ')}| Value::Unit))`]),
  ];
  const names = ['isArray', 'isNull', 'isUndefined', 'tagOf', 'typeOf'];
  report.predicateReference = cases.map(([label, value]) => ({ label, expected: Object.fromEntries(names.map(name => [name, js[name](value)])) }));
  // Each former boolean stub is challenged by both true and false JS results.
  for (const name of names.slice(0, 3)) assert.deepEqual([...new Set(report.predicateReference.map(row => row.expected[name]))].sort(), [false, true]);
  writeFileSync(join(directory, 'predicate-reference.json'), JSON.stringify({ source: jsPath, sha256: hash(jsPath), cases: report.predicateReference }, null, 2));
  const declarations = names.map(name => `#[test]\nfn foreign_${name}_matches_javascript() {\n${cases.map(([label, , rust], index) => `
    let mut value = ${rust};
    for depth in 0..3 {
        assert_eq!(Purs_Foreign::Foreign_${name}(value.clone()), ${JSON.stringify(report.predicateReference[index].expected[name])}, "${label}, thunk depth {}", depth);
        value = deferred(value);
    }`).join('\n')}\n}`).join('\n');
  return `use purust_core::*;\nuse std::rc::Rc;\n
fn deferred(value: Value) -> Value {
    let thunk = perceus_ptr::PerceusPtr::new(Thunk::default());
    assert!(thunk.value.set(value).is_ok());
    Value::Thunk(thunk)
}
${declarations}`;
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
  assert.deepEqual([...t.foreign].sort(), ['isArray', 'isNull', 'isUndefined', 'readStringImpl', 'tagOf', 'typeOf']); save();
  assert.match(run('reference', process.execPath, [join(fixtures, 'js-checks.mjs'), tast]).stdout, /JS: 10 contract groups passed/);
  const predicates = await predicateTests(tast);
  const actualFFI = readFileSync(source.replace(/\.purs$/, '.rs'), 'utf8');
  for (const mode of ['normal', 'threaded']) {
    const rust = join(directory, mode), cache = join(directory, 'host-cache', mode);
    run(`generate-${mode}`, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
      '--out', rust, '--main', 'ForeignProbe', ...(mode === 'threaded' ? ['--threaded'] : [])]);
    const cargo = ['--offline', '--manifest-path', join(rust, 'Cargo.toml'), '--target-dir', cache, '-p', 'Purs_ForeignProbe'];
    cargoRun(`check-${mode}`, ['check', ...cargo, '--lib']);
    const code = readFileSync(join(rust, 'Purs_Foreign/src/lib.rs'), 'utf8');
    assert.match(code, new RegExp(`ErrorAtIndex\\(i64, std::${mode === 'threaded' ? 'sync::Arc' : 'rc::Rc'}<crate::ForeignError>\\)`));
    assert.ok(code.includes(mode === 'threaded' ? threadedRust(actualFFI) : actualFFI), 'Generated code must include the actual Foreign FFI');
    for (const name of t.foreign) assert.equal([...code.matchAll(new RegExp(`^pub fn Foreign_${name}\\(`, 'gm'))].length, 1, `Exactly one native ${name}`);
    const tests = join(rust, 'Purs_ForeignProbe/tests'); mkdirSync(tests);
    const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'checks.rs'), mode === 'threaded' ? threadedRust(checks) : checks);
    assert.match(cargoRun(`tests-${mode}`, ['test', ...cargo, '--locked', '--tests', '--', '--test-threads=1']).stdout, /10 passed; 0 failed/);
    const predicateDirectory = join(rust, 'Purs_Foreign/tests'); mkdirSync(predicateDirectory);
    writeFileSync(join(predicateDirectory, 'predicates.rs'), mode === 'threaded' ? threadedRust(predicates) : predicates);
    const predicateCargo = [...cargo]; predicateCargo[predicateCargo.indexOf('Purs_ForeignProbe')] = 'Purs_Foreign';
    assert.match(cargoRun(`predicates-${mode}`, ['test', ...predicateCargo, '--locked', '--test', 'predicates', '--', '--test-threads=1']).stdout, /5 passed; 0 failed/);
    report.modes.push({ mode, rust, tests: 10, lockSha256: hash(join(rust, 'Cargo.lock')),
      predicateTests: 5, predicateCases: report.predicateReference.length, predicateAssertions: report.predicateReference.length * 5 * 3,
      generated: globSync(['**/*.rs', '**/*.toml'], { cwd: rust }).map(path => ({ path, sha256: hash(join(rust, path)) })) }); save();
    console.log(`${mode}: ${sources.size} fresh modules, 10 original contracts + 5 JS-qualified predicate tests passed (${report.predicateReference.length * 5 * 3} predicate assertions)`);
  }
  for (const input of report.inputs) assert.equal(hash(input.path), input.sha256, input.path);
  report.complete = true; save();
} finally {
  if (!report.complete || process.env.PURUST_FOREIGN_ERROR_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
