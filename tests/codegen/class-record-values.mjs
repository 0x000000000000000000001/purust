// A synthesized dictionary can be stored as an ordinary Value record before
// its later use supplies the native class type. Do not downcast that record.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { superclassFields } from '../../output/Purust.ClassFields/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { singleton, insert as insertSet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, Int, LitInt, LitRecord, LitString, Prop, Qualified, String as StringType }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, GetProp, Lit, Local, Op2, OpAdd, OpIntNum, PrimOp, Typed, Var }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const name = 'ClassRecordValues';
const any = Any.value;
const int = Int.value;
const reflect = new ADT('Reflect', [name, 'Reflect'], []);
const top = new ADT('Top', [name, 'Top'], []);
const payload = new ADT('Payload', [name, 'Payload'], []);
const effect = new ADT('Effect', ['Effect', 'Effect'], [int]);
const declarations = [
  { name: 'Reflect', vars: [], methods: [new Tuple('reflectSymbol', new Func([any], StringType.value))], superclasses: [] },
  { name: 'Top', vars: [], methods: [new Tuple('calculate', new Func([int], int)), new Tuple('tick', effect)],
    superclasses: [new Tuple([name, 'Reflect'], [])] },
];
const fields = declarations.reduce((table, decl) => insert(ordString)(`${name}_${decl.name}`)
  ([...superclassFields(decl), ...decl.methods])(table), emptyMap);
const param = (label, level) => new Tuple(new Just(label), level);
const local = (label, level) => new Local(new Just(label), level);
const global = label => new Var(new Qualified(new Just(name), label));
const typed = (type, value) => new Typed(type, value);
const record = properties => new Lit(new LitRecord(properties.map(([key, value]) => new Prop(key, value))));
const method = typed(new Func([any], StringType.value),
  new Abs([param('ignored', 0)], new Lit(new LitString('bound symbol'))));
const calculate = typed(new Func([int], int), new Abs([param('n', 1)],
  new PrimOp(new Op2(new OpIntNum(OpAdd.value), local('n', 1), new Lit(new LitInt(2))))));
const bindings = [
  // The declaration itself deliberately has no class annotation.
  new Tuple('rawReflect', record([['reflectSymbol', method]])),
  new Tuple('lifted', typed(reflect, global('rawReflect'))),
  new Tuple('dictionary', typed(top, record([
    ['Reflect0', typed(new Func([any], reflect), new Abs([param('ignored', 0)], typed(reflect, record([['reflectSymbol', method]]))))],
    ['calculate', calculate],
    ['tick', typed(new Func([any], int), new Abs([param('ignored', 0)], new Lit(new LitInt(7))))],
  ]))),
  // This zero-argument binding must see dictionary's native type from the same
  // binding group, even though the projection has no explicit annotation.
  new Tuple('sameGroupTick', new Accessor(global('dictionary'), new GetProp('tick'))),
  new Tuple('rawTop', typed(new Func([effect], any), new Abs([param('action', 0)], record([
    ['Reflect0', typed(new Func([any], any), new Abs([param('ignored', 1)], global('rawReflect')))],
    ['calculate', calculate], ['tick', local('action', 0)],
  ])))),
  new Tuple('convert', typed(new Func([any], top), new Abs([param('dictionary', 0)], typed(top, local('dictionary', 0))))),
  new Tuple('convertReflect', typed(new Func([any], reflect), new Abs([param('dictionary', 0)], typed(reflect, local('dictionary', 0))))),
  new Tuple('retainPayload', typed(new Func([any], payload), new Abs([param('input', 0)], typed(payload, local('input', 0))))),
  new Tuple('retainEffect', typed(new Func([any], effect), new Abs([param('input', 0)], typed(effect, local('input', 0))))),
];
const generated = codegenModule(emptyMap)(fields)({ name, classDecls: declarations, dataDecls: [] })
  ({ name, bindings: [{ recursive: false, bindings }] });
const shapes = insertSet(ordString)('Reflect0,calculate,tick')(singleton('reflectSymbol'));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const main = `
#[derive(Clone)] pub struct Payload(i64);
fn main() {
    let lifted = ClassRecordValues_lifted();
    assert_eq!((lifted.reflectSymbol)(Value::Unit), "bound symbol");
    assert_eq!(ClassRecordValues_sameGroupTick().unwrap_func1()(Value::Unit).unwrap_int(), 7);
    let runs = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let counter = runs.clone();
    let action = Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        Value::Int(counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst) as i64 + 1)
    })));
    let native = ClassRecordValues_convert(ClassRecordValues_rawTop(action.clone()));
    assert_eq!(runs.load(std::sync::atomic::Ordering::SeqCst), 0, "converting a dictionary must not run methods or effects");
    assert_eq!((native.calculate)(40), 42);
    assert_eq!(((native.Reflect0)(Value::Unit).reflectSymbol)(Value::Unit), "bound symbol");
    assert_eq!(native.tick.unwrap_func1()(Value::Unit).unwrap_int(), 1);
    assert_eq!(native.tick.unwrap_func1()(Value::Unit).unwrap_int(), 2);
    let boxed = Value::Class(std::rc::Rc::new(native.clone()));
    assert!(std::rc::Rc::ptr_eq(&native, &ClassRecordValues_convert(boxed.clone())), "native class conversion must preserve identity");
    let cell = perceus_ptr::PerceusPtr::new(Thunk::default());
    assert!(cell.value.set(boxed).is_ok());
    assert!(std::rc::Rc::ptr_eq(&native, &ClassRecordValues_convert(Value::Thunk(cell))));
    let opaque = std::rc::Rc::new(Payload(42));
    let retained = ClassRecordValues_retainPayload(Value::Class(std::rc::Rc::new(opaque.clone())));
    assert!(std::rc::Rc::ptr_eq(&opaque, &retained));
    assert_eq!(retained.0, 42);
    let retained_action = ClassRecordValues_retainEffect(action);
    assert_eq!(runs.load(std::sync::atomic::Ordering::SeqCst), 2);
    assert_eq!(retained_action.unwrap_func1()(Value::Unit).unwrap_int(), 3);
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    // TAST supplies Prim.undefined for dictionaries that a callee never uses.
    // Such a method must remain dormant, but still reject an actual invocation.
    let omitted = ClassRecordValues_convertReflect(Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a::default())));
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        (omitted.reflectSymbol)(Value::Unit)
    })).is_err(), "an omitted dictionary method must fail when invoked");
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        ClassRecordValues_retainPayload(ClassRecordValues_rawReflect())
    })).is_err(), "unknown ADTs must retain their checked downcast");
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        ClassRecordValues_convert(ClassRecordValues_rawReflect())
    })).is_err(), "missing class fields must fail instead of constructing a partial dictionary");
    std::panic::set_hook(previous_hook);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-class-record-values-'));
try {
  for (const threaded of [false, true]) {
    const prelude = codegenPrelude(shapes);
    const source = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${threaded ? threadedRust(generated + main) : generated + main}`;
    const path = join(directory, 'main.rs');
    const binary = join(directory, threaded ? 'threaded' : 'local');
    writeFileSync(path, source);
    const flags = threaded ? ['--cfg', 'feature="threaded"'] : [];
    const build = spawnSync('rustc', ['--edition=2021', '-Awarnings', ...flags, path, '-o', binary], { encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stderr}`);
  }
  console.log('Class record values: top-level bindings, superclass callbacks, native identity, deferred effects and non-class downcasts passed in Rc and Arc.');
} finally { rmSync(directory, { recursive: true, force: true }); }
