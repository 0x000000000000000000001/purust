import assert from 'node:assert/strict';
import { eligibleValues, memoizedBody } from '../../output/Purust.ModuleValues/index.js';
import { member } from '../../output/Data.Set/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Ann, Binding, NonRec, Rec, ExprVar, ExprConstructor, ExprAbs,
  Int, Any, ADT, Func, ForAll, TypeVar, Row, Record, ConstrainedType, ordIdent } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';

const int = Int.value, ref = new ADT('Ref', ['Effect', 'Ref', 'Ref'], [int]);
const annotation = type => new Ann({ type: new Just(type) });
const value = type => new ExprVar(annotation(type), {});
const bind = (name, type, expression = value(type)) => new Binding(annotation(type), name, expression);
const declarations = [
  new NonRec(bind('native', int)), new NonRec(bind('reference', ref)),
  new NonRec(bind('effect', new ADT('Effect', ['Effect', 'Effect'], [ref]))),
  new NonRec(bind('computedFunction', new Func([int], int))),
  new NonRec(bind('lambda', int, new ExprAbs(annotation(int), 'x', value(int)))),
  new NonRec(bind('constructor', int, new ExprConstructor(annotation(int), 'T', 'C', []))),
  new NonRec(bind('unknown', Any.value)),
  new NonRec(bind('polymorphic', new ForAll(['a'], new ADT('Ref', [], [new TypeVar('a')])))),
  new NonRec(bind('constrained', new ConstrainedType([], int))),
  new NonRec(bind('openRecord', new Record(new Row([new Tuple('x', int)], new Just(new TypeVar('r')))))),
  new NonRec(bind('record', new Record(new Row([new Tuple('x', int)], Nothing.value)))),
  new Rec([bind('recursive', int)]),
];
const names = eligibleValues({ decls: declarations });
for (const name of ['native', 'reference', 'effect', 'record']) assert.equal(member(ordIdent)(name)(names), true, name);
for (const name of ['computedFunction', 'lambda', 'constructor', 'unknown', 'polymorphic', 'constrained', 'openRecord', 'recursive', 'foreign', 'worker']) {
  assert.equal(member(ordIdent)(name)(names), false, name);
}
for (const threaded of [false, true]) {
  const body = memoizedBody(threaded)('Probe_value')('i64')('42');
  assert.match(body, /Cell<i64>/); assert.doesNotMatch(body, /UnknownType|Value>/);
  assert.equal(body.includes('thread_local!'), !threaded);
}
console.log('Module values: original closed TAST eligibility and explicit normal/threaded typed storage');
