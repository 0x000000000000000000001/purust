import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude, sanitizeIdent } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude } from '../../src/Purust/Threading.js';

const shapes = fromFoldable(foldableArray)(ordString)(['final,final_kw', 'type,value',
  'async,async_kw,match,match_kw,where,where_kw']);
const code = codegenPrelude(shapes);
assert.equal(sanitizeIdent('final'), 'final', 'composite/public names must not contain a raw identifier');
assert.equal(sanitizeIdent('final_kw'), 'final_kw');
assert.equal(sanitizeIdent('type'), 'type_kw', 'preserve existing naming conventions');
assert.match(code, /pub struct Record_final_final_kw/);
assert.match(code, /pub r#final: Option<UnknownType>/);
assert.match(code, /pub final_kw: Option<UnknownType>/);
assert.match(code, /pub type_kw: Option<UnknownType>/);
assert.match(code, /pub fn get_final\(/);
assert.match(code, /pub fn set_final\(/);
assert.match(code, /pub fn __purust_borrow_final\(/);
assert.match(code, /"final" => r\.r#final\.clone\(\)/);
assert.match(code, /r\.r#final\.as_ref\(\)/);
assert.match(code, /mut_r\.r#final = Some\(val\)/);
assert.match(code, /make_mut\(r\)\.r#final = Some\(value\)/);
assert.match(code, /fields\.insert\("final"\.to_owned\(\), value\.clone\(\)\)/);
assert.doesNotMatch(code, /\.final\b|\bpub final:|(?:Record_|get_|set_|__purust_borrow_)r#final/);
for (const field of ['async', 'match', 'where']) {
  assert.equal(sanitizeIdent(field), field);
  assert.match(code, new RegExp(`pub r#${field}: Option<UnknownType>`));
  assert.match(code, new RegExp(`pub ${field}_kw: Option<UnknownType>`));
  assert.match(code, new RegExp(`pub fn get_${field}\\(`));
  assert.match(code, new RegExp(`pub fn set_${field}\\(`));
  assert.match(code, new RegExp(`"${field}" => r\\.r#${field}\\.clone\\(\\)`));
  assert.doesNotMatch(code, new RegExp(`\\.${field}\\b|\\bpub ${field}:|(?:Record_|get_|set_|__purust_borrow_)r#${field}`));
}

const directory = mkdtempSync(join(tmpdir(), 'purust-record-keywords-'));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const fields = ['async', 'match', 'where'];
const shape = fields.flatMap(field => [field, `${field}_kw`]).join('_');
for (const threaded of [false, true]) {
  const file = join(directory, threaded ? 'threaded.rs' : 'normal.rs'), binary = file.slice(0, -3);
  writeFileSync(file, `${threaded ? threadedPrelude(code) : code}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
fn main() {
    let closed = Value::Record_${shape}(perceus_ptr::PerceusPtr::new(Record_${shape} {
        ${fields.map((field, index) => `r#${field}: Some(mk_int(${index + 1})), ${field}_kw: Some(mk_int(${index + 11}))`).join(',\n        ')}
    }));
    ${fields.map((field, index) => `
    assert_eq!(closed.get_${field}().unwrap_int(), ${index + 1});
    assert_eq!(closed.get_${field}_kw().unwrap_int(), ${index + 11});
    assert_eq!(closed.__purust_borrow_${field}().unwrap_int(), ${index + 1});
    assert_eq!(closed.__purust_get_field("${field}").unwrap().unwrap_int(), ${index + 1});
    let mut changed = closed.clone();
    changed.set_${field}(mk_int(42));
    assert_eq!(changed.get_${field}().unwrap_int(), 42);
    assert_eq!(changed.get_${field}_kw().unwrap_int(), ${index + 11});
    assert_eq!(closed.get_${field}().unwrap_int(), ${index + 1});
    let changed = closed.clone().__purust_set_field("${field}", mk_int(43));
    assert_eq!(changed.get_${field}().unwrap_int(), 43);
    let properties = changed.__purust_record_fields().unwrap();
    assert_eq!(properties.get("${field}").unwrap().unwrap_int(), 43);
    assert_eq!(properties.get("${field}_kw").unwrap().unwrap_int(), ${index + 11});
    let generic = Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a { r#${field}: Some(mk_int(44)), ..Default::default() }));
    assert_eq!(generic.get_${field}().unwrap_int(), 44);
    let dynamic = generic.__purust_set_field("extra", mk_int(45));
    assert_eq!(dynamic.get_${field}().unwrap_int(), 44);
    `).join('\n')}
}
`);
  for (const [cmd, args] of [['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary,
    ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]], [binary, []]]) {
    const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
}
console.log(`record keywords: closed/generic/dynamic fields preserve labels in Rc/Arc; ${directory}`);
