// Dictionary fields share the record keyword escaping without renaming their
// PureScript labels or colliding with distinct *_kw user fields.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { singleton } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Func, Int, LitInt, LitRecord, Prop, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Accessor, CtorSaturated, GetProp, Lit, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
const name = 'ClassKeywords', type = new ADT(`${name}.Keywords`, [name, 'Keywords'], []);
const names = ['async', 'async_kw', 'match', 'match_kw', 'where', 'where_kw', 'final', 'final_kw'];
const methods = names.map(field => new Tuple(field, Int.value));
const props = names.map((field, index) => new Prop(field, new Lit(new LitInt(index + 1))));
const fields = insert(ordString)(`${name}_Keywords`)(methods)(emptyMap);
const parameter = new Tuple(new Just('input'), 0), input = new Local(new Just('input'), 0);
const bindings = [
  new Tuple('literal', new Typed(type, new Lit(new LitRecord(props)))),
  new Tuple('raw', new Lit(new LitRecord(props))),
  new Tuple('convert', new Typed(new Func([Any.value], type), new Abs([parameter], new Typed(type, input)))),
  new Tuple('constructor', new CtorSaturated(new Qualified(new Just(name), 'Keywords$Dict'), SumType.value,
    'Keywords', 'Keywords$Dict', names.map((_, index) => new Tuple(Int.value, new Lit(new LitInt(index + 1)))))),
  ...names.map(field => new Tuple(`read_${field}`, new Typed(new Func([type], Int.value),
    new Abs([parameter], new Accessor(input, new GetProp(field)))))),
];
const generated = codegenModule(emptyMap)(fields)({ name, dataDecls: [], classDecls: [
  { name: 'Keywords', vars: [], methods, superclasses: [] },
] })({ name, bindings: [{ recursive: false, bindings }] });
for (const keyword of ['async', 'match', 'where', 'final']) assert.ok(generated.includes(`pub r#${keyword}: i64`));
const main = `fn main() {
    for dictionary in [ClassKeywords_literal(), ClassKeywords_convert(ClassKeywords_raw()), ClassKeywords_constructor()] {
        ${names.map((field, index) => `assert_eq!(ClassKeywords_read_${field}(dictionary.clone()), ${index + 1});`).join('\n')}
    }
}`;
const prelude = codegenPrelude(singleton(names.slice().sort().join(',')));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-class-keywords-'));
try {
  for (const threaded of [false, true]) {
    const path = join(directory, threaded ? 'arc.rs' : 'rc.rs'), binary = path + '.bin';
    writeFileSync(path, `${threaded ? threadedPrelude(prelude) : prelude}\nextern crate self as purust_core;\n#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;\n${threaded ? threadedRust(generated + main) : generated + main}`);
    for (const [command, args] of [['rustc', ['--edition=2021', '-Awarnings', ...(threaded ? ['--cfg', 'feature="threaded"'] : []), path, '-o', binary]], [binary, []]]) {
      const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
    }
  }
  console.log('Keyword class fields: native literals, constructors, dynamic conversion, projections and distinct labels passed in Rc/Arc.');
} finally { rmSync(directory, { recursive: true, force: true }); }
