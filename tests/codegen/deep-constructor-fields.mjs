// Deep constructor projections must compile in bounded time and preserve
// ownership, checked downcasts and single evaluation in both Rc and Arc modes.
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
import { ADT, Any, Func, Int, LitInt, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, GetCtorField, Lit, Local, Op1, OpIsTag, Pair, PrimOp, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const name = 'DeepFields';
const depth = 26;
const boxed = new ADT(`${name}.BoxChain`, [name, 'BoxChain'], []);
const native = new ADT(`${name}.NativeChain`, [name, 'NativeChain'], []);
const local = (label, level) => new Local(new Just(label), level);
const param = (label, level) => new Tuple(new Just(label), level);
const typed = (type, value) => new Typed(type, value);
const field = (type, ctor, base) => new Accessor(base, new GetCtorField(
  new Qualified(new Just(name), ctor), SumType.value, type === boxed ? 'BoxChain' : 'NativeChain', ctor, 'value0', 0));
const walk = (type, ctor, base) => {
  for (let index = 0; index < depth; index++) base = field(type, ctor, typed(type, new TypeApp(base, Int.value)));
  return base;
};
const guardedWalk = (base, remaining) => remaining === 0 ? base : new Branch([
  new Pair(new PrimOp(new Op1(new OpIsTag(new Qualified(new Just(name), 'BoxNext')), typed(boxed, base))),
    guardedWalk(field(boxed, 'BoxNext', typed(boxed, base)), remaining - 1)),
], new Lit(new LitInt(-1)));
const bindings = [
  new Tuple('boxed', typed(new Func([boxed], Any.value), new Abs([param('root', 0)], walk(boxed, 'BoxNext', local('root', 0))))),
  new Tuple('native', typed(new Func([native], native), new Abs([param('root', 0)], walk(native, 'NativeNext', local('root', 0))))),
  new Tuple('guarded', typed(new Func([boxed], Any.value), new Abs([param('root', 0)], guardedWalk(local('root', 0), depth)))),
  new Tuple('temporary', typed(new Func([new Func([Any.value], boxed), Any.value], Any.value),
    new Abs([param('factory', 0), param('argument', 1)],
      walk(boxed, 'BoxNext', new App(local('factory', 0), [local('argument', 1)]))))),
];
let arities = emptyMap;
for (const [ctor, input, result] of [['BoxNext', Any.value, boxed], ['BoxStop', Int.value, boxed],
  ['NativeNext', native, native], ['NativeStop', Int.value, native]]) {
  arities = insert(ordString)(`${name}_${ctor}`)(new Func([input], result))(arities);
}
const generated = codegenModule(arities)(emptyMap)({ name, classDecls: [], dataDecls: [
  { name: 'BoxChain', constructors: [{ name: 'BoxNext', fields: [Any.value] }, { name: 'BoxStop', fields: [Int.value] }] },
  { name: 'NativeChain', constructors: [{ name: 'NativeNext', fields: [native] }, { name: 'NativeStop', fields: [Int.value] }] },
] })({ name, bindings: [{ recursive: false, bindings }] });
const main = `
fn main() {
    use std::rc::Rc;
    let mut value = Value::Int(42);
    for _ in 0..${depth} { value = Value::Class(Rc::new(Rc::new(BoxChain::BoxNext(value)))); }
    let root = value.unwrap_class::<Rc<BoxChain>>().clone();
    assert_eq!(DeepFields_boxed(root.clone()).unwrap_int(), 42);
    assert_eq!(DeepFields_guarded(root.clone()).unwrap_int(), 42);
    assert_eq!(DeepFields_guarded(Rc::new(BoxChain::BoxStop(0))).unwrap_int(), -1);
    let calls = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let observed = calls.clone();
    let factory = Func1::Shared(Rc::new(move |value: Value| {
        observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        value.unwrap_class::<Rc<BoxChain>>().clone()
    }));
    assert_eq!(DeepFields_temporary(factory, value).unwrap_int(), 42);
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
    assert_eq!(Rc::strong_count(&root), 1, "temporary and intermediate owners must be released");
    let leaf = Rc::new(NativeChain::NativeStop(42));
    let mut native_root = leaf.clone();
    for _ in 0..${depth} { native_root = Rc::new(NativeChain::NativeNext(native_root)); }
    let retained = DeepFields_native(native_root.clone());
    assert!(Rc::ptr_eq(&leaf, &retained));
    drop(native_root);
    assert!(matches!(retained.as_ref(), NativeChain::NativeStop(42)));
    assert_eq!(Rc::strong_count(&leaf), 2);
    drop(retained);
    assert_eq!(Rc::strong_count(&leaf), 1);
    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    for invalid in [Rc::new(BoxChain::BoxStop(0)), Rc::new(BoxChain::BoxNext(Value::Int(0)))] {
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| DeepFields_boxed(invalid))).is_err());
    }
    std::panic::set_hook(hook);
}
`;
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-deep-fields-'));
try {
  for (const threaded of [false, true]) {
    const prelude = threaded ? threadedPrelude(codegenPrelude(emptySet)) : codegenPrelude(emptySet);
    const body = threaded ? threadedRust(generated + main) : generated + main;
    const source = join(directory, threaded ? 'arc.rs' : 'rc.rs');
    const binary = source + '.bin';
    writeFileSync(source, `${prelude}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}]\nmod perceus_ptr;\n${body}`);
    for (const [command, args] of [['rustc', ['--edition=2021', ...(threaded ? ['--cfg', 'feature="threaded"'] : []), source, '-o', binary]], [binary, []]]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    }
  }
  console.log('26-deep boxed/native constructor reads: bounded compilation, lifetime, identity, single evaluation and invalid paths passed in Rc/Arc.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
