import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenExprType, codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { superclassFields } from '../../output/Purust.ClassFields/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { empty, insert } from '../../output/Data.Map/index.js';
import { empty as noShapes } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, LitRecord, Prop } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, GetProp, Lit, Local, PrimUndefined, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const name = 'Effect.Aff.Class';
const any = Any.value;
const adt = (module, type) => new ADT(type, [...module.split('.'), type], []);
const monadAff = adt(name, 'MonadAff');
const monadEffect = adt('Effect.Class', 'MonadEffect');
const aff = adt('Effect.Aff', 'Aff');
assert.equal(codegenExprType('Effect_Aff_Class')(false)(monadAff), 'std::rc::Rc<crate::MonadAff>');
assert.equal(codegenExprType('Consumer')(false)(monadAff), 'std::rc::Rc<Purs_Effect_Aff_Class::MonadAff>');
// Preserve the opaque ABI of Aff and its existing runtime wrappers.
for (const [module, types] of [
  ['Effect.Aff', ['Aff', 'ParAff', 'Supervisor', 'Fiber', 'Canceler', 'FFIUtil']],
  ['Effect.Aff.Compat', ['EffectFnAff', 'EffectFnCanceler']],
]) for (const type of types) assert.equal(codegenExprType('Consumer')(false)(adt(module, type)), 'crate::UnknownType');
assert.equal(codegenExprType('Consumer')(false)(adt('Effect.AVar', 'AVar')), 'std::rc::Rc<Purs_Effect_AVar::AVar>');

const decl = { name: 'MonadAff', vars: ['m'], methods: [new Tuple('liftAff', new Func([aff], aff))],
  superclasses: [new Tuple(['Effect', 'Class', 'MonadEffect'], [])] };
const fields = insert(ordString)('Effect_Aff_Class_MonadAff')([...superclassFields(decl), ...decl.methods])(empty);
const local = (label, level) => new Local(new Just(label), level);
const param = (label, level) => new Tuple(new Just(label), level);
const typed = (type, expr) => new Typed(type, expr);
const property = (expr, field) => new Accessor(expr, new GetProp(field));
const bindings = [
  new Tuple('make', typed(new Func([monadEffect], monadAff), new Abs([param('parent', 0)],
    typed(monadAff, new Lit(new LitRecord([
      new Prop('MonadEffect0', typed(new Func([any], monadEffect),
        new Abs([param('ignored', 1)], local('parent', 0)))),
      new Prop('liftAff', typed(new Func([aff], aff), new Abs([param('action', 1)], local('action', 1)))),
    ])))))),
  new Tuple('lift', typed(new Func([monadAff, aff], aff),
    new Abs([param('dictionary', 0), param('action', 1)],
      new App(property(local('dictionary', 0), 'liftAff'), [local('action', 1)])))),
  new Tuple('parent', typed(new Func([monadAff], monadEffect), new Abs([param('dictionary', 0)],
    new App(property(local('dictionary', 0), 'MonadEffect0'), [PrimUndefined.value])))),
];
const generated = codegenModule(empty)(fields)({ name, classDecls: [decl], dataDecls: [] })
  ({ name, bindings: [{ recursive: false, bindings }] });
const checks = `
mod Purs_Effect_Class { #[derive(Clone)] pub struct MonadEffect { pub sentinel: i64 } }
fn main() {
    use std::rc::Rc;
    let parent = Rc::new(Purs_Effect_Class::MonadEffect { sentinel: 42 });
    let dictionary = Effect_Aff_Class_make(parent.clone());
    let returned = Effect_Aff_Class_parent(dictionary.clone());
    assert!(Rc::ptr_eq(&parent, &returned));
    assert_eq!(returned.sentinel, 42);
    let payload = Rc::new(123_i64);
    let opaque = Value::Class(payload.clone());
    match Effect_Aff_Class_lift(dictionary.clone(), opaque) {
        Value::Class(retained) => {
            let expected: Rc<dyn std::any::Any> = payload;
            assert!(Rc::ptr_eq(&retained, &expected));
        }
        _ => panic!("lifting replaced the opaque payload"),
    }
    let calls = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let seen = calls.clone();
    let action = Value::Func1(Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        mk_int(42)
    })));
    let lifted = Effect_Aff_Class_lift(dictionary, action);
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 0);
    assert_eq!(lifted.unwrap_func1()(Value::Unit).unwrap_int(), 42);
    assert_eq!(lifted.unwrap_func1()(Value::Unit).unwrap_int(), 42);
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 2);
}
`;
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-aff-class-'));
try {
  for (const threaded of [false, true]) {
    const prelude = codegenPrelude(noShapes);
    // The threaded Value::Class also requires Send + Sync on its Any payload.
    const main = threaded ? checks.replace('dyn std::any::Any>', 'dyn std::any::Any + Send + Sync>') : checks;
    const source = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${threaded ? threadedRust(generated + main) : generated + main}`;
    const file = join(directory, 'checks.rs');
    const binary = join(directory, 'checks');
    writeFileSync(file, source);
    for (const [command, args] of [
      ['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary, ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]],
      [binary, []],
    ]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30_000 });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
    }
  }
  console.log('MonadAff: native dictionary construction, superclass identity, deferred methods and opaque ABI passed in Rc/Arc.');
} finally { rmSync(directory, { recursive: true, force: true }); }
