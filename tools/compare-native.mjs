// Compare prebuilt compilers on a frozen compilation-purust-aff.mjs snapshot.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { arch, cpus, loadavg, release, totalmem } from 'node:os';
import { compareGeneratedSources } from './native-workspace.mjs';

const [snapshotArg, resultArg, ...variants] = process.argv.slice(2);
assert(snapshotArg && resultArg && variants.length >= 2,
  'Usage: node tools/compare-native.mjs SNAPSHOT RESULT_JSON LABEL=EXECUTABLE_OR_CONFIG_JSON [...]\nConfig: { "binary": "path/relative/to/config", "env": { "PURUST_PBO_JOBS": "4" } }');
const snapshot = resolve(snapshotArg), destination = resolve(resultArg);
assert(!existsSync(destination), `Result already exists: ${destination}`);
const manifest = JSON.parse(readFileSync(join(snapshot, 'manifest.json'), 'utf8'));
const cwd = join(snapshot, 'inputs/purust-aff');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const compilers = variants.map(value => {
  const separator = value.indexOf('=');
  assert(separator > 0);
  const label = value.slice(0, separator), file = resolve(value.slice(separator + 1));
  const config = file.endsWith('.json') ? JSON.parse(readFileSync(file, 'utf8')) : { binary: file };
  const binary = resolve(dirname(file), config.binary);
  assert(/^[a-zA-Z0-9_-]+$/.test(label));
  return { label, binary, sha256: hash(binary), env: config.env ?? {} };
});
assert.equal(new Set(compilers.map(c => c.label)).size, compilers.length);
const rounds = Number(process.env.PURUST_BENCH_RUNS ?? 5);
assert(Number.isInteger(rounds) && rounds > 0);
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(PURUST_|GOPURS_|NODE_|RUST|CARGO)/.test(key)) delete env[key];
function verify() {
  for (const file of manifest.inputs.files) assert.equal(hash(join(snapshot, file.path)), file.sha256, file.path);
  for (const compiler of compilers) assert.equal(hash(compiler.binary), compiler.sha256, compiler.label);
}
verify();
const work = destination.replace(/\.json$/, '') + '-runs';
assert(!existsSync(work));
mkdirSync(work, { recursive: true });
const result = { started_at: new Date().toISOString(), snapshot, input_sha256: manifest.inputs.tast_sha256,
  host: { architecture: arch(), os_release: release(), cpu: cpus()[0].model,
    logical_cpus: cpus().length, memory_bytes: totalmem(), node: process.version },
  compilers, protocol: { rounds, warmups_per_compiler: 1, order: 'rotating first compiler each round',
    metric: 'backend total in ms', fresh_output_and_purmeta: true,
    environment: 'PURUST_/GOPURS_/NODE_/RUST*/CARGO* removed, then per-variant env applied',
    cpu_affinity: 'unset', os_file_cache: 'not flushed' }, runs: [] };
const save = () => writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
mkdirSync(dirname(destination), { recursive: true });
let reference;
try {
  for (let round = 0; round <= rounds; round++) {
    const order = round === 0 ? compilers : [...compilers.slice((round - 1) % compilers.length), ...compilers.slice(0, (round - 1) % compilers.length)];
    for (const compiler of order) {
      const label = `${round}-${compiler.label}`, output = join(work, label);
      rmSync(join(cwd, '.purmeta'), { recursive: true, force: true });
      const args = ['--source', 'output', '--main', 'Test.Main', '--threaded', '--out', output];
      const command = compiler.binary.endsWith('.js')
        ? [process.execPath, '--expose-gc', '--stack-size=65536', '--max-old-space-size=16384', compiler.binary, ...args]
        : [compiler.binary, ...args];
      const started = performance.now(), load = loadavg();
      const execution = spawnSync('/usr/bin/time', ['-l', ...command], { cwd, env: { ...env, ...compiler.env }, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
      const run = { compiler: compiler.label, round, warmup: round === 0, command, load_average: load,
        wall_ms: performance.now() - started, status: execution.status, signal: execution.signal,
        stdout: execution.stdout, stderr: execution.stderr,
        phases_ms: Object.fromEntries([...execution.stderr.matchAll(/^\[purust\] (.+): (\d+) ms$/gm)].map(([, phase, ms]) => [phase, Number(ms)])),
        max_rss_bytes: Number(execution.stderr.match(/(\d+)\s+maximum resident set size/)?.[1]),
        peak_footprint_bytes: Number(execution.stderr.match(/(\d+)\s+peak memory footprint/)?.[1]) };
      result.runs.push(run);
      save();
      writeFileSync(join(work, label + '.log'), execution.stdout + execution.stderr);
      assert.ifError(execution.error);
      assert.equal(execution.status, 0, execution.stderr);
      assert(run.phases_ms['backend total'] > 0);
      assert.equal([...execution.stderr.matchAll(/^\[purust\] backend total:/gm)].length, 1);
      if (!reference) reference = output;
      run.identical_files = compareGeneratedSources(reference, output);
      console.log(`${label}: ${run.phases_ms['backend total']} ms, ${run.identical_files} identical files`);
      save();
    }
  }
  const median = values => { const sorted = values.toSorted((a, b) => a - b), half = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2; };
  result.summary = Object.fromEntries(compilers.map(({ label }) => {
    const runs = result.runs.filter(run => !run.warmup && run.compiler === label);
    return [label, { samples_ms: runs.map(run => run.phases_ms['backend total']),
      phases_median_ms: Object.fromEntries(Object.keys(runs[0].phases_ms).map(phase => [phase, median(runs.map(run => run.phases_ms[phase]))])),
      max_rss_bytes: Math.max(...runs.map(run => run.max_rss_bytes)) }];
  }));
  verify();
  result.finished_at = new Date().toISOString();
  save();
  console.log(JSON.stringify(result.summary, null, 2));
} catch (error) {
  result.failure = error.message;
  save();
  throw error;
}
