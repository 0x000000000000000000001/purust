import assert from 'node:assert/strict';
import { codegenModule } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Map/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Func, Int, LitInt, Prop, Record, Row, TypeVar } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, GetProp, Lit, Local, Typed, TypeApp, Update } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const integer = Int.value;
const record = new Record(new Row([new Tuple('a', integer), new Tuple('b', integer)], Nothing.value));
const openRecord = new Record(new Row([new Tuple('a', integer)], new Just(new TypeVar('r'))));
const param = n => new Tuple(new Just(`input${n}`), n);
const local = n => new Local(new Just(`input${n}`), n);
const field = (base, name) => new Typed(integer, new Accessor(base, new GetProp(name)));
const literal = n => new Lit(new LitInt(n));
const update = (base, rhs = field(base, 'a')) => new Update(base, [new Prop('a', rhs)]);
const r = new Typed(record, local(0));
const bindings = [];
function binding(name, args, ret, body) {
  bindings.push(new Tuple(name, new Typed(new Func(args, ret), new Abs(args.map((_, i) => param(i)), body))));
}
binding('lastUse', [record], record, update(r));
binding('wrapped', [record], record, update(new TypeApp(new Typed(record, r), integer)));
binding('stillNeeded', [record, new Func([record, record], integer)], integer,
  new App(local(1), [update(r), r]));
binding('baseCall', [record, new Func([record], record)], record,
  update(new Typed(record, new App(local(1), [r])), field(r, 'a')));
binding('openRow', [openRecord], openRecord, update(new Typed(openRecord, local(0))));
binding('converted', [integer], record, update(r));
binding('noSourceRead', [record], record, update(r, literal(1)));
binding('captured', [record], new Func([integer], record),
  new Typed(new Func([integer], record), new Abs([param(1)], update(r))));

const generated = codegenModule(empty)(empty)({ name: 'RecordMove', dataDecls: [], classDecls: [] })(
  { name: 'RecordMove', bindings: [{ recursive: false, bindings }] });
const bodies = new Map(generated.split(/^pub fn /m).slice(1).map(body =>
  [body.match(/^RecordMove_(\w+)\(/)?.[1], body]));
for (const name of ['lastUse', 'wrapped']) {
  const body = bodies.get(name);
  assert.match(body, /let _record_update_0 = /, name);
  assert.match(body, /let mut _base = (?:\/\*[^]*?\*\/)?purs_local_0;/, name);
  assert.ok(body.indexOf('let _record_update_0') < body.indexOf('let mut _base'), name);
  assert.match(body, /_base\.set_a\(_record_update_0\);/, name);
}
for (const name of ['stillNeeded', 'baseCall', 'openRow', 'converted', 'noSourceRead', 'captured']) {
  assert.ok(bodies.has(name), name);
  assert.doesNotMatch(bodies.get(name), /let _record_update_/, name);
}
console.log('Record root move: last use, compatible wrappers, live/captured bases, calls, open rows, conversions and already movable bases checked.');
