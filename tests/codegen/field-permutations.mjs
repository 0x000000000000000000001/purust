// A field-permutation proof must conserve every subtree and establish every
// constructor projection before a runtime uniqueness check can be emitted.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fieldPermutation, ScalarConstructor, ScalarPath }
  from '../../output/Purust.FieldPermutations/index.js';
import { permutationFunction } from '../../output/Purust.FieldPermutationPrinter/index.js';
import { Constant, If, IsTag } from '../../output/Purust.ChildBranches/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Boolean as BooleanType, Int, LitBoolean, LitInt, Qualified, SumType }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Accessor, App, Branch, CtorSaturated, GetCtorField, Let, Lit, Local, Op1, Op2,
  OpAdd, OpBooleanAnd, OpIntNum, OpIsTag, Pair, PrimOp, Typed, TypeApp, Var }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const moduleName = 'PermutationProof';
const modeType = new ADT('Mode', [moduleName, 'Mode'], []);
const treeType = new ADT('Tree', [moduleName, 'Tree'], []);
const q = name => new Qualified(new Just(moduleName), name);
const typed = (type, value) => new Typed(type, value);
const local = name => new Local(new Just(name), 0);
const isTag = (name, value) => new PrimOp(new Op1(new OpIsTag(q(name)), value));
const and = (left, right) => new PrimOp(new Op2(OpBooleanAnd.value, left, right));
const ctor = (name, typeName, fields = []) => new CtorSaturated(q(name), SumType.value,
  typeName, name, fields.map((value, index) => new Tuple(`value${index}`, value)));
const color = name => typed(modeType, ctor(name, 'Mode'));
const representation = type => {
  if (type === treeType) return 'std::rc::Rc<crate::Tree>';
  if (type === modeType) return 'crate::Mode';
  if (type === Int.value) return 'i64';
  if (type === BooleanType.value) return 'bool';
  if (type === Any.value) return 'crate::UnknownType';
  throw new Error(`Unexpected type ${type.constructor.name}`);
};
const copyScalar = type => [modeType, Int.value, BooleanType.value].includes(type);
const copyEnum = type => type === modeType;

function fixture({ order = ['mode', 'left', 'key', 'right'], mirrored = false,
  parameterOrder = order } = {}) {
  const kindType = kind => kind === 'mode' ? modeType : kind === 'key' ? Int.value
    : kind === 'flag' ? BooleanType.value : treeType;
  const fields = order.map(kindType);
  const params = parameterOrder.map(kind => `arg_${kind}`);
  const argTypes = parameterOrder.map(kindType);
  const fieldParams = order.map(kind => parameterOrder.indexOf(kind));
  const values = order.map((kind, index) => typed(fields[index], local(`arg_${kind}`)));
  const forward = order.indexOf(mirrored ? 'right' : 'left');
  const reverse = order.indexOf(mirrored ? 'left' : 'right');
  const mode = order.indexOf('mode');
  const key = order.indexOf('key');
  const metadata = new Map([
    ['Bin', { resultType: treeType, fields }], ['Empty', { resultType: treeType, fields: [] }],
    ['Hot', { resultType: modeType, fields: [] }], ['Cold', { resultType: modeType, fields: [] }],
  ]);
  const info = qualified => qualified.value0 instanceof Just
    && qualified.value0.value0 === moduleName && metadata.has(qualified.value1)
    ? new Just(metadata.get(qualified.value1)) : Nothing.value;
  const node = values => typed(treeType, ctor('Bin', 'Tree', values));
  const unchanged = node(values);
  const branch = (condition, yes, no = unchanged) => new Branch([new Pair(condition, yes)], no);
  const field = (base, index, type = fields[index], typeName = 'Tree', name = 'Bin') => typed(type,
    new Accessor(base, new GetCtorField(q('Bin'), SumType.value, typeName, name, `value${index}`, index)));
  const parent = values[forward];
  const grandchild = field(parent, forward);
  const output = (change = {}) => {
    const left = fields.map((_, index) => field(grandchild, index));
    const right = fields.map((_, index) => values[index]);
    const root = fields.map((_, index) => field(parent, index));
    left[mode] = color('Cold');
    right[mode] = color('Cold');
    right[forward] = field(parent, reverse);
    right[reverse] = values[reverse];
    root[mode] = color('Hot');
    change.mutate?.({ left, right, root });
    root[forward] = change.forward ?? node(left);
    root[reverse] = change.reverse ?? node(right);
    return node(root);
  };
  const wrap = value => branch(isTag('Cold', values[mode]),
    branch(isTag('Bin', parent), branch(isTag('Hot', field(parent, mode)),
      branch(isTag('Bin', grandchild), branch(isTag('Hot', field(grandchild, mode)), value)))));
  const prove = (body = wrap(output()), options = {}) => fieldPermutation(representation)
    (options.copyScalar ?? copyScalar)(copyEnum)(options.info ?? info)
    (options.params ?? params)(options.argTypes ?? argTypes)(treeType)(body);
  return { order, fields, params, argTypes, fieldParams, values, forward, reverse, mode, key,
    metadata, info, node, unchanged, branch, field, parent, grandchild, output, wrap, prove };
}

let assertions = 0;
function accepted(f, body = f.wrap(f.output())) {
  const result = f.prove(body);
  assert.ok(result instanceof Just, 'the guarded, linear reconstruction must be recognized');
  const plan = result.value0;
  assert.equal(plan.constructor.value1, 'Bin');
  assert.equal(plan.typeName, 'Tree');
  assert.deepEqual(plan.fields, f.fields);
  assert.deepEqual(plan.fieldParams, f.fieldParams);
  assert.equal(plan.forward, f.forward);
  assert.equal(plan.reverse, f.reverse);
  assert.equal(plan.writes.length, 3 * (f.fields.length - 2));
  const write = (level, index) => plan.writes.find(w => w.level === level && w.index === index).value;
  for (const level of [0, 1, 2]) {
    const modeWrite = write(level, f.mode);
    assert.ok(modeWrite instanceof ScalarConstructor);
    assert.equal(modeWrite.value0.value1, level === 0 ? 'Hot' : 'Cold');
  }
  // The root receives the former parent's key; its new reverse child uses
  // the former root's key; the forward child retains the grandchild's key.
  for (const [level, source] of [[0, 1], [1, 0], [2, 2]]) {
    const keyWrite = write(level, f.key);
    assert.ok(keyWrite instanceof ScalarPath);
    assert.deepEqual(keyWrite.value0, { level: source, index: f.key });
  }
  assertions++;
  return plan;
}
function rejected(f, body, reason, options) {
  assert.ok(f.prove(body, options) instanceof Nothing, reason);
  assertions++;
}

// Neither the constructor's field positions nor the function's parameter
// order encode the optimization. Both chain directions share the proof.
const layouts = [
  ['mode', 'left', 'key', 'right'],
  ['right', 'key', 'left', 'mode'],
  ['flag', 'right', 'mode', 'key', 'left'],
];
for (const order of layouts) for (const mirrored of [false, true]) {
  accepted(fixture({ order, mirrored }));
  accepted(fixture({ order, mirrored, parameterOrder: order.toReversed() }));
}

const f = fixture();
const good = f.wrap(f.output());
accepted(f, typed(treeType, new TypeApp(good, treeType)));
accepted(f, f.branch(new Lit(new LitBoolean(true)), good));
accepted(f, f.branch(and(isTag('Bin', f.parent), isTag('Bin', f.grandchild)), f.output()));

// A named alias preserves a dominated path, including the type annotation.
const saved = typed(treeType, local('saved'));
accepted(f, f.branch(isTag('Bin', f.parent), new Let(new Just('saved'), 7, f.grandchild,
  f.branch(isTag('Bin', saved), f.output({ mutate: ({ left }) => {
    left[f.key] = f.field(saved, f.key);
  } })))));
accepted(f, new Let(new Just('savedParent'), 8, f.parent,
  f.branch(isTag('Bin', typed(treeType, local('savedParent'))),
    f.branch(isTag('Bin', f.grandchild), f.output()))));

// Evaluate the plan's guard on all color/shape combinations. Every runtime
// path step must encounter the declared constructor before projection.
const value = (constructor, fields = []) => ({ constructor, fields });
const hot = value('Hot');
const cold = value('Cold');
const empty = value('Empty');
const tree = (mode, left = empty, right = empty) => value('Bin', [mode, left, 17, right]);
const shapes = [empty, tree(cold), tree(hot), tree(hot, tree(cold)), tree(hot, tree(hot))];
let nestedPath = false;
function evaluate(predicate, args) {
  if (predicate instanceof Constant) return predicate.value0;
  if (predicate instanceof If) return evaluate(predicate.value0, args)
    ? evaluate(predicate.value1, args) : evaluate(predicate.value2, args);
  assert.ok(predicate instanceof IsTag);
  const path = predicate.value0;
  nestedPath ||= path.steps.length > 1;
  let current = args[path.parameter];
  for (const step of path.steps) {
    assert.equal(current.constructor, step.constructor.value1, 'projection requires a dominating tag');
    assert.equal(current.fields.length, step.width);
    assert.equal(step.typeName, 'Tree');
    assert.equal(step.fieldType, f.fields[step.index]);
    current = current.fields[step.index];
  }
  return current.constructor === predicate.value1.value1;
}
const plan = accepted(f);
for (const mode of [hot, cold]) for (const left of shapes) for (const right of shapes) {
  assert.equal(evaluate(plan.predicate, [mode, left, 19, right]),
    mode === cold && left.constructor === 'Bin' && left.fields[0] === hot
      && left.fields[1].constructor === 'Bin' && left.fields[1].fields[0] === hot);
}
assert.ok(nestedPath, 'nested scalar tag paths are exercised');

// Duplicating one frontier loses another subtree, even if both are Trees.
rejected(f, f.wrap(f.output({ mutate: ({ left }) => {
  left[f.reverse] = left[f.forward];
} })), 'a duplicated/lost grandchild frontier is rejected');
rejected(f, f.wrap(f.output({ mutate: ({ right }) => {
  right[f.forward] = f.values[f.reverse];
} })), 'the sibling frontier cannot be duplicated');
rejected(f, f.wrap(f.output({ mutate: ({ left }) => {
  [left[f.forward], left[f.reverse]] = [left[f.reverse], left[f.forward]];
} })), 'arbitrary subtree permutations are outside the proven topology');
rejected(f, f.wrap(f.output({ forward: f.parent })), 'both result children must be reconstructed');
rejected(f, f.wrap(f.unchanged), 'an unchanged constructor is not a three-cell permutation');

// Representation conversions, opaque computations and changed metadata
// cannot be staged as Copy field reads or discarded by a shortcut.
rejected(f, typed(Any.value, good), 'a result conversion is not transparent');
rejected(f, f.wrap(f.output({ mutate: ({ left }) => {
  left[f.forward] = typed(Any.value, left[f.forward]);
} })), 'a subtree conversion is rejected');
rejected(f, f.wrap(f.output({ mutate: ({ root }) => {
  root[f.key] = typed(Any.value, root[f.key]);
} })), 'a scalar conversion is rejected');
const opaque = new App(new Var(q('opaque')), [f.values[f.key]]);
rejected(f, f.wrap(f.output({ mutate: ({ root }) => { root[f.key] = opaque; } })),
  'opaque scalar evaluation is not a field permutation');
rejected(f, f.wrap(f.output({ mutate: ({ root }) => {
  root[f.key] = new PrimOp(new Op2(new OpIntNum(OpAdd.value), root[f.key], new Lit(new LitInt(1))));
} })), 'computed scalar arithmetic is outside the bounded proof');
rejected(f, new Let(new Just('ignored'), 9, opaque, good), 'an unused opaque binding still executes');
rejected(f, f.branch(opaque, good, good), 'an earlier unknown guard must execute');
rejected(f, new Branch([new Pair(opaque, f.unchanged),
  new Pair(isTag('Bin', f.parent), good)], f.unchanged), 'a later known arm cannot bypass an unknown guard');
rejected(f, f.branch(new Lit(new LitBoolean(false)), good), 'the first false arm is outside this bounded proof');
rejected(f, f.branch(isTag('Hot', f.field(f.parent, f.mode)), good),
  'a tag of a projected field needs the parent tag first');
rejected(f, f.branch(and(isTag('Bin', f.grandchild), isTag('Bin', f.parent)), f.output()),
  'conjunction order cannot project an untested parent');
rejected(f, f.branch(isTag('Bin', f.parent), f.output()), 'the grandchild constructor must also be known');
rejected(f, f.branch(isTag('Bin', typed(Any.value, f.parent)), good),
  'converted receiver does not establish a usable tag');
rejected(f, f.wrap(f.output({ mutate: ({ left }) => {
  left[f.key] = f.field(f.grandchild, f.key, Int.value, 'WrongTree');
} })), 'accessor metadata must name the declared type');
rejected(f, f.wrap(f.output({ mutate: ({ left }) => {
  left[f.key] = f.field(f.grandchild, 99, Int.value);
} })), 'out-of-bounds field metadata is rejected');
rejected(f, f.wrap(f.output({ mutate: ({ left }) => {
  left[f.key] = f.field(f.grandchild, f.key, Int.value, 'Tree', 'WrongCtor');
} })), 'accessor constructor names must agree');
rejected(f, good, 'constructor layout is required', { info: () => Nothing.value });
rejected(f, good, 'every nonrecursive field must be Copy', { copyScalar: type => type === modeType });
rejected(f, good, 'duplicate parameters cannot identify distinct fields', { params: f.params.map(() => 'same') });
rejected(f, good, 'parameter and type counts must agree', { argTypes: f.argTypes.slice(1) });
const malformed = fields => qualified => qualified.value1 === 'Bin'
  ? new Just({ resultType: treeType, fields }) : f.info(qualified);
rejected(f, good, 'constructor arity cannot change', { info: malformed(f.fields.slice(1)) });
rejected(f, good, 'exactly two recursive fields are required', {
  info: malformed([modeType, treeType, treeType, treeType]),
});
rejected(f, good, 'Copy enum constructors cannot hide payloads', {
  info: qualified => qualified.value1 === 'Hot'
    ? new Just({ resultType: modeType, fields: [treeType] }) : f.info(qualified),
});

// A sibling constructor can have the same ADT and tuple positions without
// being one of the three retained cells described by this plan.
const alternative = (base, index) => typed(f.fields[index], new Accessor(base,
  new GetCtorField(q('Other'), SumType.value, 'Tree', 'Other', `value${index}`, index)));
const alternateGrandchild = alternative(f.parent, f.forward);
const alternateRoot = f.fields.map((_, index) => alternative(f.parent, index));
const alternateLeft = f.fields.map((_, index) => f.field(alternateGrandchild, index));
const alternateRight = [...f.values];
alternateLeft[f.mode] = color('Cold');
alternateRight[f.mode] = color('Cold');
alternateRight[f.forward] = alternative(f.parent, f.reverse);
alternateRoot[f.mode] = color('Hot');
alternateRoot[f.forward] = f.node(alternateLeft);
alternateRoot[f.reverse] = f.node(alternateRight);
rejected(f, f.branch(isTag('Other', f.parent),
  f.branch(isTag('Bin', alternateGrandchild), f.node(alternateRoot))),
'a same-typed alternative constructor is not the retained output constructor', {
  info: qualified => qualified.value1 === 'Other'
    ? new Just({ resultType: treeType, fields: f.fields }) : f.info(qualified),
});

// Compile the printer's real output in both pointer modes. This catches
// borrow conflicts and argument/layout mistakes that AST assertions cannot.
function nativeCase(order, mirrored, caseIndex) {
  const current = fixture({ order, mirrored, parameterOrder: order.toReversed() });
  const proof = accepted(current);
  const module = `case_${caseIndex}`;
  const repr = type => type === treeType ? `std::rc::Rc<crate::${module}::Tree>`
    : type === modeType ? `crate::${module}::Mode` : representation(type);
  const generated = permutationFunction(repr)(name => name)(current.info)(current.argTypes)('rotate')(proof);
  assert.ok(generated instanceof Just);
  const indices = order.map((_, index) => index);
  const pattern = prefix => `Tree::Bin(${indices.map(index => `${prefix}${index}`).join(', ')})`;
  const children = new Set([current.forward, current.reverse]);
  const create = (mode, forward, key, reverse, flag) => `Rc::new(Tree::Bin(${order.map((kind, index) =>
    index === current.forward ? forward : index === current.reverse ? reverse
      : kind === 'mode' ? `Mode::${mode}` : kind === 'key' ? String(key) : String(flag)).join(', ')}))`;
  const nativeFields = order.map((kind, index) => children.has(index) ? 'Rc<Tree>'
    : kind === 'mode' ? 'Mode' : kind === 'key' ? 'i64' : 'bool').join(', ');
  const flag = order.indexOf('flag');
  return `mod ${module} {
    use std::rc::{Rc, Weak};
    #[derive(Clone, Copy, Debug, PartialEq)] pub enum Mode { Hot, Cold }
    #[derive(Debug)] pub enum Tree { Empty, Bin(${nativeFields}) }
    ${generated.value0}
    fn apply(root: &mut Rc<Tree>) -> bool { Rc::get_mut(root).map(rotate).unwrap_or(false) }
    pub fn run() {
      for sharing in 0..7 {
        let a = Rc::new(Tree::Empty); let b = Rc::new(Tree::Empty);
        let c = Rc::new(Tree::Empty); let d = Rc::new(Tree::Empty);
        let frontiers = [Rc::as_ptr(&a), Rc::as_ptr(&b), Rc::as_ptr(&c), Rc::as_ptr(&d)];
        let child = ${create('Hot', 'a', 11, 'b', true)};
        let child_address = Rc::as_ptr(&child);
        let held_child = if sharing == 3 { Some(child.clone()) } else { None };
        let weak_child = if sharing == 4 { Rc::downgrade(&child) } else { Weak::new() };
        let parent = ${create('Hot', 'child', 22, 'c', false)};
        let parent_address = Rc::as_ptr(&parent);
        let held_parent = if sharing == 1 { Some(parent.clone()) } else { None };
        let weak_parent = if sharing == 2 { Rc::downgrade(&parent) } else { Weak::new() };
        let mut root = ${create('Cold', 'parent', 33, 'd', true)};
        let root_address = Rc::as_ptr(&root);
        let held_root = if sharing == 5 { Some(root.clone()) } else { None };
        let weak_root = if sharing == 6 { Rc::downgrade(&root) } else { Weak::new() };
        let before = format!("{:?}", root);
        assert_eq!(apply(&mut root), sharing == 0);
        assert_eq!(Rc::as_ptr(&root), root_address);
        if sharing == 0 {
          let ${pattern('r')} = root.as_ref() else { panic!("root") };
          assert_eq!(*r${current.mode}, Mode::Hot); assert_eq!(*r${current.key}, 22);
          assert_eq!(Rc::as_ptr(r${current.forward}), child_address);
          assert_eq!(Rc::as_ptr(r${current.reverse}), parent_address);
          let ${pattern('l')} = r${current.forward}.as_ref() else { panic!("left") };
          let ${pattern('p')} = r${current.reverse}.as_ref() else { panic!("right") };
          assert_eq!((*l${current.key}, *p${current.key}), (11, 33));
          assert_eq!((*l${current.mode}, *p${current.mode}), (Mode::Cold, Mode::Cold));
          assert_eq!([Rc::as_ptr(l${current.forward}), Rc::as_ptr(l${current.reverse}),
            Rc::as_ptr(p${current.forward}), Rc::as_ptr(p${current.reverse})], frontiers);
          ${flag >= 0 ? `assert_eq!((*r${flag}, *l${flag}, *p${flag}), (false, true, true));` : ''}
          assert!(!apply(&mut root), "the rotated shape no longer matches the first arm");
        } else { assert_eq!(format!("{:?}", root), before, "refusal must not mutate"); }
        drop(root); drop(held_root); drop(held_parent); drop(held_child);
        assert!(weak_root.upgrade().is_none());
        assert!(weak_parent.upgrade().is_none());
        assert!(weak_child.upgrade().is_none());
      }
    }
  }`;
}
const nativeCases = layouts.flatMap(order => [false, true].map(mirrored => ({ order, mirrored })));
const rust = '#![allow(dead_code, unused_variables, unused_parens, non_snake_case)]\n'
  + nativeCases.map(({ order, mirrored }, index) => nativeCase(order, mirrored, index)).join('\n')
  + `\nfn main() { ${nativeCases.map((_, index) => `case_${index}::run();`).join(' ')} }\n`;
const directory = mkdtempSync(join(tmpdir(), 'purust-field-permutations-'));
try {
  for (const mode of ['rc', 'arc']) {
    const source = join(directory, `${mode}.rs`);
    const executable = join(directory, mode);
    // This is the same final textual pointer substitution as --threaded.
    writeFileSync(source, mode === 'rc' ? rust
      : rust.replaceAll('std::rc::', 'std::sync::').replaceAll(/\bRc\b/g, 'Arc'));
    for (const [command, args] of [['rustc', ['--edition=2021', '-Dwarnings', source, '-o', executable]],
      [executable, []]]) {
      const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log(`Field permutations: ${assertions} accepted/rejected proofs, six layouts/directions executed under Rc and Arc with unique/shared/weak cells, staged scalars and preserved frontiers.`);
