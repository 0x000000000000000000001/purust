// Run after npm run build. A scoped expression's result annotation applies to
// its returned expression, while each local binding keeps its own type.
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
import { ADT, Any, Func, Int } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Let, LetRec, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const value = Any.value;
const effect = new ADT('Effect', ['Effect', 'Effect'], [Int.value]);
const makerType = new Func([value, value], value);
const unaryType = new Func([Int.value], Int.value);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const params = [param('make', 0), param('operation', 1), param('input', 2)];
const saved = local('saved', 3);
const nativeResult = new Typed(Int.value, new App(local('operation', 1), [local('input', 2)]));
const stale = expression => new Typed(makerType, expression);
const result = stale(new App(local('make', 0), [saved, saved]));
const scope = body => new Let(new Just('saved'), 3, nativeResult, body);
const binding = (name, body) => new Tuple(name,
  new Typed(new Func([makerType, unaryType, Int.value], effect), new Abs(params, body)));
const copiedResult = stale(new App(local('make', 0), [local('copy', 4), saved]));
const nestedScope = scope(stale(new Let(new Just('copy'), 4, saved, copiedResult)));
const identity = new Typed(unaryType, new Abs([param('x', 4)], local('x', 4)));
const recursiveValue = new Typed(Int.value, new App(local('identity', 3), [nativeResult]));
const recursiveResult = stale(new App(local('make', 0), [local('saved', 5), local('saved', 5)]));
const recursiveScope = new LetRec(3, [new Tuple('identity', identity)],
  new Let(new Just('saved'), 5, recursiveValue, recursiveResult));
const retained = (resultType, index) => {
  const body = new Typed(resultType, new Let(new Just('saved'), 1,
    local('operation', 0), new Typed(unaryType, local('saved', 1))));
  return new Tuple(`retain${index}`, new Typed(new Func([unaryType], resultType),
    new Abs([param('operation', 0)], body)));
};
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'TypedLet', dataDecls: [], classDecls: [] },
)({ name: 'TypedLet', bindings: [{ recursive: false, bindings: [
  binding('single', new Typed(effect, scope(result))),
  binding('nested', new Typed(effect, nestedScope)),
  binding('recursive', new Typed(effect, recursiveScope)),
  ...[value, unaryType].map(retained),
] }] });

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    use std::cell::Cell;
    use std::rc::Rc;
    for build in [TypedLet_single, TypedLet_nested, TypedLet_recursive] {
        let executions = Rc::new(Cell::new(0));
        let counter = executions.clone();
        let make = Func2::Shared(Rc::new(move |x: Value, y: Value| {
            let result = x.unwrap_int() + y.unwrap_int();
            let counter = counter.clone();
            Value::Func1(Func1::Shared(Rc::new(move |_| {
                counter.set(counter.get() + 1);
                mk_int(result)
            })))
        }));
        let action = build(make, Func1::Static(|n| n + 1), 20);
        assert!(matches!(action, Value::Func1(_)), "the scoped result must remain an Effect");
        assert_eq!(executions.get(), 0, "constructing the scope must not execute the effect");
        assert_eq!(action.unwrap_func1()(Value::Unit).unwrap_int(), 42);
        assert_eq!(action.unwrap_func1()(Value::Unit).unwrap_int(), 42);
        assert_eq!(executions.get(), 2);
    }
    let retained = TypedLet_retain0(Func1::Static(|n| n + 1));
    assert_eq!(retained.unwrap_func1()(mk_int(41)).unwrap_int(), 42);
    assert_eq!(TypedLet_retain1(Func1::Static(|n| n + 1))(41), 42);
}
`;

const dir = mkdtempSync(join(tmpdir(), 'purust-typed-let-'));
try {
  const source = join(dir, 'typed-let.rs');
  const binary = join(dir, 'typed-let');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Typed Let results: deferred effects, nested scopes, recursive bindings and retained functions passed.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
