// Fresh TAST for the minimal recursive-newtype contract, not a copy of all pipes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(new URL('fixtures/pipes-x/', import.meta.url));
const sources = [...globSync('**/*.purs', { cwd: fixtures }).map(file => join(fixtures, file)),
  resolve(root, '../purust-unsafe-coerce/src/Unsafe/Coerce.purs')];
const directory = mkdtempSync(join(process.env.PURUST_PIPES_X_KEEP_OUTPUT ?? tmpdir(), 'purust-pipes-x-tast-'));
const commands = [];
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8',
    timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, status: result.status, error: result.error?.message,
    signal: result.signal, stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const purs = process.env.PURS ?? 'purs';
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...sources, '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'Pipes.Internal/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls), 'Use the TAST fork.');
  assert.equal(input.modulePath, join(fixtures, 'Pipes/Internal.purs'));
  assert.ok(!input.dataDecls.some(decl => decl.name === 'X'));
  const ctor = input.decls.find(decl => decl.identifier === 'X').expression;
  assert.equal(ctor.annotation.meta.metaType, 'IsNewtype');
  const type = input.typeTable[ctor.annotation.type];
  assert.equal(type.type, 'Func');
  assert.deepEqual(type.args, [type.ret]);
  assert.deepEqual(input.typeTable[type.ret].fqn, ['Pipes', 'Internal', 'X']);
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify({
    purs, version: run(purs, ['--version']).trim(),
    bundleSha256: sha256(join(root, 'bin/purust.js')),
    sources: sources.map(source => ({ source, sha256: sha256(source) })),
  }, null, 2) + '\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'PipesXProbe', ...(threaded ? ['--threaded'] : [])]);
    const manifest = join(rust, 'Cargo.toml');
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_PipesXProbe']);
    const tests = join(rust, 'Purs_PipesXProbe/tests');
    mkdirSync(tests);
    const checks = readFileSync(join(fixtures, 'checks.rs'), 'utf8');
    writeFileSync(join(tests, 'pipes_x.rs'), threaded ? threadedRust(checks) : checks);
    const result = run('cargo', ['test', '--offline', '--manifest-path', manifest,
      '-p', 'Purs_PipesXProbe', '--test', 'pipes_x', '--', '--test-threads=1']);
    console.log(`${mode}, ${sources.length} fresh modules: ${result.trim().split('\n').at(-1)}`);
  }
} finally {
  if (process.env.PURUST_PIPES_X_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
