// The original Yoga.JSON readImpl/TaggedSum pipeline on PS records and native Objects.
// Red executions are retained for reproduction; no generated FFI is replaced.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const profile = resolve(root, '../../b8x/run/bak/rust'), mount = resolve(profile, '..');
const fixture = join(root, 'tests/tast/fixtures/json-read-object');
const lock = JSON.parse(readFileSync(join(profile, 'spago.lock')));
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  const pkg = lock.packages[name]; assert.ok(pkg, name);
  names.add(name); pkg.dependencies.forEach(visitPackage);
}
visitPackage('yoga-json');
const roots = [...names].map(name => {
  const pkg = lock.packages[name];
  return pkg.type === 'local' ? resolve(profile, pkg.path, 'src') : join(profile, `.spago/p/${name}-${pkg.version}/src`);
});
roots.forEach(path => assert.ok(existsSync(path), path));
const directory = mkdtempSync(join(process.env.PURUST_JSON_OBJECT_OUTPUT ?? join(profile, 'output'), 'purust-json-read-object-'));
console.log(directory);
const report = { complete: false, commands: [], modes: [] };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
function run(label, executable, args, cwd = directory, requireSuccess = true) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GHCRTS: '-N2', CARGO_BUILD_JOBS: '1', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0', CARGO_INCREMENTAL: '0' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ executable, args, status: result.status,
    stdout: result.stdout, stderr: result.stderr, error: result.error?.message }, null, 2));
  report.commands.push({ label, status: result.status }); save();
  if (requireSuccess) assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  const fork = resolve(root, '../../purescript/.stack-work/dist');
  const candidates = globSync('**/build/purs/purs', { cwd: fork });
  if (!process.env.PURS) assert.equal(candidates.length, 1, 'Identify the TAST fork with PURS.');
  const purs = process.env.PURS ?? join(fork, candidates[0]);
  report.compiler = { path: purs, sha256: hash(purs) };
  const graph = JSON.parse(run('graph', purs, ['graph', join(fixture, 'JsonReadObjectProbe.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const sources = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || sources.has(name)) return;
    assert.ok(graph[name], name); sources.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('JsonReadObjectProbe');
  const inputs = [...sources.values(), ...[...sources.values()].flatMap(path => ['.js', '.rs', '.rs.cargo.json']
    .map(extension => path.replace(/\.purs$/, extension)).filter(existsSync)), join(root, 'bin/purust.js'),
    fileURLToPath(import.meta.url), join(fixture, 'checks.rs'), join(profile, 'spago.lock')];
  report.inputs = [...new Set(inputs)].map(path => ({ path, sha256: hash(path) }));
  report.modules = [...sources.keys()];
  const tast = join(directory, 'tast');
  run('tast', purs, ['compile', ...sources.values(), '--codegen', 'corefn,js', '--output', tast]);
  const jsonInput = JSON.parse(readFileSync(join(tast, 'Yoga.JSON/corefn.json')));
  assert.ok(Array.isArray(jsonInput.typeTable) && Array.isArray(jsonInput.classDecls));
  assert.equal(jsonInput.modulePath, resolve(root, '../purust-yoga-json/src/Yoga/JSON.purs'));
  const p = await import(pathToFileURL(join(tast, 'JsonReadObjectProbe/index.js')));
  const either = await import(pathToFileURL(join(tast, 'Data.Either/index.js')));
  const right = result => { assert.ok(result instanceof either.Right); return result.value0; };
  const original = { type: 'RaisedInt', value: 42 };
  assert.strictEqual(p.asObject(original), original); assert.strictEqual(p.roundObject(original), original);
  assert.deepEqual(p.asObject(p.recordForeign(42)), original);
  assert.deepEqual(right(p.readRecordObject(42)), original);
  assert.deepEqual(right(p.readObject(original)), original);
  assert.notStrictEqual(right(p.readObject(original)), original);
  assert.equal(p.taggedValue(right(p.decodeRecord(42))), 42);
  assert.equal(p.taggedValue(right(p.decodeJSON('{"type":"RaisedInt","value":42}'))), 42);
  assert.equal(p.taggedValue(right(p.decodeJSON('{"type":"RaisedRecord","value":{"count":43}}'))), 43);
  assert.deepEqual(right(p.readNestedObjects(p.nestedRecordForeign(42))), { first: { count: 42 }, second: { count: 43 } });
  const child = { count: 42 };
  assert.strictEqual(right(p.readObject({ child })).child, child);
  assert.deepEqual(right(p.readObjectWithRecord({ child })), { child });
  assert.deepEqual(p.asObject(p.emptyRecordForeign()), {});
  assert.deepEqual(p.fromHomogeneous({ type: 'RaisedInt', value: '42' }), { type: 'RaisedInt', value: '42' });
  for (const value of [undefined, null, 42, 'x', []]) assert.ok(p.readObject(value) instanceof either.Left);
  const keys = Object.keys(p.orderedRecordForeign(42));
  const foreignObject = await import(pathToFileURL(join(tast, 'Foreign.Object/foreign.js')));
  const own = Object.assign(Object.create({ inherited: 99 }), { z: undefined, '10': 10, '2': 2, '01': 1 });
  Object.defineProperty(own, '__proto__', { enumerable: true, value: child });
  own.constructor = null;
  const pairs = foreignObject.toArrayWithKey(k => v => [k, v])(own);
  const nativeKeys = pairs.map(([k]) => k);
  assert.deepEqual(nativeKeys, ['2', '10', 'z', '01', '__proto__', 'constructor']);
  assert.strictEqual(pairs[2][1], undefined); assert.strictEqual(pairs[4][1], child); assert.strictEqual(pairs[5][1], null);
  const mutable = { a: 1, b: 2, c: 3 };
  const mutation = foreignObject.toArrayWithKey(k => v => {
    if (k === 'a') { mutable.b = 20; delete mutable.c; mutable.d = 4; }
    return `${k}:${v}`;
  })(mutable);
  assert.deepEqual(mutation, ['a:1', 'b:20']);
  assert.deepEqual(foreignObject.toArrayWithKey(() => { throw new Error('empty callback'); })({}), []);
  assert.deepEqual(foreignObject.toArrayWithKey(k => v => [k, v])({ '\ud800': '\udc00a' }), [['\ud800', '\udc00a']]);
  const callbackError = new TypeError('callback failed'); let calls = 0;
  assert.throws(() => foreignObject.toArrayWithKey(() => () => { calls++; throw callbackError; })({ a: 1, b: 2 }),
    error => error === callbackError); assert.equal(calls, 1);
  const probeInput = JSON.parse(readFileSync(join(tast, 'JsonReadObjectProbe/corefn.json')));
  const orderedLiteral = probeInput.decls.find(d => d.identifier === 'orderedRecordForeign').expression.body.argument;
  const recordType = probeInput.typeTable[orderedLiteral.annotation.type];
  const rowKeys = probeInput.typeTable[recordType.row].fields.map(field => field.label);
  assert.deepEqual(rowKeys, keys, 'TAST row retains JS source order; native failure must not be rebaselined to sorted keys');
  report.jsReference = { passed: true, recordKeys: keys, tastRowKeys: rowKeys, nativeKeys, mutation,
    pipeline: 'unchanged Yoga.JSON.read/readImpl + genericReadForeignTaggedSum + Foreign.Object.toArrayWithKey' }; save();
  const docker = process.argv.includes('--docker');
  if (docker) assert.ok(!relative(mount, directory).startsWith('..'));
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    run(`generate-${mode}`, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'JsonReadObjectProbe', ...(threaded ? ['--threaded'] : [])]);
    for (const module of ['Yoga.JSON', 'Foreign.Object', 'Foreign.Object.ST']) {
      const ffi = sources.get(module).replace(/\.purs$/, '.rs');
      const actual = readFileSync(ffi, 'utf8');
      assert.ok(readFileSync(join(rust, `Purs_${module.replaceAll('.', '_')}/src/lib.rs`), 'utf8').includes(threaded ? threadedRust(actual) : actual));
    }
    const tests = join(rust, 'Purs_JsonReadObjectProbe/tests'); mkdirSync(tests);
    const checks = `const EXPECTED_RECORD_KEYS: &[&str] = &${JSON.stringify(keys)};\n` +
      `const EXPECTED_NATIVE_KEYS: &[&str] = &${JSON.stringify(nativeKeys)};\n` +
      `const EXPECTED_MUTATION: &[&str] = &${JSON.stringify(mutation)};\n` + readFileSync(join(fixture, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'json_read_object.rs'), threaded ? threadedRust(checks) : checks);
    const remote = '/var/www/b8x/run/bak/' + relative(mount, rust);
    const prefix = docker ? ['exec', '-w', remote, '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0',
      '-e', 'CARGO_PROFILE_TEST_DEBUG=0', '-e', 'CARGO_INCREMENTAL=0', '-e', 'RUST_BACKTRACE=1', 'core-api-cli-1', 'cargo'] : [];
    const result = run(`test-${mode}`, docker ? 'docker' : 'cargo', [...prefix, 'test', '--offline', '--quiet',
      '-p', 'Purs_JsonReadObjectProbe', '--test', 'json_read_object', '--', '--test-threads=1'], rust, false);
    const summary = result.stdout.match(/test result: (ok|FAILED)\. (\d+) passed; (\d+) failed/);
    assert.ok(summary, `Native tests must compile and execute: ${result.stderr}`);
    report.modes.push({ mode, status: result.status, passed: Number(summary[2]), failed: Number(summary[3]),
      expectedClass: result.stdout.includes('Expected Class'), unimplemented: result.stdout.includes('not implemented'), rust }); save();
    console.log(`${mode}: ${sources.size} fresh TAST modules; ${summary[0]}`);
  }
  report.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, `input changed: ${input.path}`));
  report.complete = report.modes.every(mode => mode.status === 0 && mode.failed === 0 && mode.passed === 17);
  assert.ok(report.complete, `Reproduction retained: ${join(directory, 'report.json')}`);
} finally { save(); }
