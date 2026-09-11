import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';

const shapes = fromFoldable(foldableArray)(ordString)(['failed,passed,pending', 'label,value', 'tag']);
const prelude = codegenPrelude(shapes);
const ffi = readFileSync(new URL('../../../purust-prelude/src/Record/Unsafe.rs', import.meta.url), 'utf8');
const checks = readFileSync(new URL('fixtures/record-set.rs', import.meta.url), 'utf8');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-record-set-ffi-'));
try {
  for (const threaded of [false, true]) {
    const file = join(directory, `${threaded ? 'threaded' : 'normal'}.rs`);
    const binary = file.slice(0, -3);
    const code = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${threaded ? threadedRust(ffi + checks) : ffi + checks}`;
    writeFileSync(file, code);
    for (const [command, args] of [
      ['rustc', ['--edition=2021', '-Awarnings', '--test', file, '-o', binary,
        ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]],
      [binary, ['--test-threads=1']],
    ]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30_000 });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
      if (command === binary) console.log(`${threaded ? 'threaded' : 'normal'}: ${result.stdout.trim().split('\n').at(-1)}`);
    }
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
