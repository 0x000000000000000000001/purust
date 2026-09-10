// Synthetic superclass applications can lack annotations. Their classDecls
// layout must still provide the thunk result type across multiple levels.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { superclassFields } from '../../output/Purust.ClassFields/index.js';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, Int, LitRecord, Prop, TypeVar }
  from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, App, GetProp, Let, Lit, Local, PrimUndefined, Typed }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const name = 'SuperclassFields';
const any = Any.value;
const int = Int.value;
const a = new TypeVar('a');
const type = className => new ADT(className, [name, className], [a]);
const base = type('Base');
const middle = type('Middle');
const top = type('Top');
const methodType = new Func([a], int);
const declarations = [
  { name: 'Base', vars: ['a'], methods: [new Tuple('readValue', methodType)], superclasses: [] },
  { name: 'Middle', vars: ['a'], methods: [], superclasses: [new Tuple([name, 'Base'], [a])] },
  { name: 'Top', vars: ['a'], methods: [], superclasses: [new Tuple([name, 'Middle'], [a])] },
];
assert.deepEqual(superclassFields(declarations[1]), [new Tuple('Base0', new Func([any], base))]);
const fields = declarations.reduce((table, decl) => insert(ordString)(`${name}_${decl.name}`)
  ([...superclassFields(decl), ...decl.methods])(table), emptyMap);
const param = (label, level) => new Tuple(new Just(label), level);
const local = (label, level) => new Local(new Just(label), level);
const typed = (ty, expr) => new Typed(ty, expr);
const field = (expr, label) => new Accessor(expr, new GetProp(label));
const force = (expr, label) => new App(field(expr, label), [PrimUndefined.value]);
const pending = (resultType, level, value) => typed(new Func([any], resultType),
  new Abs([param(`ignored${level}`, level)], value));
const literal = (ty, label, value) => typed(ty, new Lit(new LitRecord([new Prop(label, value)])));
const makeBase = literal(base, 'readValue', typed(new Func([any], int),
  new Abs([param('ignoredValue', 3)], local('seed', 0))));
const makeMiddle = literal(middle, 'Base0', pending(base, 2, makeBase));
const makeTop = literal(top, 'Middle0', pending(middle, 1, makeMiddle));
const bindings = [
  new Tuple('make', typed(new Func([int], top), new Abs([param('seed', 0)], makeTop))),
  new Tuple('read', typed(new Func([top, any], int), new Abs([param('dictionary', 0), param('input', 1)],
    // Deliberately no Typed wrappers on either local value or application.
    new Let(new Just('middle'), 2, force(local('dictionary', 0), 'Middle0'),
      new Let(new Just('base'), 3, force(local('middle', 2), 'Base0'),
        new App(field(local('base', 3), 'readValue'), [local('input', 1)])))))),
];
const generated = codegenModule(emptyMap)(fields)({ name, classDecls: declarations, dataDecls: [] })
  ({ name, bindings: [{ recursive: false, bindings }] });
assert.doesNotMatch(generated, /\.get_(?:Middle0|Base0)\(/,
  'a native superclass dictionary must never use dynamic record access');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const source = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    for expected in [-3_i64, 0, 37] {
        let dictionary = SuperclassFields_make(expected);
        assert_eq!(SuperclassFields_read(dictionary.clone(), Value::Unit), expected);
        assert_eq!(SuperclassFields_read(dictionary, mk_int(99)), expected);
    }
    println!("Native superclass thunk results survive two unannotated projections.");
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-superclass-fields-'));
try {
  const path = join(directory, 'main.rs');
  const binary = join(directory, 'checks');
  writeFileSync(path, source);
  for (const [command, args] of [
    ['rustc', ['--edition=2021', '-C', 'opt-level=1', path, '-o', binary]],
    [binary, []],
  ]) {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    if (command === binary) process.stdout.write(result.stdout);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
