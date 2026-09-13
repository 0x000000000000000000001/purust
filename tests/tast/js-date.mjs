// Real JSDate sources, fresh TAST, and the native FFI's unit tests in both modes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const library = resolve(root, '../purust-js-date/src/Data/JSDate');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = new Set(['prelude', 'effect', 'foreign', 'datetime', 'enums', 'functions',
  'integers', 'numbers', 'partial', 'foldable-traversable', 'unfoldable', 'unsafe-coerce', 'refs', 'st']);
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  assert.ok(packages[name], name);
  names.add(name);
  packages[name].dependencies.forEach(visitPackage);
}
['datetime', 'effect', 'enums', 'foreign', 'functions', 'integers', 'maybe', 'prelude'].forEach(visitPackage);
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
const directory = mkdtempSync(join(process.env.PURUST_JSDATE_KEEP_OUTPUT ?? tmpdir(), 'purust-js-date-'));
console.log(`JSDate diagnostic: ${directory}`);
const report = { complete: false, commands: [], modes: [] };
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function run(label, executable, args) {
  console.log(label);
  const result = spawnSync(executable, args, { cwd: directory, encoding: 'utf8', timeout: 120000,
    maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CARGO_PROFILE_TEST_DEBUG: '0',
      CARGO_PROFILE_DEV_DEBUG: '0', CARGO_INCREMENTAL: '0' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ executable, args, ...result }, null, 2));
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  roots.forEach(path => assert.ok(existsSync(path), path));
  const js = await import(pathToFileURL(`${library}.js`));
  const cases = [[0, 0], [-0, 0], [1.9, 1], [-1.9, -1], [-0.5, 0],
    [864e13, 864e13], [-864e13, -864e13], [864e13 + 1, null], [-864e13 - 1, null],
    [NaN, null], [Infinity, null], [-Infinity, null]];
  for (const [input, expected] of cases) {
    for (const construct of [js.fromTime, js.fromInstant]) {
      const date = construct(input);
      assert.equal(js.isValid(date), expected !== null);
      assert.equal(js.toInstantImpl(x => x)(null)(date), expected);
      if (expected !== null) assert.ok(Object.is(date.getTime(), expected));
    }
  }
  report.jsCases = cases.length;
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run('graph', purs, ['graph', `${library}.purs`,
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const sources = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || sources.has(name)) return;
    assert.ok(graph[name], name);
    sources.set(name, resolve(directory, graph[name].path));
    graph[name].depends.forEach(visit);
  }
  visit('Data.JSDate');
  assert.equal(sources.get('Data.JSDate'), `${library}.purs`);
  report.modules = sources.size;
  const tast = join(directory, 'tast');
  run('tast', purs, ['compile', ...sources.values(), '--codegen', 'corefn', '--output', tast]);
  const module = JSON.parse(readFileSync(join(tast, 'Data.JSDate/corefn.json')));
  assert.ok(module.typeTable.some(t => t.type === 'Adt' && t.fqn.join('.') === 'Data.JSDate.JSDate'));
  assert.ok(!module.dataDecls.some(d => d.name === 'JSDate'), 'JSDate is opaque, not a guessed ADT');
  for (const mode of ['normal', 'threaded']) {
    const rust = join(directory, mode);
    run(`generate-${mode}`, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'Data.JSDate', ...(mode === 'threaded' ? ['--threaded'] : [])]);
    const tested = run(`test-${mode}`, 'cargo', ['test', '--manifest-path', join(rust, 'Cargo.toml'),
      '--target-dir', join(directory, 'host-cache', mode), '-j', '1', '-p', 'Purs_Data_JSDate', '--lib']);
    assert.match(tested.stdout, /2 passed; 0 failed/);
    report.modes.push({ mode, rust, tests: 2 }); save();
  }
  report.complete = true; save();
} finally {
  if (report.complete && !process.env.PURUST_JSDATE_KEEP_OUTPUT) rmSync(directory, { recursive: true });
  else console.log(`Retained JSDate diagnostic: ${directory}`);
}
