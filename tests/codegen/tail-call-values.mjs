// Run after npm run build. Tail calls must perform the same representation
// conversions as ordinary calls, with all arguments evaluated before rebinding.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, Int, LitInt, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, CtorSaturated, GetCtorField, Let, LetRec, Lit, Local, Op2, OpAdd, OpEq, OpIntNum, OpIntOrd, OpSubtract, Pair, PrimOp, Typed, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

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
const arities = insert(ordString)('TailCalls_Holder')(new Func([Any.value], holderType))(emptyMap);
const generated = codegenModule(arities)(emptyMap)(
  { name: 'TailCalls', dataDecls: [{ name: 'Holder', constructors: [
    { name: 'Holder', fields: [Any.value] },
  ] }], classDecls: [] },
)({ name: 'TailCalls', bindings: [
  { recursive: true, bindings: [swap] },
  { recursive: false, bindings: [increment, ownedInt, ownedClass] },
] });
assert.ok(generated.includes('unwrap_or_clone'), 'the regression must move constructor fields');
assert.ok(generated.includes('continue;'), 'the regression must exercise tail-call loops');

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
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
}
`;
const dir = mkdtempSync(join(tmpdir(), 'purust-tail-calls-'));
try {
  const source = join(dir, 'tail-calls.rs');
  const binary = join(dir, 'tail-calls');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', [source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Tail calls: local and global loops preserve Value/int conversions and argument swaps.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
