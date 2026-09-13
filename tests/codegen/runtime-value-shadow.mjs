// Application ADTs named Value must remain distinct from the runtime carrier.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { singleton } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, Int, LitInt, LitRecord, Prop } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, EffectPure, Lit, Local, PrimUndefined, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
const name = 'ValueShadow', type = new ADT(`${name}.Value`, [name, 'Value'], []);
const typed = (type, expression) => new Typed(type, expression);
const parameter = new Tuple(new Just('input'), 0), input = new Local(new Just('input'), 0);
const fn = (argument, result, body) => typed(new Func([argument], result), new Abs([parameter], body));
const generated = codegenModule(emptyMap)(emptyMap)({ name, classDecls: [], dataDecls: [
  { name: 'Value', constructors: [{ name: 'Local', fields: [Int.value] }, { name: 'Remote', fields: [Int.value] }] },
] })({ name, bindings: [{ recursive: false, bindings: [
  new Tuple('box', fn(type, Any.value, typed(Any.value, input))),
  new Tuple('unbox', fn(Any.value, type, typed(type, input))),
  new Tuple('callback', fn(new Func([Int.value], Int.value), Any.value, typed(Any.value, input))),
  new Tuple('record', new Lit(new LitRecord([new Prop('x', new Lit(new LitInt(42)))]))),
  new Tuple('empty', PrimUndefined.value),
  new Tuple('action', new EffectPure(new Lit(new LitInt(42)))),
] }] });
const main = `
fn main() {
    use std::rc::Rc;
    let value = Rc::new(Value::Local(42));
    let boxed = ValueShadow_box(value.clone());
    assert!(Rc::ptr_eq(&value, &ValueShadow_unbox(boxed)));
    assert!(matches!(value.as_ref(), Value::Local(42)));
    let callback = ValueShadow_callback(Func1::Static(|n: i64| n + 1));
    assert_eq!(callback.unwrap_func1()(purust_core::Value::Int(41)).unwrap_int(), 42);
    assert_eq!(ValueShadow_record().get_x().unwrap_int(), 42);
    assert!(matches!(ValueShadow_empty(), purust_core::Value::Record_a(_)));
    assert_eq!(ValueShadow_action().unwrap_func1()(purust_core::Value::Unit).unwrap_int(), 42);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-value-shadow-'));
const pointer = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
try {
  for (const threaded of [false, true]) {
    const suffix = threaded ? 'arc' : 'rc', flags = threaded ? ['--cfg', 'feature="threaded"'] : [];
    const pointerLib = join(directory, `libperceus_ptr_${suffix}.rlib`);
    const core = join(directory, `core_${suffix}.rs`), coreLib = join(directory, `libpurust_core_${suffix}.rlib`);
    const source = join(directory, `main_${suffix}.rs`), binary = source + '.bin';
    const prelude = codegenPrelude(singleton('x'));
    writeFileSync(core, threaded ? threadedPrelude(prelude) : prelude);
    writeFileSync(source, `#![allow(warnings)]\nuse purust_core::*;\n${threaded ? threadedRust(generated + main) : generated + main}`);
    const base = ['--edition=2021', '-Awarnings', ...flags, '-L', `dependency=${directory}`];
    for (const [command, args] of [
      ['rustc', [...base, '--crate-name', 'perceus_ptr', '--crate-type=rlib', pointer, '-o', pointerLib]],
      ['rustc', [...base, '--crate-name', 'purust_core', '--crate-type=rlib', '--extern', `perceus_ptr=${pointerLib}`, core, '-o', coreLib]],
      ['rustc', [...base, '--extern', `perceus_ptr=${pointerLib}`, '--extern', `purust_core=${coreLib}`, source, '-o', binary]],
      [binary, []],
    ]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
    }
  }
  console.log('A local Value ADT cannot shadow runtime boxing, callbacks, records or effects in Rc/Arc.');
} finally { rmSync(directory, { recursive: true, force: true }); }
