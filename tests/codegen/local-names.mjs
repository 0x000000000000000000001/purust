// Run after npm run build. Recursive group members share a level in PBO;
// ordinary locals use their level independently of optional name hints.
import assert from 'node:assert/strict';
import { renameLocals } from '../../output/Purust.LocalNames/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, EffectBind, LetRec, Local, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const local = (name, level) => new Local(new Just(name), level);
const group = renameLocals(new LetRec(0, [
  new Tuple('ping', local('pong', 0)),
  new Tuple('pong', local('ping', 0)),
], new App(local('ping', 0), [local('pong', 0)])));
const [ping, pong] = group.value1;
assert.notEqual(ping.value0, pong.value0);
assert.equal(ping.value1.value0.value0, pong.value0);
assert.equal(pong.value1.value0.value0, ping.value0);
assert.equal(group.value2.value0.value0.value0, ping.value0);
assert.equal(group.value2.value1[0].value0.value0, pong.value0);
assert.equal(ping.value1.value1, 0);
assert.equal(pong.value1.value1, 0);

const unqualifiedGlobal = new Var(new Qualified(Nothing.value, 'ping'));
const qualifiedGlobal = new Var(new Qualified(new Just('Foreign.Module'), 'ping'));
const globals = renameLocals(new Abs([new Tuple(new Just('ping'), 0)],
  new App(unqualifiedGlobal, [qualifiedGlobal, local('ping', 0)])));
assert.deepEqual(globals.value1.value0, unqualifiedGlobal);
assert.deepEqual(globals.value1.value1[0], qualifiedGlobal);
assert.equal(globals.value1.value1[1].value0.value0, globals.value0[0].value0.value0);

const effects = renameLocals(new Abs([new Tuple(new Just('value'), 0)],
  new EffectBind(new Just('value'), 1, new Local(Nothing.value, 0),
    new App(local('value', 0), [local('value', 1)]))));
const outer = effects.value0[0].value0.value0;
const inner = effects.value1.value0.value0;
assert.notEqual(outer, inner);
assert.equal(effects.value1.value2.value0.value0, outer);
assert.equal(effects.value1.value3.value0.value0.value0, outer);
assert.equal(effects.value1.value3.value1[0].value0.value0, inner);

console.log('Local names: recursive groups, global references and effect shadowing checks passed.');
