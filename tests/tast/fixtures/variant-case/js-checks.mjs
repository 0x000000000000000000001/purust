import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const p = await import(pathToFileURL(join(resolve(process.argv[2]), 'VariantProbe/index.js')).href);
const checks = [];
function check(name, run) { run(); checks.push(name); }
check('integer equality', () => {
  for (const [a, b] of [[-2147483648, -2147483648], [2147483647, 2147483647], [-1, 1], [0, 0]])
    assert.equal(p.equalInts(a)(b), a === b);
});
check('string equality', () => {
  for (const [a, b] of [['', ''], ['é🙂', 'é🙂'], ['a', 'b']]) assert.equal(p.equalStrings(a)(b), a === b);
});
check('mixed tags differ', () => assert.equal(p.differentTags(1)('1'), false));
check('integer ordering', () => {
  for (const [a, b, expected] of [[-1, 2, 'LT'], [3, -1, 'GT'], [0, 0, 'EQ']])
    assert.equal(p.compareInts(a)(b).constructor.name, expected);
});
check('string ordering', () => {
  for (const [a, b, expected] of [['a', 'b', 'LT'], ['b', 'a', 'GT'], ['é🙂', 'é🙂', 'EQ']])
    assert.equal(p.compareStrings(a)(b).constructor.name, expected);
});
check('tag ordering', () => assert.equal(p.compareDifferentTags(999)('0').constructor.name, 'LT'));
check('tag mismatch skips callbacks', () => {
  assert.equal(p.differentTagsWithoutCallbacks(1)('1'), false);
  assert.equal(p.orderedTagsWithoutCallbacks(1)('1').constructor.name, 'LT');
});
check('missing equality callback throws', () => assert.throws(() => p.missingEq(1)(1), /Data.Variant: impossible `eq`/));
check('missing ordering callback throws', () => assert.throws(() => p.missingOrd(1)(1), /Data.Variant: impossible `compare`/));
check('opaque carrier preserves identity', () => {
  for (const payload of [42, 'text', { nested: [1] }, [1, 2], x => x]) {
    const rep = p.rep('opaque')(payload); assert.equal(rep.type, 'opaque'); assert.equal(rep.value, payload);
  }
});
console.log(`JS: ${checks.length} contracts passed`);
