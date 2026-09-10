// Recursive bindings can contain opaque values, records and primitives as well
// as functions. Exercise the generated neutral LetRec in both runtime modes.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { singleton } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Func, Int } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, GetProp, LetRec, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const value = Any.value;
const unary = new Func([value], value);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const recursive = (rhs, body = local('node', 1)) => new LetRec(1, [new Tuple('node', rhs)], body);
const binding = (name, argument, result, body) => new Tuple(name,
  new Typed(new Func([argument], result), new Abs([param('input', 0)], body)));
const self = new Typed(unary, new Abs([param('ignored', 2)], local('node', 1)));
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'RecursiveValues', dataDecls: [], classDecls: [] },
)({ name: 'RecursiveValues', bindings: [{ recursive: false, bindings: [
  binding('opaque', unary, value, recursive(new App(local('input', 0), [self]))),
  binding('boxed', value, value, recursive(local('input', 0))),
  binding('native', Int.value, Int.value, recursive(local('input', 0), new Typed(Int.value, local('node', 1)))),
  binding('field', value, Int.value, recursive(local('input', 0),
    new Typed(Int.value, new Accessor(local('node', 1), new GetProp('value'))))),
  binding('alias', value, value, new LetRec(1, [
    new Tuple('first', local('input', 0)),
    new Tuple('second', local('first', 1)),
  ], local('second', 1))),
] }] });

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const main = `
#[derive(Clone)]
struct Node { next: Func1<Value, Value> }
fn main() {
    let node = RecursiveValues_opaque(Func1::Static(|next| {
        Value::Class(std::rc::Rc::new(Node { next: next.unwrap_func1() }))
    }));
    let first = node.unwrap_class::<Node>();
    let again = (first.next)(Value::Unit);
    assert!(std::ptr::eq(first, again.unwrap_class::<Node>()), "recursive opaque identity must survive resolution");
    assert_eq!(RecursiveValues_native(42), 42);
    assert_eq!(RecursiveValues_alias(Value::Int(42)).unwrap_int(), 42);
    RecursiveValues_boxed(Value::Unit).unwrap_unit();
    assert_eq!(RecursiveValues_boxed(Value::Int(42)).unwrap_int(), 42);
    assert_eq!(RecursiveValues_boxed(Value::Number(4.2)).unwrap_number(), 4.2);
    assert!(RecursiveValues_boxed(Value::Bool(true)).unwrap_bool());
    assert_eq!(RecursiveValues_boxed(Value::String("recursive".into())).unwrap_string(), "recursive");
    assert_eq!(RecursiveValues_boxed(Value::Char('r')).unwrap_char(), 'r');
    let array = std::rc::Rc::new(vec![Value::Int(42)]);
    assert!(std::rc::Rc::ptr_eq(&array, &RecursiveValues_boxed(Value::Array(array.clone())).unwrap_array()));
    let mut record = Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a { tag: "Node", ..Default::default() }));
    record.set_value(Value::Int(42));
    assert_eq!(RecursiveValues_field(record.clone()), 42);
    let mut wrapped = RecursiveValues_boxed(record.clone());
    assert_eq!(wrapped.get_tag(), "Node");
    assert_eq!(wrapped.__purust_borrow_value().unwrap_int(), 42);
    wrapped.set_value(Value::Int(43));
    assert_eq!(wrapped.get_value().unwrap_int(), 43);
    assert_eq!(record.get_value().unwrap_int(), 42, "record update must preserve sharing semantics");
    let unary = RecursiveValues_boxed(Value::Func1(Func1::Static(|a| Value::Func1(Func1::Shared(std::rc::Rc::new(move |b| {
        Value::Int(a.unwrap_int() + b.unwrap_int())
    }))))));
    assert_eq!(unary.unwrap_func2()(Value::Int(20), Value::Int(22)).unwrap_int(), 42);
    let binary = RecursiveValues_boxed(Value::Func2(Func2::Static(|a, b| Value::Int(a.unwrap_int() + b.unwrap_int()))));
    assert_eq!(binary.unwrap_func2()(Value::Int(20), Value::Int(22)).unwrap_int(), 42);
    assert_eq!(binary.unwrap_func1()(Value::Int(20)).unwrap_func1()(Value::Int(22)).unwrap_int(), 42);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-recursive-values-'));
try {
  for (const threaded of [false, true]) {
    const prelude = codegenPrelude(singleton('value'));
    const source = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${threaded ? threadedRust(generated + main) : generated + main}`;
    const file = join(directory, 'main.rs');
    const binary = join(directory, threaded ? 'threaded' : 'local');
    writeFileSync(file, source);
    const flags = threaded ? ['--cfg', 'feature="threaded"'] : [];
    const build = spawnSync('rustc', ['--edition=2021', '-Awarnings', ...flags, file, '-o', binary], { encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stderr}`);
  }
  console.log('Recursive values: opaque identity, aliases, primitives, records and function adapters passed in local and threaded modes.');
} finally { rmSync(directory, { recursive: true, force: true }); }
