// Sample a running compiler at a named phase. All output stays in the retained
// bootstrap workspace; this deliberately stops the diagnostic build afterwards.
import { spawn } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('../', import.meta.url));
const [directory, phase = 'codegen PureScript.Backend.Optimizer.Semantics'] = process.argv.slice(2);
if (!directory) throw new Error('Usage: node bench/profile-native.mjs BOOTSTRAP_WORKSPACE ["codegen Module.Name"]');
const workspace = resolve(directory);
const binary = process.env.PURUST_NATIVE ? resolve(process.env.PURUST_NATIVE) : join(root, 'bin/purust-native');
const prefix = process.env.PURUST_PROFILE_NAME ?? 'native-profile';
const marker = process.env.PURUST_PROFILE_LINE ?? `[purust] ${phase}`;
const log = createWriteStream(join(workspace, prefix + '.log'));
const events = [], started = performance.now();
const child = spawn(binary, ['--source', 'output', '--out', `${prefix}-output`, '--main', 'Main', '--threaded', '--trace-phases'],
  { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'] });
let sample, sampling, captured = false;
const interrupt = () => { child.kill('SIGTERM'); sample?.kill('SIGTERM'); };
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
for (const stream of [child.stdout, child.stderr]) {
  stream.pipe(log, { end: false });
  createInterface({ input: stream }).on('line', line => {
    const elapsed = performance.now() - started;
    events.push({ elapsed, line });
    if ((process.env.PURUST_PROFILE_LINE ? line.startsWith(marker) : line === marker) && !sampling) {
      console.log(`Profiling PID ${child.pid} at ${phase} after ${(elapsed / 1000).toFixed(1)} s`);
      sample = spawn('/usr/bin/sample', [String(child.pid), '5', '1', '-file', join(workspace, prefix + '.sample.txt')],
        { stdio: 'inherit' });
      sampling = new Promise((resolve, reject) => {
        sample.once('error', reject);
        sample.once('close', code => code === 0 ? resolve() : reject(new Error(`sample exited ${code}`)));
      }).then(() => { captured = true; }).finally(() => child.kill('SIGTERM'));
      // Observe rejection immediately; rethrow after joining the child below.
      sampling.catch(() => {});
    }
  });
}
try {
  const status = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  if (sampling) await sampling;
  writeFileSync(join(workspace, prefix + '.events.json'), JSON.stringify({ binary, phase, status, captured, events }, null, 2) + '\n');
  if (!captured) throw new Error(`Compiler exited before profiling ${phase}: ${JSON.stringify(status)}`);
  console.log(`Profile: ${join(workspace, prefix + '.sample.txt')}`);
} finally {
  interrupt();
  log.end();
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', interrupt);
}
