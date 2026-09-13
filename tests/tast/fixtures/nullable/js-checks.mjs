import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const tast = resolve(process.argv[2]);
const foreign = await import(pathToFileURL(join(tast, 'Data.Nullable/foreign.js')));
const checks = [];
function check(name, body) { body(); checks.push(name); }
check('null and undefined select the default without calling the callback', () => {
  const fallback = {}; let calls = 0;
  for (const value of [foreign.null, undefined]) assert.equal(foreign.nullable(value, fallback, () => { calls++; }), fallback);
  assert.equal(calls, 0);
});
check('notNull preserves falsy values, references and callback results', () => {
  for (const value of [0, false, '', [], {}, x => x, NaN]) {
    assert.equal(foreign.notNull(value), value); let calls = 0; const result = {};
    assert.equal(foreign.nullable(value, null, x => { calls++; assert.equal(x, value); return result; }), result);
    assert.equal(calls, 1);
  }
});
check('nested null collapses, nested present preserves the payload', () => {
  assert.equal(foreign.notNull(foreign.null), foreign.null);
  assert.equal(foreign.notNull(foreign.notNull(7)), 7);
});
check('callback exceptions propagate unchanged', () => {
  const error = new Error('nullable callback');
  assert.throws(() => foreign.nullable(7, 0, () => { throw error; }), e => e === error);
});
{
  const probe = await import(pathToFileURL(join(tast, 'NullableProbe/index.js')));
  const maybe = await import(pathToFileURL(join(tast, 'Data.Maybe/index.js')));
  check('fresh JS Maybe round trips and scalar conversions', () => {
    assert.ok(probe.roundTrip(maybe.Nothing.value) instanceof maybe.Nothing);
    assert.equal(probe.roundTrip(new maybe.Just(7)).value0, 7);
    assert.equal(probe.decodeInt(41)(probe.missing), 41);
    assert.equal(probe.decodeInt(41)(probe.intValue(0)), 0);
  });
  check('fresh JS nested Nullable and Just null collapse', () => {
    assert.equal(probe.decodeNested(41)(probe.nest(probe.missing)), 41);
    assert.equal(probe.decodeNested(41)(probe.nest(probe.intValue(7))), 7);
    assert.ok(probe.roundTripNested(new maybe.Just(probe.missing)) instanceof maybe.Nothing);
    assert.equal(probe.decodeInt(41)(probe.roundTripNested(new maybe.Just(probe.intValue(7))).value0), 7);
  });
  check('fresh JS Eq Ord Show instances', () => {
    assert.equal(probe.eqInt(probe.missing)(probe.intValue(7)), false);
    assert.equal(probe.eqInt(probe.intValue(7))(probe.intValue(7)), true);
    assert.equal(probe.compareInt(probe.missing)(probe.intValue(7)).constructor.name, 'LT');
    assert.equal(probe.showInt(probe.missing), 'null'); assert.equal(probe.showInt(probe.intValue(7)), '7');
  });
  check('fresh JS callbacks retain captures and records retain the original', () => {
    let calls = 0; const f = probe.functionValue(x => { calls++; return x + 7; });
    assert.equal(calls, 0); assert.equal(probe.callFunction(f)(2), 9); assert.equal(probe.callFunction(f)(3), 10); assert.equal(calls, 2);
    const original = { value: 7 }, wrapped = probe.recordValue(original);
    assert.equal(wrapped, original); assert.equal(probe.replaceRecord(wrapped)(19).value, 19); assert.equal(probe.readRecord(wrapped), 7);
  });
}
assert.equal(checks.length, 8);
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
