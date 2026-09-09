import assert from 'node:assert/strict';
import { codegenModule } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Map/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Func, Int, LitInt, Prop, Record, Row, TypeVar } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, GetProp, Lit, Local, Typed, TypeApp, Update } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
const int = Int.value;
const child = new Record(new Row([new Tuple('c', int), new Tuple('d', int)], Nothing.value));
const openChild = new Record(new Row([new Tuple('c', int)], new Just(new TypeVar('r'))));
const root = c => new Record(new Row([new Tuple('a', int), new Tuple('b', c), new Tuple('z', c)], Nothing.value));
const record = root(child);
const local = n => new Local(new Just(`input${n}`), n);
const param = n => new Tuple(new Just(`input${n}`), n);
const r = new Typed(record, local(0));
const get = (v, k) => new Accessor(v, new GetProp(k));
const change = source => new Update(source, [new Prop('c', new Lit(new LitInt(1)))]);
const update = (base = r, value = change(get(r, 'b'))) => new Update(base, [new Prop('b', value)]);
const bindings = [];
function add(name, args, result, body) {
  bindings.push(new Tuple(name, new Typed(new Func(args, result), new Abs(args.map((_, i) => param(i)), body))));
}
add('plain', [record], record, update());
add('wrapped', [record], record, update(r, new TypeApp(new Typed(child, change(new Typed(child, get(r, 'b')))), int)));
add('twoChildren', [record], record, new Update(r, [new Prop('b', change(get(r, 'b'))), new Prop('z', change(get(r, 'z')))]));
add('otherRoot', [record, record], record, update(r, change(get(new Typed(record, local(1)), 'b'))));
add('otherField', [record], record, update(r, change(get(r, 'z'))));
add('calledChild', [record, new Func([child], child)], record, update(r, change(new Typed(child, new App(local(1), [get(r, 'b')])))));
add('liveRoot', [record, new Func([record, record], int)], int, new App(local(1), [update(), r]));
const opened = new Typed(root(openChild), local(0));
add('openChild', [root(openChild)], root(openChild), update(opened, change(get(opened, 'b'))));
add('convertedChild', [record], record, update(r, change(new Typed(int, get(r, 'b')))));
add('duplicateRootField', [record], record, new Update(r, [new Prop('b', change(get(r, 'b'))), new Prop('b', change(get(r, 'b')))]));
add('duplicateChildField', [record], record, update(r, new Update(get(r, 'b'), [new Prop('c', get(r, 'a')), new Prop('c', get(r, 'a'))])));
add('capturedRoot', [record], new Func([int], record), new Typed(new Func([int], record), new Abs([param(1)], update())));
const generated = codegenModule(empty)(empty)({ name: 'ChildReuse', dataDecls: [], classDecls: [] })({ name: 'ChildReuse', bindings: [{ recursive: false, bindings }] });
const bodies = new Map(generated.split(/^pub fn /m).slice(1).map(body => [body.match(/^ChildReuse_(\w+)\(/)?.[1], body]));
for (const name of ['plain', 'wrapped', 'twoChildren']) {
  const body = bodies.get(name);
  assert.match(body, /let _record_child_update_0 = /, name);
  assert.ok(body.indexOf('let _record_child_update_0') < body.lastIndexOf('let mut _base = '), name);
  assert.equal((body.match(/let mut _record_child = /g) ?? []).length, 1, name);
  assert.match(body, /_base\.set_b\(crate::Value::Unit\);/, name);
  assert.match(body, /_record_child\.set_c\(_record_child_update_0\);/, name);
}
for (const name of ['otherRoot', 'otherField', 'calledChild', 'liveRoot', 'openChild', 'convertedChild', 'duplicateRootField', 'duplicateChildField', 'capturedRoot']) {
  assert.ok(bodies.has(name), name);
  assert.doesNotMatch(bodies.get(name), /let mut _record_child = /, name);
}
console.log('Record child reuse: closed TAST rows, same local/field, wrappers, one-child limit, sharing/liveness and fallback guards checked.');
