import assert from 'node:assert/strict';
import { codegenExprType } from '../../output/Purust.CodeGen/index.js';
import { ADT } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';

const adt = (module, name) => new ADT(name, [...module.split('.'), name], []);
for (const current of ['Data_Variant_Internal', 'Consumer']) {
  const type = (module, name) => codegenExprType(current)(false)(adt(module, name));
  assert.equal(type('Data.Variant.Internal', 'VariantCase'), 'crate::UnknownType');
  assert.equal(type('Data.Variant.Internal', 'VariantFCase'), 'crate::UnknownType');
  // Only the heterogeneous case payload is a Value, not every foreign type
  // or class in Variant, nor a namesake from an unrelated module.
  for (const [module, name] of [
    ['Other', 'VariantFCase'], ['Data.Variant.Internal', 'VariantTags'],
    ['Data.Variant', 'VariantShows'], ['Other', 'VariantCase'], ['Data.Variant.Internal.Other', 'VariantCase'],
  ]) {
    const prefix = module.replaceAll('.', '_') === current ? 'crate' : `Purs_${module.replaceAll('.', '_')}`;
    assert.equal(type(module, name), `std::rc::Rc<${prefix}::${name}>`);
  }
}
