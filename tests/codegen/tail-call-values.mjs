// Run after npm run build. Tail calls must perform the same representation
// conversions as ordinary calls, with all arguments evaluated before rebinding.
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
import { Just } from '../../output/Data.Maybe/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, Int, LitArray, LitInt, LitString, Qualified, String as StringType, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, CtorSaturated, Fail, GetCtorField, Let, LetRec, Lit, Local, Op2, OpAdd, OpArrayIndex, OpEq, OpIntNum, OpIntOrd, OpSubtract, Pair, PrimOp, Typed, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const param = (name, level) => new Tuple(new Just(name), level);
const local = (name, level) => new Local(new Just(name), level);
const literal = n => new Lit(new LitInt(n));
const numeric = (operator, left, right) => new PrimOp(new Op2(new OpIntNum(operator), left, right));
const isZero = n => new PrimOp(new Op2(new OpIntOrd(OpEq.value), n, literal(0)));
const n = local('n', 0);
const left = local('left', 1);
const right = local('right', 2);
const swap = new Tuple('swap', new Typed(new Func([Int.value, Int.value, Any.value], Any.value),
  new Abs([param('n', 0), param('left', 1), param('right', 2)],
    new Branch([new Pair(isZero(n), right)],
      new App(new Var(new Qualified(new Just('TailCalls'), 'swap')), [
        numeric(OpSubtract.value, n, literal(1)), right, left,
      ])))));

const count = local('count', 2);
const total = local('total', 3);
const loop = new Typed(new Func([Int.value, Any.value], Any.value),
  new Abs([param('count', 2), param('total', 3)],
    new Branch([new Pair(isZero(count), total)],
      new App(local('loop', 1), [
        numeric(OpSubtract.value, count, literal(1)),
        numeric(OpAdd.value, new Typed(Int.value, total), literal(1)),
      ]))));
const increment = new Tuple('increment', new Typed(new Func([Int.value], Any.value),
  new Abs([param('n', 0)], new LetRec(1, [new Tuple('loop', loop)],
    new App(local('loop', 1), [n, literal(0)])))));

// A typed tail call can move an owned constructor before continuing. Its
// result never exists, even though the local recursive binding is stored as Value.
const holderType = new ADT('Holder', ['TailCalls', 'Holder'], []);
const holder = value => new CtorSaturated(new Qualified(new Just('TailCalls'), 'Holder'),
  SumType.value, 'Holder', 'Holder', [new Tuple('value0', value)]);
const owned = local('owned', 4);
const ownedField = new Accessor(owned, new GetCtorField(
  new Qualified(new Just('TailCalls'), 'Holder'), SumType.value, 'Holder', 'Holder', 'value0', 0));
function ownedTail(name, resultType, finish) {
  const body = new Branch([new Pair(isZero(count), finish(total))],
    new Let(new Just('owned'), 4, holder(total),
      new Typed(resultType, new App(local('loop', 1), [
        numeric(OpSubtract.value, count, literal(1)), ownedField,
      ]))));
  const loop = new Typed(new Func([Int.value, Any.value], resultType),
    new Abs([param('count', 2), param('total', 3)], body));
  return new Tuple(name, new Typed(new Func([Int.value], resultType),
    new Abs([param('n', 0)], new LetRec(1, [new Tuple('loop', loop)],
      new Typed(resultType, new App(local('loop', 1), [n, literal(42)]))))));
}
const ownedInt = ownedTail('ownedInt', Int.value, value => new Typed(Int.value, value));
const ownedClass = ownedTail('ownedClass', holderType, holder);
// A non-tail direct worker call returns its declared native representation,
// even when the recursive thunk is erased in a branch beside a boxed value.
function nonTailCase(name, resultType, finish, annotated = false) {
  const fallback = local('fallback', 1), depth = local('depth', 3);
  const decrement = numeric(OpSubtract.value, depth, literal(1));
  const callee = annotated ? new Typed(new Func([Int.value], resultType), local('worker', 2)) : local('worker', 2);
  const call = new App(callee, [decrement]);
  const result = annotated
    ? new Branch([new Pair(isZero(decrement), fallback), new Pair(isZero(literal(0)), new Typed(resultType, call))], new Fail('unreachable'))
    : new Branch([new Pair(isZero(decrement), fallback)], call);
  const worker = new Typed(new Func([Int.value], resultType), new Abs([param('depth', 3)],
    new Branch([new Pair(isZero(depth), finish(literal(42)))],
      new Let(new Just('result'), 4, result, new Typed(resultType, local('result', 4))))));
  return new Tuple(name, new Typed(new Func([Int.value, Any.value], resultType),
    new Abs([param('n', 0), param('fallback', 1)], new LetRec(2, [new Tuple('worker', worker)],
      new Typed(resultType, new App(local('worker', 2), [n]))))));
}
const directInt = nonTailCase('directInt', Int.value, value => value);
const directClass = nonTailCase('directClass', holderType, holder);
const annotatedInt = nonTailCase('annotatedInt', Int.value, value => value, true);
const annotatedClass = nonTailCase('annotatedClass', holderType, holder, true);
// These recursive references still need their Value binding: aliases, partial
// application and recursion under a new function/LetRec worker context.
const escaped = ['alias', 'partial', 'closure', 'nestedRec', 'array'].map(name => {
  const type = new Func([Int.value, Int.value], Int.value);
  const worker = new Typed(type, local('worker', 1));
  const depth = local('depth', 2), total = local('total', 3);
  const args = [numeric(OpSubtract.value, depth, literal(1)), numeric(OpAdd.value, total, literal(1))];
  const call = new App(worker, args);
  const closure = new Typed(new Func([Int.value], Int.value), new Abs([param('ignored', 5)], call));
  const recur = name === 'alias'
    ? new Let(new Just('alias'), 4, worker, new App(local('alias', 4), args))
    : name === 'partial'
      ? new Let(new Just('partial'), 4, new App(worker, [args[0]]), new App(local('partial', 4), [args[1]]))
      : name === 'closure'
        ? new Let(new Just('closure'), 4, closure, new App(local('closure', 4), [literal(0)]))
        : name === 'nestedRec'
          ? new LetRec(4, [new Tuple('nested', closure)], new App(local('nested', 4), [literal(0)]))
          : new Let(new Just('array'), 4, new Lit(new LitArray([call])),
            new Typed(Int.value, new PrimOp(new Op2(OpArrayIndex.value, local('array', 4), literal(0)))));
  const rhs = new Typed(type, new Abs([param('depth', 2), param('total', 3)],
    new Branch([new Pair(isZero(depth), total)], recur)));
  return new Tuple(name, new Typed(new Func([Int.value], Int.value), new Abs([param('n', 0)],
    new LetRec(1, [new Tuple('worker', rhs)], new App(worker, [n, literal(42)])))));
});
const failedBranch = new Tuple('failedBranch', new Typed(new Func([Int.value], StringType.value),
  new Abs([param('n', 0)], new Branch([new Pair(isZero(n), new Lit(new LitString('ok')))], new Fail('unreachable')))));
const arities = insert(ordString)('TailCalls_Holder')(new Func([Any.value], holderType))(emptyMap);
const generated = codegenModule(arities)(emptyMap)(
  { name: 'TailCalls', dataDecls: [{ name: 'Holder', constructors: [
    { name: 'Holder', fields: [Any.value] },
  ] }], classDecls: [] },
)({ name: 'TailCalls', bindings: [
  { recursive: true, bindings: [swap] },
  { recursive: false, bindings: [increment, ownedInt, ownedClass, directInt, directClass, annotatedInt, annotatedClass, ...escaped, failedBranch] },
] });
assert.ok(generated.includes('unwrap_or_clone'), 'the regression must move constructor fields');
assert.ok(generated.includes('continue;'), 'the regression must exercise tail-call loops');

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    assert_eq!(TailCalls_failedBranch(0), "ok");
    assert_eq!(TailCalls_alias(3), 45);
    assert_eq!(TailCalls_partial(3), 45);
    assert_eq!(TailCalls_closure(3), 45);
    assert_eq!(TailCalls_nestedRec(3), 45);
    assert_eq!(TailCalls_array(3), 45);
    assert_eq!(TailCalls_swap(0, 17, mk_int(42)).unwrap_int(), 42);
    assert_eq!(TailCalls_swap(1, 17, mk_int(42)).unwrap_int(), 17);
    assert_eq!(TailCalls_swap(2, 17, mk_int(42)).unwrap_int(), 42);
    assert_eq!(TailCalls_swap(100001, 17, mk_int(42)).unwrap_int(), 17);
    assert_eq!(TailCalls_increment(0).unwrap_int(), 0);
    assert_eq!(TailCalls_increment(100000).unwrap_int(), 100000);
    assert_eq!(TailCalls_ownedInt(100000), 42);
    let result = TailCalls_ownedClass(100000);
    let Holder::Holder(value) = result.as_ref() else { unreachable!() };
    assert_eq!(value.unwrap_int(), 42);
    for depth in [0, 1, 3] {
        let expected = if depth == 0 { 42 } else { 7 };
        assert_eq!(TailCalls_directInt(depth, mk_int(7)), expected);
        assert_eq!(TailCalls_annotatedInt(depth, mk_int(7)), expected);
        let owner = std::rc::Rc::new(Holder::Holder(mk_int(7)));
        let fallback = Value::Class(std::rc::Rc::new(owner.clone()));
        let annotated = TailCalls_annotatedClass(depth, fallback.clone());
        let Holder::Holder(field) = annotated.as_ref() else { unreachable!() };
        assert_eq!(field.unwrap_int(), expected);
        let value = TailCalls_directClass(depth, fallback);
        let Holder::Holder(field) = value.as_ref() else { unreachable!() };
        assert_eq!(field.unwrap_int(), expected);
        drop(annotated);
        drop(value);
        assert_eq!(std::rc::Rc::strong_count(&owner), 1,
            "local recursive workers must release their captured environment");
    }
}
`;
const dir = mkdtempSync(join(tmpdir(), 'purust-tail-calls-'));
try {
  const source = join(dir, 'tail-calls.rs');
  const binary = join(dir, 'tail-calls');
  for (const threaded of [false, true]) {
    const prelude = codegenPrelude(emptySet);
    writeFileSync(source, (threaded ? threadedPrelude(prelude) : prelude) + '\n' + (threaded ? threadedRust(rust) : rust));
    const flags = threaded ? ['--cfg', 'feature="threaded"'] : [];
    for (const [command, args] of [['rustc', ['--edition=2021', ...flags, source, '-o', binary]], [binary, []]]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000 });
      assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    }
  }
  console.log('Tail calls: conversions, swaps, released worker captures and escaping recursive references pass in both ownership modes.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
