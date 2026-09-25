// Fresh TAST/JS, real Nullable FFI and untouched Rust exports, in both modes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = join(root, 'tests/tast/fixtures/nullable');
const nullableSource = resolve(root, '../purust-nullable/src/Data/Nullable.purs');
const ffi = nullableSource.replace(/\.purs$/, '.rs');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = new Set(['nullable', 'prelude', 'functions', 'unsafe-coerce']);
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  assert.ok(packages[name], name); names.add(name);
  packages[name].dependencies.forEach(visitPackage);
}
visitPackage('nullable');
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
roots.forEach(path => assert.ok(existsSync(path), path));
const directory = mkdtempSync(join(process.env.PURUST_NULLABLE_KEEP_OUTPUT ?? tmpdir(), 'purust-nullable-'));
console.log(`Diagnostic: ${directory}`);
const commands = [], negatives = [], hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const purs = process.env.PURS ?? 'purs';
function run(command, args, expected = 0) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 90_000, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, status: result.status, signal: result.signal, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.status, expected, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function generate(tast, rust, threaded) {
  run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
    '--out', rust, '--main', 'NullableProbe', ...(threaded ? ['--threaded'] : [])]);
  return readFileSync(join(rust, 'Purs_Data_Nullable/src/lib.rs'), 'utf8');
}
function checkRealFFI(code) {
  assert.match(code, /pub struct Nullable\b/, 'Nullable FFI: missing native type');
  for (const name of ['null', 'notNull', 'nullable']) {
    const declarations = [...code.matchAll(new RegExp(`^pub fn Data_Nullable_${name}\\([^\\n]*`, 'gm'))];
    assert.equal(declarations.length, 1, `Nullable FFI: missing/duplicate ${name}`);
    assert.ok(!declarations[0][0].includes('unimplemented!'), `Nullable FFI: fallback ${name}`);
  }
}
function installTests(rust, threaded) {
  const tests = join(rust, 'Purs_NullableProbe/tests'); mkdirSync(tests);
  const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
  writeFileSync(join(tests, 'nullable.rs'), threaded ? threadedRust(checks) : checks);
  if (threaded) writeFileSync(join(tests, 'shared.rs'), readFileSync(join(fixtures, 'shared.rs')));
}
let succeeded = false;
try {
  const graph = JSON.parse(run(purs, ['graph', join(fixtures, 'NullableProbe.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const sources = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || sources.has(name)) return;
    assert.ok(graph[name], name); assert.ok(!/^(Yoga|JS|Test|Util|Effect)\./.test(name));
    sources.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('NullableProbe'); assert.equal(sources.get('Data.Nullable'), nullableSource);
  const ffiInputs = [...sources.values()].flatMap(path => ['js', 'rs'].map(ext => path.replace(/\.purs$/, `.${ext}`)).filter(existsSync));
  const inputs = [...new Set([...sources.values(), ...ffiInputs, join(root, 'spago.lock'),
    ...['checks.rs', 'shared.rs', 'js-checks.mjs'].map(name => join(fixtures, name))])];
  const provenance = { purs, version: run(purs, ['--version']).stdout.trim(), bundleSha256: hash(join(root, 'bin/purust.js')),
    sources: [...sources.keys()], inputs: inputs.map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...sources.values(), '--codegen', 'corefn,js', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Data.Nullable/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls) && Array.isArray(input.classDecls));
  assert.equal(input.modulePath, nullableSource);
  assert.equal(input.typeTable[input.foreignAnnotations.nullable.type].type, 'ForAll');
  const js = run(process.execPath, [join(fixtures, 'js-checks.mjs'), tast]);
  assert.equal(JSON.parse(js.stdout).passed, 8);
  assert.equal(readFileSync(join(tast, 'Data.Nullable/foreign.js'), 'utf8'), readFileSync(nullableSource.replace(/\.purs$/, '.js'), 'utf8'));
  console.log(`JS: 8 checks passed; ${sources.size} fresh TAST modules`);
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    const code = generate(tast, rust, threaded), actualFFI = readFileSync(ffi, 'utf8');
    checkRealFFI(code); assert.ok(code.includes(threaded ? threadedRust(actualFFI) : actualFFI));
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_NullableProbe', '--lib']);
    installTests(rust, threaded);
    const test = run('cargo', ['test', '--offline', '--manifest-path', manifest, '-p', 'Purs_NullableProbe', '--tests', '--', '--test-threads=1']);
    assert.match(test.stdout, /7 passed; 0 failed/);
    if (threaded) assert.match(test.stdout, /1 passed; 0 failed/);
    console.log(`${mode}: 7 nullable tests${threaded ? ' + 1 threaded-sharing test' : ''} passed`);
  }

  // Mutate only isolated source copies, then regenerate TAST and Rust. The
  // regression guard rejects fallback exports; Cargo also proves each failure.
  for (const kind of ['missing-file', 'missing-symbol']) {
    const isolated = join(directory, kind), source = join(isolated, 'sources/Data/Nullable.purs');
    mkdirSync(join(isolated, 'sources/Data'), { recursive: true });
    writeFileSync(source, readFileSync(nullableSource));
    if (kind === 'missing-symbol') writeFileSync(source.replace(/\.purs$/, '.rs'),
      readFileSync(ffi, 'utf8').replace('fn Data_Nullable_notNull(', 'fn removed_notNull('));
    const negativeTast = join(isolated, 'tast');
    run(purs, ['compile', ...[...sources.values()].map(path => path === nullableSource ? source : path), '--codegen', 'corefn', '--output', negativeTast]);
    assert.equal(JSON.parse(readFileSync(join(negativeTast, 'Data.Nullable/corefn.json'))).modulePath, source);
    for (const threaded of [false, true]) {
      const mode = threaded ? 'threaded' : 'normal', rust = join(isolated, mode);
      const code = generate(negativeTast, rust, threaded);
      const expected = kind === 'missing-file' ? /Nullable FFI: missing native type/ : /Nullable FFI: fallback notNull/;
      assert.throws(() => checkRealFFI(code), expected);
      const manifest = join(rust, 'Cargo.toml');
      if (kind === 'missing-file') {
        // The compiler forwards an absent FFI type as an empty marker enum (see
        // foreign-types.mjs) and uses the boxed runtime Value at its use sites,
        // so the crate still type-checks and the stubs panic instead of
        // rejecting the build.
        run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_NullableProbe', '--lib']);
        const fallback = readFileSync(join(rust, 'Purs_Data_Nullable/src/lib.rs'), 'utf8');
        assert.match(fallback, /pub enum Nullable \{\}/, 'missing FFI types keep their marker');
        assert.match(fallback, /pub fn Data_Nullable_null\(\) -> crate::UnknownType \{ unimplemented!\(\) \}/);
      } else {
        installTests(rust, threaded);
        const check = run('cargo', ['test', '--offline', '--manifest-path', manifest, '-p', 'Purs_NullableProbe', '--test', 'nullable',
          'typed_scalar_round_trips_and_instances', '--', '--exact', '--test-threads=1'], 101);
        assert.match(check.stdout, /not implemented/); assert.match(check.stdout, /0 passed; 1 failed/);
      }
      negatives.push({ kind, mode, rejectedByGuard: true, nativeStatus: kind === 'missing-file' ? 0 : 101 });
      writeFileSync(join(directory, 'negative-checks.json'), JSON.stringify(negatives, null, 2) + '\n');
      console.log(`${kind}/${mode}: explicit regression rejection ${kind === 'missing-file' ? 'and unconstructible fallback' : 'and native failure'} confirmed`);
    }
  }
  assert.equal(hash(join(root, 'bin/purust.js')), provenance.bundleSha256);
  provenance.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, input.path));
  succeeded = true;
} finally {
  if (!succeeded || process.env.PURUST_NULLABLE_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
