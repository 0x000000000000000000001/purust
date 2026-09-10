// A callback parameter discarded by the body must not acquire a representation
// check from an obsolete optimizer annotation when crossing a generic boundary.
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
import { Any, Boolean as BooleanType, Func, Int, String as StringType, Unit } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Local, PrimUndefined, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const value = Any.value;
const callbackType = new Func([value], value);
const callerType = new Func([callbackType, value], value);
const pairCallbackType = new Func([value, value], value);
const pairCallerType = new Func([pairCallbackType, value, value], value);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const callback = (type, body) => new Typed(type, new Abs([param('input', 2)], body));
const constant = callback(new Func([BooleanType.value], Unit.value), new Typed(Unit.value, PrimUndefined.value));
const identity = callback(new Func([BooleanType.value], BooleanType.value), local('input', 2));
const capture = callback(new Func([BooleanType.value], new Func([Unit.value], BooleanType.value)),
  new Typed(new Func([Unit.value], BooleanType.value), new Abs([param('ignored', 3)], local('input', 2))));
const binding = (name, cb) => new Tuple(name,
  new Typed(new Func([callerType, value], value), new Abs([param('call', 0), param('payload', 1)],
    new App(local('call', 0), [cb, local('payload', 1)]))));
const pair = new Typed(new Func([Int.value, StringType.value], Int.value),
  new Abs([param('number', 3), param('unused', 4)], local('number', 3)));
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'Discarded', dataDecls: [], classDecls: [] },
)({ name: 'Discarded', bindings: [{ recursive: false, bindings: [
  binding('constant', constant),
  binding('identity', identity),
  binding('capture', capture),
  new Tuple('pair', new Typed(new Func([pairCallerType, value, value], value),
    new Abs([param('call', 0), param('first', 1), param('second', 2)],
      new App(local('call', 0), [pair, local('first', 1), local('second', 2)])))),
] }] });

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    let call = Func2::Static(|f: Func1<Value, Value>, payload| f(payload));
    let payload = Value::Class(std::rc::Rc::new("fiber payload"));
    for value in [payload.clone(), mk_int(42), mk_array(vec![])] {
        assert!(matches!(Discarded_constant(call.clone(), value), Value::Unit));
    }
    assert!(Discarded_identity(call.clone(), mk_bool(true)).unwrap_bool());
    let retained = Discarded_capture(call.clone(), mk_bool(true));
    assert!(retained.unwrap_func1()(Value::Unit).unwrap_bool());
    let call_pair = Func3::Static(|f: Func2<Value, Value, Value>, x, y| f(x, y));
    assert_eq!(Discarded_pair(call_pair, mk_int(42), payload.clone()).unwrap_int(), 42);

    // Used parameters still require the representation declared by their body.
    let old_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    for invoke in [Discarded_identity, Discarded_capture] {
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| invoke(call.clone(), payload.clone()))).is_err());
    }
    std::panic::set_hook(old_hook);
}
`;

const directory = mkdtempSync(join(tmpdir(), 'purust-discarded-callbacks-'));
try {
  const source = join(directory, 'checks.rs');
  const binary = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Discarded callback parameters skip unused conversions; used and captured parameters retain their checks.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
