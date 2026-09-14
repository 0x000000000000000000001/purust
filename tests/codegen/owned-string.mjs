import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Func, LitString, String as StringType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Fail, Lit, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const consume = new Func([Any.value], Any.value);
const binding = (name, expression) => new Tuple(name, new Typed(new Func([consume], Any.value),
  new Abs([new Tuple(new Just('consume'), 0)], new App(new Local(new Just('consume'), 0),
    [new Typed(StringType.value, expression)]))));
const generated = codegenModule(emptyMap)(emptyMap)({ name: 'OwnedString', dataDecls: [], classDecls: [] })({
  name: 'OwnedString', bindings: [{ recursive: false, bindings: [
    binding('failed', new Fail('Failed pattern match')),
    binding('value', new Lit(new LitString('abc\ud800😀'))),
  ] }],
});
assert.ok(generated.includes('purust_core::Value::String('));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-owned-string-'));
const source = join(directory, 'main.rs'), binary = join(directory, 'main');
writeFileSync(source, `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
fn main() {
    assert_eq!(purust_string_to_utf16(&OwnedString_value(Func1::Static(|x| x)).unwrap_string()),
        vec![97, 98, 99, 0xd800, 0xd83d, 0xde00]);
    std::panic::set_hook(Box::new(|_| {}));
    assert!(std::panic::catch_unwind(|| OwnedString_failed(Func1::Static(|_| panic!("not reached")))).is_err());
}
`);
for (const [command, args] of [['rustc', ['--edition=2021', '-Awarnings', source, '-o', binary]], [binary, []]]) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
console.log('Owned String boxing preserves UTF-16 and compiles diverging expressions without an unsized str.');
