// Keep reconstruction safe at liveness and representation boundaries.
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
import { ADT, Any, Func, Int, LitInt, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, CtorSaturated, GetCtorField, Lit, Local, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const treeType = new ADT('Tree', ['ConstructorReuse', 'Tree'], []);
const local = (name, level = 0) => new Local(new Just(name), level);
const tree = local('tree');
const field = (base, i) => new Accessor(base,
  new GetCtorField(new Qualified(new Just('ConstructorReuse'), 'Node'), SumType.value, 'Tree', 'Node', `value${i}`, i));
const ctor = (name, fields) => new CtorSaturated(new Qualified(new Just('ConstructorReuse'), name),
  SumType.value, 'Tree', name, fields.map((value, i) => new Tuple(`value${i}`, value)));
const int = n => new Lit(new LitInt(n));
const rebuild = base => ctor('Node', [field(base, 0), int(99), field(base, 2)]);
const bindings = [];
function binding(name, params, body) {
  bindings.push(new Tuple(name, new Typed(new Func(params.map(p => p[1]), treeType),
    new Abs(params.map(([name], i) => new Tuple(new Just(name), i)), body))));
}
binding('direct', [['tree', treeType]], rebuild(tree));
binding('wrapped', [['tree', treeType]], rebuild(new Typed(treeType,
  new TypeApp(new Typed(Any.value, new Typed(treeType, tree)), Int.value))));
binding('converted', [['tree', Any.value]], rebuild(new Typed(treeType, tree)));
binding('fromCall', [['tree', treeType], ['factory', new Func([treeType], treeType)]],
  ctor('Node', [field(new App(local('factory', 1), [tree]), 0), int(99), ctor('Leaf', [int(0)])]));
binding('retained', [['tree', treeType], ['consume', new Func([treeType, treeType], treeType)]],
  new App(local('consume', 1), [rebuild(tree), tree]));
binding('differentConstructor', [['tree', treeType]], ctor('Leaf', [field(tree, 1)]));
let arities = insert(ordString)('ConstructorReuse_Node')(new Func([treeType, Int.value, treeType], treeType))(emptyMap);
arities = insert(ordString)('ConstructorReuse_Leaf')(new Func([Int.value], treeType))(arities);
const generated = codegenModule(arities)(emptyMap)({
  name: 'ConstructorReuse', classDecls: [], dataDecls: [{ name: 'Tree', constructors: [
    { name: 'Leaf', fields: [Int.value] }, { name: 'Node', fields: [treeType, Int.value, treeType] },
  ] }],
})({ name: 'ConstructorReuse', bindings: [{ recursive: false, bindings }] });
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
    fn checked(tree: &Tree, expected: i64) {
        let Tree::Node(left, key, _) = tree else { panic!("not a node") };
        assert_eq!(*key, expected);
        assert!(matches!(left.as_ref(), Tree::Leaf(7)));
    }
    for rewrite in [ConstructorReuse_direct, ConstructorReuse_wrapped] {
        let parent = make();
        let before = Rc::as_ptr(&parent);
        let result = rewrite(parent);
        checked(&result, 99);
        assert_eq!(Rc::as_ptr(&result), before);
        let parent = make();
        let old = parent.clone();
        let result = rewrite(parent);
        checked(&result, 99);
        checked(&old, 42);
    }
    let parent = make();
    let result = ConstructorReuse_converted(Value::Class(Rc::new(parent.clone())));
    checked(&result, 99);
    checked(&parent, 42);
    let calls = Rc::new(std::cell::Cell::new(0));
    let observed = calls.clone();
    let factory = Func1::Shared(Rc::new(move |tree| {
        observed.set(observed.get() + 1);
        tree
    }));
    checked(&ConstructorReuse_fromCall(make(), factory), 99);
    assert_eq!(calls.get(), 1);
    let result = ConstructorReuse_retained(make(), Func2::Static(|new, old| {
        checked(&new, 99);
        checked(&old, 42);
        new
    }));
    checked(&result, 99);
    assert!(matches!(ConstructorReuse_differentConstructor(make()).as_ref(), Tree::Leaf(42)));
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-constructor-reuse-'));
try {
  const source = join(directory, 'checks.rs');
  const binary = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const run = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  }
  const bodies = generated.split(/^pub fn /m).slice(1);
  for (const body of bodies) {
    const name = body.match(/^ConstructorReuse_(\w+)\(/)?.[1];
    if (['direct', 'wrapped'].includes(name)) assert.match(body, /Rc::get_mut/);
    else assert.doesNotMatch(body, /Rc::get_mut/, `${name}: keep the existing ownership path`);
  }
  console.log('Constructor reuse: native locals, shared inputs, later uses, conversions and single evaluation checked.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
