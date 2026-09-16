import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { optimizeRecordLoops } from '../../output/Purust.RecordScalarization/index.js';
import { codegenModule, codegenPrelude, sanitizeIdent } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet, fromFoldable, size } from '../../output/Data.Set/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Func, Int, Boolean as Bool, LitInt, Prop, Qualified, Record, Row, TypeVar } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, Branch, GetProp, Let, Lit, Local, Pair, PrimOp, Typed, TypeApp, Update, Var,
  Op2, OpIntNum, OpIntOrd, OpAdd, OpSubtract, OpMod, OpEq } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';

const moduleName = 'ScalarRecords';
const i = Int.value;
const record = (fields, tail = Nothing.value) => new Record(new Row(fields.map(([k, v]) => new Tuple(k, v)), tail));
const leaf = record([['e', i], ['f', i]]);
const child = record([['c', i], ['d', leaf]]);
const root = record([['a', i], ['b', child], ['keep', i]]);
const ty = new Func([i, root], root);
const typed = (t, e) => new Typed(t, e);
const param = n => new Tuple(new Just(`source${n}`), n);
const local = (t, n) => typed(t, new Local(new Just(`source${n}`), n));
const int = n => typed(i, new Lit(new LitInt(n)));
const get = (r, key) => new Accessor(r, new GetProp(key));
const field = (r, path) => typed(i, path.reduce(get, r));
const op = (kind, a, b) => typed(i, new PrimOp(new Op2(new OpIntNum(kind), a, b)));
const add = (a, b) => op(OpAdd.value, a, b);
const eq = (a, b) => typed(Bool.value, new PrimOp(new Op2(new OpIntOrd(OpEq.value), a, b)));
const variable = (name, mod = moduleName) => new Var(new Qualified(mod === null ? Nothing.value : new Just(mod), name));
const call = (name, args, t = root, mod = moduleName) => typed(t, new App(variable(name, mod), args));
const update = (r, a, c, e, f) => typed(root, new Update(r, [
  new Prop('a', a), new Prop('b', typed(child, new Update(get(r, 'b'), [
    new Prop('c', c), new Prop('d', typed(leaf, new Update(get(get(r, 'b'), 'd'), [new Prop('e', e), new Prop('f', f)]))),
  ]))),
]));

function fixture(options = {}) {
  const { name = 'rotateFields', type = root, recursive = true } = options;
  const n = local(i, 0), r = local(type, 1);
  const changed = options.changed?.(n, r) ?? update(r,
    add(field(r, ['b', 'c']), int(1)), add(field(r, ['a']), int(2)),
    add(field(r, ['b', 'd', 'e']), int(3)),
    add(field(r, ['b', 'd', 'f']), op(OpMod.value, n, int(5))));
  const next = call(name, [op(OpSubtract.value, n, int(1)), changed], type, options.selfModule ?? moduleName);
  let body = typed(type, new Branch([new Pair(eq(n, int(0)), r)], next));
  if (options.bodyWrap) body = options.bodyWrap(body, n, r);
  const binding = typed(new Func([i, type], type), new Abs([param(0), param(1)], body));
  return [{ recursive, bindings: [new Tuple(name, options.wrap ? options.wrap(binding) : binding)] }];
}
const runPass = (groups, reserved = emptySet) => optimizeRecordLoops(sanitizeIdent)(reserved)(moduleName)(groups);
function accepts(groups, reserved = emptySet) {
  const before = JSON.stringify(groups);
  const transformed = runPass(groups, reserved);
  assert.ok(size(transformed.workers) > 0, 'fixture must exercise the scalar pass');
  assert.equal(JSON.stringify(groups), before, 'source IR is immutable');
  return transformed;
}
function rejects(groups, reason) {
  const before = JSON.stringify(groups);
  const transformed = runPass(groups);
  assert.equal(size(transformed.workers), 0, reason);
  assert.equal(JSON.stringify(transformed.bindings), before, reason);
}

accepts(fixture());
accepts(fixture({ name: 'anotherName', wrap: e => new TypeApp(e, i) }));
accepts(fixture({ selfModule: null }));
const withLet = fixture({ name: 'withLet', changed: (n, r) =>
  update(r, add(field(r, ['b', 'c']), int(1)), add(local(i, 40), int(2)),
    add(field(r, ['b', 'd', 'e']), int(3)), add(field(r, ['b', 'd', 'f']), op(OpMod.value, n, int(5)))),
  bodyWrap: (body, _, r) => new Let(new Just('old_a'), 40, field(r, ['a']), body) });
accepts(withLet);
rejects(fixture({ recursive: false }), 'a nonrecursive binding is not a self-loop');
rejects(fixture({ selfModule: 'Foreign' }), 'qualified foreign recursion cannot become a local loop');
const opened = record([['a', i], ['b', child], ['keep', i]], new Just(new TypeVar('row')));
rejects(fixture({ type: opened }), 'open root row');
rejects(fixture({ changed: (n, r) => call('opaque', [n, r]) }), 'unknown callee');
rejects(fixture({ changed: (n, r) => update(r, call('opaqueInt', [n], i), field(r, ['b','c']), field(r, ['b','d','e']), field(r, ['b','d','f'])) }), 'unknown scalar call');
rejects(fixture({ changed: (_, r) => typed(root, new Update(r, [new Prop('a', typed(Bool.value, field(r, ['a'])))])) }),
  'a contradictory scalar annotation cannot justify replacing a projection');
rejects(fixture({ changed: (_, r) => typed(root, new Update(r, [new Prop('b', typed(root, get(r, 'b')))])) }),
  'a contradictory subrecord annotation cannot establish provenance');
rejects(fixture({ bodyWrap: (body, n, r) => new Let(new Just('capture'), 50,
  typed(new Func([i], root), new Abs([param(51)], r)), body) }), 'captured record');
rejects(fixture({ changed: (_, r) => typed(root, new Update(r, [new Prop('a', int(1)), new Prop('a', int(2))])) }), 'duplicate update labels');
rejects([{ recursive: true, bindings: [...fixture()[0].bindings, ...fixture({ name: 'mutual' })[0].bindings] }], 'mutual group');

function helper(name = 'nextFields', prefix = false, constant = false) {
  const n = local(i, 60), r = local(root, 61);
  const oldA = prefix ? local(i, 62) : field(r, ['a']);
  let body = update(r, add(field(r, ['b', 'c']), int(1)), add(oldA, int(2)),
    add(field(r, ['b', 'd', 'e']), int(3)), add(field(r, ['b', 'd', 'f']), op(OpMod.value, n, int(5))));
  if (prefix) body = new Let(new Just('saved'), 62, field(r, ['a']), body);
  if (constant) body = typed(root, new Update(r, [new Prop('a', int(7))]));
  return { recursive: false, bindings: [new Tuple(name, typed(ty, new Abs([param(60), param(61)], body)))] };
}
const withCall = [helper(), ...fixture({ name: 'throughCall', changed: (n, r) => call('nextFields', [n, r]) })];
const withLetCall = [helper('nextWithLet', true), ...fixture({ name: 'throughLetCall', changed: (n, r) => call('nextWithLet', [n, r]) })];
accepts(withCall);
accepts(withLetCall);
const withConstantCall = [helper('constantField', false, true),
  ...fixture({ name: 'throughConstant', changed: (n, r) => call('constantField', [n, r]) })];
accepts(withConstantCall);
rejects([helper(), ...fixture({ changed: (n, r) => call('nextFields', [add(n, int(1)), r]) })],
  'computed arguments must not be duplicated between field workers');
rejects([helper(), ...fixture({ changed: (n, r) => call('nextFields', [n, r], root, 'AnotherModule') })],
  'a same-named foreign helper has no local body proof');
rejects([helper(), ...fixture({ changed: (n, r) => call('nextFields', [n, typed(root, new Update(r, [new Prop('a', int(9))]))]) })],
  'a computed record argument must not be reevaluated separately for each field');
rejects([helper(), ...fixture({ changed: (n, r) => call('nextFields', [n, call('makeRecord', [r])]) })],
  'an opaque record-producing call cannot acquire local provenance');

const n = local(i, 0), r = local(root, 1);
const again = value => call('intermittent', [op(OpSubtract.value, n, int(1)), value]);
const modulus = op(OpMod.value, n, int(3));
const intermittentBody = typed(root, new Branch([new Pair(eq(n, int(0)), r)], typed(root, new Branch([
  new Pair(eq(modulus, int(1)), again(r)),
  new Pair(eq(modulus, int(2)), again(typed(root, new Update(r, [new Prop('a', add(field(r, ['a']), int(1)))])))),
], again(typed(root, new Update(r, [new Prop('b', typed(child, new Update(get(r, 'b'), [
  new Prop('c', add(field(r, ['b','c']), int(2))),
])))])))))));
const intermittent = [{ recursive: true, bindings: [new Tuple('intermittent', typed(ty, new Abs([param(0), param(1)], intermittentBody)))] }];
accepts(intermittent);
const wideLabels = Array.from({ length: 16 }, (_, index) => `v${index}`);
const wideType = record(wideLabels.map(label => [label, i]));
const wideRecord = local(wideType, 1);
const wideUpdate = typed(wideType, new Update(wideRecord, wideLabels.map(label =>
  new Prop(label, add(field(wideRecord, [label]), int(1))))));
const wideBody = typed(wideType, new Branch([new Pair(eq(n, int(0)), wideRecord)],
  call('wideLoop', [op(OpSubtract.value, n, int(1)), wideUpdate], wideType)));
const wide = [{ recursive: true, bindings: [new Tuple('wideLoop', typed(new Func([i, wideType], wideType),
  new Abs([param(0), param(1)], wideBody)))] }];
accepts(wide);

const groups = [...fixture(), ...withLet, ...withCall, ...withLetCall, ...withConstantCall, ...intermittent, ...wide];
const generated = codegenModule(emptyMap)(emptyMap)({ name: moduleName, dataDecls: [], classDecls: [] })({ name: moduleName, bindings: groups });
assert.match(generated, /fn ScalarRecords_\w+__purust_/, 'actual codegen integrates the transformation');
const transformed = accepts(fixture());
const workerNames = transformed.bindings.flatMap(g => g.bindings.map(b => b.value0)).filter(n => n !== 'rotateFields');
const reserved = fromFoldable(foldableArray)(ordString)(workerNames);
const collision = accepts(fixture(), reserved);
for (const g of collision.bindings) for (const b of g.bindings) {
  if (b.value0 !== 'rotateFields') assert.ok(!workerNames.includes(b.value0), 'fresh worker avoids foreign reserved names');
}
const callWorkers = accepts(withCall).bindings.flatMap(g => g.bindings.map(b => b.value0))
  .filter(name => !['throughCall','nextFields'].includes(name));
const callCollision = accepts(withCall, fromFoldable(foldableArray)(ordString)(callWorkers));
for (const g of callCollision.bindings) for (const b of g.bindings) {
  if (!['throughCall','nextFields'].includes(b.value0)) assert.ok(!callWorkers.includes(b.value0), 'helper workers honor reserved names');
}

const wideShape = [...wideLabels].sort().join('_');
const shapes = fromFoldable(foldableArray)(ordString)(['a,b,keep,z', 'c,d', 'e,f', wideLabels.join(',')]);
const prelude = codegenPrelude(shapes);
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const checks = `
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::alloc::{GlobalAlloc, Layout, System};
static TRACK: AtomicBool = AtomicBool::new(false);
static ALLOCS: AtomicUsize = AtomicUsize::new(0);
struct Counter;
unsafe impl GlobalAlloc for Counter {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if TRACK.load(Ordering::Relaxed) { ALLOCS.fetch_add(1, Ordering::Relaxed); }
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, p: *mut u8, layout: Layout) { System.dealloc(p, layout); }
}
#[global_allocator] static ALLOCATOR: Counter = Counter;
fn seed(v: [i64;4]) -> Value {
    Value::Record_a_b_keep_z(perceus_ptr::PerceusPtr::new(Record_a_b_keep_z {
        a: Some(mk_int(v[0])), keep: Some(mk_int(99)), z: Some(mk_int(777)),
        b: Some(Value::Record_c_d(perceus_ptr::PerceusPtr::new(Record_c_d {
            c: Some(mk_int(v[1])), d: Some(Value::Record_e_f(perceus_ptr::PerceusPtr::new(Record_e_f {
                e: Some(mk_int(v[2])), f: Some(mk_int(v[3]))
            })))
        })))
    }))
}
fn values(r: &Value) -> [i64;4] {
    [r.__purust_borrow_a().unwrap_int(), r.__purust_borrow_b().__purust_borrow_c().unwrap_int(),
     r.__purust_borrow_b().__purust_borrow_d().__purust_borrow_e().unwrap_int(),
     r.__purust_borrow_b().__purust_borrow_d().__purust_borrow_f().unwrap_int()]
}
fn expected(mut n:i64, mut v:[i64;4])->[i64;4] {
    while n != 0 { v=[v[1]+1,v[0]+2,v[2]+3,v[3]+n.checked_rem_euclid(5).unwrap_or(0)]; n-=1; } v
}
fn main() {
    let initial=seed([4,8,12,16]);
    assert_eq!(values(&ScalarRecords_throughConstant(0,initial.clone())),[4,8,12,16]);
    assert_eq!(values(&ScalarRecords_throughConstant(31,initial.clone())),[7,8,12,16]);
    assert_eq!(values(&initial),[4,8,12,16]);
    let wide=Value::Record_${wideShape}(perceus_ptr::PerceusPtr::new(Record_${wideShape} {
        ${wideLabels.map((label, index) => `${label}:Some(mk_int(${index}))`).join(',')}
    }));
    let result=ScalarRecords_wideLoop(31,wide);
    ${wideLabels.map((label, index) => `assert_eq!(result.get_${label}().unwrap_int(),${index + 31});`).join('\n')}
    for n in [0,1,2,3,4,5,31,1000] {
        let original=seed([5,11,23,29]); let mut expected=[5,11,23,29];
        for k in (1..=n).rev() { if k%3==2 { expected[0]+=1; } else if k%3==0 { expected[1]+=2; } }
        let arg=original.clone(); ALLOCS.store(0,Ordering::Relaxed); TRACK.store(true,Ordering::Relaxed);
        let result=ScalarRecords_intermittent(n,arg); TRACK.store(false,Ordering::Relaxed);
        if n<=1 { assert_eq!(ALLOCS.load(Ordering::Relaxed),0,"no changed branch means no reconstruction"); }
        assert_eq!(values(&result),expected); assert_eq!(values(&original),[5,11,23,29]);
        assert_eq!(result.get_keep().unwrap_int(),99); assert_eq!(result.get_z().unwrap_int(),777);
    }
    for fun in [ScalarRecords_rotateFields as fn(i64,Value)->Value, ScalarRecords_withLet,
                ScalarRecords_throughCall, ScalarRecords_throughLetCall] {
        for fields in [[0,0,0,0], [3,19,-100,7], [-5,99,12,-50]] {
            for n in [0,1,2,3,31,1000] {
                let original=seed(fields); let b=original.get_b(); let d=b.get_d();
                let result=fun(n,original.clone());
                assert_eq!(values(&result),expected(n,fields)); assert_eq!(values(&original),fields);
                assert_eq!(result.get_keep().unwrap_int(),99); assert_eq!(result.get_z().unwrap_int(),777);
                assert_eq!(b.get_c().unwrap_int(),fields[1]); assert_eq!(d.get_e().unwrap_int(),fields[2]); assert_eq!(d.get_f().unwrap_int(),fields[3]);
            }
        }
        let original=seed([0,0,0,0]); let arg=original.clone();
        ALLOCS.store(0,Ordering::Relaxed); TRACK.store(true,Ordering::Relaxed);
        let result=fun(0,arg); TRACK.store(false,Ordering::Relaxed);
        assert_eq!(ALLOCS.load(Ordering::Relaxed),0,"zero iterations must not allocate");
        if let (Value::Record_a_b_keep_z(a),Value::Record_a_b_keep_z(b))=(&original,&result) {
            assert!(std::ptr::eq(&**a,&**b));
        } else { panic!("root shape changed"); }
        let owned=seed([0,0,0,0]);
        let address=if let Value::Record_a_b_keep_z(p)=&owned { &**p as *const _ } else { unreachable!() };
        ALLOCS.store(0,Ordering::Relaxed); TRACK.store(true,Ordering::Relaxed);
        let result=fun(100,owned); TRACK.store(false,Ordering::Relaxed);
        assert_eq!(ALLOCS.load(Ordering::Relaxed),0,"a unique input must remain reusable after wrapper extraction");
        assert_eq!(values(&result),expected(100,[0,0,0,0]));
        if let Value::Record_a_b_keep_z(p)=&result { assert_eq!(&**p as *const _,address); }
        else { panic!("root shape changed"); }
    }
}
`;
// Keep the exact code emitted by this fixture when running a separate,
// uninstrumented performance experiment. Ordinary tests leave no artifacts.
if (process.env.PURUST_SCALAR_ARTIFACT_DIR) {
  writeFileSync(join(process.env.PURUST_SCALAR_ARTIFACT_DIR, 'generated-call-fixture.rs'),
    `${prelude}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;\n${generated}\n${checks.slice(checks.indexOf('fn seed('), checks.indexOf('fn main()'))}`);
}
const directory = mkdtempSync(join(tmpdir(), 'purust-record-scalars-'));
try {
  for (const threaded of [false, true]) {
    const source = join(directory, threaded ? 'arc.rs' : 'rc.rs');
    const executable = source.slice(0, -3);
    const code = `${threaded ? threadedPrelude(prelude) : prelude}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;\n${threaded ? threadedRust(generated + checks) : generated + checks}`;
    writeFileSync(source, code);
    for (const [cmd, args] of [['rustc', ['--edition=2021', '-Awarnings', '-C', 'opt-level=3', source, '-o', executable,
      ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]], [executable, []]]) {
      const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
      assert.equal(result.status, 0, `${cmd}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}\nsource=${source}`);
    }
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log('Record scalarization: generated loops, simultaneous field dependencies, scalar lets, retained aliases, untouched fields, zero allocations/identity and conservative fallbacks passed under Rc/Arc.');
