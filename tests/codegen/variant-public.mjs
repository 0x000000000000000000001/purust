import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codegenExprType, codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty, insert } from '../../output/Data.Map/index.js';
import { singleton } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, Int, LitInt, LitRecord, LitString, Prop, String as StringType }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, GetProp, Lit, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';

const adt = (module, name) => new ADT(name, [...module.split('.'), name], []);
for (const current of ['Data_Variant', 'Consumer']) for (const isRet of [false, true]) {
  for (const [module, name, value] of [
    ['Data.Variant', 'Variant', true], ['Data.Variant.Internal', 'VariantCase', true],
    ['Data.Variant', 'VariantEqs', false], ['Data.Variant', 'VariantShows', false],
    ['Data.Variant.Internal', 'VariantFCase', false], ['Data.Variant.Internal', 'VariantTags', false],
    ['Data.Functor.Variant', 'VariantF', false], ['Other', 'Variant', false], ['Data.Variant.Other', 'Variant', false],
  ]) {
    const prefix = module.replaceAll('.', '_') === current ? 'crate' : `Purs_${module.replaceAll('.', '_')}`;
    assert.equal(codegenExprType(current)(isRet)(adt(module,name)), value ? 'crate::UnknownType' : `std::rc::Rc<${prefix}::${name}>`);
  }
}
const name='VariantValues', variant=adt('Data.Variant','Variant'), native=adt(name,'Variant');
const methods=[new Tuple('type',StringType.value),new Tuple('value',Int.value)];
const fieldTypes=[new Tuple('type_kw',StringType.value),new Tuple('value',Int.value)];
const fields=insert(ordString)(`${name}_Variant`)(fieldTypes)(
  // Known scalar projection tests both dispatch and unboxing of a Value field.
  insert(ordString)('Data_Variant_Variant')(fieldTypes)(empty));
const local=new Local(new Just('x'),0), param=new Tuple(new Just('x'),0);
const record=new Lit(new LitRecord([new Prop('type',new Lit(new LitString('integer'))),new Prop('value',new Lit(new LitInt(42)))]));
const bindings=[];
for (const [label,type] of [['dynamic',variant],['native',native]]) {
  bindings.push(new Tuple(label,new Typed(type,record)));
  bindings.push(new Tuple(`${label}Value`,new Typed(new Func([type],Int.value),new Abs([param],new Accessor(local,new GetProp('value'))))));
  bindings.push(new Tuple(`${label}Tag`,new Typed(new Func([type],StringType.value),new Abs([param],new Accessor(local,new GetProp('type'))))));
}
bindings.push(new Tuple('retainNative',new Typed(new Func([Any.value],native),new Abs([param],new Typed(native,local)))));
const generated=codegenModule(empty)(fields)({name,classDecls:[{name:'Variant',vars:[],methods,superclasses:[]}],dataDecls:[]})
  ({name,bindings:[{recursive:false,bindings}]});
assert.doesNotMatch(generated,/Purs_Data_Variant::Variant\b/);
assert.match(generated,/Rc::new\(crate::Variant \{/);
assert.match(generated,/\.value\.clone\(\)/);
assert.match(generated,/\.get_value\(\)\)\.unwrap_int\(\)/);
const runtime=fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs',import.meta.url));
const main=`
fn main() {
    let dynamic = VariantValues_dynamic();
    assert_eq!(VariantValues_dynamicValue(dynamic.clone()),42);
    assert_eq!(VariantValues_dynamicTag(dynamic.clone()),"integer");
    let native = VariantValues_native();
    assert_eq!(VariantValues_nativeValue(native.clone()),42);
    assert_eq!(VariantValues_nativeTag(native.clone()),"integer");
    let retained = VariantValues_retainNative(Value::Class(std::rc::Rc::new(native.clone())));
    assert!(std::rc::Rc::ptr_eq(&native,&retained));
    let hook=std::panic::take_hook(); std::panic::set_hook(Box::new(|_|{}));
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        VariantValues_dynamicValue(Value::Unit)
    })).is_err(),"invalid dynamic receiver must not produce a default scalar");
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        VariantValues_retainNative(Value::Int(42))
    })).is_err(),"native namesake must keep checked conversion");
    std::panic::set_hook(hook);
}
`;
const directory=mkdtempSync(join(process.env.PURUST_VARIANT_CODEGEN_KEEP_OUTPUT??tmpdir(),'purust-variant-values-'));
try {
  for(const threaded of [false,true]) {
    const prelude=codegenPrelude(singleton('type,value'));
    const source=`${threaded?threadedPrelude(prelude):prelude}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;\n${threaded?threadedRust(generated+main):generated+main}`;
    const path=join(directory,threaded?'threaded.rs':'normal.rs'), binary=path.slice(0,-3); writeFileSync(path,source);
    const build=spawnSync('rustc',['--edition=2021','-Awarnings',...(threaded?['--cfg','feature="threaded"']:[]),path,'-o',binary],{encoding:'utf8',timeout:60000});
    assert.equal(build.status,0,build.stderr);
    const run=spawnSync(binary,[],{encoding:'utf8',timeout:10000}); assert.equal(run.status,0,run.stderr);
  }
  console.log('Variant: 36 mapping boundaries; Value/native literals, scalar projections, native identity and negative receivers passed in Rc/Arc.');
} finally {
  if(process.env.PURUST_VARIANT_CODEGEN_KEEP_OUTPUT) console.log(`Diagnostic: ${directory}`);
  else rmSync(directory,{recursive:true});
}
