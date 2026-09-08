// Run after npm run build. Field reads borrow local parents, but return owned
// children so persistent trees can keep sharing subtrees independently.
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
import { ADT, Any, Func, Int, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, GetCtorField, Local, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const treeType = new ADT('Tree', ['FieldBorrows', 'Tree'], []);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const field = (base, index) => new Accessor(base,
  new GetCtorField(new Qualified(new Just('FieldBorrows'), 'Node'), SumType.value, 'Tree', 'Node', `value${index}`, index));
const tree = local('tree', 0);
const wrapped = new Typed(treeType, new TypeApp(new Typed(Any.value, new Typed(treeType, tree)), Int.value));
const bindings = [];
function reading(name, operand, inputType = treeType, resultType = treeType, extraParams = []) {
  bindings.push(new Tuple(name, new Typed(
    new Func([inputType, new Func([resultType, inputType], treeType), ...extraParams.map(p => p[1])], treeType),
    new Abs([param('tree', 0), param('consume', 1), ...extraParams.map((p, i) => param(p[0], i + 2))],
      // The parent must remain alive for the second argument, after extraction.
      new App(local('consume', 1), [operand, tree])))));
}
reading('direct', field(tree, 0));
reading('wrapped', field(wrapped, 0));
reading('scalar', field(tree, 1), treeType, Int.value);
reading('converted', field(new Typed(treeType, tree), 0), Any.value);
reading('nested', field(field(tree, 0), 0));
reading('fromCall', field(new App(local('factory', 2), [tree]), 0), treeType, treeType,
  [['factory', new Func([treeType], treeType)]]);
let arities = insert(ordString)('FieldBorrows_Node')(new Func([treeType, Int.value, treeType], treeType))(emptyMap);
arities = insert(ordString)('FieldBorrows_Leaf')(new Func([Int.value], treeType))(arities);
const generated = codegenModule(arities)(emptyMap)({
  name: 'FieldBorrows', classDecls: [],
  dataDecls: [{ name: 'Tree', constructors: [
    { name: 'Leaf', fields: [Int.value] },
    { name: 'Node', fields: [treeType, Int.value, treeType] },
  ] }],
})({ name: 'FieldBorrows', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    use std::rc::Rc;
    fn consume(child: Rc<Tree>, parent: Rc<Tree>) -> Rc<Tree> {
        let Tree::Node(left, key, right) = parent.as_ref() else { panic!("not a node") };
        assert!(Rc::ptr_eq(&child, left));
        assert!(Rc::ptr_eq(left, right), "both branches share the same subtree");
        assert_eq!(*key, 42);
        child
    }
    let leaf = Rc::new(Tree::Leaf(7));
    let parent = Rc::new(Tree::Node(leaf.clone(), 42, leaf.clone()));
    for read in [FieldBorrows_direct, FieldBorrows_wrapped] {
        let child = read(parent.clone(), Func2::Static(consume));
        assert!(Rc::ptr_eq(&child, &leaf));
        // Reconstruct another root and retain the old version unchanged.
        let new_root = Rc::new(Tree::Node(child.clone(), 99, child));
        assert!(matches!(parent.as_ref(), Tree::Node(_, 42, _)));
        assert!(matches!(new_root.as_ref(), Tree::Node(_, 99, _)));
        drop(new_root);
        let temporary = Rc::new(Tree::Node(leaf.clone(), 42, leaf.clone()));
        let survivor = read(temporary, Func2::Static(consume));
        assert!(Rc::ptr_eq(&survivor, &leaf), "child survives its only parent");
    }
    let child = FieldBorrows_scalar(parent.clone(), Func2::Static(|key, tree| {
        assert_eq!(key, 42);
        tree
    }));
    assert!(Rc::ptr_eq(&child, &parent));
    drop(child);
    let boxed = Value::Class(Rc::new(parent.clone()));
    let child = FieldBorrows_converted(boxed, Func2::Static(|child, parent: Value| {
        consume(child, parent.unwrap_class::<Rc<Tree>>().clone())
    }));
    assert!(Rc::ptr_eq(&child, &leaf));
    drop(child);
    let nested = Rc::new(Tree::Node(parent.clone(), 0, parent.clone()));
    let child = FieldBorrows_nested(nested, Func2::Static(|child, root| {
        let Tree::Node(left, _, _) = root.as_ref() else { panic!("not a node") };
        let Tree::Node(grandchild, _, _) = left.as_ref() else { panic!("not a node") };
        assert!(Rc::ptr_eq(&child, grandchild));
        child
    }));
    assert!(Rc::ptr_eq(&child, &leaf));
    drop(child);
    let calls = Rc::new(std::cell::Cell::new(0));
    let observed = calls.clone();
    let factory = Func1::Shared(Rc::new(move |tree: Rc<Tree>| {
        observed.set(observed.get() + 1);
        tree
    }));
    let child = FieldBorrows_fromCall(parent.clone(), Func2::Static(consume), factory);
    assert_eq!(calls.get(), 1, "a non-local base must be evaluated once");
    assert!(Rc::ptr_eq(&child, &leaf));
    drop(child);
    assert_eq!(Rc::strong_count(&parent), 1);
    assert_eq!(Rc::strong_count(&leaf), 3);
    drop(parent);
    assert_eq!(Rc::strong_count(&leaf), 1);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-field-borrows-'));
try {
  const source = join(directory, 'field-borrows.rs');
  const binary = join(directory, 'field-borrows');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const run = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  }
  console.log('Field reads preserve shared children, persistent parents, conversions and single evaluation.');
  // A transient parent clone leaves final Rc counts unchanged, so check emission too.
  const functions = generated.split(/^pub fn /m).slice(1);
  let reads = 0;
  for (const body of functions) {
    const name = body.match(/^FieldBorrows_(\w+)\(/)?.[1];
    if (!['direct', 'wrapped', 'scalar'].includes(name)) continue;
    for (const [, operand] of body.matchAll(/if let crate::Tree::Node\([^]*?\) = \(([^]*?)\)\.as_ref\(\) \{ f\.clone\(\) \}/g)) {
      reads++;
      assert.doesNotMatch(operand, /\b(?:purs_local_\d+|tree)\.clone\(\)/,
        `${name}: extracting a field must borrow its local parent`);
    }
  }
  assert.equal(reads, 3, 'exercise three native-local field reads while retaining the field clone');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
