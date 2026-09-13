import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenExprType, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';
import { Func, Int } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { threadedPrelude } from '../../src/Purust/Threading.js';

const types = Array(12).fill(Int.value), code = codegenPrelude(empty);
assert.match(codegenExprType('Probe')(false)(new Func(types, Int.value)), /^purust_core::Func12</);
assert.match(code, /pub enum Func12</);
const directory = mkdtempSync(join(tmpdir(), 'purust-arity12-'));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const names = Array.from({ length: 12 }, (_, i) => `a${i}`), values = names.map((_, i) => `${i + 1}`);
const checks = `fn main() {
  let native = Func12::Static(|${names.map(n => `${n}: i64`).join(', ')}| -> i64 { ${names.join(' + ')} });
  assert_eq!(native(${values.join(', ')}), 78);
  let boxed = Value::Func12(Func12::Static(|${names.map(n => `${n}: Value`).join(', ')}| -> Value { mk_int(${names.map(n => `${n}.unwrap_int()`).join(' + ')}) }));
  assert_eq!(boxed.unwrap_func12()(${values.map(v => `mk_int(${v})`).join(', ')}).unwrap_int(), 78);
  let mut partial = boxed;
  for i in 1..=12 { partial = partial.unwrap_func1()(mk_int(i)); }
  assert_eq!(partial.unwrap_int(), 78);
}`;
for (const threaded of [false, true]) {
  const file = join(directory, threaded ? 'threaded.rs' : 'normal.rs'), binary = file.slice(0, -3);
  writeFileSync(file, `${threaded ? threadedPrelude(code) : code}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;\n${checks}`);
  for (const [cmd, args] of [['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary,
    ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]], [binary, []]]) {
    const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
}
console.log(`arity 12: typed/boxed/curried normal/threaded checks passed; ${directory}`);
