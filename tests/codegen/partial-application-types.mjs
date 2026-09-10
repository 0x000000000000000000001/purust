// Optimized expressions can retain the original function's annotation after
// partial application. Its remaining arguments determine the generated ABI.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Boolean as Bool, ForAll, Func, Int, LitInt, Qualified, TypeVar } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, GetIndex, Let, Lit, Local, Op2, OpIntNum, OpIntOrd, OpAdd, OpSubtract, OpLte, OpIntBitAnd, OpIntBitOr, OpIntBitXor, OpIntBitShiftLeft, OpIntBitShiftRight, OpIntBitZeroFillShiftRight, Pair, PrimOp, TypeApp, Typed, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const local = (n, i) => new Local(new Just(n), i);
const param = (n, i) => new Tuple(new Just(n), i);
const int = n => new Lit(new LitInt(n));
const ternary = new Func([Int.value, Int.value, Int.value], Int.value);
const partial = new App(local('f', 0), [int(10)]);
const bindings = [new Tuple('partial', new Typed(new Func([ternary], Int.value),
  new Abs([param('f', 0)], new Let(new Just('first'), 1, new Typed(Bool.value, partial),
    new Let(new Just('second'), 2, new Typed(ternary, local('first', 1)),
      new App(local('second', 2), [int(20), int(12)]))))))];
// The identifier "not" carries no built-in result type. Use a non-Boolean
// signature so both a partial application and a saturated call prove this.
const globalNot = new Var(new Qualified(new Just('Remaining'), 'not'));
bindings.push(new Tuple('not', new Typed(new Func([Int.value, Int.value], Int.value),
  new Abs([param('x', 0), param('y', 1)], new PrimOp(new Op2(new OpIntNum(OpAdd.value),
    local('x', 0), local('y', 1)))))));
bindings.push(new Tuple('partialNot', new Typed(new Func([Int.value], Int.value),
  new Abs([param('x', 0)], new Let(new Just('pending'), 1,
    new App(globalNot, [local('x', 0)]), new App(local('pending', 1), [int(2)]))))));
bindings.push(new Tuple('completeNot', new Typed(new Func([Int.value], Int.value),
  new Abs([param('x', 0)], new App(globalNot, [local('x', 0), int(2)])))));
bindings.push(new Tuple('pairSum', new Typed(new Func([Any.value], Int.value),
  new Abs([param('array', 0)], new PrimOp(new Op2(new OpIntNum(OpAdd.value),
    new Accessor(local('array', 0), new GetIndex(0)),
    new Accessor(local('array', 0), new GetIndex(1))))))));
for (const [name, op] of Object.entries({ and: OpIntBitAnd, or: OpIntBitOr, xor: OpIntBitXor,
  shl: OpIntBitShiftLeft, shr: OpIntBitShiftRight, zshr: OpIntBitZeroFillShiftRight })) {
  bindings.push(new Tuple(name, new Typed(new Func([Int.value, Int.value], Any.value),
    new Abs([param('x', 0), param('y', 1)],
      new PrimOp(new Op2(op.value, local('x', 0), local('y', 1)))))));
}
const variable = new TypeVar('a');
const recursive = new Tuple('repeat', new Typed(
  new ForAll(['a'], new Func([Int.value, new Func([variable], variable), variable], variable)),
  new Abs([param('n', 0), param('next', 1), param('value', 2)],
    new Branch([new Pair(new PrimOp(new Op2(new OpIntOrd(OpLte.value), local('n', 0), int(0))), local('value', 2))],
      new App(new TypeApp(new Var(new Qualified(new Just('Remaining'), 'repeat')), variable), [
        new PrimOp(new Op2(new OpIntNum(OpSubtract.value), local('n', 0), int(1))),
        local('next', 1), new App(local('next', 1), [local('value', 2)]),
      ])))));
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'Remaining', dataDecls: [], classDecls: [] },
)({ name: 'Remaining', bindings: [{ recursive: false, bindings }, { recursive: true, bindings: [recursive] }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const source = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
fn main() {
  assert_eq!(Remaining_partial(Func3::Static(|a,b,c| a+b+c)), 42);
  assert_eq!(Remaining_partialNot(40), 42);
  assert_eq!(Remaining_completeNot(40), 42);
  assert_eq!(Remaining_pairSum(mk_array(vec![mk_int(19), mk_int(23)])), 42);
  assert_eq!(Remaining_repeat(100000, Func1::Static(|n| mk_int(n.unwrap_int()+1)), mk_int(42)).unwrap_int(), 100042);
  for (operation, expected) in [(Remaining_and as fn(i64,i64)->Value, 2),
      (Remaining_or, 6), (Remaining_xor, 4), (Remaining_shl, 24),
      (Remaining_shr, 1), (Remaining_zshr, 1)] {
    assert_eq!(operation(6, 2).unwrap_int(), expected);
  }
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-remaining-'));
try {
  const path = join(directory, 'remaining.rs');
  const binary = join(directory, 'remaining');
  writeFileSync(path, source);
  for (const [command, args] of [['rustc', ['--edition=2021', path, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Partial applications, global not signatures, array-pattern fields and boxed bit operations passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
