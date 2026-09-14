// Fresh TAST, real Yoga.JSON ReadForeign BigInt and native Cargo dependency checks.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const profile = resolve(root, '../../b8x/run/bak/rust');
const fixture = join(root, 'tests/tast/fixtures/json-read-bigint');
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
const directory = mkdtempSync(join(process.env.PURUST_JSON_OUTPUT ?? tmpdir(), 'purust-json-read-bigint-'));
console.log(directory);
const report = { complete: false, commands: [], modes: [] };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
function run(label, executable, args, cwd = directory) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GHCRTS: '-N2', CARGO_BUILD_JOBS: '1', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0', CARGO_INCREMENTAL: '0' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ executable, args, status: result.status,
    stdout: result.stdout, stderr: result.stderr, error: result.error?.message }, null, 2));
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  const fork = resolve(root, '../../purescript/.stack-work/dist');
  const candidates = globSync('**/build/purs/purs', { cwd: fork });
  if (!process.env.PURS) assert.equal(candidates.length, 1, 'Identify the TAST fork with PURS.');
  const purs = process.env.PURS ?? join(fork, candidates[0]);
  report.compiler = { path: purs, sha256: hash(purs) };
  const graph = JSON.parse(run('graph', purs, ['graph', join(fixture, 'JsonReadBigIntProbe.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]).stdout);
  const sources = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || sources.has(name)) return;
    assert.ok(graph[name], name); sources.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('JsonReadBigIntProbe');
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
  const reference = await import(pathToFileURL(join(tast, 'JsonReadBigIntProbe/index.js')));
  assert.equal(reference.readField('{"big":"123456789012345678901234567890"}').value0, 123456789012345678901234567890n);
  assert.equal(reference.readNative(-123n).value0, -123n);
  const bigintInput = JSON.parse(readFileSync(join(tast, 'JS.BigInt/corefn.json')));
  const docker = process.argv.includes('--docker'), mount = resolve(profile, '..');
  if (docker) assert.ok(!relative(mount, directory).startsWith('..'));
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    run(`generate-${mode}`, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'JsonReadBigIntProbe', ...(threaded ? ['--threaded'] : [])]);
    const foreignManifest = readFileSync(join(rust, 'Purs_Foreign/Cargo.toml'), 'utf8');
    assert.match(foreignManifest, /num-bigint-dig/);
    assert.ok(!foreignManifest.includes('Purs_JS_BigInt'), 'Foreign must not acquire a PureScript module dependency');
    const ffi = readFileSync(resolve(root, '../purust-yoga-json/src/Yoga/JSON.rs'), 'utf8');
    assert.ok(readFileSync(join(rust, 'Purs_Yoga_JSON/src/lib.rs'), 'utf8').includes(threaded ? threadedRust(ffi) : ffi));
    // These tests must take the already-native BigInt branch, never a default
    // return from any still-unported JS.BigInt operation.
    const bigintFile = join(rust, 'Purs_JS_BigInt/src/lib.rs');
    let bigintCode = readFileSync(bigintFile, 'utf8');
    let guarded = 0;
    for (const name of bigintInput.foreign) {
      const pattern = new RegExp(`^(pub fn JS_BigInt_${name}\\([^\\n]+?\\{) (?:unimplemented!\\(\\)|false|0|0\\.0|String::new\\(\\)) \\}$`, 'm');
      if (pattern.test(bigintCode)) {
        bigintCode = bigintCode.replace(pattern, `$1 panic!("UNPORTED_BIGINT:${name}") }`); guarded++;
      }
    }
    writeFileSync(bigintFile, bigintCode);
    const tests = join(rust, 'Purs_JsonReadBigIntProbe/tests'); mkdirSync(tests);
    const checks = readFileSync(join(fixture, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'json_read_bigint.rs'), threaded ? threadedRust(checks) : checks);
    const remote = '/var/www/b8x/run/bak/' + relative(mount, rust);
    const prefix = docker ? ['exec', '-w', remote, '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0',
      '-e', 'CARGO_PROFILE_TEST_DEBUG=0', '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo'] : [];
    const result = run(`test-${mode}`, docker ? 'docker' : 'cargo', [...prefix, 'test', '--offline', '--quiet',
      '-p', 'Purs_JsonReadBigIntProbe', '--test', 'json_read_bigint', '--', '--test-threads=1'], rust);
    assert.match(result.stdout, /5 passed; 0 failed/);
    assert.ok(!result.stderr.includes('UNPORTED_BIGINT:'));
    report.modes.push({ mode, guardedBigIntOperations: guarded }); save();
    console.log(`${mode}: ${sources.size} fresh TAST modules; 5 real ReadForeign BigInt tests passed`);
  }
  report.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, `input changed: ${input.path}`));
  report.complete = true;
} finally { save(); }
