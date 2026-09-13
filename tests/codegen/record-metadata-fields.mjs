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

const code = codegenPrelude(fromFoldable(foldableArray)(ordString)(['', 'call,clone,tag,vals']));
assert.match(code, /pub fn get_tag\(&self\) -> UnknownType/);
assert.match(code, /pub fn __purust_ctor_tag\(&self\) -> &'static str/);
const directory = mkdtempSync(join(tmpdir(), 'purust-record-metadata-'));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
for (const threaded of [false, true]) {
  const file = join(directory, threaded ? 'threaded.rs' : 'normal.rs'), binary = file.slice(0, -3);
  writeFileSync(file, `${threaded ? threadedPrelude(code) : code}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
fn main() {
    let closed = Value::Record_call_clone_tag_vals(perceus_ptr::PerceusPtr::new(Record_call_clone_tag_vals {
        call: Some(mk_int(1)), clone: Some(mk_int(2)), tag: Some(mk_int(3)), vals: Some(mk_int(4))
    }));
    assert_eq!(closed.get_tag().unwrap_int(), 3);
    assert_eq!(closed.__purust_borrow_tag().unwrap_int(), 3);
    assert_eq!(closed.get_call().unwrap_int(), 1);
    assert_eq!(closed.get_clone().unwrap_int(), 2);
    assert_eq!(closed.get_vals().unwrap_int(), 4);
    let mut changed = closed.clone();
    changed.set_tag(mk_int(9));
    assert_eq!(changed.get_tag().unwrap_int(), 9);
    assert_eq!(closed.get_tag().unwrap_int(), 3);
    let widened = closed.__purust_set_field("extra", mk_int(5));
    assert_eq!(widened.get_tag().unwrap_int(), 3);
    assert_eq!(widened.__purust_get_field("vals").unwrap().unwrap_int(), 4);
    let internal = Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a { tag: "Node", ..Default::default() }));
    assert_eq!(internal.__purust_ctor_tag(), "Node");
    assert!(internal.__purust_get_field("tag").is_none());
    let dynamic = internal.__purust_set_field("tag", mk_string("user tag"));
    assert_eq!(dynamic.get_tag().unwrap_string(), "user tag");
}
`);
  for (const [cmd, args] of [['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary,
    ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]], [binary, []]]) {
    const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
}
console.log(`record metadata fields: normal/threaded native checks passed; ${directory}`);
