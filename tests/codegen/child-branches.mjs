// Constructor shortcuts may inspect nested fields only behind their tag
// guards. Evaluate the proof on real shapes and fail on any unsafe projection.
import assert from 'node:assert/strict';
import { constructorPredicate, Constant, IsTag, If } from '../../output/Purust.ChildBranches/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Boolean as BooleanType, Int, LitBoolean, LitInt, Qualified, SumType }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Accessor, App, Branch, CtorSaturated, EffectPure, GetCtorField, Let, Lit, Local,
  Op1, Op2, OpAdd, OpBooleanAnd, OpBooleanNot, OpBooleanOr, OpIntNum, OpIsTag, Pair,
  PrimOp, Typed, TypeApp, Var }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const moduleName = 'BranchProof';
const modeType = new ADT('Mode', [moduleName, 'Mode'], []);
const treeType = new ADT('Tree', [moduleName, 'Tree'], []);
const params = ['mode', 'left', 'key', 'right'];
const types = [modeType, treeType, Int.value, treeType];
const q = name => new Qualified(new Just(moduleName), name);
const local = name => new Local(new Just(name), 0);
const typed = (type, expr) => new Typed(type, expr);
const values = params.map((name, index) => typed(types[index], local(name)));
const node = fields => new CtorSaturated(q('Bin'), SumType.value, 'Tree', 'Bin',
  fields.map((value, index) => new Tuple(`value${index}`, value)));
const unchanged = node(values);
const reordered = node([values[0], values[3], values[2], values[1]]);
const isTag = (name, value) => new PrimOp(new Op1(new OpIsTag(q(name)), value));
const not = condition => new PrimOp(new Op1(OpBooleanNot.value, condition));
const and = (left, right) => new PrimOp(new Op2(OpBooleanAnd.value, left, right));
const or = (left, right) => new PrimOp(new Op2(OpBooleanOr.value, left, right));
const branch = (condition, yes, no = unchanged) => new Branch([new Pair(condition, yes)], no);
const field = (base, index, type = types[index], typeName = 'Tree') => typed(type,
  new Accessor(base, new GetCtorField(q('Bin'), SumType.value, typeName, 'Bin', `value${index}`, index)));
const representation = type => {
  if (type === modeType) return 'crate::Mode';
  if (type === treeType) return 'std::rc::Rc<crate::Tree>';
  if (type === Int.value) return 'i64';
  if (type === BooleanType.value) return 'bool';
  if (type === Any.value) return 'crate::UnknownType';
  throw new Error(`Unexpected type ${type.constructor.name}`);
};
const metadata = new Map([
  ['Hot', { resultType: modeType, fields: [] }],
  ['Cold', { resultType: modeType, fields: [] }],
  ['Void', { resultType: treeType, fields: [] }],
  ['Bin', { resultType: treeType, fields: types }],
]);
const constructorInfo = qualified => qualified.value0 instanceof Just
  && qualified.value0.value0 === moduleName && metadata.has(qualified.value1)
  ? new Just(metadata.get(qualified.value1)) : Nothing.value;
const prove = (body, info = constructorInfo) => constructorPredicate(representation)(type => type === modeType)
  (info)(params)(types)(treeType)(body);
const requireProof = body => {
  const proof = prove(body);
  assert.ok(proof instanceof Just, 'the constructor-only default supplies a target');
  return proof.value0;
};

const value = (constructor, fields = []) => ({ constructor, fields });
const hot = value('Hot');
const cold = value('Cold');
const voidTree = value('Void');
const bin = (mode, left = voidTree, right = voidTree) => value('Bin', [mode, left, 11, right]);
const shapes = [voidTree, bin(cold), bin(hot), bin(hot, bin(cold)), bin(hot, bin(hot)),
  bin(cold, bin(hot)), bin(hot, voidTree, bin(hot))];
const inputs = [hot, cold].flatMap(mode => shapes.flatMap(left => shapes.map(right => [mode, left, 17, right])));
const tagPaths = [];
function evaluate(predicate, args) {
  if (predicate instanceof Constant) return predicate.value0;
  if (predicate instanceof If) return evaluate(predicate.value0, args)
    ? evaluate(predicate.value1, args) : evaluate(predicate.value2, args);
  assert.ok(predicate instanceof IsTag);
  const path = predicate.value0;
  tagPaths.push(path);
  let current = args[path.parameter];
  for (const step of path.steps) {
    assert.equal(current.constructor, step.constructor.value1, 'a matching tag must dominate every projection');
    assert.equal(current.fields.length, step.width, 'the field width comes from the constructor layout');
    assert.ok(step.index >= 0 && step.index < step.width);
    assert.equal(step.typeName, 'Tree');
    assert.equal(step.fieldType, types[step.index]);
    current = current.fields[step.index];
  }
  return current.constructor === predicate.value1.value1;
}
const expect = (body, predicate) => {
  const proof = requireProof(body);
  assert.deepEqual(proof.fieldParams, [0, 1, 2, 3]);
  for (const args of inputs) assert.equal(evaluate(proof.predicate, args), predicate(args));
  return proof;
};

const leftColor = field(values[1], 0);
const leftLeft = field(values[1], 1);
const leftLeftColor = field(leftLeft, 0);
const rotation = branch(isTag('Hot', values[0]),
  branch(isTag('Bin', values[1]),
    branch(isTag('Hot', leftColor),
      branch(isTag('Bin', leftLeft), branch(isTag('Hot', leftLeftColor), reordered)))));
expect(typed(treeType, new TypeApp(rotation, treeType)), ([mode, left]) =>
  !(mode === hot && left.constructor === 'Bin' && left.fields[0] === hot
    && left.fields[1].constructor === 'Bin' && left.fields[1].fields[0] === hot));
assert.ok(tagPaths.some(path => path.steps.length === 2), 'the proof exercises nested borrowed projections');

// Aliases of guarded projections preserve their path identity and type.
expect(branch(isTag('Bin', values[1]),
  new Let(new Just('savedColor'), 4, leftColor,
    branch(isTag('Hot', typed(modeType, local('savedColor'))), reordered))),
([, left]) => !(left.constructor === 'Bin' && left.fields[0] === hot));
expect(new Let(new Just('savedMode'), 4, values[0],
  branch(isTag('Hot', local('savedMode')), reordered)), ([mode]) => mode !== hot);

// && establishes the left tag before accessing its fields on the right.
expect(branch(and(isTag('Bin', values[1]), isTag('Hot', leftColor)), reordered),
  ([, left]) => !(left.constructor === 'Bin' && left.fields[0] === hot));
// !Bin || field-test evaluates the field only in the false arm of !Bin.
expect(branch(or(not(isTag('Bin', values[1])), isTag('Hot', leftColor)), reordered),
  ([, left]) => left.constructor === 'Bin' && left.fields[0] !== hot);
expect(branch(not(isTag('Bin', values[1])), reordered,
  branch(isTag('Hot', leftColor), reordered)), ([, left]) => left.constructor === 'Bin' && left.fields[0] !== hot);

// Reversing those tests would project before checking the constructor. A
// conservative false result is required even for inputs on which it works.
expect(branch(and(isTag('Hot', leftColor), isTag('Bin', values[1])), reordered), () => false);
expect(branch(isTag('Hot', leftColor), reordered), () => false);

// Unknown work is never silently dropped, even when both results happen to
// be the same constructor. A guarded unknown arm retains the helper there.
const opaque = new App(new Var(q('opaque')), [values[0]]);
expect(branch(opaque, unchanged), () => false);
expect(branch(isTag('Hot', values[0]), new EffectPure(unchanged)), ([mode]) => mode !== hot);
expect(branch(isTag('Hot', values[0]),
  new Let(new Just('ignored'), 4, opaque, unchanged)), ([mode]) => mode !== hot);
const changedKey = node([values[0], values[1], new PrimOp(new Op2(new OpIntNum(OpAdd.value),
  values[2], new Lit(new LitInt(1)))), values[3]]);
expect(branch(isTag('Hot', values[0]), changedKey), ([mode]) => mode !== hot);

// Ordered alternatives preserve reachability. A rejected later condition
// must not disable a constructor-only earlier arm which bypasses it.
expect(new Branch([
  new Pair(isTag('Hot', values[0]), unchanged), new Pair(opaque, unchanged),
], unchanged), ([mode]) => mode === hot);
expect(branch(new Lit(new LitBoolean(true)), reordered), () => false);
expect(branch(new Lit(new LitBoolean(false)), reordered), () => true);

// Representation changes and malformed field metadata cannot create facts.
expect(branch(isTag('Bin', typed(Any.value, values[1])), reordered), () => false);
expect(branch(isTag('Bin', values[1]),
  branch(isTag('Hot', field(values[1], 0, Any.value)), reordered)),
([, left]) => left.constructor !== 'Bin');
expect(branch(isTag('Bin', values[1]),
  branch(isTag('Hot', field(values[1], 0, modeType, 'WrongType')), reordered)),
([, left]) => left.constructor !== 'Bin');
expect(branch(isTag('Bin', values[1]),
  branch(isTag('Hot', field(values[1], 9, modeType)), reordered)),
([, left]) => left.constructor !== 'Bin');
assert.ok(prove(typed(Any.value, unchanged)) instanceof Nothing);
assert.ok(prove(node([values[0], values[1], values[2], values[1]])) instanceof Nothing,
  'a duplicate/default parameter does not establish a consumed constructor');
assert.ok(prove(node([values[0], typed(Any.value, values[1]), values[2], values[3]])) instanceof Nothing);
assert.ok(prove(unchanged, () => Nothing.value) instanceof Nothing, 'constructor metadata is mandatory');

const badModeInfo = qualified => qualified.value1 === 'Hot'
  ? new Just({ resultType: modeType, fields: [treeType] }) : constructorInfo(qualified);
const malformed = prove(branch(isTag('Hot', values[0]), reordered), badModeInfo);
assert.ok(malformed instanceof Just);
for (const args of inputs) assert.equal(evaluate(malformed.value0.predicate, args), false,
  'a Copy enum cannot secretly have payload fields');

console.log('Constructor branches: ordered paths, dominating tags, aliases, short-circuiting, layouts and opaque boundaries checked.');
