// Run after npm run build. Branches must agree on a Rust representation even
// when some alternatives are already boxed and others have concrete types.
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
import { ADT, Any, Boolean as BooleanType, Func, Int, LitBoolean } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Branch, Fail, Lit, Local, Pair, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const fnType = new Func([Int.value], Int.value);
const adtType = new ADT('Boxed', ['Branches', 'Boxed'], []);
const bindings = [['integer', Int.value], ['function', fnType], ['adt', adtType]].map(([name, type]) =>
  new Tuple(name, new Typed(new Func([BooleanType.value, Any.value, type], Any.value),
    new Abs([param('condition', 0), param('boxed', 1), param('concrete', 2)],
      new Branch([
        new Pair(local('condition', 0), local('boxed', 1)),
        new Pair(new Lit(new LitBoolean(true)), local('concrete', 2)),
      ], new Fail('unreachable'))))));
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'Branches', dataDecls: [], classDecls: [] },
)({ name: 'Branches', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
#[derive(Clone)]
pub struct Boxed(i64);
${generated}
fn main() {
    assert_eq!(Branches_integer(true, mk_int(19), 23).unwrap_int(), 19);
    assert_eq!(Branches_integer(false, mk_int(19), 23).unwrap_int(), 23);
    let f = Func1::Static(|x: i64| x + 1);
    assert_eq!(Branches_function(false, mk_int(19), f.clone()).unwrap_func1()(mk_int(41)).unwrap_int(), 42);
    assert_eq!(Branches_function(true, mk_int(19), f).unwrap_int(), 19);
    let adt = std::rc::Rc::new(Boxed(42));
    assert_eq!(Branches_adt(false, mk_int(19), adt.clone()).unwrap_class::<std::rc::Rc<Boxed>>().0, 42);
    assert_eq!(Branches_adt(true, mk_int(19), adt).unwrap_int(), 19);
}
`;
const dir = mkdtempSync(join(tmpdir(), 'purust-branches-'));
try {
  const source = join(dir, 'branches.rs');
  const binary = join(dir, 'branches');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', [source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Branches reconcile boxed values, primitives, functions and ADTs.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
