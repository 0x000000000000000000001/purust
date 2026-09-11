// Run after npm run build. Exercise the real clock FFI with the generated runtime.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';

const ffi = readFileSync(new URL('../../../purust-now/src/Effect/Now.rs', import.meta.url), 'utf8');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const effect = readFileSync(new URL('../../../purust-effect/src/Effect.rs', import.meta.url), 'utf8');

function source(threaded) {
  const prelude = codegenPrelude(empty);
  return `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
mod clock_ffi {
    ${threaded ? threadedRust(ffi) : ffi}
    pub fn check_epoch_conversion() {
        use std::time::Duration;
        assert_eq!(purust_now_milliseconds(UNIX_EPOCH), 0.0);
        assert_eq!(purust_now_milliseconds(UNIX_EPOCH + Duration::from_millis(1234)), 1234.0);
        assert_eq!(purust_now_milliseconds(UNIX_EPOCH - Duration::from_millis(1234)), -1234.0);
        assert_eq!(purust_now_milliseconds(UNIX_EPOCH + Duration::from_nanos(1234999999)), 1234.0);
    }
}
mod effect_ffi {
    use super::*;
    ${threaded ? threadedRust(effect) : effect}
}

fn unix_milliseconds() -> f64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as f64
}

fn sample(action: &Value) -> f64 {
    let before = unix_milliseconds();
    let value = action.unwrap_func1()(Value::Unit);
    let after = unix_milliseconds();
    let milliseconds = match value {
        Value::Number(value) => value,
        _ => panic!("Effect.Now.now must return the Number underlying Instant"),
    };
    assert!(milliseconds.is_finite() && milliseconds.fract() == 0.0);
    assert!(before <= milliseconds && milliseconds <= after,
        "clock was read before effect execution: {before} <= {milliseconds} <= {after}");
    milliseconds
}

fn main() {
    clock_ffi::check_epoch_conversion();
    let action = clock_ffi::Effect_Now_now();
    assert!(matches!(&action, Value::Func1(_)), "construction must return an effect");
    std::thread::sleep(std::time::Duration::from_millis(25));
    let first = sample(&action);
    std::thread::sleep(std::time::Duration::from_millis(25));
    let second = sample(&action);
    assert!(second > first, "replaying the same effect must read the clock again");

    let composed = effect_ffi::Effect_bindE(action.clone(), Func1::Static(|value| {
        effect_ffi::Effect_pureE(value)
    }));
    std::thread::sleep(std::time::Duration::from_millis(25));
    sample(&composed);

    ${threaded ? `fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<Value>();
    let shared = action.clone();
    std::thread::spawn(move || { sample(&shared); }).join().unwrap();` : ''}
    println!("{first:.0} {second:.0}");
}
`;
}

for (const threaded of [false, true]) {
  const label = threaded ? 'threaded' : 'normal';
  test(`Effect.Now.now (${label}): deferred clock, replay and Effect bind`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'purust-now-ffi-'));
    try {
      const file = join(directory, 'main.rs');
      const binary = join(directory, 'checks');
      writeFileSync(file, source(threaded));
      const args = ['--edition=2021', '-Awarnings', file, '-o', binary];
      if (threaded) args.push('--cfg', 'feature="threaded"');
      const build = spawnSync('rustc', args, { encoding: 'utf8', timeout: 30_000 });
      assert.equal(build.status, 0, `${label} rustc: ${build.error ?? ''}\n${build.stderr}`);
      const before = Date.now();
      const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 5_000 });
      const after = Date.now();
      assert.equal(run.status, 0, `${label}: ${run.error ?? ''}\n${run.stderr}`);
      assert.equal(run.stderr, '');
      assert.match(run.stdout, /^\d+ \d+\n$/);
      const [first, second] = run.stdout.trim().split(' ').map(Number);
      assert.ok(before <= first && first < second && second <= after,
        'native samples must be milliseconds on the same Unix timeline as Date.now()');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
