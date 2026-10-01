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
import { ADT, Any, Boolean as BooleanType, Func, Int, LitInt, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Branch, Let, Lit, Local, Op2, OpAdd, OpIntNum, Pair, PrimOp, Typed, UncurriedAbs, UncurriedApp, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const typed = (ty, value) => new Typed(ty, value);
const local = level => new Local(new Just(`x${level}`), level);
const int = value => typed(Int.value, new Lit(new LitInt(value)));
const plus = (a, b) => typed(Int.value, new PrimOp(new Op2(new OpIntNum(OpAdd.value), a, b)));
const fnType = arity => new ADT(`Fn${arity}`, ['Data', 'Function', 'Uncurried', `Fn${arity}`],
  Array(arity + 1).fill(Int.value));
function closure(arity, firstLevel = 0, seed) {
  const args = Array.from({ length: arity }, (_, i) => firstLevel + i);
  const values = args.map(local);
  return typed(fnType(arity), new UncurriedAbs(args.map(level => new Tuple(new Just(`x${level}`), level)),
    seed === undefined ? values.reduce(plus) : values.reduce(plus, seed)));
}

// FnN is an opaque TAST type: these top-level bindings have no Rust parameters
// and return Value, while their optimized bodies are native FuncN closures.
const bindings = [2, 10].map(arity => new Tuple(`sum${arity}`, typed(fnType(arity), closure(arity))));
bindings.push(new Tuple('captured', typed(fnType(2),
  new Let(new Just('offset'), 0, int(10), closure(2, 1, local(0))))));
const tick = value => new App(new Var(new Qualified(new Just('UncurriedValues'), 'tick')), [value]);
// PBO uses nullary uncurried functions for case/guard continuations. Creating
// one must defer its body; selecting another branch must never execute it.
bindings.push(new Tuple('zero', closure(0, 0, tick(int(42)))));
bindings.push(new Tuple('capturedZero', typed(new Func([Int.value], Any.value),
  new Abs([new Tuple(new Just('x0'), 0)], typed(new Func([], Int.value),
    new UncurriedAbs([], tick(local(0))))))));
bindings.push(new Tuple('choose', typed(new Func([BooleanType.value], Int.value),
  new Abs([new Tuple(new Just('x0'), 0)],
    new Let(new Just('x1'), 1, new UncurriedAbs([], tick(int(42))),
      new Branch([new Pair(local(0), int(7))], typed(Int.value, new UncurriedApp(local(1), []))))))));
bindings.push(new Tuple('invokeZero', typed(new Func([Any.value], Int.value),
  new Abs([new Tuple(new Just('x0'), 0)],
    typed(Int.value, new UncurriedApp(local(0), []))))));
const declarations = bindings.reduce((types, binding) =>
  insert(ordString)(`UncurriedValues_${binding.value0}`)(binding.value1.value0)(types),
  insert(ordString)('UncurriedValues_tick')(new Func([Int.value], Int.value))(emptyMap));
const generated = codegenModule(declarations)(emptyMap)(
  { name: 'UncurriedValues', dataDecls: [], classDecls: [] },
)({ name: 'UncurriedValues', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const prelude = codegenPrelude(emptySet);
const body = `
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
static CALLS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
fn UncurriedValues_tick(value: i64) -> i64 {
    CALLS.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    value
}
fn main() {
    let _: fn() -> Value = UncurriedValues_sum2;
    let _: fn() -> Value = UncurriedValues_sum10;
    let pair = UncurriedValues_sum2();
    let ten = UncurriedValues_sum10();
    assert_eq!(pair.clone().unwrap_func2()(mk_int(19), mk_int(23)).unwrap_int(), 42);
    assert_eq!(ten.unwrap_func10()(mk_int(1), mk_int(2), mk_int(3), mk_int(4), mk_int(5),
        mk_int(6), mk_int(7), mk_int(8), mk_int(9), mk_int(10)).unwrap_int(), 55);
    let captured = UncurriedValues_captured();
    assert_eq!(captured.clone().unwrap_func2()(mk_int(20), mk_int(12)).unwrap_int(), 42);
    assert_eq!(captured.unwrap_func2()(mk_int(1), mk_int(2)).unwrap_int(), 13);
    let first_class = Func1::Shared(std::rc::Rc::new(move |x: i64| {
        pair.clone().unwrap_func2()(mk_int(x), mk_int(2)).unwrap_int()
    }));
    assert_eq!(first_class(40), 42);
    assert_eq!(first_class(5), 7);
    let zero = UncurriedValues_zero();
    let captured = UncurriedValues_capturedZero(23);
    assert_eq!(UncurriedValues_choose(true), 7);
    assert_eq!(CALLS.load(std::sync::atomic::Ordering::SeqCst), 0, "nullary bodies ran before invocation");
    assert_eq!(UncurriedValues_choose(false), 42);
    assert_eq!(UncurriedValues_invokeZero(zero.clone()), 42);
    assert_eq!(zero.unwrap_func1()(Value::Unit).unwrap_int(), 42);
    assert_eq!(UncurriedValues_invokeZero(captured.clone()), 23);
    assert_eq!(UncurriedValues_invokeZero(captured), 23);
    assert_eq!(CALLS.load(std::sync::atomic::Ordering::SeqCst), 5, "each nullary invocation must run once");
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-uncurried-values-'));
try {
  const path = join(directory, 'uncurried-values.rs');
  const binary = join(directory, 'uncurried-values');
  for (const threaded of [false, true]) {
    writeFileSync(path, threaded ? threadedPrelude(prelude) + threadedRust(body) : prelude + body);
    for (const [command, args] of [['rustc', ['--edition=2021', path, '-o', binary, ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]], [binary, []]]) {
      const result = spawnSync(command, args, { encoding: 'utf8' });
      assert.equal(result.status, 0, `${command} (${threaded ? 'threaded' : 'local'}): ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    }
  }
  console.log('Fn0/Fn2/Fn10 values defer their bodies and retain captures across repeated calls in both ownership modes.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
