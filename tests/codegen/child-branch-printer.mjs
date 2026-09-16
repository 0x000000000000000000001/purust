// Execute the compact printer on real enums. Ordered conditions must protect
// every projection, and borrowed names/facts must remain local to their arm.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { predicateFunction } from '../../output/Purust.ChildBranchPrinter/index.js';
import { Constant, If, IsTag } from '../../output/Purust.ChildBranches/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { ADT, Int, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';

const mode = new ADT('Mode', ['GuardPrinter', 'Mode'], []);
const tree = new ADT('Tree', ['GuardPrinter', 'Tree'], []);
const types = [mode, tree, Int.value, tree];
const q = name => new Qualified(new Just('GuardPrinter'), name);
const repr = type => type === mode ? 'crate::Mode' : type === tree
  ? 'std::rc::Rc<crate::Tree>' : type === Int.value ? 'i64' : 'crate::Invalid';
const metadata = new Map([
  ['Hot', { resultType: mode, fields: [] }], ['Cold', { resultType: mode, fields: [] }],
  ['Empty', { resultType: tree, fields: [] }], ['Bin', { resultType: tree, fields: types }],
]);
const info = qualified => qualified.value0 instanceof Just && qualified.value0.value0 === 'GuardPrinter'
  && metadata.has(qualified.value1) ? new Just(metadata.get(qualified.value1)) : Nothing.value;
const root = parameter => ({ parameter, steps: [], finalType: types[parameter] });
const child = (path, index) => ({ parameter: path.parameter,
  steps: [...path.steps, { constructor: q('Bin'), typeName: 'Tree', index, width: 4, fieldType: types[index] }],
  finalType: types[index] });
const tag = (path, name) => new IsTag(path, q(name));
const yes = new Constant(true), no = new Constant(false);
const and = (a, b) => new If(a, b, no);
const or = (a, b) => new If(a, yes, b);
const not = a => new If(a, no, yes);
const l = root(1), r = root(3), ll = child(l, 1), lr = child(l, 3);
const hot = path => and(tag(path, 'Bin'), tag(child(path, 0), 'Hot'));
const cases = [
  and(hot(l), hot(ll)),
  // A nested condition creates a field binding needed only by the yes arm.
  new If(hot(l), or(hot(ll), hot(lr)), hot(r)),
  // Equal-typed fields and parameters are distinct paths.
  or(hot(l), hot(r)),
  and(tag(l, 'Bin'), or(hot(ll), hot(lr))),
  // A negative fact must not suppress a different constructor's test.
  new If(tag(l, 'Empty'), no, and(tag(l, 'Bin'), tag(child(l, 0), 'Cold'))),
  // A false parent test must bypass all nested projections.
  or(not(tag(l, 'Bin')), tag(child(l, 0), 'Hot')),
  // Repeated tests in both continuations simplify with branch-local facts.
  new If(tag(l, 'Bin'), and(tag(l, 'Bin'), hot(ll)), not(tag(l, 'Bin'))),
  new If(tag(root(0), 'Hot'), tag(root(0), 'Cold'), tag(root(0), 'Cold')),
  yes, no,
  // This repeated continuation requires the left parent's borrowed fields.
  // It cannot be emitted at function scope even though its body is identical.
  and(tag(l, 'Bin'), new If(tag(root(0), 'Hot'),
    or(tag(child(l, 0), 'Hot'), hot(ll)), hot(ll))),
];
const value = (name, fields = []) => ({ name, fields });
const empty = value('Empty');
const node = (color, left = empty, right = empty) => value('Bin', [value(color), left, 19, right]);
const shapes = [empty, node('Cold'), node('Hot'), node('Hot', node('Cold')),
  node('Hot', node('Hot')), node('Cold', node('Hot')), node('Hot', empty, node('Hot'))];
const inputs = ['Hot', 'Cold'].flatMap(color => shapes.flatMap(left =>
  shapes.map(right => [value(color), left, 23, right])));
function evaluate(predicate, args) {
  if (predicate instanceof Constant) return predicate.value0;
  if (predicate instanceof If) return evaluate(predicate.value0, args)
    ? evaluate(predicate.value1, args) : evaluate(predicate.value2, args);
  let current = args[predicate.value0.parameter];
  for (const step of predicate.value0.steps) {
    assert.equal(current.name, step.constructor.value1, 'reference evaluation protects each projection');
    current = current.fields[step.index];
  }
  return current.name === predicate.value1.value1;
}
const native = value => typeof value === 'number' ? String(value)
  : ['Hot', 'Cold'].includes(value.name) ? `Mode::${value.name}`
    : value.name === 'Empty' ? 'Rc::new(Tree::Empty)'
      : `Rc::new(Tree::Bin(${value.fields.map(native).join(', ')}))`;
const print = (predicate, name, args = types, layout = info) => predicateFunction(repr)(x => x)(layout)(args)(name)(predicate);
const generated = cases.map((predicate, index) => {
  const result = print(predicate, `guard_${index}`);
  assert.ok(result instanceof Just);
  assert.ok(!result.value0.includes('unreachable!()'), 'compact paths use scoped borrowed bindings');
  return result.value0;
});
// Current-module and unqualified constructor names can denote one native
// variant. A positive fact must not classify those aliases as disjoint.
const aliasInfo = qualified => qualified.value0 instanceof Nothing
  ? info(q(qualified.value1)) : info(qualified);
const aliasTag = new IsTag(root(0), new Qualified(Nothing.value, 'Hot'));
const aliasPredicate = and(aliasTag, tag(root(0), 'Hot'));
const aliasGenerated = print(aliasPredicate, 'alias_guard', types, aliasInfo);
assert.ok(aliasGenerated instanceof Just);
assert.ok(generated[1].includes('_purust_guard_bound_'));
assert.ok(generated[1].includes("'_purust_guard_tail:"), 'an independent repeated suffix is shared');
assert.ok(!generated.at(-1).includes("'_purust_guard_tail:"), 'a suffix needing a local binding stays scoped');
assert.ok(print(tag({ ...ll, steps: [{ ...ll.steps[0], width: 3 }] }, 'Bin'), 'invalid') instanceof Nothing,
  'full layout validation still rejects a malformed path');
assert.ok(print(new If(tag(l, 'Bin'), yes, yes), 'invalid', types, () => Nothing.value) instanceof Nothing,
  'simplification does not bypass validation of a redundant test');

// More independent decisions than the bounded compiler accepts use the
// original short-circuit printer, without truncation or a depth-only budget.
const largeTypes = Array(130).fill(mode);
const large = largeTypes.reduceRight((rest, _, parameter) => new If(
  tag({ parameter, steps: [], finalType: mode }, 'Hot'), no, rest), yes);
const fallback = print(large, 'large', largeTypes);
assert.ok(fallback instanceof Just);
assert.ok(fallback.value0.includes('matches!('), 'over-budget predicates use the legacy emitter');
assert.ok(!fallback.value0.includes('_purust_guard_bound_'));
const largeCall = hotIndex => `large(${largeTypes.map((_, index) => `&Mode::${index === hotIndex ? 'Hot' : 'Cold'}`).join(', ')})`;
// A shallow parity tree exceeds the total-node limit while its depth is eight.
const parityTypes = Array(8).fill(mode);
const parity = parameter => parameter === parityTypes.length ? no : new If(
  tag({ parameter, steps: [], finalType: mode }, 'Hot'), not(parity(parameter + 1)), parity(parameter + 1));
const parityGenerated = print(parity(0), 'parity', parityTypes);
assert.ok(parityGenerated instanceof Just);
assert.ok(parityGenerated.value0.includes('matches!('));
assert.ok(!parityGenerated.value0.includes('_purust_guard_bound_'), 'the budget bounds total nodes, not depth');
const parityCall = count => `parity(${parityTypes.map((_, index) => `&Mode::${index < count ? 'Hot' : 'Cold'}`).join(', ')})`;
const rust = `#![allow(dead_code, unused_variables, unused_parens)]
use std::rc::Rc;
#[derive(Clone, Copy)] pub enum Mode { Hot, Cold }
pub enum Tree { Empty, Bin(Mode, Rc<Tree>, i64, Rc<Tree>) }
${generated.join('\n')}
${aliasGenerated.value0}
${fallback.value0}
${parityGenerated.value0}
fn main() {
assert!(alias_guard(&Mode::Hot, &Rc::new(Tree::Empty), &0, &Rc::new(Tree::Empty)));
assert!(!alias_guard(&Mode::Cold, &Rc::new(Tree::Empty), &0, &Rc::new(Tree::Empty)));
${inputs.flatMap(args => cases.map((predicate, index) =>
  `assert_eq!(guard_${index}(${args.map(v => `&${native(v)}`).join(', ')}), ${evaluate(predicate, args)});`)).join('\n')}
assert!(${largeCall(-1)}); assert!(!${largeCall(0)}); assert!(!${largeCall(129)});
assert!(!${parityCall(0)}); assert!(${parityCall(1)}); assert!(!${parityCall(2)});
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-child-branch-printer-'));
try {
  for (const pointer of ['rc', 'arc']) {
    const source = join(directory, `${pointer}.rs`), executable = join(directory, pointer);
    writeFileSync(source, pointer === 'rc' ? rust
      : rust.replaceAll('std::rc::', 'std::sync::').replaceAll(/\bRc\b/g, 'Arc'));
    for (const [command, args] of [['rustc', ['--edition=2021', '-Dwarnings', source, '-o', executable]], [executable, []]]) {
      const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    }
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log(`Child branch printer: ${inputs.length * cases.length} ordered decisions checked under Rc and Arc; bounded fallback and malformed metadata checked.`);
