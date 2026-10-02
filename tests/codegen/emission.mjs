import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Aff from '../../output/Effect.Aff/index.js';
import { Left } from '../../output/Data.Either/index.js';
import { withEmitter } from '../../output/Purust.Emission/index.js';

const pure = Aff.applicativeAff.pure, bind = Aff.bindAff.bind, lift = Aff.monadEffectAff.liftEffect;
const fail = message => Aff.monadThrowAff.throwError(new Error(message));
const run = action => new Promise((resolve, reject) => Aff.runAff(result => () =>
  result instanceof Left ? reject(result.value0) : resolve(result.value0))(action)());
const sequence = (items, effect) => items.reduce((action, item) => bind(action)(() => effect(item)), pure(undefined));
const inputs = Array.from({ length: 12 }, (_, i) => i);

test('emission bounds concurrent work and publishes in input order after out-of-order completion', async () => {
  for (const jobs of [1, 2, 4]) {
    let active = 0, peak = 0;
    const completed = [], published = [];
    const generate = n => Aff.bracket(lift(() => { active++; peak = Math.max(peak, active); }))(
      () => lift(() => { active--; }))(() => bind(Aff.delay(n % 3 === 0 ? 12 : 1))(() =>
        lift(() => { completed.push(n); return n * n; })));
    await run(withEmitter(jobs)(generate)(n => lift(() => published.push(n)))(enqueue => sequence(inputs, enqueue)));
    assert.deepEqual(published, inputs.map(n => n * n));
    assert.equal(active, 0);
    assert.equal(peak, jobs);
    if (jobs > 1) assert.notDeepEqual(completed, inputs);
  }
});

test('emission joins children on generator, publisher and producer failure', async () => {
  for (const jobs of [1, 2, 4]) {
    for (const stage of ['generate', 'publish', 'produce']) {
      let active = 0;
      const published = [];
      const generate = n => Aff.bracket(lift(() => { active++; }))(() => lift(() => { active--; }))(
        () => bind(Aff.delay(n % 3 === 0 ? 12 : 1))(() =>
          stage === 'generate' && n === 2 ? fail(stage) : pure(n)));
      const publish = n => stage === 'publish' && n === 2 ? fail(stage) : lift(() => published.push(n));
      const produce = enqueue => bind(sequence(inputs.slice(0, 6), enqueue))(() =>
        stage === 'produce' ? fail(stage) : pure(undefined));
      await assert.rejects(run(withEmitter(jobs)(generate)(publish)(produce)), new RegExp(stage));
      assert.equal(active, 0, `${jobs}/${stage}: no worker survives the returned error`);
      assert.deepEqual(published, inputs.slice(0, published.length), 'published results remain a prefix');
      if (stage !== 'produce') assert.deepEqual(published, [0, 1]);
    }
  }
});

test('generator construction failures are observed at their ordered publication point', async () => {
  const published = [];
  const generate = n => {
    if (n === 2) throw new Error('construction failed');
    return bind(Aff.delay(5))(() => pure(n));
  };
  await assert.rejects(run(withEmitter(2)(generate)(n => lift(() => published.push(n)))(enqueue =>
    sequence(inputs, enqueue))), /construction failed/);
  assert.deepEqual(published, [0, 1]);
});
