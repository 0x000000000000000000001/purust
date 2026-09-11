import assert from 'node:assert/strict';
import { codegenExprType } from '../../output/Purust.CodeGen/index.js';
import { ADT } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';

const adt = (module, name) => new ADT(name, [...module.split('.'), name], []);
for (const current of ['Pipes_Internal', 'Consumer']) {
  assert.equal(codegenExprType(current)(false)(adt('Pipes.Internal', 'X')), 'purust_core::Void');
  assert.equal(codegenExprType(current)(false)(adt('Data.Void', 'Void')), 'purust_core::Void');
  const prefix = current === 'Pipes_Internal' ? 'crate' : 'Purs_Pipes_Internal';
  assert.equal(codegenExprType(current)(false)(adt('Pipes.Internal', 'Proxy')), `std::rc::Rc<${prefix}::Proxy>`);
  for (const module of ['Example', 'Pipes.Internal.Other']) {
    assert.equal(codegenExprType(current)(false)(adt(module, 'X')),
      `std::rc::Rc<Purs_${module.replaceAll('.', '_')}::X>`);
  }
}
