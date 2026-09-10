import assert from 'node:assert/strict';
import test from 'node:test';
import { empty } from '../../output/Data.Map/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { monoidBackendAnalysis } from '../../output/PureScript.Backend.Optimizer.Analysis/index.js';
import { ForAll, Func, Int, LitInt, Qualified, TypeVar } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, EffectDefer, EffectPure, Lit, Local, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
import {
  evalExternFromImpl, insertDirective, EvalExtern, ExternApp, ExternExpr,
  InlineAlways, InlineArity, InlineNever, InlineRef, NeutApp, NeutLit,
  NeutLocal, NeutStop, SemEffectDefer, SemEffectPure, SemLam, SemRef, SemTyped,
} from '../../output/PureScript.Backend.Optimizer.Semantics/index.js';

const name = new Qualified(new Just('IdentityProbe'), 'wrap');
const generic = new TypeVar('a');
const param = level => new Tuple(new Just('value'), level);
const local = (level = 7) => new Local(new Just('value'), level);
const typed = (ty, body) => new Typed(ty, body);
const implementation = (body = local(), params = [param(7)]) =>
  new Tuple(monoidBackendAnalysis.mempty, new ExternExpr([], typed(
    new ForAll(['a'], new Func(params.map(() => generic), generic)),
    new Abs(params, body),
  )));

function evaluate(arg, { impl = implementation(), directive, spine = [new ExternApp([arg])] } = {}) {
  const env = {
    currentModule: 'Caller', locals: empty, localsSize: 0,
    evalExternRef: () => { throw new Error('Unexpected callee dereference'); },
    evalExternSpine: () => { throw new Error('Unexpected callee evaluation'); },
    directives: directive === undefined ? empty
      : insertDirective(new EvalExtern(name))(InlineRef.value)(directive)(empty),
  };
  return evalExternFromImpl(env)(name)(impl)(spine);
}

function retained(arg, options) {
  const result = evaluate(arg, options);
  assert.ok(result instanceof Just);
  assert.strictEqual(result.value0, arg, 'Return the caller value without callee annotations');
}

test('polymorphic identity preserves the caller value and its type scope', () => {
  const callerType = new Func([new TypeVar('a')], Int.value);
  const arg = new SemTyped(callerType, new NeutLocal(new Just('captured'), 42));
  const before = JSON.stringify(arg);
  retained(arg);
  retained(arg, { impl: implementation(typed(generic, typed(generic, local()))) });
  retained(arg, { directive: InlineAlways.value });
  retained(arg, { directive: new InlineArity(1) });
  assert.strictEqual(arg.value0, callerType);
  assert.equal(JSON.stringify(arg), before);
});

test('identity does not invoke or force a function, effect, or delayed reference', () => {
  let calls = 0;
  const fn = new SemLam(Nothing.value, value => { calls++; return value; });
  const delayed = new SemRef(new EvalExtern(name), [], () => {
    calls++;
    throw new Error('Identity forced a delayed argument');
  });
  for (const arg of [fn, new SemEffectPure(fn), new SemEffectDefer(delayed), delayed]) retained(arg);
  assert.equal(calls, 0);
});

test('the guard retains other polymorphic implementations and unsupported spines', () => {
  const arg = new NeutLit(new LitInt(42));
  const rejected = [
    implementation(new Lit(new LitInt(0))),
    implementation(local(8)), // Same spelling, different lexical binding.
    implementation(new TypeApp(local(), Int.value)),
    implementation(new App(local(), [new Lit(new LitInt(0))])),
    implementation(new EffectPure(local())),
    implementation(new EffectDefer(local())),
    implementation(local(), [param(7), param(8)]),
  ];
  for (const impl of rejected) assert.strictEqual(evaluate(arg, { impl }), Nothing.value);
  for (const spine of [[], [new ExternApp([])], [new ExternApp([arg, arg])]]) {
    assert.strictEqual(evaluate(arg, { spine }), Nothing.value);
  }
});

test('identity reduction respects explicit inlining directives', () => {
  const arg = new NeutLit(new LitInt(42));
  assert.strictEqual(evaluate(arg, { directive: new InlineArity(2) }), Nothing.value);
  const result = evaluate(arg, { directive: InlineNever.value });
  assert.ok(result instanceof Just);
  assert.ok(result.value0 instanceof NeutApp);
  assert.ok(result.value0.value0 instanceof NeutStop);
  assert.deepEqual(result.value0.value0.value0, name);
  assert.strictEqual(result.value0.value1[0], arg);
});
