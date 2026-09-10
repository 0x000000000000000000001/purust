// Borrowing a projection must preserve its TAST field path and may only
// produce an immediately copied native scalar, never an escaping reference.
import assert from 'node:assert/strict';
import { recordProjection } from '../../output/Purust.RecordBorrows/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Boolean as BooleanType, Char, Func, Int, Number as NumberType,
  Prop, Qualified, Record, Row, String as StringType, TypeVar }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Accessor, App, EffectPure, GetProp, Let, Local, Typed, TypeApp, Update, Var }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const int = Int.value;
const number = NumberType.value;
const boolean = BooleanType.value;
const char = Char.value;
const any = Any.value;
const record = (fields, tail = Nothing.value) => new Record(new Row(
  fields.map(([name, type]) => new Tuple(name, type)), tail));
const leaf = record([['count', int], ['ratio', number], ['enabled', boolean], ['symbol', char]]);
const middle = record([['entry', leaf], ['text', StringType.value]]);
const rootType = record([['nested', middle], ['direct', int]]);
const local = name => new Local(new Just(name), 0);
const get = (base, field) => new Accessor(base, new GetProp(field));
const typed = (type, expr) => new Typed(type, expr);
const source = local('source');
const root = typed(rootType, source);
const bound = new Map([['source', rootType], ['number', number]]);
const annotated = new Map();
const infer = expr => {
  if (annotated.has(expr)) return annotated.get(expr);
  if (expr instanceof Typed) return expr.value0 === any ? infer(expr.value1) : expr.value0;
  // TypeApp contains an instantiation argument, not the expression's result.
  if (expr instanceof TypeApp) return infer(expr.value0);
  if (expr instanceof Local) return bound.get(expr.value0.value0) ?? any;
  // Bare GetProp currently infers Any in CodeGen. The closed row is essential.
  return any;
};
const representation = type => {
  if (type === int) return 'i64';
  if (type === number) return 'f64';
  if (type === boolean) return 'bool';
  if (type === char) return 'char';
  if (type === StringType.value) return 'String';
  return 'crate::UnknownType';
};
const prove = (expr, result = int, repr = representation) => recordProjection(infer)(repr)(result)(expr);
const accept = (expr, fields, expectedRoot, result = int) => {
  const proof = prove(expr, result);
  assert.ok(proof instanceof Just, `expected borrowed projection ${fields.join('.')}`);
  assert.equal(proof.value0.root, expectedRoot, 'retain the exact root expression for code generation');
  assert.deepEqual(proof.value0.fields, fields);
  return proof.value0;
};
const reject = (expr, result = int, reason = 'unsupported projection', repr = representation) => {
  assert.ok(prove(expr, result, repr) instanceof Nothing, reason);
};

accept(get(root, 'direct'), ['direct'], root);
accept(get(source, 'direct'), ['direct'], source);
const nested = get(root, 'nested');
const entry = get(nested, 'entry');
for (const [field, type] of [['count', int], ['ratio', number], ['enabled', boolean], ['symbol', char]]) {
  accept(get(entry, field), ['nested', 'entry', field], root, type);
  accept(typed(type, get(entry, field)), ['nested', 'entry', field], root, type);
}
const wrappedRoot = new TypeApp(typed(rootType, root), number);
const wrappedPath = typed(int, new TypeApp(get(typed(leaf,
  get(typed(middle, get(wrappedRoot, 'nested')), 'entry')), 'count'), boolean));
accept(wrappedPath, ['nested', 'entry', 'count'], wrappedRoot);

// An annotation may supply the row for an otherwise Value-typed local. It
// must agree with any type already known for that local and keep its storage.
const unknown = local('unknown');
const annotatedRoot = typed(rootType, unknown);
accept(get(annotatedRoot, 'direct'), ['direct'], annotatedRoot);
reject(get(unknown, 'direct'), int, 'an unannotated Any root does not establish a row');
reject(get(typed(rootType, local('number')), 'direct'), int, 'scalar-to-record representation conversion');
const otherType = record([['direct', number], ['nested', middle]]);
reject(get(typed(otherType, source), 'direct'), number, 'contradictory known root type, even with the same Value storage');
reject(get(typed(any, root), 'direct'), int, 'an erased annotation is not a closed record proof');
reject(get(annotatedRoot, 'direct'), int, 'a Typed root cannot silently change runtime storage',
  type => type instanceof Record ? 'NativeRecord' : representation(type));

// All traversed rows are closed and labels must be present and unique.
const open = record([['direct', int]], new Just(new TypeVar('r')));
reject(get(typed(open, unknown), 'direct'), int, 'open root row');
const openNested = record([['nested', open], ['direct', int]]);
const openNestedRoot = typed(openNested, unknown);
reject(get(get(openNestedRoot, 'nested'), 'direct'), int, 'open intermediate row');
accept(get(openNestedRoot, 'direct'), ['direct'], openNestedRoot);
reject(get(root, 'absent'), int, 'unknown root field');
reject(get(entry, 'absent'), int, 'unknown nested field');
reject(get(get(root, 'direct'), 'field'), int, 'cannot project through a scalar');
const duplicate = record([['direct', int], ['direct', int]]);
reject(get(typed(duplicate, unknown), 'direct'), int, 'duplicate labels do not establish a layout');
const duplicateNested = record([['nested', duplicate]]);
reject(get(get(typed(duplicateNested, unknown), 'nested'), 'direct'), int, 'duplicate labels in an intermediate row');

// Unsupported field types or incompatible wrappers cannot acquire a scalar
// proof merely because the consumer requested a native number.
reject(get(entry, 'count'), number, 'requested scalar differs from the field type');
reject(typed(number, get(entry, 'count')), number, 'numeric conversion wrapper');
reject(typed(any, get(entry, 'count')), int, 'boxed scalar wrapper');
reject(get(typed(otherType, nested), 'direct'), int, 'incorrect intermediate record annotation');
reject(get(typed(any, nested), 'entry'), int, 'erased intermediate annotation');
reject(get(nested, 'text'), StringType.value, 'owned String result is outside the Copy subset');
reject(entry, leaf, 'a borrowed record cannot escape');
reject(root, int, 'the plan must contain a projection');
const unknownField = typed(record([['value', any]]), unknown);
reject(typed(int, get(unknownField, 'value')), int, 'a scalar annotation cannot replace unknown field metadata');
const wronglyInferred = get(root, 'direct');
annotated.set(wronglyInferred, number);
reject(wronglyInferred, int, 'a known accessor result must agree with its row');
const changedTypeApp = new TypeApp(get(entry, 'count'), number);
annotated.set(changedTypeApp, number);
reject(changedTypeApp, int, 'TypeApp wrappers must preserve the expression representation');

// Roots and intermediate projections are pure local paths. Even a typed
// result of an apparently harmless call must retain ordinary evaluation.
const opaque = new App(new Var(new Qualified(new Just('BorrowBoundary'), 'opaque')), [root]);
reject(get(typed(rootType, opaque), 'direct'), int, 'call root');
reject(get(typed(rootType, new Let(new Just('saved'), 1, root, root)), 'direct'), int, 'Let root');
reject(get(typed(rootType, new Update(root, [new Prop('direct', get(root, 'direct'))])), 'direct'), int, 'update root');
reject(get(typed(rootType, new EffectPure(root)), 'direct'), int, 'effect root');
reject(get(typed(rootType, new Var(new Qualified(new Just('BorrowBoundary'), 'global'))), 'direct'), int, 'global root');
reject(get(typed(leaf, new App(typed(new Func([middle], leaf), local('callback')), [nested])), 'count'), int, 'call in the field path');

console.log('Record borrowing: closed TAST paths, four native scalars, root storage, annotations and opaque boundaries checked.');
