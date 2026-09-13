// The actual partial package, fresh typed sources and unmodified generated FFI.
// Native checks exercise representation, not the 27 missing JS.BigInt operations.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = resolve(root, '../purust-js-bigints'), fixtures = join(root, 'tests/tast/fixtures/bigint');
const source = join(pkg, 'src/JS/BigInt.purs'), ffi = source.replace('.purs', '.rs');
const lock = JSON.parse(readFileSync(join(pkg, 'spago.lock')));
const roots = [join(pkg, 'src'), ...Object.entries(lock.packages).map(([name, p]) =>
  p.type === 'local' ? resolve(pkg, p.path, 'src') : join(pkg, `.spago/p/${name}-${p.version}/src`))];
roots.forEach(path => assert.ok(existsSync(path), `Resolve js-bigints dependencies first: ${path}`));
const directory = mkdtempSync(join(process.env.PURUST_BIGINT_KEEP_OUTPUT ?? tmpdir(), 'purust-bigint-'));
console.log(`Diagnostic: ${directory}`);
const report = { complete: false, commands: [], modes: [], negatives: [] };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function run(label, command, args, expected = 0) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 90_000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ command, args, status: result.status, signal: result.signal,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr }, null, 2) + '\n');
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, expected, `${label}: ${result.stdout}\n${result.stderr}`);
  return result;
}
const generate = (label, tast, rust, threaded) => run(label, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
  '--source', tast, '--out', rust, '--main', 'BigIntProbe', ...(threaded ? ['--threaded'] : [])]);
try {
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run('graph', purs, ['graph', join(fixtures, 'BigIntProbe.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(p => join(path, p)))]).stdout);
  const selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name); assert.ok(!/^(Yoga|Test|Util|Effect)\./.test(name));
    selected.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('BigIntProbe'); assert.equal(selected.get('JS.BigInt'), source);
  report.sources = [...selected].map(([module, path]) => ({ module, path, sha256: hash(path) }));
  const inputs = [...selected.values(), ...[...selected.values()].flatMap(path => ['.js', '.rs', '.rs.cargo.json']
    .map(ext => path.replace(/\.purs$/, ext)).filter(existsSync)), join(pkg, 'spago.yaml'), join(pkg, 'spago.lock'),
    ...globSync('*.rs', { cwd: fixtures }).map(p => join(fixtures, p)), join(root, 'bin/purust.js')];
  report.inputs = [...new Set(inputs)].map(path => ({ path, sha256: hash(path) }));
  report.purs = { path: purs, version: run('purs-version', purs, ['--version']).stdout.trim() };
  const tast = join(directory, 'tast');
  run('tast', purs, ['compile', ...selected.values(), '--codegen', 'corefn,js', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'JS.BigInt/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls) && Array.isArray(input.classDecls));
  assert.equal(input.modulePath, source); assert.equal(input.foreign.length, 27);
  assert.equal(readFileSync(join(tast, 'JS.BigInt/foreign.js'), 'utf8'), readFileSync(source.replace('.purs', '.js'), 'utf8'));
  report.tast = tast; report.foreignNames = input.foreign; save();
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    generate(`generate-${mode}`, tast, rust, threaded);
    const lib = join(rust, 'Purs_JS_BigInt/src/lib.rs'), code = readFileSync(lib, 'utf8');
    assert.ok(code.includes(readFileSync(ffi, 'utf8')));
    for (const name of input.foreign) {
      const lines = code.split('\n').filter(l => l.startsWith(`pub fn JS_BigInt_${name}(`));
      assert.equal(lines.length, 1);
      assert.match(lines[0], /\{ (unimplemented!\(\)|0|0\.0|false|String::new\(\)) \}$/);
    }
    const manifest = join(rust, 'Cargo.toml');
    run(`check-${mode}`, 'cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_BigIntProbe', '--lib']);
    const metadata = JSON.parse(run(`metadata-${mode}`, 'cargo', ['metadata', '--offline', '--locked', '--format-version', '1', '--manifest-path', manifest]).stdout);
    const dep = metadata.packages.find(p => p.name === 'Purs_JS_BigInt').dependencies.find(d => d.name === 'num-bigint-dig');
    assert.equal(dep.req, '=0.8.6'); assert.equal(dep.uses_default_features, false); assert.deepEqual(dep.features, []);
    const tests = join(rust, 'Purs_BigIntProbe/tests'); mkdirSync(tests);
    const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'bigint.rs'), threaded ? threadedRust(checks) : checks);
    if (threaded) writeFileSync(join(tests, 'shared.rs'), readFileSync(join(fixtures, 'shared.rs')));
    const result = run(`tests-${mode}`, 'cargo', ['test', '--offline', '--locked', '--manifest-path', manifest,
      '-p', 'Purs_BigIntProbe', '--tests', '--', '--test-threads=1']);
    assert.match(result.stdout, /4 passed; 0 failed/);
    if (threaded) assert.match(result.stdout, /1 passed; 0 failed/);
    report.modes.push({ mode, rust, tests: threaded ? 5 : 4, foreignsImplemented: 0,
      lockSha256: hash(join(rust, 'Cargo.lock')), generated: globSync(['**/*.rs', '**/*.toml'], { cwd: rust })
        .filter(p => !p.startsWith('target/')).map(p => ({ path: p, sha256: hash(join(rust, p)) })) }); save();
    console.log(`${mode}: ${selected.size} fresh TAST modules; ${threaded ? 5 : 4} representation tests passed`);
  }
  for (const kind of ['missing-ffi', 'missing-cargo']) {
    const copy = join(directory, kind, 'src/JS'); mkdirSync(copy, { recursive: true });
    const replacement = join(copy, 'BigInt.purs'); writeFileSync(replacement, readFileSync(source));
    if (kind === 'missing-cargo') writeFileSync(join(copy, 'BigInt.rs'), readFileSync(ffi));
    const negativeTast = join(directory, kind, 'tast'), rust = join(directory, kind, 'rust');
    run(`tast-${kind}`, purs, ['compile', ...[...selected.values()].map(p => p === source ? replacement : p), '--codegen', 'corefn', '--output', negativeTast]);
    generate(`generate-${kind}`, negativeTast, rust, false);
    const result = run(`check-${kind}`, 'cargo', ['check', '--offline', '--manifest-path', join(rust, 'Cargo.toml'),
      '-p', 'Purs_BigIntProbe', '--lib', '--message-format=short'], 101);
    assert.match(result.stderr, kind === 'missing-ffi' ? /cannot find type `BigInt`/ : /unresolved import `num_bigint_dig`/);
    report.negatives.push({ kind, status: result.status });
  }
  for (const entry of report.inputs) assert.equal(hash(entry.path), entry.sha256, entry.path);
  report.complete = true; save();
} finally {
  if (!report.complete || process.env.PURUST_BIGINT_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
