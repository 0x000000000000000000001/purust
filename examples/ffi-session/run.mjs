import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTypedCompiler, verifyTypedOutput } from '../../tools/native-workspace.mjs';

const example = fileURLToPath(new URL('./', import.meta.url));
const root = resolve(example, '../..');
const artifacts = join(example, 'artifacts');
const directory = mkdtempSync(join(tmpdir(), 'purust-ffi-session-'));
const keep = process.argv.includes('--keep-output');
const purs = findTypedCompiler(root, process.env.PURUST_PURS ?? process.env.PURS);
const bundle = join(root, 'bin/purust.js');
const commands = [];
const report = { complete: false, rejected: [], executions: [] };
mkdirSync(artifacts, { recursive: true });

function run(command, args, { cwd = directory, reject = false } = {}) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CARGO_NET_OFFLINE: 'true' },
  });
  commands.push({ command, args, cwd, status: result.status,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(artifacts, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.equal(result.signal, null, `${command}: ${result.error ?? result.stderr}`);
  if (reject) assert.ok(Number.isInteger(result.status) && result.status !== 0, 'Expected rejection');
  else assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function files(pattern, cwd) {
  return globSync(pattern, { cwd }).map(file => join(cwd, file));
}

try {
  const input = join(directory, 'input');
  cpSync(join(example, 'src'), input, { recursive: true });
  const negative = join(directory, 'rejected');
  cpSync(join(example, 'rejected'), negative, { recursive: true });
  const candidates = [
    ...files('*.purs', input), ...files('*.purs', negative),
    ...['prelude', 'effect', 'unsafe-coerce'].flatMap(name => files('**/*.purs', resolve(root, `../purust-${name}/src`))),
    ...files('safe-coerce-*/src/**/*.purs', join(root, '.spago/p')),
  ];
  const graph = JSON.parse(run(purs, ['graph', ...candidates]).stdout);
  function sourcesFor(main) {
    const selected = new Map();
    function visit(name) {
      if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
      assert.ok(graph[name], `Missing module ${name}; install the existing project dependencies first.`);
      selected.set(name, resolve(directory, graph[name].path));
      graph[name].depends.forEach(visit);
    }
    visit(main);
    return [...selected.values()];
  }

  report.tools = {
    pursPath: purs,
    purs: run(purs, ['--version']).stdout.trim(),
    rustc: run('rustc', ['--version']).stdout.trim(),
    bundleSha256: createHash('sha256').update(readFileSync(bundle)).digest('hex'),
  };
  console.log('Compile the valid program from fresh TAST.');
  const tast = join(directory, 'tast');
  run(purs, ['compile', ...sourcesFor('Demo'), '--codegen', 'corefn', '--output', tast]);
  report.tast = verifyTypedOutput(tast);

  const cases = [
    ['DoubleFinish', ['TypesDoNotUnify']],
    ['AliasedFinish', ['TypesDoNotUnify']],
    ['ReadAfterFinish', ['TypesDoNotUnify']],
    ['CallbackRepeat', ['TypesDoNotUnify']],
    ['Unfinished', ['TypesDoNotUnify']],
    ['CoerceState', ['NoInstanceFound', 'TypesDoNotUnify']],
    ['CoerceInput', ['NoInstanceFound', 'TypesDoNotUnify']],
    ['ForgeProgram', ['UnknownImportDataConstructor']],
    ['RawRunner', ['UnknownImport']],
  ];
  for (const [name, codes] of cases) {
    const result = run(purs, ['compile', ...sourcesFor(name), '--codegen', 'corefn',
      '--output', join(directory, `reject-${name}`), '--json-errors'], { reject: true });
    const errors = (result.stdout + '\n' + result.stderr).split('\n').flatMap(line => {
      try { return JSON.parse(line).errors ?? []; } catch { return []; }
    });
    assert.ok(errors.some(error => codes.includes(error.errorCode) && error.moduleName === name),
      `Unexpected reason for rejecting ${name}: ${result.stdout}\n${result.stderr}`);
    report.rejected.push({ name, errors: errors.map(error => ({ code: error.errorCode, message: error.message })) });
    console.log(`Rejected as expected: ${name}`);
  }

  const expected = [
    'OPEN session=1', 'READ session=1 value=15', 'FINISH session=1 value=17',
    'OPEN session=2', 'READ session=2 value=15', 'FINISH session=2 value=17',
    'OPEN session=3', 'READ session=3 value=25', 'FINISH session=3 value=25',
    'FFI_SESSION_POC_OK sessions=3', '',
  ].join('\n');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const output = join(directory, mode);
    console.log(`Generate and execute Rust (${mode}).`);
    run(process.execPath, ['--stack-size=65536', bundle, '--source', tast,
      '--out', output, '--main', 'Demo', ...(threaded ? ['--threaded'] : [])]);
    const result = run('cargo', ['run', '--offline', '--quiet'], { cwd: output });
    assert.equal(result.stdout, expected, 'Replay must create fresh sessions and finish each exactly once.');
    for (const module of ['Session', 'Demo']) {
      cpSync(join(output, `Purs_${module}/src/lib.rs`), join(artifacts, `${mode}-${module}.rs`));
    }
    report.executions.push({ mode, output: result.stdout });
    console.log(`${mode}: 3 distinct sessions created, finished and dropped; results 17, 17, 25.`);
  }
  report.complete = true;
  console.log(`Passed: ${report.rejected.length} compile-time rejections and both Rust modes.`);
} finally {
  report.retainedWorkspace = keep || !report.complete ? directory : null;
  writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.retainedWorkspace) console.log(`Retained workspace: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
  console.log(`Report: ${join(artifacts, 'report.json')}`);
}
