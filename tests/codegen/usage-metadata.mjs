// Source usage facts are tested at the CoreFn boundary in PBO test/source-usage.mjs.
// This runtime regression preserves final-IR reuse, liveness and representation checks.
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
import { ADT, Any, Boolean as BooleanType, Func, Int, LitInt, Qualified, SumType }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, CtorSaturated, GetCtorField, Let, Lit, Local,
  Pair, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const moduleName = 'UsageMetadata';
const treeType = new ADT('Tree', [moduleName, 'Tree'], []);
const q = name => new Qualified(new Just(moduleName), name);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
let arities = insert(ordString)(`${moduleName}_Node`)(new Func([treeType, Int.value, treeType], treeType))(emptyMap);
arities = insert(ordString)(`${moduleName}_Leaf`)(new Func([Int.value], treeType))(arities);
const metadata = { name: moduleName, classDecls: [], dataDecls: [{ name: 'Tree', constructors: [
  { name: 'Leaf', fields: [Int.value] }, { name: 'Node', fields: [treeType, Int.value, treeType] },
] }] };

function generate() {
  const tree = () => local('tree', 0);
  const wrappedTree = () => new Typed(treeType,
    new TypeApp(new Typed(treeType, tree()), Int.value));
  const field = i => new Accessor(wrappedTree(),
    new GetCtorField(q('Node'), SumType.value, 'Tree', 'Node', `value${i}`, i));
  const rebuild = () => new CtorSaturated(q('Node'), SumType.value, 'Tree', 'Node', [
    new Tuple('value0', field(0)), new Tuple('value1', new Lit(new LitInt(99))),
    new Tuple('value2', field(2)),
  ]);
  const binding = (name, params, resultType, body) => new Tuple(name,
    new Typed(new Func(params.map(([, type]) => type), resultType),
      new Abs(params.map(([name], level) => param(name, level)), body)));
  const consume = new Func([treeType, treeType], treeType);
  const callback = new Func([Int.value], treeType);
  const predicate = new Func([treeType], BooleanType.value);
  return codegenModule(arities)(emptyMap)(metadata)({ name: moduleName, bindings: [{
    recursive: false, bindings: [
      binding('rebuild', [['tree', treeType]], treeType, rebuild()),
      // The first argument remains live until the second has been evaluated.
      binding('retained', [['tree', treeType], ['consume', consume]], treeType,
        new App(local('consume', 1), [tree(), tree()])),
      binding('retainedRebuild', [['tree', treeType], ['consume', consume]], treeType,
        new App(local('consume', 1), [rebuild(), tree()])),
      // A failed guard still needs the same value in the fallback arm.
      binding('guarded', [['tree', treeType], ['predicate', predicate]], treeType,
        new Branch([new Pair(new App(local('predicate', 1), [tree()]),
          rebuild())], tree())),
      binding('captured', [['tree', treeType]], callback,
        new Typed(callback, new Abs([param('ignored', 1)], tree()))),
      // Explicit type applications retain the required representation conversion.
      binding('unbox', [['boxed', Any.value]], Int.value,
        new Typed(Int.value, new TypeApp(local('boxed', 0), Int.value))),
      // The result type crosses a scoped body, including nested annotations.
      binding('scoped', [['input', Int.value]], Int.value,
        new Typed(Int.value, new Let(new Just('saved'), 1,
          local('input', 0), new Typed(Any.value, local('saved', 1))))),
    ],
  }] });
}

const generated = generate();

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
fn main() {
    use std::rc::Rc;
    fn make() -> Rc<Tree> {
        Rc::new(Tree::Node(Rc::new(Tree::Leaf(7)), 42, Rc::new(Tree::Leaf(17))))
    }
    fn key(tree: &Tree) -> i64 {
        let Tree::Node(_, value, _) = tree else { panic!("expected node") };
        *value
    }
    let original = make();
    let pointer = Rc::as_ptr(&original);
    let rewritten = UsageMetadata_rebuild(original);
    assert_eq!(key(&rewritten), 99);
    assert_eq!(Rc::as_ptr(&rewritten), pointer, "unique cells remain reusable");

    let shared = make();
    assert_eq!(key(&UsageMetadata_rebuild(shared.clone())), 99);
    assert_eq!(key(&shared), 42);
    let retained = UsageMetadata_retained(make(), Func2::Static(|first, second| {
        assert!(Rc::ptr_eq(&first, &second), "both live arguments must remain valid");
        first
    }));
    assert_eq!(key(&retained), 42);
    let rewritten = UsageMetadata_retainedRebuild(make(), Func2::Static(|new, old| {
        assert_eq!(key(&new), 99);
        assert_eq!(key(&old), 42);
        new
    }));
    assert_eq!(key(&rewritten), 99);
    for answer in [false, true] {
        let predicate = Func1::Shared(Rc::new(move |tree: Rc<Tree>| {
            assert_eq!(key(&tree), 42);
            answer
        }));
        assert_eq!(key(&UsageMetadata_guarded(make(), predicate)), if answer { 99 } else { 42 });
    }
    let captured = UsageMetadata_captured(make());
    let first = captured(1);
    let second = captured(2);
    assert!(Rc::ptr_eq(&first, &second), "a repeatable closure retains its capture");
    assert_eq!(key(&second), 42);
    assert_eq!(UsageMetadata_unbox(mk_int(42)), 42);
    assert_eq!(UsageMetadata_scoped(42), 42);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-usage-metadata-'));
try {
  const source = join(directory, 'checks.rs');
  const binary = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const run = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  }
  console.log('Final liveness: reuse, live arguments, guarded fallback, repeatable captures and types passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
