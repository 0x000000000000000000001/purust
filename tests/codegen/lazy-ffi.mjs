// Compile the actual FFI with the generated runtime, in both ownership modes.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';

const ffi = readFileSync(new URL('../../../purust-lazy/src/Data/Lazy.rs', import.meta.url), 'utf8');
const checks = readFileSync(new URL('fixtures/lazy-ffi.rs', import.meta.url), 'utf8');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
for (const threaded of [false, true]) {
  const mode = threaded ? 'threaded' : 'normal';
  test(`Data.Lazy (${mode}): memoization, ownership, unwind and contention`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'purust-lazy-ffi-'));
    try {
      const prelude = codegenPrelude(empty);
      const source = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
mod lazy_ffi { ${threaded ? threadedRust(ffi) : ffi} }
${threaded ? threadedRust(checks) : checks}`;
      const file = join(directory, 'checks.rs');
      const binary = join(directory, 'checks');
      writeFileSync(file, source);
      const build = spawnSync('rustc', ['--edition=2021', '-Awarnings', '--test', file, '-o', binary,
        ...(threaded ? ['--cfg', 'feature="threaded"'] : [])], { encoding: 'utf8', timeout: 30_000 });
      assert.equal(build.status, 0, `${build.error ?? ''}\n${build.stderr}`);
      const run = spawnSync(binary, ['--test-threads=1'], { encoding: 'utf8', timeout: 15_000 });
      assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
      console.log(`${mode}: ${run.stdout.trim().split('\n').at(-1)}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
