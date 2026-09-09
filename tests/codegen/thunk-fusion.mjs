import assert from 'node:assert/strict';
import { optimizeThunkProducers } from '../../output/Purust.ThunkFusion/index.js';
import { sanitizeIdent } from '../../output/Purust.CodeGen/index.js';
import { empty, singleton } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Func, Int, Unit, LitInt, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Branch, LetRec, Lit, Local, Typed, TypeApp, Var, Pair, PrimOp,
  Op1, Op2, OpIntNum, OpIntOrd, OpAdd, OpSubtract, OpMultiply, OpDivide,
  OpEq, OpIntNegate, OpIntBitNot } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const intType = Int.value;
const thunkType = new Func([Unit.value], intType);
const type = (ty, value) => new Typed(ty, value);
const int = value => type(intType, new Lit(new LitInt(value)));
const local = (name, level) => new Local(new Just(name), level);
const variable = (name, module = 'Fusion') => new Var(new Qualified(new Just(module), name));
const unit = type(Unit.value, variable('unit', 'Data.Unit'));
const param = (name, level) => new Tuple(new Just(name), level);
const apply = (fn, ...args) => new App(fn, args);
const op = (operator, left, right) => type(intType, new PrimOp(new Op2(new OpIntNum(operator), left, right)));
const thunk = body => type(thunkType, new Abs([param('u', 2)], body));
const force = type(intType, apply(local('acc', 1), unit));
const plus = op(OpAdd.value, force, int(1));

function producer(step = plus, name = 'suspend') {
  const n = type(intType, local('n', 0));
  const condition = new PrimOp(new Op2(new OpIntOrd(OpEq.value), n, int(0)));
  const body = new Branch([new Pair(condition, type(thunkType, local('acc', 1)))],
    type(thunkType, apply(variable(name), op(OpSubtract.value, n, int(1)), thunk(step))));
  return new Tuple(name, type(new Func([intType, thunkType], thunkType),
    new Abs([param('n', 0), param('acc', 1)], body)));
}

function consumer({ depth = int(3), seed = thunk(int(7)), name = 'suspend', immediate = true } = {}) {
  const built = apply(variable(name), depth, seed);
  return new Tuple('consumer', type(new Func([intType], immediate ? intType : thunkType),
    new Abs([param('input', 9)], immediate ? apply(built, unit) : built)));
}

function run({ step = plus, call = {}, reserved = empty, recursive = true, wrap = x => x } = {}) {
  const original = producer(step, call.name);
  const usage = consumer(call);
  const groups = [{ recursive, bindings: [original] },
    { recursive: false, bindings: [new Tuple(usage.value0, wrap(usage.value1))] }];
  const before = JSON.stringify(groups);
  const result = optimizeThunkProducers(sanitizeIdent)(reserved)('Fusion')(groups);
  assert.equal(JSON.stringify(groups), before, 'The input module is immutable');
  const rewritten = result.bindings.flatMap(g => g.bindings).find(b => b.value0 === 'consumer');
  const workers = result.bindings.flatMap(g => g.bindings).filter(b => b.value0.includes('__purust_strict_thunk_'));
  return { groups, result, rewritten, workers };
}

function accepts(options = {}) {
  const result = run(options);
  assert.equal(result.workers.length, 1);
  assert.ok(JSON.stringify(result.rewritten).includes(result.workers[0].value0));
  const original = result.result.bindings.flatMap(g => g.bindings).find(b => b.value0 === (options.call?.name ?? 'suspend'));
  assert.deepEqual(original, result.groups[0].bindings[0], 'Keep the original producer');
  assert.equal(result.result.bindings[0].recursive, true, 'Emit the worker before its callers');
  return result;
}

function rejects(options) {
  const result = run(options);
  assert.equal(result.workers.length, 0);
  assert.deepEqual(result.result.bindings, result.groups);
}

accepts();
accepts({ call: { depth: int(0) } });
accepts({ call: { seed: thunk(int(2147483646)), depth: int(1) } });
accepts({ call: { seed: thunk(int(-2147483648)), depth: int(1) } });
accepts({ step: op(OpMultiply.value, force, int(2)) });
accepts({ step: new PrimOp(new Op1(OpIntBitNot.value, force)) });
accepts({ call: { depth: new TypeApp(int(3), intType) } });
const clash = "suspend'";
const fresh = accepts({ call: { name: clash }, reserved: singleton(sanitizeIdent(`${clash}__purust_strict_thunk_0`)) });
assert.ok(fresh.workers[0].value0.endsWith('_1'), 'Reserve foreign and sanitized names');

rejects({ call: { immediate: false } });
rejects({ recursive: false });
rejects({ call: { depth: type(intType, local('input', 9)) } });
rejects({ call: { seed: thunk(type(intType, local('input', 9))) } });
rejects({ call: { seed: thunk(type(intType, apply(variable('unknown', 'Foreign'), unit))) } });
rejects({ call: { seed: thunk(int(2147483647)), depth: int(1) } });
rejects({ call: { depth: int(5000) } });
rejects({ call: { depth: int(-1) } });
rejects({ step: int(1) });
rejects({ step: op(OpAdd.value, force, force) });
rejects({ step: op(OpDivide.value, force, int(0)) });
rejects({ step: op(OpMultiply.value, force, int(2147483647)) });
rejects({ step: new PrimOp(new Op1(OpIntNegate.value, force)), call: { seed: thunk(int(-2147483648)) } });
rejects({ wrap: body => new LetRec(20, [new Tuple('rec', new Abs([param('x', 21)], local('x', 21)))], body) });
const unused = [{ recursive: true, bindings: [producer()] }];
assert.deepEqual(optimizeThunkProducers(sanitizeIdent)(empty)('Fusion')(unused).bindings, unused);
const grouped = [{ recursive: true, bindings: [producer(), producer(plus, 'other')] },
  { recursive: false, bindings: [consumer()] }];
assert.deepEqual(optimizeThunkProducers(sanitizeIdent)(empty)('Fusion')(grouped).bindings, grouped);
console.log('Thunk fusion guards: demand counts, closed inputs, Int bounds, proof budget, deferred/opaque calls, recursive scopes, fresh names and unchanged fallback verified.');
