// Exercise the proof boundaries before any Rust emitter is involved. A
// shortcut must not guess through conversions, effects or hidden callbacks.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { constructorCases, closedFunctions } from '../../output/Purust.ChildCalls/index.js';
import { childUpdate } from '../../output/Purust.ChildUpdates/index.js';
import { codegenModuleWithValueEnums, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { valueEnumsForModule } from '../../output/Purust.DataLayout/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { member, empty as emptySet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Boolean as BooleanType, Func, Int, LitInt, Qualified, SumType }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, CtorSaturated, EffectPure, Fail, GetCtorField, Let, Lit, Local,
  Op1, Op2, OpEq, OpIntOrd, OpIsTag, Pair, PrimOp, Typed, TypeApp, Var }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const moduleName = 'ChildEligibility';
const flagType = new ADT('Flag', [moduleName, 'Flag'], []);
const treeType = new ADT('Tree', [moduleName, 'Tree'], []);
const types = [flagType, treeType, Int.value, treeType];
const params = ['flag', 'left', 'key', 'right'];
const qualified = name => new Qualified(new Just(moduleName), name);
const local = name => new Local(new Just(name), 0);
const typed = (type, value) => new Typed(type, value);
const integer = n => new Lit(new LitInt(n));
const node = values => new CtorSaturated(qualified('Node'), SumType.value,
  'Tree', 'Node', values.map((value, index) => new Tuple(`value${index}`, value)));
const call = (name, args) => new App(new Var(qualified(name)), args);
const typeRepresentation = type => {
  if (type instanceof ADT) return type.value0 === 'Flag' ? 'crate::Flag' : 'std::rc::Rc<crate::Tree>';
  if (type === Int.value) return 'i64';
  if (type === BooleanType.value) return 'bool';
  if (type === Any.value) return 'crate::UnknownType';
  if (type instanceof Func) return 'function';
  throw new Error(`Unexpected type: ${type.constructor.name}`);
};
const copyEnum = type => type === flagType;
const copyScalar = type => copyEnum(type) || type === Int.value;
const cases = body => constructorCases(typeRepresentation)(copyEnum)(params)(types)(treeType)(body);
const isFrozen = value => new PrimOp(new Op1(new OpIsTag(qualified('Frozen')), value));
const otherwise = (body, tested = typed(flagType, local('flag'))) => new Branch([
  new Pair(isFrozen(tested), new Fail('unrelated branch')),
], body);
const values = params.map((name, index) => typed(types[index], local(name)));

// Renamed aliases can be introduced in an arbitrary evaluation order while
// the final constructor still consumes every original parameter once.
const aliased = new Let(new Just('savedRight'), 4, values[3],
  new Let(new Just('savedFlag'), 5, values[0],
    new Let(new Just('savedLeft'), 6, values[1],
      otherwise(node([local('savedFlag'), local('savedLeft'), values[2], local('savedRight')]),
        typed(flagType, local('savedFlag'))))));
const [identityCase] = cases(typed(treeType, aliased));
assert.ok(identityCase, 'pure aliases preserve the constructor proof');
assert.deepEqual(identityCase.fieldParams, [0, 1, 2, 3]);
assert.equal(identityCase.guards.length, 1);
assert.equal(identityCase.guards[0].parameter, 0);
assert.equal(identityCase.guards[0].matches, false);
assert.equal(cases(node([values[0], values[1], values[2], values[1]])).length, 0,
  'duplicating a parameter cannot prove ownership transfer');
assert.equal(cases(node(values.slice(0, 3))).length, 0, 'all helper arguments must be returned');
assert.equal(cases(typed(Any.value, node(values))).length, 0, 'result conversion is a proof boundary');
assert.equal(cases(new Let(new Just('savedLeft'), 4, typed(Any.value, values[1]),
  node([values[0], local('savedLeft'), values[2], values[3]]))).length, 0,
  'a local alias cannot hide a representation conversion');
assert.equal(cases(new Let(new Just('savedLeft'), 4, call('walk', [values[2], values[1]]),
  node([values[0], local('savedLeft'), values[2], values[3]]))).length, 0,
  'evaluating a call is not an alias');
assert.equal(cases(new Branch([
  new Pair(isFrozen(call('changeFlag', [values[0]])), new Fail('unrelated branch')),
], node(values))).length, 0, 'a transformed argument cannot be tested before its evaluation');
const [reorderedCase] = cases(otherwise(node([values[0], values[3], values[2], values[1]])));
assert.deepEqual(reorderedCase.fieldParams, [0, 3, 2, 1],
  'constructor metadata keeps a legitimate permutation for the call-site proof');

const binding = (name, names, body) => new Tuple(name,
  new Abs(names.map((param, index) => new Tuple(new Just(param), index)), body));
const groups = [{ recursive: true, bindings: [
  binding('walk', ['key', 'tree'], local('tree')),
  binding('pairWalk', ['first', 'second'], local('first')),
  binding('mutualA', ['tree'], call('mutualB', [local('tree')])),
  binding('mutualB', ['tree'], call('mutualA', [local('tree')])),
  binding('external', ['tree'], new App(new Var(new Qualified(new Just('ForeignModule'), 'walk')), [local('tree')])),
  binding('opaque', ['tree'], call('foreignOnly', [local('tree')])),
  binding('indirectOpaque', ['tree'], call('opaque', [local('tree')])),
  binding('indirectExternal', ['tree'], call('external', [local('tree')])),
  binding('callback', ['f', 'tree'], new App(local('f'), [local('tree')])),
  binding('closure', ['tree'], new Let(new Just('f'), 1,
    new Abs([new Tuple(new Just('value'), 2)], local('value')), local('tree'))),
  binding('partial', ['tree'], call('walk', [local('tree')])),
  binding('overapplied', ['tree'], call('walk', [integer(0), local('tree'), local('tree')])),
  binding('bareFunction', ['tree'], new Var(qualified('walk'))),
  binding('effectful', ['tree'], new EffectPure(local('tree'))),
  binding('saturatedSpine', ['tree'], new App(call('walk', [integer(0)]), [local('tree')])),
] }];
const closed = closedFunctions(moduleName)(groups);
const isClosed = name => member(ordString)(name)(closed);
for (const name of ['walk', 'pairWalk', 'mutualA', 'mutualB', 'saturatedSpine']) {
  assert.ok(isClosed(name), `${name}: a saturated local call graph is closed`);
}
for (const name of ['external', 'opaque', 'indirectOpaque', 'indirectExternal', 'callback',
  'closure', 'partial', 'overapplied', 'bareFunction', 'effectful']) {
  assert.equal(isClosed(name), false, `${name}: hidden or deferred evaluation must be rejected`);
}

const owned = {
  source: 'parent', nativeType: 'crate::Tree', constructor: 'crate::Tree::Node',
  constructorName: 'Node', names: ['ownedFlag', 'ownedLeft', 'ownedKey', 'ownedRight'], types,
};
const localTypes = new Map(owned.names.map((name, index) => [name, types[index]]));
const ownValues = owned.names.map((name, index) => typed(types[index], local(name)));
const raw = value => value instanceof Typed ? raw(value.value1)
  : value instanceof TypeApp ? raw(value.value0) : value;
const expressionRepresentation = value => {
  if (value instanceof Typed) return typeRepresentation(value.value0);
  if (value instanceof TypeApp) return expressionRepresentation(value.value0);
  if (value instanceof Local) return typeRepresentation(localTypes.get(value.value0.value0));
  if (value instanceof Lit && value.value0 instanceof LitInt) return 'i64';
  if (value instanceof App) return typeRepresentation(treeType);
  throw new Error(`Unexpected expression: ${value.constructor.name}`);
};
const arities = new Map([['walk', 2], ['pairWalk', 2], ['opaque', 1]]);
const closedCall = value => {
  const app = raw(value);
  if (!(app instanceof App)) return false;
  const fn = raw(app.value0);
  if (!(fn instanceof Var)) return false;
  const name = fn.value0.value1;
  return isClosed(name) && arities.get(name) === app.value1.length;
};
const update = (args, branch = identityCase) => childUpdate(typeRepresentation)
  (expressionRepresentation)(closedCall)(copyScalar)(branch)(owned)(args);
const replacing = replacement => [ownValues[0], typed(treeType, replacement), ownValues[2], ownValues[3]];
const args = replacing(call('walk', [integer(7), ownValues[1]]));
const result = update(args);
assert.ok(result instanceof Just, 'one consumed child with Copy arguments can retain its parent fields');
assert.equal(result.value0.index, 1);
assert.equal(result.value0.sibling, 3);
const reject = (candidate, label, branch = identityCase) =>
  assert.ok(update(candidate, branch) instanceof Nothing, label);
reject(args, 'reordering unchanged fields cannot become a one-child write', reorderedCase);
reject(args, 'a guard cannot read the child whose value is computed',
  { ...identityCase, guards: [{ ...identityCase.guards[0], parameter: 1 }] });
reject(replacing(typed(Any.value, call('walk', [integer(7), ownValues[1]]))),
  'an outer type annotation cannot hide a converted call');
reject(replacing(call('walk', [typed(Int.value, typed(Any.value, integer(7))), ownValues[1]])),
  'Copy arguments must preserve their representation through every wrapper');
reject(replacing(call('pairWalk', [ownValues[1], ownValues[1]])), 'the consumed child may occur only once');
reject(replacing(call('pairWalk', [ownValues[1], ownValues[3]])), 'the sibling cannot enter the recursive call');
reject(replacing(call('walk', [ownValues[1]])), 'partial calls cannot consume the child immediately');
reject(replacing(call('opaque', [ownValues[1]])), 'a transitive FFI caller is not a closed replacement');
reject([typed(flagType, call('changeFlag', [ownValues[0]])), ...args.slice(1)],
  'the scalar used by the guard must remain unchanged');

// Run a generated closed call that unwinds while its caller retains a mutable
// parent slot. Observe the children and total live allocations after the
// catch, including the shared/Weak fallbacks. No foreign callback is involved.
const ref = (name, level, type) => typed(type, new Local(new Just(name), level));
const functionBinding = (name, argTypes, names, body) => new Tuple(name,
  typed(new Func(argTypes, treeType), new Abs(names.map((name, level) => new Tuple(new Just(name), level)),
    typed(treeType, body))));
const helperValues = params.map((name, index) => ref(name, index, types[index]));
const helper = functionBinding('assemble', types, params, new Branch([
  new Pair(isFrozen(helperValues[0]), node([helperValues[0], helperValues[3], helperValues[2], helperValues[1]])),
], node(helperValues)));
const panicChild = functionBinding('panicChild', [Int.value, treeType], ['key', 'child'], new Branch([
  new Pair(new PrimOp(new Op2(new OpIntOrd(OpEq.value), ref('key', 0, Int.value), integer(0))),
    new Fail('closed child panic')),
], ref('child', 1, treeType)));
const rewrite = (name, index) => {
  const source = ref('parent', 1, treeType);
  const fields = types.map((type, fieldIndex) => typed(type, new Accessor(source,
    new GetCtorField(qualified('Node'), SumType.value, 'Tree', 'Node', `value${fieldIndex}`, fieldIndex))));
  fields[index] = typed(treeType, call('panicChild', [ref('key', 0, Int.value), fields[index]]));
  return functionBinding(name, [Int.value, treeType], ['key', 'parent'], call('assemble', fields));
};
const runtimeBindings = [helper, panicChild, rewrite('rewriteLeft', 1), rewrite('rewriteRight', 3)];
const core = { name: moduleName, classDecls: [], dataDecls: [
  { name: 'Flag', vars: [], constructors: [{ name: 'Frozen', fields: [] }, { name: 'Ready', fields: [] }] },
  { name: 'Tree', vars: [], constructors: [{ name: 'Empty', fields: [] }, { name: 'Node', fields: types }] },
] };
let runtimeArities = emptyMap;
for (const [name, type] of [
  ['Frozen', flagType], ['Ready', flagType], ['Empty', treeType], ['Node', new Func(types, treeType)],
  ...runtimeBindings.map(binding => [binding.value0, binding.value1.value0]),
]) runtimeArities = insert(ordString)(`${moduleName}_${name}`)(type)(runtimeArities);
const generated = codegenModuleWithValueEnums(valueEnumsForModule(core))(runtimeArities)(emptyMap)(core)(
  { name: moduleName, bindings: [{ recursive: false, bindings: runtimeBindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicIsize, Ordering};
use std::rc::Rc;
static LIVE: AtomicIsize = AtomicIsize::new(0);
struct Counting;
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let pointer = System.alloc(layout);
        if !pointer.is_null() { LIVE.fetch_add(1, Ordering::Relaxed); }
        pointer
    }
    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        LIVE.fetch_sub(1, Ordering::Relaxed);
        System.dealloc(pointer, layout);
    }
}
#[global_allocator] static ALLOCATOR: Counting = Counting;
fn make() -> Rc<Tree> {
    Rc::new(Tree::Node(Flag::Ready, Rc::new(Tree::Empty), 17, Rc::new(Tree::Empty)))
}
fn check_old(tree: &Tree) {
    let Tree::Node(Flag::Ready, left, 17, right) = tree else { panic!("changed parent") };
    assert!(matches!(left.as_ref(), Tree::Empty));
    assert!(matches!(right.as_ref(), Tree::Empty));
}
fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    drop(std::panic::catch_unwind(|| panic!("warm up panic runtime")));
    let before = LIVE.load(Ordering::Relaxed);
    for rewrite in [ChildEligibility_rewriteLeft, ChildEligibility_rewriteRight] {
        let parent = make();
        let address = Rc::as_ptr(&parent);
        let result = rewrite(1, parent);
        assert_eq!(Rc::as_ptr(&result), address);
        check_old(result.as_ref());
        drop(result);
        for shared in [false, true] {
            for weak_parent in [false, true] {
                let parent = make();
                let Tree::Node(_, left, _, right) = parent.as_ref() else { unreachable!() };
                let left_observer = Rc::downgrade(left);
                let right_observer = Rc::downgrade(right);
                let retained = if shared { Some(parent.clone()) } else { None };
                let parent_observer = if weak_parent { Some(Rc::downgrade(&parent)) } else { None };
                let unwound = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| rewrite(0, parent)));
                assert!(unwound.is_err());
                drop(unwound);
                if let Some(old) = retained.as_ref() {
                    check_old(old.as_ref());
                    assert_eq!(left_observer.strong_count(), 1);
                    assert_eq!(right_observer.strong_count(), 1);
                } else {
                    assert_eq!(left_observer.strong_count(), 0);
                    assert_eq!(right_observer.strong_count(), 0);
                }
                drop(retained);
                assert!(left_observer.upgrade().is_none());
                assert!(right_observer.upgrade().is_none());
                if let Some(observer) = parent_observer.as_ref() { assert!(observer.upgrade().is_none()); }
                drop(parent_observer);
                drop(left_observer);
                drop(right_observer);
                assert_eq!(LIVE.load(Ordering::Relaxed), before, "allocation leaked while unwinding");
            }
        }
    }
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-child-call-unwind-'));
try {
  const source = join(directory, 'checks.rs');
  const executable = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [
    ['rustc', ['--edition=2021', '-C', 'opt-level=1', source, '-o', executable]], [executable, []],
  ]) {
    const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log('Child-call proof: aliasing, conversions, field order, saturation, recursive graphs and opaque boundaries checked.');
