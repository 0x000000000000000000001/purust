// A closed child call may unwind before its result selects a constructor-only
// helper arm. Exercise the emitted path with native Rc and observable values.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModuleWithValueEnums, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { valueEnumsForModule } from '../../output/Purust.DataLayout/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Func, Int, LitInt, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, CtorSaturated, Fail, GetCtorField, Lit, Local,
  Op1, Op2, OpAdd, OpEq, OpIntNum, OpIntOrd, OpIsTag, Pair, PrimOp, Typed, Var }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const moduleName = 'PostChildPanic';
const treeType = new ADT('Tree', [moduleName, 'Tree'], []);
const types = [Int.value, treeType, treeType];
const q = name => new Qualified(new Just(moduleName), name);
const typed = (type, expr) => new Typed(type, expr);
const ref = (name, level, type) => typed(type, new Local(new Just(name), level));
const integer = n => new Lit(new LitInt(n));
const ctor = (name, values) => typed(treeType, new CtorSaturated(q(name), SumType.value,
  'Tree', name, values.map((value, index) => new Tuple(`value${index}`, value))));
const field = (base, name, index, type) => typed(type, new Accessor(base,
  new GetCtorField(q(name), SumType.value, 'Tree', name, `value${index}`, index)));
const tag = (name, value) => new PrimOp(new Op1(new OpIsTag(q(name)), value));
const call = (name, args) => typed(treeType, new App(new Var(q(name)), args));
const branch = (test, yes, no) => new Branch([new Pair(test, yes)], no);
const binding = (name, argTypes, names, body) => new Tuple(name,
  typed(new Func(argTypes, treeType), new Abs(names.map((name, level) => new Tuple(new Just(name), level)),
    typed(treeType, body))));
const addOne = value => typed(Int.value, new PrimOp(new Op2(new OpIntNum(OpAdd.value), value, integer(1))));
const child = ref('child', 1, treeType);
const advance = binding('advance', [Int.value, treeType], ['mode', 'child'], branch(
  new PrimOp(new Op2(new OpIntOrd(OpEq.value), ref('mode', 0, Int.value), integer(0))),
  new Fail('closed child panic'), branch(tag('Leaf', child),
    ctor('Leaf', [addOne(field(child, 'Leaf', 0, Int.value))]),
    branch(tag('Node', child), ctor('Node', [addOne(field(child, 'Node', 0, Int.value)),
      field(child, 'Node', 1, treeType), field(child, 'Node', 2, treeType)]),
    ctor('Leaf', [integer(1)])))));
const bindings = [advance];
for (const [side, index] of [['Left', 1], ['Right', 2]]) {
  const args = ['key', 'left', 'right'].map((name, level) => ref(name, level, types[level]));
  bindings.push(binding(`assemble${side}`, types, ['key', 'left', 'right'],
    branch(tag('Leaf', args[index]), ctor('Node', [args[0], args[2], args[1]]), ctor('Node', args))));
  const parent = ref('parent', 1, treeType);
  const fields = types.map((type, i) => field(parent, 'Node', i, type));
  fields[index] = call('advance', [ref('mode', 0, Int.value), fields[index]]);
  bindings.push(binding(`rewrite${side}`, [Int.value, treeType], ['mode', 'parent'], call(`assemble${side}`, fields)));
}
const core = { name: moduleName, classDecls: [], dataDecls: [{ name: 'Tree', vars: [], constructors: [
  { name: 'Empty', fields: [] }, { name: 'Leaf', fields: [Int.value] }, { name: 'Node', fields: types },
] }] };
let arities = emptyMap;
for (const [name, type] of [['Empty', treeType], ['Leaf', new Func([Int.value], treeType)],
  ['Node', new Func(types, treeType)], ...bindings.map(b => [b.value0, b.value1.value0])]) {
  arities = insert(ordString)(`${moduleName}_${name}`)(type)(arities);
}
const generated = codegenModuleWithValueEnums(valueEnumsForModule(core))(arities)(emptyMap)(core)(
  { name: moduleName, bindings: [{ recursive: false, bindings }] });
assert.equal(generated.split('purust child call: post-call fields').length - 1, 2,
  'both directions must exercise the accepted post-call field path');
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
fn node(key: i64) -> Rc<Tree> { Rc::new(Tree::Node(key, Rc::new(Tree::Empty), Rc::new(Tree::Empty))) }
fn key(tree: &Tree) -> i64 {
    match tree { Tree::Leaf(k) | Tree::Node(k, _, _) => *k, Tree::Empty => -1 }
}
fn old_parent(tree: &Tree) {
    let Tree::Node(17, left, right) = tree else { panic!("parent changed") };
    assert_eq!((key(left), key(right)), (10, 20));
}
fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    drop(std::panic::catch_unwind(|| panic!("warm panic runtime")));
    let before = LIVE.load(Ordering::Relaxed);
    let rewrites: [(fn(i64, Rc<Tree>) -> Rc<Tree>, bool); 2] =
        [(PostChildPanic_rewriteLeft, true), (PostChildPanic_rewriteRight, false)];
    for (rewrite, left_side) in rewrites {
        // Node results take the retained arm; Leaf results take the complex
        // swapping arm. Incremented values expose omitted or repeated calls.
        for complex in [false, true] {
            let changed = if complex { Rc::new(Tree::Leaf(10)) } else { node(10) };
            let sibling = node(20);
            let parent = if left_side { Rc::new(Tree::Node(17, changed, sibling)) }
                else { Rc::new(Tree::Node(17, sibling, changed)) };
            let address = Rc::as_ptr(&parent);
            let result = rewrite(1, parent);
            if !complex { assert_eq!(Rc::as_ptr(&result), address, "unique parent was copied"); }
            let Tree::Node(17, left, right) = result.as_ref() else { panic!("wrong result") };
            let expected = if left_side != complex { (11, 20) } else { (20, 11) };
            assert_eq!((key(left), key(right)), expected, "child must run exactly once before the helper");
            drop(result);
            assert_eq!(LIVE.load(Ordering::Relaxed), before);
        }
        for shared in [false, true] {
            for weak_parent in [false, true] {
                let parent = Rc::new(Tree::Node(17, node(10), node(20)));
                let Tree::Node(_, left, right) = parent.as_ref() else { unreachable!() };
                let left_observer = Rc::downgrade(left);
                let right_observer = Rc::downgrade(right);
                let retained = shared.then(|| parent.clone());
                let parent_observer = weak_parent.then(|| Rc::downgrade(&parent));
                let unwound = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| rewrite(0, parent)));
                assert!(unwound.is_err());
                drop(unwound);
                if let Some(old) = retained.as_ref() { old_parent(old); }
                assert_eq!(left_observer.strong_count(), usize::from(shared));
                assert_eq!(right_observer.strong_count(), usize::from(shared));
                drop(retained);
                assert!(left_observer.upgrade().is_none());
                assert!(right_observer.upgrade().is_none());
                if let Some(observer) = parent_observer.as_ref() { assert!(observer.upgrade().is_none()); }
                drop(parent_observer); drop(left_observer); drop(right_observer);
                assert_eq!(LIVE.load(Ordering::Relaxed), before, "allocation leaked while unwinding");
            }
        }
    }
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-post-child-panic-'));
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
console.log('Post-child call: both arms, single evaluation, unique/shared/Weak unwind and allocation balance checked.');
