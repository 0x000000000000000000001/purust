// Run after `npm run build` (the test imports the compiled generator).
// Shared ADTs are already owned Rc/Arc values: boxing them into `Value` must
// erase that owner unsized (ClassShared) instead of nesting a second Rc
// (Class(Rc::new(owner))). Unboxing hands the owner back with one refcount
// bump. Native FFI boxes written as `Class(Rc::new(owner))` or
// `Class(Rc::new(Rc::new(owner)))` must keep resolving.
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
import { Abs, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';

const name = 'ClassShared';
const boxType = new ADT(`${name}.Payload`, [name, 'Payload'], []);
const param = (label, level) => new Tuple(new Just(label), level);
const local = (label, level) => new Local(new Just(label), level);
const typed = (type, value) => new Typed(type, value);
const bindings = [
  // Any <- Box: the Rc owner is erased unsized, no second allocation.
  new Tuple('box', typed(new Func([boxType], Any.value),
    new Abs([param('value', 0)], typed(Any.value, local('value', 0))))),
  // Box <- Any: the shared owner is handed back by downcast.
  new Tuple('unbox', typed(new Func([Any.value], boxType),
    new Abs([param('value', 0)], typed(boxType, local('value', 0))))),
];
const generated = codegenModule(emptyMap)(emptyMap)({
  name,
  classDecls: [],
  dataDecls: [{ name: 'Payload', constructors: [{ name: 'Wrap', fields: [Int.value] }] }],
})({ name, bindings: [{ recursive: false, bindings }] });

assert.match(generated, /Value::ClassShared\(/, 'shared ADT boxing must reuse the owner');
assert.match(generated, /unwrap_class_shared::<crate::Payload>/, 'shared ADT unboxing must return the owner');
assert.ok(!generated.includes('Value::Class(std::rc::Rc::new('),
  'shared ADT boxing must not allocate a nested Rc');

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const main = `
fn number(payload: &Payload) -> i64 { match payload { Payload::Wrap(value) => *value } }
fn main() {
    use std::rc::Rc;
    // Round trip through the dynamic boundary.
    let value = Rc::new(Payload::Wrap(41));
    let unboxed = ClassShared_unbox(ClassShared_box(value.clone()));
    assert_eq!(number(&unboxed), 41, "boxing then unboxing preserves the value");

    // The owner is shared, not copied: extraction keeps the same allocation.
    let owner = Rc::new(Payload::Wrap(7));
    let shared = Value::ClassShared(owner.clone());
    let extracted = shared.unwrap_class_shared::<Payload>();
    assert!(Rc::ptr_eq(&owner, &extracted), "ClassShared returns the same owner");
    drop(shared);
    assert_eq!(number(&extracted), 7, "the extracted owner outlives the Value");

    // Native FFI compatibility: a nested Class box still resolves.
    let legacy = Value::Class(Rc::new(owner.clone()));
    assert!(Rc::ptr_eq(&owner, &legacy.unwrap_class_shared::<Payload>()));
    assert!(Rc::ptr_eq(&owner, &ClassShared_unbox(legacy)), "legacy Class stays readable");

    // A plain Class payload also returns its original owner, without cloning T.
    let plain_owner = Rc::new(Payload::Wrap(9));
    let plain = Value::Class(plain_owner.clone());
    assert!(Rc::ptr_eq(&plain_owner, &ClassShared_unbox(plain)));
    struct Handle(std::sync::Mutex<i32>);
    let handle = Rc::new(Handle(std::sync::Mutex::new(3)));
    for value in [Value::Class(handle.clone()), Value::Class(Rc::new(handle.clone())), Value::ClassShared(handle.clone())] {
        assert!(Rc::ptr_eq(&handle, &value.unwrap_class_shared::<Handle>()));
    }

    // The legacy accessor also accepts the shared carrier.
    let shared_accessor = Value::ClassShared(owner.clone());
    assert_eq!(number(shared_accessor.unwrap_class::<Payload>()), 7);

    // Packed native arrays retain concrete Rc<T> elements rather than a Value
    // carrier. Extraction must preserve their existing shared owner too.
    let packed = Value::NativeElement(Rc::new(NativeClasses(vec![owner.clone()]).into()), 0);
    let from_packed = ClassShared_unbox(packed);
    assert!(Rc::ptr_eq(&owner, &from_packed));

    // Dropping the last ClassShared releases the owner.
    let survivor = Rc::new(Payload::Wrap(5));
    let value = Value::ClassShared(survivor.clone());
    drop(survivor);
    assert_eq!(number(&value.unwrap_class_shared::<Payload>()), 5);
}
`;

const directory = mkdtempSync(join(tmpdir(), 'purust-class-shared-'));
try {
  for (const threaded of [false, true]) {
    const path = join(directory, threaded ? 'arc.rs' : 'rc.rs');
    const binary = path + '.bin';
    writeFileSync(path, `${threaded ? threadedPrelude(codegenPrelude(emptySet)) : codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${threaded ? threadedRust(generated + main) : generated + main}`);
    for (const [command, args] of [
      ['rustc', ['--edition=2021', '-Awarnings', ...(threaded ? ['--cfg', 'feature="threaded"'] : []), path, '-o', binary]],
      [binary, []],
    ]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
    }
  }
  console.log('ClassShared: unsized owner boxing, legacy Class fallback and Rc/Arc refcounts passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
