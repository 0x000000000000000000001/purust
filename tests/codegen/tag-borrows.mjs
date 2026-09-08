// Run after npm run build. Tag tests borrow native local ADTs while preserving
// their later uses, representation conversions, and non-local evaluations.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Boolean as BooleanType, Func, Int, Qualified, Unit } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Branch, Local, Op1, OpIsTag, Pair, PrimOp, PrimUndefined, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const treeType = new ADT('Tree', ['TagBorrows', 'Tree'], []);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const tag = (name, value) => new PrimOp(new Op1(new OpIsTag(new Qualified(new Just('TagBorrows'), name)), value));
const tree = local('tree', 0);
const fallback = local('fallback', 1);
const wrapped = new Typed(treeType, new TypeApp(new Typed(Any.value, new Typed(treeType, tree)), Int.value));
const returning = (name, operand, inputType = treeType) => new Tuple(name,
  new Typed(new Func([inputType, inputType], inputType), new Abs([param('tree', 0), param('fallback', 1)],
    new Branch([new Pair(tag('Full', operand), tree)], fallback))));
const bindings = [returning('direct', tree), returning('wrapped', wrapped),
  returning('converted', new Typed(treeType, tree), Any.value)];
bindings.push(new Tuple('twice', new Typed(new Func([treeType, treeType], treeType),
  new Abs([param('tree', 0), param('fallback', 1)], new Branch([
    new Pair(tag('Full', tree), new Branch([new Pair(tag('Full', wrapped), tree)], fallback)),
    new Pair(tag('Empty', wrapped), tree),
  ], fallback)))));
bindings.push(new Tuple('fromCall', new Typed(new Func([new Func([Unit.value], treeType)], BooleanType.value),
  new Abs([param('factory', 0)], tag('Full', new App(local('factory', 0), [new Typed(Unit.value, PrimUndefined.value)]))))));
bindings.push(new Tuple('fromPassingCall', new Typed(new Func([new Func([treeType], treeType), treeType, treeType], treeType),
  new Abs([param('factory', 0), param('tree', 1), param('fallback', 2)], new Branch([
    new Pair(tag('Full', new App(local('factory', 0), [local('tree', 1)])), local('tree', 1)),
  ], local('fallback', 2))))));
let arities = insert(ordString)('TagBorrows_Full')(new Func([Int.value], treeType))(emptyMap);
arities = insert(ordString)('TagBorrows_Empty')(treeType)(arities);
const generated = codegenModule(arities)(emptyMap)({
  name: 'TagBorrows', classDecls: [],
  dataDecls: [{ name: 'Tree', constructors: [{ name: 'Empty', fields: [] }, { name: 'Full', fields: [Int.value] }] }],
})({ name: 'TagBorrows', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    use std::rc::Rc;
    let full = Rc::new(Tree::Full(42));
    let empty = Rc::new(Tree::Empty);
    for select in [TagBorrows_direct, TagBorrows_wrapped] {
        let selected = select(full.clone(), empty.clone());
        assert!(Rc::ptr_eq(&selected, &full));
        assert!(matches!(selected.as_ref(), Tree::Full(42)));
        let selected = select(empty.clone(), full.clone());
        assert!(Rc::ptr_eq(&selected, &full));
    }
    for tree in [&full, &empty] {
        let selected = TagBorrows_twice(tree.clone(), full.clone());
        assert!(Rc::ptr_eq(&selected, tree));
    }
    for (tree, expected) in [(&full, &full), (&empty, &full)] {
        let boxed = Value::Class(Rc::new(tree.clone()));
        let fallback = Value::Class(Rc::new(full.clone()));
        let selected = TagBorrows_converted(boxed, fallback);
        assert!(Rc::ptr_eq(selected.unwrap_class::<Rc<Tree>>(), expected));
    }
    let calls = Rc::new(std::cell::Cell::new(0));
    let observed = calls.clone();
    let factory = Func1::Shared(Rc::new(move |()| {
        observed.set(observed.get() + 1);
        Rc::new(Tree::Full(7))
    }));
    assert!(TagBorrows_fromCall(factory));
    assert_eq!(calls.get(), 1, "a non-local operand must be evaluated exactly once");
    assert!(!TagBorrows_fromCall(Func1::Static(|()| Rc::new(Tree::Empty))));
    for tree in [&full, &empty] {
        let observed = calls.clone();
        let factory = Func1::Shared(Rc::new(move |tree: Rc<Tree>| {
            observed.set(observed.get() + 1);
            tree
        }));
        let before = calls.get();
        let selected = TagBorrows_fromPassingCall(factory, tree.clone(), full.clone());
        assert_eq!(calls.get(), before + 1);
        assert!(Rc::ptr_eq(&selected, &full));
    }
    assert_eq!(Rc::strong_count(&full), 1);
    assert_eq!(Rc::strong_count(&empty), 1);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-tag-borrows-'));
try {
  const source = join(directory, 'tag-borrows.rs');
  const binary = join(directory, 'tag-borrows');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const run = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  }
  console.log('Tag tests preserve shared parents, branches, conversions and single evaluation.');
  // Emission is part of this optimization's contract: semantic checks alone
  // cannot detect a transient Rc clone whose count is restored immediately.
  const functions = generated.split(/^pub fn /m).slice(1);
  let reads = 0;
  for (const body of functions) {
    const name = body.match(/^TagBorrows_(\w+)\(/)?.[1];
    if (!['direct', 'wrapped', 'twice'].includes(name)) continue;
    for (const [, operand] of body.matchAll(/matches!\(\(([^]*?)\)\.as_ref\(\)/g)) {
      reads++;
      assert.doesNotMatch(operand, /\b(?:purs_local_\d+|tree)\.clone\(\)/,
        `${name}: reading a local tag must not clone its parent`);
    }
  }
  assert.equal(reads, 5, 'exercise all five eligible native-local tag reads');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
