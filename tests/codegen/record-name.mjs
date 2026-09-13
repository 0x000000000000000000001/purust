import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude } from '../../src/Purust/Threading.js';

const code = codegenPrelude(fromFoldable(foldableArray)(ordString)(['', 'a', 'a,b', 'a_', '_a']));
assert.equal([...code.matchAll(/pub struct Record_a \{/g)].length, 1);
assert.match(code, /pub struct ClosedRecord_a \{/);
assert.match(code, /pub struct Record_a_b \{/);
const directory = mkdtempSync(join(tmpdir(), 'purust-record-name-'));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
for (const threaded of [false, true]) {
  const file = join(directory, threaded ? 'threaded.rs' : 'normal.rs'), binary = file.slice(0, -3);
  writeFileSync(file, `${threaded ? threadedPrelude(code) : code}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
fn main() {
    let closed = Value::ClosedRecord_a(perceus_ptr::PerceusPtr::new(ClosedRecord_a { a: Some(mk_int(42)) }));
    let open = Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a { a: Some(mk_int(7)), ..Default::default() }));
    assert_eq!(closed.get_a().unwrap_int(), 42);
    assert_eq!(open.get_a().unwrap_int(), 7);
    let updated = closed.clone().__purust_set_field("a", mk_int(99));
    assert_eq!(updated.__purust_get_field("a").unwrap().unwrap_int(), 99);
    assert_eq!(closed.get_a().unwrap_int(), 42);
    let widened = closed.__purust_set_field("runtime-key", mk_int(12));
    assert_eq!(widened.get_a().unwrap_int(), 42);
    assert_eq!(widened.__purust_get_field("runtime-key").unwrap().unwrap_int(), 12);
}
`);
  for (const [cmd, args] of [['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary,
    ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]], [binary, []]]) {
    const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
}
console.log(`record name: normal/threaded native checks passed; ${directory}`);
