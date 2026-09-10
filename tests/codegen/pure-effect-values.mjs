// Run after npm run build. `pure f >>= k` must pass f to k without executing f.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { singleton } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Func, Int } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, EffectBind, EffectDefer, EffectPure, EffectRefNew, EffectRefRead, EffectRefWrite, Local, PrimEffect, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const bindings = [1, 2].map(arity => {
  const args = Array(arity).fill(Int.value);
  const fnType = new Func(args, Int.value);
  const names = args.map((_, i) => `x${i}`);
  const result = new Typed(Int.value, new App(local('retained', arity + 1),
    names.map((name, i) => local(name, i + 1))));
  return new Tuple(`apply${arity}`, new Typed(new Func([fnType, ...args], Any.value),
    new Abs([param('f', 0), ...names.map((name, i) => param(name, i + 1))],
      new EffectBind(new Just('retained'), arity + 1,
        new Typed(Any.value, new EffectPure(new Typed(fnType, local('f', 0)))),
        new EffectPure(result)))));
});
bindings.push(new Tuple('integer', new Typed(new Func([Int.value], Any.value),
  new Abs([param('x', 0)], new EffectBind(new Just('retained'), 1,
    new EffectPure(local('x', 0)), new EffectPure(local('retained', 1)))))));

// PBO's primitive ST operations must use the same cells as the public FFI.
const primitive = (name, names, types, operation) => new Tuple(name,
  new Typed(new Func(types, Any.value), new Abs(names.map((name, i) => param(name, i)),
    new EffectDefer(new PrimEffect(operation)))));
bindings.push(
  primitive('newRef', ['value'], [Int.value], new EffectRefNew(local('value', 0))),
  primitive('readRef', ['reference'], [Any.value], new EffectRefRead(local('reference', 0))),
  primitive('writeRef', ['reference', 'value'], [Any.value, Int.value],
    new EffectRefWrite(local('reference', 0), local('value', 1))),
  primitive('newFunction', ['function'], [new Func([Int.value, Int.value], Int.value)],
    new EffectRefNew(local('function', 0))),
);

const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'PureEffect', dataDecls: [], classDecls: [] },
)({ name: 'PureEffect', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const stFFI = readFileSync(new URL('../../../purust-st/src/Control/Monad/ST/Internal.rs', import.meta.url), 'utf8');
const rust = `${codegenPrelude(singleton('state,value'))}
extern crate self as purust_core;
extern crate self as Purs_Control_Monad_ST_Internal;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
${stFFI}
fn run(action: Value) -> Value {
    action.unwrap_func1()(Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a::default())))
}
fn main() {
    let calls = std::rc::Rc::new(std::cell::Cell::new(0));
    let counter = calls.clone();
    let f = Func1::Shared(std::rc::Rc::new(move |x: i64| { counter.set(counter.get() + 1); x + 1 }));
    let action = PureEffect_apply1(f, 41);
    assert_eq!(calls.get(), 0, "constructing an effect must not call its pure function");
    assert_eq!(run(action.clone()).unwrap_int(), 42);
    assert_eq!(calls.get(), 1, "the function runs only when the continuation calls it");
    assert_eq!(run(action).unwrap_int(), 42);
    assert_eq!(calls.get(), 2);
    assert_eq!(run(PureEffect_apply2(Func2::Static(|x, y| x + y), 19, 23)).unwrap_int(), 42);
    assert_eq!(run(PureEffect_integer(42)).unwrap_int(), 42);

    let allocate = PureEffect_newRef(7);
    let first = run(allocate.clone());
    let second = run(allocate);
    let alias = first.clone();
    let read = PureEffect_readRef(alias.clone());
    let write = PureEffect_writeRef(first, 9);
    assert_eq!(run(read.clone()).unwrap_int(), 7, "write remains deferred");
    assert_eq!(run(write.clone()).unwrap_int(), 9, "ST write returns its value");
    assert_eq!(run(Control_Monad_ST_Internal_read(alias.clone())).unwrap_int(), 9,
        "primitive and public FFI access the same cell");
    run(Control_Monad_ST_Internal_write(mk_int(11), alias));
    assert_eq!(run(read.clone()).unwrap_int(), 11, "reads observe the current aliased state");
    assert_eq!(run(write).unwrap_int(), 9, "write can be replayed");
    assert_eq!(run(read).unwrap_int(), 9);
    assert_eq!(run(PureEffect_readRef(second)).unwrap_int(), 7,
        "each execution of new creates a fresh cell");

    let function_calls = std::rc::Rc::new(std::cell::Cell::new(0));
    let counter = function_calls.clone();
    let stored = Func2::Shared(std::rc::Rc::new(move |a: i64, b: i64| {
        counter.set(counter.get() + 1); a + b
    }));
    let allocate = PureEffect_newFunction(stored);
    assert_eq!(function_calls.get(), 0);
    let reference = run(allocate);
    let value = run(PureEffect_readRef(reference));
    assert_eq!(function_calls.get(), 0, "storing and reading a function must not call it");
    assert_eq!(value.unwrap_func2()(mk_int(19), mk_int(23)).unwrap_int(), 42);
    assert_eq!(function_calls.get(), 1);
}
`;
const dir = mkdtempSync(join(tmpdir(), 'purust-pure-effect-'));
try {
  const source = join(dir, 'pure-effect.rs');
  const binary = join(dir, 'pure-effect');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Pure effects and primitive ST refs preserve values, defer execution, replay and share cells with the FFI.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
