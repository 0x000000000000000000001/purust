import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTypedCompiler, verifyTypedOutput } from '../../tools/native-workspace.mjs';

const lab = fileURLToPath(new URL('./', import.meta.url));
const root = resolve(lab, '../..');
const args = process.argv.slice(2);
const chosen = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : null;
const keep = args.includes('--keep-output');
const purs = findTypedCompiler(root, process.env.PURUST_PURS ?? process.env.PURS);
const bundle = join(root, 'bin/purust.js');
const suites = readdirSync(lab, { withFileTypes: true }).filter(entry =>
  entry.isDirectory() && existsSync(join(lab, entry.name, 'suite.json')) && (!chosen || entry.name === chosen));
assert.ok(suites.length, `No suites found${chosen ? `: ${chosen}` : ''}`);

function pursFiles(directory) {
  return globSync('**/*.purs', { cwd: directory }).map(file => join(directory, file));
}

// This selects dependency files only. The actual compiler resolves and checks
// the module graph and every program; no regex is used to decide type safety.
const librarySources = new Map();
function indexSources(paths, target) {
  for (const path of paths) {
    const source = readFileSync(path, 'utf8');
    const name = source.match(/^\s*module\s+([\w.]+)/m)?.[1];
    if (name) target.set(name, { path, imports: [...source.matchAll(/^\s*import\s+([\w.]+)/gm)].map(match => match[1]) });
  }
}
indexSources(globSync('*/src/**/*.purs', { cwd: join(root, '.spago/p') }).map(path => join(root, '.spago/p', path)), librarySources);
indexSources(globSync('purust-*/src/**/*.purs', { cwd: resolve(root, '..') }).map(path => resolve(root, '..', path)), librarySources);

for (const entry of suites) {
  const suite = join(lab, entry.name);
  const config = JSON.parse(readFileSync(join(suite, 'suite.json'), 'utf8'));
  const artifacts = join(lab, 'artifacts', entry.name);
  mkdirSync(artifacts, { recursive: true });
  const workspace = mkdtempSync(join(tmpdir(), `purust-linearity-${entry.name}-`));
  const commands = [];
  const report = { name: config.name, complete: false, cases: [], executions: [], tools: {
    pursPath: purs, bundleSha256: createHash('sha256').update(readFileSync(bundle)).digest('hex'),
  } };
  function run(command, argv, { cwd = workspace, reject = false } = {}) {
    const result = spawnSync(command, argv, { cwd, encoding: 'utf8', timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CARGO_NET_OFFLINE: 'true' } });
    commands.push({ command, args: argv, cwd, status: result.status, error: result.error?.message,
      stdout: result.stdout, stderr: result.stderr });
    writeFileSync(join(artifacts, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
    assert.equal(result.signal, null, `${command}: ${result.error ?? result.stderr}`);
    if (reject) assert.ok(Number.isInteger(result.status) && result.status !== 0, `Expected rejection: ${command}`);
    else assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    return result;
  }
  try {
    report.tools.purs = run(purs, ['--version']).stdout.trim();
    report.tools.rustc = run('rustc', ['--version']).stdout.trim();
    const input = join(workspace, 'input');
    cpSync(suite, input, { recursive: true, filter: path => !['target', 'artifacts'].includes(basename(path)) });
    const hook = config.hook ? await import(new URL(`./${entry.name}/${config.hook}`, import.meta.url)) : null;
    if (hook?.prepare) await hook.prepare({ input, workspace, artifacts, run, report });
    const sources = new Map(librarySources);
    indexSources(pursFiles(input), sources);
    const selected = new Map();
    function visit(name) {
      if (name === 'Prim' || name.startsWith('Prim.') || selected.has(name)) return;
      const item = sources.get(name);
      assert.ok(item, `Missing module: ${name}`);
      selected.set(name, item.path);
      item.imports.forEach(visit);
    }
    [...config.cases, ...(config.executions ?? [])].forEach(test => visit(test.module));
    const graph = JSON.parse(run(purs, ['graph', ...selected.values()]).stdout);
    function sourcesFor(name) {
      const result = new Map();
      function add(name) {
        if (name === 'Prim' || name.startsWith('Prim.') || result.has(name)) return;
        assert.ok(graph[name], `Missing graph node: ${name}`);
        result.set(name, resolve(workspace, graph[name].path));
        graph[name].depends.forEach(add);
      }
      add(name);
      return [...result.values()];
    }
    const compiled = new Map();
    for (const test of config.cases) {
      const output = join(workspace, 'tast', test.module);
      const result = run(purs, ['compile', ...sourcesFor(test.module), '--codegen', 'corefn', '--output', output,
        '--json-errors'], { reject: test.expect === 'reject' });
      const errors = (result.stdout + '\n' + result.stderr).split('\n').flatMap(line => {
        try { return JSON.parse(line).errors ?? []; } catch { return []; }
      });
      if (test.expect === 'reject') {
        assert.ok(test.codes?.length, `Provide expected diagnostic codes for ${test.module}`);
        assert.ok(errors.some(error => test.codes.includes(error.errorCode) && error.moduleName === test.module),
          `Wrong rejection for ${test.module}: ${result.stdout}\n${result.stderr}`);
      } else {
        assert.equal(test.expect, 'accept');
        verifyTypedOutput(output);
        compiled.set(test.module, output);
      }
      report.cases.push({ ...test, errors: errors.map(error => ({ code: error.errorCode, message: error.message, module: error.moduleName })) });
      console.log(`[${entry.name}] ${test.expect}: ${test.module}`);
    }
    for (const execution of config.executions ?? []) {
      let tast = compiled.get(execution.module);
      if (!tast) {
        tast = join(workspace, 'tast', execution.module);
        run(purs, ['compile', ...sourcesFor(execution.module), '--codegen', 'corefn', '--output', tast]);
        verifyTypedOutput(tast);
        compiled.set(execution.module, tast);
      }
      for (const mode of execution.modes ?? ['normal', 'threaded']) {
        assert.ok(['normal', 'threaded'].includes(mode));
        const output = join(workspace, 'rust', `${execution.module}-${mode}`);
        mkdirSync(resolve(output, '..'), { recursive: true });
        run(process.execPath, ['--stack-size=65536', bundle, '--source', tast, '--out', output,
          '--main', execution.module, ...(mode === 'threaded' ? ['--threaded'] : [])]);
        const result = run('cargo', ['run', '--offline', '--quiet'], { cwd: output });
        assert.ok(execution.marker && result.stdout.split('\n').includes(execution.marker), `Missing assertion marker: ${result.stdout}`);
        const archive = join(artifacts, `${execution.module}-${mode}`);
        mkdirSync(archive, { recursive: true });
        for (const file of globSync('Purs_*/src/lib.rs', { cwd: output })) {
          const dest = join(archive, file);
          mkdirSync(resolve(dest, '..'), { recursive: true });
          cpSync(join(output, file), dest);
        }
        report.executions.push({ module: execution.module, mode, stdout: result.stdout });
        console.log(`[${entry.name}] Rust ${mode}: ${execution.marker}`);
      }
    }
    if (hook?.check) await hook.check({ input, workspace, artifacts, run, report, compiled });
    report.complete = true;
  } finally {
    report.retainedWorkspace = keep || !report.complete ? workspace : null;
    writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (report.retainedWorkspace) console.log(`Retained workspace: ${workspace}`);
    else rmSync(workspace, { recursive: true, force: true });
    console.log(`Report: ${join(artifacts, 'report.json')}`);
  }
}
