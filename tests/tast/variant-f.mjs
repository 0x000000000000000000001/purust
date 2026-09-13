import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url)), fixture = join(root, 'tests/tast/fixtures/variant-f');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = new Set(['prelude', 'unsafe-coerce', 'effect', 'refs', 'partial', 'foldable-traversable', 'unfoldable', 'enums']);
const names = new Set();
function visitPackage(name) { if (names.has(name)) return; names.add(name); packages[name].dependencies.forEach(visitPackage); }
['control', 'lists', 'maybe', 'partial', 'record', 'type-equality', 'unsafe-coerce', 'refs', 'enums'].forEach(visitPackage);
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`) : join(root, `.spago/p/${name}-${packages[name].version}/src`));
const directory = mkdtempSync(join(process.env.PURUST_VARIANT_F_OUTPUT ?? tmpdir(), 'purust-variant-f-'));
const report = { complete: false, commands: [], modes: [] };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function run(label, executable, args, cwd = directory) {
  console.log(label);
  const r = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CARGO_BUILD_JOBS: '1', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0', CARGO_INCREMENTAL: '0' } });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ executable, args, status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error?.message }, null, 2));
  report.commands.push({ label, status: r.status });
  assert.equal(r.status, 0, `${label}: ${r.error ?? ''}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
try {
  const purs = process.env.PURS ?? 'purs';
  const candidates = [join(fixture, 'VariantFProbe.purs'), ...globSync('../purust-variant/src/**/*.purs', { cwd: root }).map(p => resolve(root, p)),
    ...roots.flatMap(p => globSync('**/*.purs', { cwd: p }).map(f => join(p, f)))];
  const graph = JSON.parse(run('graph', purs, ['graph', ...candidates]));
  const selected = new Map();
  function visit(name) { if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name); selected.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit); }
  visit('VariantFProbe');
  const inputs = [...selected.values(), ...[...selected.values()].map(p => p.replace(/\.purs$/, '.rs')).filter(existsSync),
    join(root, 'bin/purust.js'), fileURLToPath(import.meta.url), join(fixture, 'checks.rs')];
  report.inputs = [...new Set(inputs)].map(path => ({ path, sha256: hash(path) }));
  report.modules = selected.size;
  const tast = join(directory, 'tast');
  run('tast', purs, ['compile', ...selected.values(), '--codegen', 'corefn,js', '--output', tast]);
  const t = JSON.parse(readFileSync(join(tast, 'Data.Functor.Variant/corefn.json')));
  assert.ok(Array.isArray(t.dataDecls) && Array.isArray(t.typeTable), 'Set PURS to the typed TAST fork, not the official compiler.');
  assert.equal(t.dataDecls.find(d => d.name === 'VariantF').constructors.length, 0);
  assert.ok(t.classDecls.some(c => c.name === 'VariantFMaps'));
  const js = join(directory, 'reference.mjs');
  writeFileSync(js, `import assert from 'node:assert/strict'; import * as p from './tast/VariantFProbe/index.js';
    assert.deepEqual([p.original,p.mapped,p.emptyMapped,p.changedType,p.recordMapped,p.traversed.value0],[41,42,0,'41',42,42]);`);
  run('reference', process.execPath, [js]);
  const docker = process.argv.includes('--docker');
  const mount = resolve(root, '../../b8x/run/bak');
  if (docker) assert.ok(!relative(mount, directory).startsWith('..'), 'Place the output inside the existing run/bak mount.');
  for (const mode of ['normal', 'threaded']) {
    const rust = join(directory, mode);
    run(`generate-${mode}`, process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
      '--out', rust, '--main', 'VariantFProbe', ...(mode === 'threaded' ? ['--threaded'] : [])]);
    const code = readFileSync(join(rust, 'Purs_Data_Functor_Variant/src/lib.rs'), 'utf8');
    assert.doesNotMatch(code, /(?:crate|Purs_Data_Functor_Variant)::VariantF\b/);
    assert.match(code, /pub struct VariantFMaps/);
    const checks = join(rust, 'Purs_VariantFProbe/tests'); mkdirSync(checks);
    writeFileSync(join(checks, 'native.rs'), readFileSync(join(fixture, 'checks.rs')));
    const remote = '/var/www/b8x/run/bak/' + relative(mount, rust);
    const prefix = docker ? ['exec', '-w', remote, '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0',
      '-e', 'CARGO_PROFILE_TEST_DEBUG=0', '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo'] : [];
    const tested = run(`test-${mode}`, docker ? 'docker' : 'cargo', [...prefix, 'test', '--offline', '-p', 'Purs_VariantFProbe', '--test', 'native'], rust);
    assert.match(tested, /1 passed; 0 failed/); report.modes.push({ platform: docker ? 'linux' : process.platform, mode });
  }
  report.inputs.forEach(p => assert.equal(hash(p.path), p.sha256));
  report.complete = true;
} finally { writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2)); console.log(directory); }
