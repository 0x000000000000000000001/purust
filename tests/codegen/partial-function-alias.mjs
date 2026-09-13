// A constrained polymorphic alias can be a partial application whose emitted
// function is unary, even though its public TAST signature is flattened.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Func, Int, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { App, PrimUndefined, Typed, TypeApp, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
const name = 'PartialAlias';
const callback = new Func([Int.value], Int.value);
const type = new Func([callback, Int.value], Int.value);
let arities = insert(ordString)(`${name}_discharge`)(new Func([Any.value, Any.value], Any.value))(emptyMap);
for (const alias of ['direct', 'wrapped']) arities = insert(ordString)(`${name}_${alias}`)(type)(arities);
const partial = new App(new Var(new Qualified(new Just(name), 'discharge')), [PrimUndefined.value]);
const generated = codegenModule(arities)(emptyMap)({ name, dataDecls: [], classDecls: [] })({ name,
  bindings: [{ recursive: false, bindings: [
    new Tuple('direct', new Typed(type, new Typed(type, partial))),
    new Tuple('wrapped', new Typed(type, new TypeApp(new Typed(type, partial), Any.value))),
  ] }] });
const main = `
fn PartialAlias_discharge(_: Value, value: Value) -> Value { value }
fn main() {
    let calls = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let observed = calls.clone();
    let callback = Func1::Shared(std::rc::Rc::new(move |n: i64| {
        observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        n + 1
    }));
    for alias in [PartialAlias_direct, PartialAlias_wrapped] {
        assert_eq!(alias(callback.clone(), 41), 42);
        assert_eq!(alias(callback.clone(), 9), 10);
    }
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 4);
}
`;
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-partial-alias-'));
try {
  for (const threaded of [false, true]) {
    const path = join(directory, threaded ? 'arc.rs' : 'rc.rs'), binary = path + '.bin';
    const prelude = codegenPrelude(emptySet);
    writeFileSync(path, `${threaded ? threadedPrelude(prelude) : prelude}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;\n${threaded ? threadedRust(generated + main) : generated + main}`);
    for (const [command, args] of [['rustc', ['--edition=2021', '-Awarnings', ...(threaded ? ['--cfg', 'feature="threaded"'] : []), path, '-o', binary]], [binary, []]]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
    }
  }
  console.log('Partial polymorphic aliases preserve emitted arity and callback execution in Rc/Arc.');
} finally { rmSync(directory, { recursive: true, force: true }); }
