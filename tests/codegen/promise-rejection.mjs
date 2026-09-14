import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenExprType, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { empty } from '../../output/Data.Set/index.js';
import { ADT } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';

for (const current of ['Promise_Rejection', 'Consumer']) for (const isRet of [false, true]) {
  for (const [module, name, carrier] of [
    ['Promise.Rejection', 'Rejection', true], ['Promise.Rejection', 'Sibling', false],
    ['Other', 'Rejection', false], ['Promise.Rejection.Other', 'Rejection', false],
  ]) for (const display of [name, `${module}.${name}`]) {
    const prefix = module.replaceAll('.', '_') === current ? 'crate' : `Purs_${module.replaceAll('.', '_')}`;
    assert.equal(codegenExprType(current)(isRet)(new ADT(display, [...module.split('.'), name], [])),
      carrier ? 'crate::UnknownType' : `std::rc::Rc<${prefix}::${name}>`);
  }
}
const foreign = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const exception = foreign('purust-exceptions/src/Effect/Exception.rs');
const rejection = foreign('purust-js-promise/src/Promise/Rejection.rs');
const checks = `
fn main() {
    use std::rc::Rc;
    let error = Purs_Effect_Exception::Effect_Exception_error("original".to_owned());
    let retained = Promise_Rejection_fromError(error.clone());
    let identity = |a: &Value, b: &Value| match (a.resolve(), b.resolve()) {
        (Value::Class(a), Value::Class(b)) => assert!(Rc::ptr_eq(a, b)),
        _ => panic!("lost native identity"),
    };
    identity(&error, &retained);
    let just = Value::Func1(Func1::Static(|a| a));
    let to_error = Promise_Rejection__toError().unwrap_func3();
    let recovered = to_error(just.clone(), Value::Int(-1), retained);
    identity(&error, &recovered);
    assert_eq!(Purs_Effect_Exception::Effect_Exception_message(recovered), "original");
    let forbidden = Value::Func1(Func1::Static(|_| panic!("not an Error")));
    for value in [Value::String("rejected".to_owned()), Value::Int(42), Value::Bool(false),
        Value::Unit, Value::Number(0.0), Value::Class(Rc::new("opaque".to_owned())),
        Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a::default())), just] {
        assert_eq!(to_error(forbidden.clone(), Value::Int(-1), value).unwrap_int(), -1);
    }
    // Foreign's string decoding must see the original payload, with no opaque box.
    let text = Promise_Rejection_fromError(Value::String("rejected".to_owned()));
    assert_eq!(text.unwrap_string(), "rejected");
    // Both native uncurried and generated curried calls use the same contract.
    let recovered = Promise_Rejection__toError().unwrap_func1()(Value::Func1(Func1::Static(|a| a)))
        .unwrap_func1()(Value::Int(-1)).unwrap_func1()(error.clone());
    identity(&error, &recovered);
}
`;
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-promise-rejection-'));
try {
  for (const threaded of [false, true]) {
    const prelude = codegenPrelude(empty);
    const body = `mod Purs_Effect_Exception { ${exception} }\n${rejection}\n${checks}`;
    const file = join(directory, 'checks.rs');
    const binary = join(directory, 'checks');
    writeFileSync(file, `${threaded ? threadedPrelude(prelude) : prelude}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;\n${threaded ? threadedRust(body) : body}`);
    for (const [command, args] of [
      ['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary, ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]],
      [binary, []],
    ]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30_000 });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
    }
  }
  console.log('Promise.Rejection: transparent payload, native Error identity, curried/uncurried ABI passed in Rc/Arc.');
} finally { rmSync(directory, { recursive: true, force: true }); }
