// A post-call predicate must not collide with an existing constructor helper,
// and a proof which is always false must not register an unusable helper.
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
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Func, Int, LitInt, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Branch, CtorSaturated, Lit, Local, Op2, OpEq, OpIntOrd, Pair, PrimOp, Typed }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const moduleName = 'PostChildNames';
const ctorName = 'X__purust_child_rebuilds';
const sourceName = '__purust_rebuild_X';
const treeType = new ADT('Tree', [moduleName, 'Tree'], []);
const fieldTypes = [treeType, Int.value, treeType];
const helperType = new Func(fieldTypes, treeType);
const qualified = name => new Qualified(new Just(moduleName), name);
const params = ['left', 'key', 'right'];
const locals = params.map((name, index) => new Typed(fieldTypes[index], new Local(new Just(name), index)));
const returned = new CtorSaturated(qualified(ctorName), SumType.value, 'Tree', ctorName,
  locals.map((value, index) => new Tuple(`value${index}`, value)));
const binding = (name, body) => new Tuple(name, new Typed(helperType,
  new Abs(params.map((name, index) => new Tuple(new Just(name), index)), body)));
const bindings = [
  binding(sourceName, returned),
  binding('falseProof', new Branch([
    new Pair(new PrimOp(new Op2(new OpIntOrd(OpEq.value), locals[1], new Lit(new LitInt(0)))), returned),
  ], returned)),
];
const core = { name: moduleName, classDecls: [], dataDecls: [
  { name: 'Tree', vars: [], constructors: [{ name: 'Empty', fields: [] }, { name: ctorName, fields: fieldTypes }] },
] };
let arities = emptyMap;
for (const [name, type] of [['Empty', treeType], [ctorName, helperType],
  ...bindings.map(entry => [entry.value0, helperType])]) {
  arities = insert(ordString)(`${moduleName}_${name}`)(type)(arities);
}
const generated = codegenModuleWithValueEnums(valueEnumsForModule(core))(arities)(emptyMap)(core)(
  { name: moduleName, bindings: [{ recursive: false, bindings }] });
assert.doesNotMatch(generated, /PostChildNames_falseProof__purust_child_rebuilds/,
  'an always-false proof must leave the ordinary helper path');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
fn main() {
    use std::rc::Rc;
    fn check(tree: &Tree, expected: i64) {
        let Tree::X__purust_child_rebuilds(left, key, right) = tree else { panic!("wrong constructor") };
        assert_eq!(*key, expected);
        assert!(matches!(left.as_ref(), Tree::Empty));
        assert!(matches!(right.as_ref(), Tree::Empty));
    }
    let built = PostChildNames___purust_rebuild_X(Rc::new(Tree::Empty), 7, Rc::new(Tree::Empty));
    check(built.as_ref(), 7);
    for key in [0, 11] {
        check(PostChildNames_falseProof(Rc::new(Tree::Empty), key, Rc::new(Tree::Empty)).as_ref(), key);
    }
    // This name belongs to the constructor rebuilder, not the predicate for
    // the source function whose spelling happens to have the same suffix.
    let cell = Rc::new(Tree::Empty);
    let address = Rc::as_ptr(&cell);
    let rebuilt = PostChildNames___purust_rebuild_X__purust_child_rebuilds(
        Rc::new(Tree::Empty), 23, Rc::new(Tree::Empty), cell);
    assert_eq!(Rc::as_ptr(&rebuilt), address);
    check(rebuilt.as_ref(), 23);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-post-child-names-'));
try {
  const source = join(directory, 'checks.rs');
  const executable = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', executable]], [executable, []]]) {
    const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log('Post-child helpers preserve constructor-helper names and omit always-false predicates.');
