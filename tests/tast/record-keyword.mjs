// The generator must escape a field, not its logical key or composite names.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = join(root, 'tests/tast/fixtures/record-keyword');
const recordSource = resolve(root, '../purust-prelude/src/Record/Unsafe.purs');
const ffi = recordSource.replace(/\.purs$/, '.rs');
const sources = [join(fixtures, 'RecordKeywordProbe.purs'), recordSource];
const directory = mkdtempSync(join(process.env.PURUST_RECORD_KEYWORD_KEEP_OUTPUT ?? tmpdir(), 'purust-record-keyword-'));
const commands = [], hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
console.log(`Diagnostic: ${directory}`);
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 90_000, maxBuffer: 16 * 1024 * 1024 });
  commands.push({ command, args, status: result.status, signal: result.signal, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(directory, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
let succeeded = false;
try {
  const purs = process.env.PURS ?? 'purs';
  const provenance = { purs, version: run(purs, ['--version']).trim(), bundleSha256: hash(join(root, 'bin/purust.js')),
    inputs: [...sources, ffi, join(fixtures, 'checks.rs')].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(join(directory, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...sources, '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'RecordKeywordProbe/corefn.json')));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls) && Array.isArray(input.classDecls));
  assert.equal(input.modulePath, sources[0]);
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'), '--source', tast,
      '--out', rust, '--main', 'RecordKeywordProbe', ...(threaded ? ['--threaded'] : [])]);
    const code = readFileSync(join(rust, 'Purs_Record_Unsafe/src/lib.rs'), 'utf8');
    const original = readFileSync(ffi, 'utf8');
    assert.ok(code.includes(threaded ? threadedRust(original) : original));
    const manifest = join(rust, 'Cargo.toml');
    // Check the untouched export before installing tests: failure must be in generated code.
    run('cargo', ['check', '--offline', '--manifest-path', manifest, '-p', 'Purs_RecordKeywordProbe', '--lib']);
    const prelude = readFileSync(join(rust, 'purust_core/src/lib.rs'), 'utf8');
    assert.match(prelude, /pub r#final: Option<UnknownType>/);
    assert.match(prelude, /pub final_kw: Option<UnknownType>/);
    assert.doesNotMatch(prelude, /(?:Record_|get_|set_|__purust_borrow_)r#final/);
    const generated = readFileSync(join(rust, 'Purs_RecordKeywordProbe/src/lib.rs'), 'utf8');
    assert.match(generated, /pub fn RecordKeywordProbe_readFinal\([^\n]+\) -> i64/);
    assert.match(generated, /Record_final_final_kw \{ r#final:/);
    const tests = join(rust, 'Purs_RecordKeywordProbe/tests'); mkdirSync(tests);
    writeFileSync(join(tests, 'keyword.rs'), readFileSync(join(fixtures, 'checks.rs')));
    const result = run('cargo', ['test', '--offline', '--manifest-path', manifest,
      '-p', 'Purs_RecordKeywordProbe', '--test', 'keyword', '--', '--test-threads=1']);
    assert.match(result, /3 passed; 0 failed/);
    console.log(`${mode}: 2 fresh TAST modules, 3 record keyword tests passed`);
  }
  assert.equal(hash(join(root, 'bin/purust.js')), provenance.bundleSha256);
  provenance.inputs.forEach(input => assert.equal(hash(input.path), input.sha256));
  succeeded = true;
} finally {
  if (!succeeded || process.env.PURUST_RECORD_KEYWORD_KEEP_OUTPUT) console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory, { recursive: true });
}
