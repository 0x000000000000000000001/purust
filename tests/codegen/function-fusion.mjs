import assert from 'node:assert/strict';
import { countedFunctionProducers } from '../../output/Purust.FunctionFusion/index.js';
import { size } from '../../output/Data.Set/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Func, ForAll, TypeVar, Int, Number as NumberType, LitInt, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Branch, Let, Lit, Local, Typed, TypeApp, Var, Pair, PrimOp,
  Op2, OpIntNum, OpIntOrd, OpSubtract, OpEq } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const i = Int.value;
const callback = new Func([i], i);
const iterator = new Func([callback, i], i);
const producer = new Func([i, callback, i], i);
const typed = (ty, expr) => new Typed(ty, expr);
const param = level => new Tuple(Nothing.value, level);
const local = (ty, level) => typed(ty, new Local(Nothing.value, level));
const int = n => typed(i, new Lit(new LitInt(n)));
const variable = (name, module = 'Iterator') => new Var(new Qualified(new Just(module), name));
const apply = (ty, fn, ...args) => typed(ty, new App(fn, args));
const lambda = (ty, args, body) => typed(ty, new Abs(args.map(param), body));
const binary = (op, a, b) => new PrimOp(new Op2(op, a, b));
const typeVar = new TypeVar('a');
const identityType = new Func([new Func([typeVar], typeVar), typeVar], typeVar);
const identity = typed(new ForAll(['a'], identityType),
  lambda(identityType, [10], lambda(new Func([typeVar], typeVar), [11], local(typeVar, 11))));

function groups(options = {}) {
  const { name = 'repeat', base = variable('empty'), step = 1, reversed = false,
    recursive = true, self = variable(name), wrap = x => x,
    outerType = producer, bodyWrap = x => x, annotation = true } = options;
  const n = local(i, 0), f = local(callback, 2), x = local(i, 3);
  const previous = options.previous ?? apply(i, local(iterator, 1), f, x);
  const body = options.body ?? apply(i, f, previous);
  const returned = options.returned ?? lambda(iterator, [2], lambda(new Func([i], i), [3], body));
  const built = apply(iterator, self, typed(i, binary(new OpIntNum(OpSubtract.value), n, int(step))));
  const condition = binary(new OpIntOrd(OpEq.value), ...(reversed ? [int(0), n] : [n, int(0)]));
  const branch = new Branch([new Pair(condition, typed(iterator, base))],
    typed(iterator, new Let(Nothing.value, 1, built, returned)));
  const expr = new Abs([param(0)], bodyWrap(typed(iterator, branch)));
  return [{ recursive: false, bindings: [new Tuple('empty', options.identity ?? identity)] },
    { recursive, bindings: [new Tuple(name, wrap(annotation ? typed(outerType, expr) : expr))] }];
}

function check(expected, options, mutate = x => x) {
  const input = mutate(groups(options));
  const before = JSON.stringify(input);
  assert.equal(size(countedFunctionProducers('Iterator')(input)), expected);
  assert.equal(JSON.stringify(input), before, 'Recognition must leave the original producer intact');
}

check(1);
check(1, { name: 'unrelatedName', reversed: true });
check(1, { wrap: x => new TypeApp(x, i), outerType: new Func([i], iterator) });
check(1, { base: lambda(iterator, [20, 21], local(i, 21)) });
check(1, { returned: lambda(iterator, [2, 3], apply(i, local(callback, 2),
  apply(i, local(iterator, 1), local(callback, 2), local(i, 3)))) });
check(0, { recursive: false });
check(0, { annotation: false });
check(0, { outerType: new Func([NumberType.value, callback, i], i) });
check(0, { step: 2 });
check(0, { step: -1 });
check(0, { self: variable('different') });
check(0, { self: variable('repeat', 'Foreign') });
check(0, { base: variable('empty', 'Foreign') });
check(0, { base: variable('unknown') });
check(0, { identity: lambda(iterator, [10, 11], int(7)) });
check(0, { base: lambda(iterator, [10, 11], apply(i, local(callback, 10), local(i, 11))) });
check(0, { body: apply(i, local(callback, 2), local(i, 3)) });
check(0, { body: apply(i, local(callback, 2), apply(i, local(iterator, 1), local(callback, 2), local(i, 0))) });
check(0, { previous: apply(i, local(iterator, 1), variable('otherCallback'), local(i, 3)) });
check(0, { body: apply(i, local(iterator, 1), local(callback, 2), apply(i, local(callback, 2), local(i, 3))) });
check(0, { previous: typed(NumberType.value, apply(i, local(iterator, 1), local(callback, 2), local(i, 3))) });
check(0, { bodyWrap: body => new Let(Nothing.value, 9, apply(i, variable('opaque'), int(0)), body) });
check(0, {}, input => [input[0], { recursive: true, bindings: [...input[1].bindings, new Tuple('mutual', int(0))] }]);
console.log('Counted function fusion: typed shape, renamed/local identities, callback order, counter captures, conversions, opaque calls and recursive groups checked.');
