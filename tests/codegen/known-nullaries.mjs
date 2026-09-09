// Execute the ownership/conversion/scope boundaries without PBO hoisting calls.
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
import { Abs, App, Branch, CtorSaturated, Lit, Local, Op1, OpIsTag, Pair, PrimOp, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const mod = 'KnownNullaryBoundaries';
const treeType = new ADT('Tree', [mod, 'Tree'], []);
const local = (name, level = 0) => new Local(new Just(name), level);
const ctor = (name, values = []) => new CtorSaturated(new Qualified(new Just(mod), name),
  SumType.value, 'Tree', name, values.map((v, i) => new Tuple(`value${i}`, v)));
const int = n => new Lit(new LitInt(n));
const leaf = k => ctor('Node', [ctor('Empty'), k, ctor('Empty')]);
const tag = (name, value) => new PrimOp(new Op1(new OpIsTag(new Qualified(new Just(mod), name)), value));
const branch = (condition, yes, no) => new Branch([new Pair(condition, yes)], no);
const bindings = [];
function binding(name, params, body, result = treeType) {
  bindings.push(new Tuple(name, new Typed(new Func(params.map(p => p[1]), result),
    new Abs(params.map(([name], i) => new Tuple(new Just(name), i)), body))));
}
binding('nonlocal', [['factory', new Func([Int.value], treeType)]],
  branch(tag('Empty', new App(local('factory'), [int(0)])), leaf(int(7)), ctor('End')));
binding('converted', [['source', Any.value]],
  branch(tag('Empty', new Typed(treeType, local('source'))), leaf(int(7)), ctor('End')));
binding('falseArm', [['source', treeType]],
  branch(tag('Empty', local('source')), ctor('End'), leaf(int(7))));
binding('payloadTag', [['source', treeType]],
  branch(tag('Node', local('source')), leaf(int(7)), ctor('End')));
binding('deferred', [['source', treeType]],
  branch(tag('Empty', local('source')),
    new Abs([new Tuple(new Just('key'), 1)], leaf(local('key', 1))),
    new Abs([new Tuple(new Just('key'), 1)], ctor('End'))), new Func([Int.value], treeType));
let arities = emptyMap;
for (const [name, ty] of [['Empty', treeType], ['End', treeType],
  ['Node', new Func([treeType, Int.value, treeType], treeType)]]) {
  arities = insert(ordString)(`${mod}_${name}`)(ty)(arities);
}
const generated = codegenModule(arities)(emptyMap)({
  name: mod, classDecls: [], dataDecls: [{ name: 'Tree', constructors: [
    { name: 'Empty', fields: [] }, { name: 'End', fields: [] },
    { name: 'Node', fields: [treeType, Int.value, treeType] },
  ] }],
})({ name: mod, bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
fn main() {
    use std::rc::Rc;
    fn checked(tree: &Tree) {
        let Tree::Node(l, k, r) = tree else { panic!("expected Node") };
        assert_eq!(*k, 7);
        assert!(matches!(l.as_ref(), Tree::Empty) && matches!(r.as_ref(), Tree::Empty));
    }
    let seed = Rc::new(Tree::Empty);
    let calls = Rc::new(std::cell::Cell::new(0));
    let observed = calls.clone();
    let returned = seed.clone();
    let tree = KnownNullaryBoundaries_nonlocal(Func1::Shared(Rc::new(move |_| {
        observed.set(observed.get() + 1);
        returned.clone()
    })));
    assert_eq!(calls.get(), 1);
    checked(&tree);
    let Tree::Node(l, _, _) = tree.as_ref() else { panic!() };
    assert!(!Rc::ptr_eq(l, &seed));
    let tree = KnownNullaryBoundaries_converted(Value::Class(Rc::new(seed.clone())));
    checked(&tree);
    let Tree::Node(l, _, _) = tree.as_ref() else { panic!() };
    assert!(!Rc::ptr_eq(l, &seed));
    checked(&KnownNullaryBoundaries_falseArm(Rc::new(Tree::End)));
    checked(&KnownNullaryBoundaries_payloadTag(Rc::new(Tree::Node(seed.clone(), 0, seed))));

    let seed = Rc::new(Tree::Empty);
    let weak = Rc::downgrade(&seed);
    let f = KnownNullaryBoundaries_deferred(seed);
    assert!(weak.upgrade().is_none(), "Do not add a capture to a deferred body");
    checked(&f(7));
    checked(&f(7));
    println!("Known nullary boundaries: tested calls run once; conversions, false arms, payload tags and deferred captures checked.");
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-known-nullary-boundaries-'));
try {
  const source = join(directory, 'checks.rs');
  const binary = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    if (command === binary) process.stdout.write(result.stdout);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
