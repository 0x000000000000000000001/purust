import assert from 'node:assert/strict';
import { codegenExprType } from '../../output/Purust.CodeGen/index.js';
import { ADT } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';

const adt = (module, name) => new ADT(name, [...module.split('.'), name], []);
for (const current of ['Control_Monad_Free', 'Consumer']) {
  assert.equal(codegenExprType(current)(false)(adt('Control.Monad.Free', 'Val')), 'crate::UnknownType');
  for (const name of ['Free', 'FreeView']) {
    const prefix = current === 'Control_Monad_Free' ? 'crate' : 'Purs_Control_Monad_Free';
    assert.equal(codegenExprType(current)(false)(adt('Control.Monad.Free', name)), `std::rc::Rc<${prefix}::${name}>`);
  }
  assert.equal(codegenExprType(current)(false)(adt('Control.Monad.Rec.Class', 'Step')),
    'std::rc::Rc<Purs_Control_Monad_Rec_Class::Step>');
  // Neither unrelated Val types nor neighbouring Free modules are erased.
  for (const module of ['Example', 'Control.Monad.Free.Trans']) {
    assert.equal(codegenExprType(current)(false)(adt(module, 'Val')),
      `std::rc::Rc<Purs_${module.replaceAll('.', '_')}::Val>`);
  }
}
