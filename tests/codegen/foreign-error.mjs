import assert from 'node:assert/strict';
import { codegenExprType } from '../../output/Purust.CodeGen/index.js';
import { ADT } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';

for (const current of ['Foreign', 'Consumer']) for (const isRet of [false, true]) {
  for (const [module, name, carrier] of [
    ['Foreign', 'Foreign', true], ['Foreign', 'ForeignError', false], ['Foreign', 'Sibling', false],
    ['Other', 'Foreign', false], ['Foreign.Other', 'Foreign', false], ['Other', 'ForeignError', false],
  ]) {
    const prefix = module.replaceAll('.', '_') === current ? 'crate' : `Purs_${module.replaceAll('.', '_')}`;
    const actual = codegenExprType(current)(isRet)(new ADT(name, [...module.split('.'), name], []));
    assert.equal(actual, carrier ? 'crate::UnknownType' : `std::rc::Rc<${prefix}::${name}>`);
  }
}
