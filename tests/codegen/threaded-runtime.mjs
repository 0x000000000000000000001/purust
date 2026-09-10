import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { singleton } from '../../output/Data.Set/index.js';
const literals = [
  `"std::rc::Rc + 'static"`, 'r###"std::rc::Rc"###',
  'br#"std::rc::Rc"#', "'🦀'", "'\\\\'", "'\\u{1f980}'",
  '// std::rc::Rc', `/* std::rc::Rc /* nested */ + 'static */`,
];
for (const literal of literals) assert.equal(threadedRust(literal), literal);
assert.equal(threadedRust('use std::rc::Rc;'), 'use std::sync::Arc as Rc;');
assert.equal(threadedRust("fn f(x: impl Fn() + 'static) {}"),
  "fn f(x: impl Fn() + Send + Sync + 'static) {}");
assert.equal(threadedRust("fn f(x: impl Fn() + Send + Sync + 'static) {}"),
  "fn f(x: impl Fn() + Send + Sync + 'static) {}");
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const refs = readFileSync(new URL('../../../purust-refs/src/Effect/Ref.rs', import.meta.url), 'utf8');
const source = `${threadedPrelude(codegenPrelude(singleton('state,value')))}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
mod refs { ${threadedRust(refs)} }
fn run(effect: Value) -> Value { effect.unwrap_func1()(Value::Unit) }
fn assert_send_sync<T: Send + Sync>() {}
fn main() {
    assert_send_sync::<Value>();
    let shared = run(refs::Effect_Ref__new(Value::Int(0)));
    let workers: Vec<_> = (0..8).map(|_| {
        let shared = shared.clone();
        std::thread::spawn(move || {
            for _ in 0..1000 {
                let update = Func1::Static(|value: Value| {
                    let value = Value::Int(value.unwrap_int() + 1);
                    let mut result = Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a::default()));
                    result.set_state(value.clone());
                    result.set_value(value);
                    result
                });
                run(refs::Effect_Ref_modifyImpl(update, shared.clone()));
            }
        })
    }).collect();
    for worker in workers { worker.join().unwrap(); }
    assert_eq!(run(refs::Effect_Ref_read(shared)).unwrap_int(), 8000);
    let thunk = perceus_ptr::PerceusPtr::new(Thunk::default());
    let published = thunk.clone();
    assert!(thunk.value.set(Value::Func1(Func1::Static(|v| v))).is_ok());
    std::thread::spawn(move || assert_eq!(Value::Thunk(published).unwrap_func1()(Value::Int(42)).unwrap_int(), 42)).join().unwrap();
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-threaded-'));
try {
  const file = join(directory, 'main.rs');
  writeFileSync(file, source);
  const binary = join(directory, 'test');
  const build = spawnSync('rustc', ['--edition=2021', '--cfg', 'feature="threaded"', '-Awarnings', file, '-o', binary], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 0, run.stderr);
  console.log('threaded runtime: Send + Sync, 8000 atomic Ref updates, shared thunk initialization, literal preservation');
} finally { rmSync(directory, { recursive: true, force: true }); }
