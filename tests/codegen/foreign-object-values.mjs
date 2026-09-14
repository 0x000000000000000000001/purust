import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';

function generate(module) {
  const object = new ADT('Object', [module, 'Object'], [Any.value]);
  return codegenModule(emptyMap)(emptyMap)({ name: 'ObjectBridge', dataDecls: [], classDecls: [] })({
    name: 'ObjectBridge', bindings: [{ recursive: false, bindings: [new Tuple('convert',
      new Typed(new Func([Any.value], object), new Abs([new Tuple(new Just('value'), 0)],
        new Typed(object, new Local(new Just('value'), 0))))) ] }],
  });
}
const generated = generate('Foreign.Object');
assert.match(generated, /__purust_foreign_object/);
const unrelated = generate('Other.Object');
assert.ok(!unrelated.includes('__purust_foreign_object'));
assert.match(unrelated, /unwrap_class/);
const prelude = codegenPrelude(emptySet);
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const checks = `
extern crate self as purust_core;
extern crate self as Purs_Foreign_Object;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
pub type Object = SharedRecord;
${generated}
fn main() {
    let mut fields = RecordFields::new();
    fields.insert("z".into(), Value::Unit);
    fields.insert("name".into(), Value::String(purust_string_from_utf16(&[0xd800, 97])));
    fields.insert("value".into(), Value::Null);
    let record = Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields));
    let object = ObjectBridge_convert(record.clone());
    assert_eq!(object.entries().iter().map(|(k,_)|k.as_str()).collect::<Vec<_>>(), vec!["z","name","value"]);
    assert!(matches!(object.get("z"), Some(Value::Unit)));
    assert!(matches!(object.get("value"), Some(Value::Null)));
    assert_eq!(purust_string_to_utf16(&object.get("name").unwrap().unwrap_string()), vec![0xd800,97]);
    let boxed = Value::Class(std::rc::Rc::new(object.clone()));
    assert!(std::rc::Rc::ptr_eq(&object, &ObjectBridge_convert(boxed)));
    let thunk = perceus_ptr::PerceusPtr::new(Thunk::default());
    assert!(thunk.value.set(record).is_ok());
    assert!(matches!(ObjectBridge_convert(Value::Thunk(thunk)).get("value"), Some(Value::Null)));
    std::panic::set_hook(Box::new(|_| {}));
    for invalid in [Value::Null, Value::Unit, Value::Int(1), Value::Array(std::rc::Rc::new(vec![])), Value::Class(std::rc::Rc::new(1_i64))] {
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| ObjectBridge_convert(invalid))).is_err());
    }
}
`;
for (const threaded of [false,true]) {
  const directory = mkdtempSync(join(tmpdir(), 'purust-object-values-')), source = join(directory,'main.rs'), binary = join(directory,'main');
  writeFileSync(source, (threaded ? threadedPrelude(prelude) : prelude) + (threaded ? threadedRust(checks) : checks));
  for (const [exe,args] of [['rustc',['--edition=2024','-Awarnings', ...(threaded ? ['--cfg','feature="threaded"'] : []), source,'-o',binary]],[binary,[]]]) {
    const result=spawnSync(exe,args,{encoding:'utf8'}); assert.equal(result.status,0,result.stderr);
  }
}
console.log('Foreign.Object bridges native records only, preserving fields and existing object identity in Rc/Arc.');
