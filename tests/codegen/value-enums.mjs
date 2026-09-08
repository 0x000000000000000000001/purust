// Run after npm run build. Generate native enum operations before Rust can
// optimize them, then check Copy, sharing and allocations in the emitted code.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModuleWithValueEnums, codegenExprTypeWithValueEnums, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { valueEnumsForModule } from '../../output/Purust.DataLayout/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Boolean as BooleanType, Func, Int, Qualified, SumType, Unit } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, CtorDef, CtorSaturated, GetCtorField, Local, Op1, OpIsTag, Pair, PrimOp, PrimUndefined, Typed, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const colorType = new ADT('Color', ['ValueEnums', 'Color'], []);
const treeType = new ADT('Tree', ['ValueEnums', 'Tree'], []);
const nodeFields = [colorType, treeType, Int.value, treeType];
const qualified = name => new Qualified(new Just('ValueEnums'), name);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const ctor = (type, name, fields = []) => new CtorSaturated(qualified(name), SumType.value, type, name,
  fields.map((value, i) => new Tuple(`value${i}`, value)));
const tag = value => new PrimOp(new Op1(new OpIsTag(qualified('R')), value));
const binding = (name, type, expr) => new Tuple(name, new Typed(type, expr));
const bindings = [
  binding('red', colorType, new CtorDef(SumType.value, 'Color', 'R', [])),
  binding('black', colorType, ctor('Color', 'B')),
  binding('empty', treeType, ctor('Tree', 'E')),
  binding('node', new Func(nodeFields, treeType), new Abs(
    ['color', 'left', 'key', 'right'].map(param),
    ctor('Tree', 'T', ['color', 'left', 'key', 'right'].map(local)))),
  binding('nodeConstructor', new Func(nodeFields, treeType),
    new CtorDef(SumType.value, 'Tree', 'T', ['value0', 'value1', 'value2', 'value3'])),
  binding('color', new Func([treeType], colorType), new Abs([param('tree', 0)],
    new Accessor(local('tree', 0), new GetCtorField(qualified('T'), SumType.value, 'Tree', 'T', 'value0', 0)))),
  binding('isRed', new Func([colorType], BooleanType.value),
    new Abs([param('color', 0)], tag(local('color', 0)))),
  binding('reuse', new Func([colorType], colorType), new Abs([param('color', 0)],
    new Branch([new Pair(tag(local('color', 0)), local('color', 0))], ctor('Color', 'B')))),
  binding('freshTag', BooleanType.value, tag(new Var(qualified('red')))),
  binding('apply', new Func([new Func([colorType], colorType), colorType], colorType),
    new Abs([param('fn', 0), param('color', 1)], new App(local('fn', 0), [local('color', 1)]))),
  binding('capture', new Func([colorType], new Func([Unit.value], colorType)),
    new Abs([param('color', 0)], new Typed(new Func([Unit.value], colorType),
      new Abs([param('unit', 1)], local('color', 0))))),
  binding('unit', Unit.value, PrimUndefined.value),
];
let arities = emptyMap;
for (const [name, type] of [
  ['R', colorType], ['B', colorType], ['E', treeType], ['T', new Func(nodeFields, treeType)],
  ...bindings.map(b => [b.value0, b.value1.value0]),
]) arities = insert(ordString)(`ValueEnums_${name}`)(type)(arities);
const core = { name: 'ValueEnums', classDecls: [], dataDecls: [
  { name: 'Color', vars: [], constructors: [{ name: 'R', fields: [] }, { name: 'B', fields: [] }] },
  { name: 'Tree', vars: [], constructors: [{ name: 'E', fields: [] }, { name: 'T', fields: nodeFields }] },
] };
const valueEnums = valueEnumsForModule(core);
assert.equal(codegenExprTypeWithValueEnums(valueEnums)('ValueEnums')(false)(
  new ADT('Color', ['Other', 'Color'], [])), 'std::rc::Rc<Purs_Other::Color>');
assert.equal(codegenExprTypeWithValueEnums(valueEnums)('ValueEnums')(false)(Unit.value), '()');
const generated = codegenModuleWithValueEnums(valueEnums)(arities)(emptyMap)(core)(
  { name: 'ValueEnums', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
static ALLOCS: AtomicUsize = AtomicUsize::new(0);
struct Counting;
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Ordering::Relaxed);
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) { System.dealloc(ptr, layout); }
}
#[global_allocator] static ALLOCATOR: Counting = Counting;
fn main() {
    use std::rc::Rc;
    fn needs_copy<T: Copy>() {}
    needs_copy::<Color>();
    let _: fn() -> Color = ValueEnums_red;
    let _: fn(Rc<Tree>) -> Color = ValueEnums_color;
    let _: fn() -> () = ValueEnums_unit;
    let before = ALLOCS.load(Ordering::Relaxed);
    for _ in 0..1000 {
        let red = std::hint::black_box(ValueEnums_red());
        assert!(ValueEnums_isRed(red));
        assert!(matches!(ValueEnums_reuse(red), Color::R));
        assert!(matches!(ValueEnums_apply(Func1::Static(ValueEnums_reuse), red), Color::R));
        assert!(!ValueEnums_isRed(ValueEnums_black()));
        assert!(ValueEnums_freshTag());
        ValueEnums_unit();
    }
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 0, "native colors and Unit allocate nothing");
    let captured = ValueEnums_capture(ValueEnums_red());
    assert!(matches!(captured(()), Color::R));
    assert!(matches!(captured(()), Color::R));
    let empty = ValueEnums_empty();
    let red = ValueEnums_red();
    let before = ALLOCS.load(Ordering::Relaxed);
    let old = ValueEnums_node(red, empty.clone(), 42, empty.clone());
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 1, "only the tree node allocates");
    let other = ValueEnums_nodeConstructor(red, empty.clone(), 43, empty.clone());
    assert!(matches!(ValueEnums_color(old.clone()), Color::R));
    assert!(matches!(ValueEnums_color(other.clone()), Color::R));
    let Tree::T(color, left, key, right) = old.as_ref() else { panic!("not a node") };
    assert!(matches!(color, Color::R));
    assert_eq!(*key, 42);
    assert!(Rc::ptr_eq(left, &empty) && Rc::ptr_eq(right, &empty));
    assert_eq!(Rc::strong_count(&empty), 5);
    drop(other);
    let survivor = ValueEnums_color(old);
    assert!(matches!(survivor, Color::R));
    assert_eq!(Rc::strong_count(&empty), 1);
    println!("Color: {} byte(s); 1000 native iterations: 0 allocations; one tree node: 1 allocation", std::mem::size_of::<Color>());
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-value-enums-'));
try {
  const source = join(directory, 'value-enums.rs');
  const binary = join(directory, 'value-enums');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const run = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(run.status, 0, `${command}: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    if (run.stdout) process.stdout.write(run.stdout);
  }
  assert.match(generated, /#\[derive\(Clone, Copy\)\]\npub enum Color/);
  assert.doesNotMatch(generated, /Rc<(?:crate::)?Color>|Rc::new\(crate::Color::|unwrap_class/);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
