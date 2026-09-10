import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Int, LitInt } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Let, Lit, Local, Op2, OpAdd, OpIntNum, PrimOp, Typed, UncurriedAbs } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

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
const declarations = bindings.reduce((types, binding) =>
  insert(ordString)(`UncurriedValues_${binding.value0}`)(binding.value1.value0)(types), emptyMap);
const generated = codegenModule(declarations)(emptyMap)(
  { name: 'UncurriedValues', dataDecls: [], classDecls: [] },
)({ name: 'UncurriedValues', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const source = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
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
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-uncurried-values-'));
try {
  const path = join(directory, 'uncurried-values.rs');
  const binary = join(directory, 'uncurried-values');
  writeFileSync(path, source);
  for (const [command, args] of [['rustc', ['--edition=2021', path, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Opaque Fn2/Fn10 bindings return callable Values and retain captures across repeated calls.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
