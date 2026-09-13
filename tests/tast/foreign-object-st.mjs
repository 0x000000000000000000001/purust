// Actual STObject FFI and typed PureScript callers, in Rc and Arc modes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = join(root, 'tests/tast/fixtures/foreign-object-st');
const foreignRoot = resolve(root, '../purust-foreign-object');
const packages = JSON.parse(readFileSync(join(root, 'spago.lock'))).packages;
const native = new Set(['prelude', 'st', 'effect', 'refs', 'partial', 'unsafe-coerce']);
const names = new Set();
function visitPackage(name) {
  if (names.has(name)) return;
  assert.ok(packages[name], name); names.add(name);
  packages[name].dependencies.forEach(visitPackage);
}
['st', 'maybe', 'refs'].forEach(visitPackage);
const roots = [...names].map(name => native.has(name) ? resolve(root, `../purust-${name}/src`)
  : join(root, `.spago/p/${name}-${packages[name].version}/src`));
roots.forEach(path => assert.ok(existsSync(path), path));
const directory = mkdtempSync(join(process.env.PURUST_FOREIGN_OBJECT_ST_KEEP_OUTPUT ?? tmpdir(), 'purust-foreign-object-st-'));
const commands = [];
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = () => writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 90_000, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, status: result.status, signal: result.signal, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr }); save();
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
let succeeded = false;
try {
  const purs = process.env.PURS ?? 'purs';
  const graph = JSON.parse(run(purs, ['graph', join(fixture, 'StashProbe.purs'), join(foreignRoot, 'src/Foreign/Object/ST.purs'),
    ...roots.flatMap(path => globSync('**/*.purs', { cwd: path }).map(file => join(path, file)))]));
  const modules = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || modules.has(name)) return;
    assert.ok(graph[name], name); modules.set(name, resolve(directory, graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('StashProbe');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...modules.values(), '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Foreign.Object.ST/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.classDecls));
  assert.equal(input.modulePath, join(foreignRoot, 'src/Foreign/Object/ST.purs'));
  assert.deepEqual([...input.foreign].sort(), ['delete', 'new', 'peekImpl', 'poke']);
  const ffiFile = join(foreignRoot, 'src/Foreign/Object/ST.rs');
  assert.ok(existsSync(ffiFile), 'Missing actual Foreign.Object.ST Rust FFI');
  const ffi = readFileSync(ffiFile, 'utf8');
  const provenance = { purs, pursVersion: run(purs, ['--version']).trim(), bundleSha256: hash(join(root, 'bin/purust.js')),
    ffiFile, ffiSha256: hash(ffiFile), sources: [...modules].map(([module, path]) => ({ module, path, sha256: hash(path) })) };
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
      '--out', rust, '--main', 'StashProbe', ...(threaded ? ['--threaded'] : [])]);
    const code = readFileSync(join(rust, 'Purs_Foreign_Object_ST/src/lib.rs'), 'utf8');
    assert.ok(code.includes(threaded ? threadedRust(ffi) : ffi), 'Generated module must include the actual FFI');
    for (const name of input.foreign) assert.equal([...code.matchAll(new RegExp(`pub fn Foreign_Object_ST_${name}\\(`, 'g'))].length, 1);
    assert.ok(!code.includes('unimplemented!()'));
    assert.match(code, /pub struct STObject\b/);
    const tests = join(rust, 'Purs_StashProbe/tests'); mkdirSync(tests);
    const checks = readFileSync(join(fixture, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'foreign_object_st.rs'), threaded ? threadedRust(checks) : checks);
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_StashProbe']);
    const output = run('cargo', ['test', '--offline', '--manifest-path', manifest, '-p', 'Purs_StashProbe',
      '--test', 'foreign_object_st', '--', '--test-threads=1']);
    assert.match(output, /10 passed; 0 failed/);
    console.log(`${mode}: ${modules.size} fresh TAST modules, 10 native tests passed`);
  }
  assert.equal(hash(ffiFile), provenance.ffiSha256);
  assert.equal(hash(join(root, 'bin/purust.js')), provenance.bundleSha256);
  provenance.sources.forEach(source => assert.equal(hash(source.path), source.sha256));
  succeeded = true;
} finally {
  if (!succeeded || process.env.PURUST_FOREIGN_OBJECT_ST_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
