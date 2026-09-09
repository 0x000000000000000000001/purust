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
const leaf = new Record(new Row([new Tuple('e', int), new Tuple('f', int)], Nothing.value));
const middle = l => new Record(new Row([new Tuple('c', int), new Tuple('d', l), new Tuple('z', l)], Nothing.value));
const deep = root(middle(leaf));
const dr = new Typed(deep, local(0));
const db = get(dr, 'b');
const dd = get(db, 'd');
const leafChange = source => new Update(source, [new Prop('e', new Lit(new LitInt(3)))]);
const deepChange = (value = leafChange(dd), b = db, r = dr) => new Update(r, [new Prop('b', new Update(b, [new Prop('d', value)]))]);
add('deep', [deep], deep, deepChange());
add('deepWrapped', [deep], deep, deepChange(new TypeApp(new Typed(leaf, leafChange(new Typed(leaf, get(new Typed(middle(leaf), db), 'd')))), int)));
add('otherDeepRoot', [deep, deep], deep, deepChange(leafChange(get(get(new Typed(deep, local(1)), 'b'), 'd'))));
add('wrongPath', [deep], deep, deepChange(leafChange(get(get(dr, 'z'), 'd'))));
add('wrongLeafField', [deep], deep, deepChange(leafChange(get(db, 'z'))));
add('calledLeaf', [deep, new Func([leaf], leaf)], deep, deepChange(leafChange(new Typed(leaf, new App(local(1), [dd])))));
add('convertedLeaf', [deep], deep, deepChange(leafChange(new Typed(int, dd))));
const openLeaf = new Record(new Row([new Tuple('e', int)], new Just(new TypeVar('r'))));
const openDeep = root(middle(openLeaf));
const odr = new Typed(openDeep, local(0));
add('openLeaf', [openDeep], openDeep, deepChange(leafChange(get(get(odr, 'b'), 'd')), get(odr, 'b'), odr));
add('twoLeaves', [deep], deep, new Update(dr, [new Prop('b', new Update(db, [new Prop('d', leafChange(dd)), new Prop('z', leafChange(get(db, 'z')))]))]));
const deeper = root(middle(middle(leaf)));
const rr = new Typed(deeper, local(0));
const rb = get(rr, 'b'); const rd = get(rb, 'd');
add('threeChildren', [deeper], deeper, deepChange(new Update(rd, [new Prop('d', leafChange(get(rd, 'd')))]), rb, rr));
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
for (const name of ['deep', 'deepWrapped', 'twoLeaves', 'threeChildren']) {
  const body = bodies.get(name);
  assert.equal((body.match(/let mut _record_child(?:_\d+)? = /g) ?? []).length, name === 'threeChildren' ? 3 : 2, name);
  assert.match(body, /_record_child\.set_d\(crate::Value::Unit\);/, name);
  assert.ok(body.indexOf('let _record_child_1_update_') < body.lastIndexOf('let mut _base = '), name);
  assert.ok(body.indexOf('_record_child.set_d(_record_child_1);') < body.indexOf('_base.set_b(_record_child);'), name);
}
for (const name of ['otherDeepRoot', 'wrongPath', 'wrongLeafField', 'calledLeaf', 'convertedLeaf', 'openLeaf']) {
  assert.equal((bodies.get(name).match(/let mut _record_child(?:_\d+)? = /g) ?? []).length, 1, name);
}
console.log('Record child reuse: closed TAST rows, same local/field, wrappers, one path across three child levels, sibling limit, sharing/liveness and fallback guards checked.');
