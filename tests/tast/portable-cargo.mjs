// Exercise the exported Cargo workspace after relocation, using fresh fork TAST.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/portable-cargo/Portable.purs', import.meta.url));
const runtimeChecks = join(dirname(fixture), 'runtime-checks.rs');
const runtime = join(root, 'tests/runtime/perceus_ptr');
const directory = mkdtempSync(join(process.env.PURUST_PORTABLE_KEEP_OUTPUT ?? tmpdir(), 'purust-portable-'));
const commands = [];
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const hashes = files => Object.fromEntries(files.map(file => [relative(runtime, file),
  sha256(file)]));
const runtimeFiles = [join(runtime, 'Cargo.toml'), ...globSync('**/*', { cwd: join(runtime, 'src'), withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name))].sort();
const runtimeHashes = hashes(runtimeFiles);
function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, cwd, status: result.status, signal: result.signal,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function inside(parent, child) {
  const rel = relative(realpathSync(parent), realpathSync(child));
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
try {
  const purs = process.env.PURS ?? 'purs';
  const sources = [fixture, ...['prelude', 'effect'].flatMap(name =>
    globSync('**/*.purs', { cwd: resolve(root, `../purust-${name}/src`) })
      .map(file => resolve(root, `../purust-${name}/src`, file)))];
  const graph = JSON.parse(run(purs, ['graph', ...sources]));
  const selected = new Map();
  function visit(name) {
    if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
    assert.ok(graph[name], name);
    selected.set(name, resolve(directory, graph[name].path));
    graph[name].depends.forEach(visit);
  }
  visit('Portable');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...selected.values(), '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Portable/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls), 'Use the TAST fork.');
  const compiler = join(directory, 'standalone compiler');
  mkdirSync(compiler);
  const bundle = join(compiler, 'purust.mjs');
  cpSync(join(root, 'bin/purust.js'), bundle);
  const provenance = {
    purs, pursVersion: run(purs, ['--version']).trim(),
    bundleSha256: sha256(bundle), runtime: runtimeHashes,
    rustc: run('rustc', ['--version']).trim(), cargo: run('cargo', ['--version']).trim(),
    sources: [...selected.values(), fixture.replace(/\.purs$/, '.rs'), runtimeChecks]
      .map(file => ({ file, sha256: sha256(file) })),
    modes: [],
  };
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const original = join(directory, `generated-${mode}`);
    const generateArgs = ['--stack-size=65536', bundle,
      '--source', tast, '--out', original, '--main', 'Portable', ...(threaded ? ['--threaded'] : [])];
    run(process.execPath, generateArgs);
    assert.ok(existsSync(join(original, 'perceus_ptr/Cargo.toml')), 'The runtime must be embedded in the export.');
    // A reused output directory must refresh the runtime rather than retain stale bytes.
    writeFileSync(join(original, 'perceus_ptr/src/lib.rs'), '// stale generated runtime\n');
    run(process.execPath, generateArgs);
    const relocated = join(directory, `relocated ${mode}`);
    renameSync(original, relocated);
    assert.equal(existsSync(original), false);
    for (const file of runtimeFiles) {
      assert.deepEqual(readFileSync(join(relocated, 'perceus_ptr', relative(runtime, file))), readFileSync(file));
    }
    const metadata = JSON.parse(run('cargo', ['metadata', '--offline', '--format-version', '1'], relocated));
    const ptr = metadata.packages.filter(pkg => pkg.name === 'perceus_ptr');
    assert.equal(ptr.length, 1);
    assert.ok(inside(relocated, ptr[0].manifest_path), 'Cargo must resolve the embedded runtime.');
    const features = metadata.resolve.nodes.find(node => node.id === ptr[0].id).features;
    assert.equal(features.includes('threaded'), threaded);
    for (const pkg of metadata.packages.filter(pkg => pkg.source === null)) {
      assert.ok(inside(relocated, pkg.manifest_path), pkg.manifest_path);
      for (const dependency of pkg.dependencies.filter(dep => dep.path)) {
        assert.ok(inside(relocated, dependency.path), dependency.path);
      }
      const manifest = readFileSync(pkg.manifest_path, 'utf8');
      for (const [, path] of manifest.matchAll(/\bpath\s*=\s*"([^"]+)"/g)) {
        assert.equal(isAbsolute(path), false, `${pkg.name}: ${path}`);
        assert.ok(inside(relocated, resolve(dirname(pkg.manifest_path), path)), path);
      }
    }
    assert.ok(existsSync(join(relocated, 'Cargo.lock')));
    const output = run('cargo', ['run', '--offline', '--locked', '--quiet'], relocated);
    assert.equal(output, 'PORTABLE_CARGO_OK\n');
    mkdirSync(join(relocated, 'perceus_ptr/tests'));
    cpSync(runtimeChecks, join(relocated, 'perceus_ptr/tests/portable.rs'));
    // The canonical local tests share DROP_COUNT and must run serially.
    const tests = run('cargo', ['test', '--offline', '--locked', '-p', 'perceus_ptr',
      ...(threaded ? ['--features', 'threaded'] : []), '--', '--test-threads=1'], relocated);
    assert.match(tests, /copy_on_write_preserves_shared_values \.\.\. ok/);
    assert.equal(tests.includes('threaded_runtime_shares_across_threads ... ok'), threaded);
    provenance.modes.push({ mode, relocated, runtimeFeatures: features,
      lockSha256: sha256(join(relocated, 'Cargo.lock')),
      binarySha256: sha256(join(relocated, 'target/debug/purust_output')) });
    console.log(`${mode}: ${selected.size} fresh TAST modules, relocated Cargo binary and runtime tests passed`);
  }
  assert.deepEqual(hashes(runtimeFiles), runtimeHashes, 'The source runtime must not change.');
  for (const source of provenance.sources) assert.equal(sha256(source.file), source.sha256);
  assert.equal(sha256(join(root, 'bin/purust.js')), provenance.bundleSha256);
  writeFileSync(join(directory, 'report.json'), JSON.stringify(provenance, null, 2) + '\n');
} finally {
  if (process.env.PURUST_PORTABLE_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
