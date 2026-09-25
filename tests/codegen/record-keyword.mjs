import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude, fieldRenames, sanitizeIdent } from '../../output/Purust.CodeGen/index.js';
import { fromFoldable } from '../../output/Data.Set/index.js';
import { toUnfoldable as mapToUnfoldable } from '../../output/Data.Map/index.js';
import { unfoldableArray } from '../../output/Data.Unfoldable/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { threadedPrelude } from '../../src/Purust/Threading.js';

// Rust keywords that can be raw identifiers at the actual struct field.
const rawKeywords = ['static', 'unsafe', 'struct', 'impl', 'const', 'enum', 'extern', 'for',
  'return', 'in', 'while', 'continue', 'else', 'trait', 'true', 'false', 'await', 'dyn',
  'box', 'do', 'try', 'yield', 'abstract', 'become', 'macro', 'override', 'priv',
  'typeof', 'unsized', 'virtual'];
// rustc rejects r#self, r#Self, r#super and r#crate.
const renamedKeywords = { self: 'self_kw', Self: 'Self_kw', super: 'super_kw', crate: 'crate_kw' };
const rawKeywordSet = new Set(['final', 'async', 'match', 'where', ...rawKeywords]);
const allKeywords = Object.keys(renamedKeywords).concat(rawKeywords);

// Mirrors fieldRenames in Purust.CodeGen: sorted first label wins, later
// colliding labels take _1, _2, ... so the mapping stays injective.
const sanitizedKeywords = { type: 'type_kw', gen: 'gen_kw' };
const baseName = field => renamedKeywords[field] ?? sanitizedKeywords[field] ?? field;
const resolveRenames = labels => {
  const used = new Set(), renames = new Map();
  for (const label of [...new Set(labels)].sort()) {
    let suffix = 0, name;
    do { name = suffix === 0 ? baseName(label) : `${baseName(label)}_${suffix}`; suffix += 1; } while (used.has(name));
    used.add(name);
    renames.set(label, name);
  }
  return renames;
};

const shapes = fromFoldable(foldableArray)(ordString)(['final,final_kw', 'type,value',
  'async,async_kw,match,match_kw,where,where_kw',
  'self,other', 'Self,super,crate', 'static,static_kw', 'self,self_kw', 'gen', 'gen_kw',
  'gen,gen_kw', 'type,type_kw', allKeywords.join(',')]);
const code = codegenPrelude(shapes);
const shapeStrings = ['final,final_kw', 'type,value', 'async,async_kw,match,match_kw,where,where_kw',
  'self,other', 'Self,super,crate', 'static,static_kw', 'self,self_kw', 'gen', 'gen_kw',
  'gen,gen_kw', 'type,type_kw', allKeywords.join(',')];
const allLabels = shapeStrings.flatMap(shape => shape.split(','));
const renames = resolveRenames(allLabels);
const fieldBase = field => renames.get(field) ?? baseName(field);
const fieldIdent = field => rawKeywordSet.has(field) ? `r#${field}` : fieldBase(field);
const structName = fields => `Record_${[...fields].sort().map(fieldBase).join('_')}`;

// The PureScript resolver must agree with its JavaScript mirror.
const psRenames = new Map(mapToUnfoldable(unfoldableArray)(fieldRenames(fromFoldable(foldableArray)(ordString)(allLabels)))
  .map(entry => [entry.value0, entry.value1]));
assert.deepEqual([...psRenames].sort(), [...renames].sort(), 'fieldRenames stays injective and sorted-first');

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

// The four reserved raw identifiers cannot be written as r#…, so the field and
// its composite names take the *_kw spelling while the label stays logical.
for (const [label, renamed] of Object.entries(renamedKeywords)) {
  assert.equal(sanitizeIdent(label), label, `${label} keeps its composite spelling`);
  assert.equal(fieldBase(label), renamed);
  assert.match(code, new RegExp(`pub ${renamed}: Option<UnknownType>`));
  assert.match(code, new RegExp(`pub fn get_${renamed}\\(`));
  assert.match(code, new RegExp(`pub fn set_${renamed}\\(`));
  assert.match(code, new RegExp(`pub fn __purust_borrow_${renamed}\\(`));
  assert.match(code, new RegExp(`"${label}" => r\\.${renamed}\\.clone\\(\\)`));
  assert.match(code, new RegExp(`r\\.${renamed}\\.as_ref\\(\\)`));
  assert.match(code, new RegExp(`mut_r\\.${renamed} = Some\\(val\\)`));
  assert.match(code, new RegExp(`make_mut\\(r\\)\\.${renamed} = Some\\(value\\)`));
  assert.doesNotMatch(code, new RegExp(`\\bpub ${label}:|r\\.${label}\\b`));
}

// Every other Rust keyword stays a raw identifier, so a real `static_kw`-style
// label remains distinct.
for (const field of rawKeywords) {
  assert.equal(sanitizeIdent(field), field);
  assert.equal(fieldBase(field), field);
  assert.match(code, new RegExp(`pub r#${field}: Option<UnknownType>`));
  assert.match(code, new RegExp(`"${field}" => r\\.r#${field}\\.clone\\(\\)`));
  assert.match(code, new RegExp(`r\\.r#${field}\\.as_ref\\(\\)`));
  assert.match(code, new RegExp(`mut_r\\.r#${field} = Some\\(val\\)`));
  assert.doesNotMatch(code, new RegExp(`\\bpub ${field}:`));
}

// A keyword and its literal *_kw twin must keep distinct fields, methods and
// struct names instead of collapsing on the same spelling.
for (const [label, twin, renamed] of [['self', 'self_kw', 'self_kw'], ['gen', 'gen_kw', 'gen_kw'],
  ['type', 'type_kw', 'type_kw']]) {
  assert.equal(fieldBase(label), renamed);
  assert.equal(fieldBase(twin), `${renamed}_1`);
  assert.match(code, new RegExp(`pub ${renamed}: Option<UnknownType>`));
  assert.match(code, new RegExp(`pub ${renamed}_1: Option<UnknownType>`));
  assert.match(code, new RegExp(`pub fn get_${renamed}\\(`));
  assert.match(code, new RegExp(`pub fn get_${renamed}_1\\(`));
  assert.match(code, new RegExp(`pub struct ${structName([label, twin])}`));
}
const structNames = [...code.matchAll(/pub struct (Record_[A-Za-z0-9_]+)/g)].map(match => match[1]);
assert.equal(structNames.length, new Set(structNames).size, 'each record shape owns one struct name');

const directory = mkdtempSync(join(tmpdir(), 'purust-record-keywords-'));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const compileGroups = [
  { fields: ['final', 'final_kw'], values: [1, 11] },
  { fields: ['async', 'async_kw', 'match', 'match_kw', 'where', 'where_kw'], values: [2, 12, 3, 13, 4, 14] },
  { fields: ['self', 'other'], values: [5, 15] },
  { fields: ['Self', 'super', 'crate'], values: [6, 16, 26] },
  { fields: ['static', 'static_kw'], values: [7, 17] },
  { fields: ['self', 'self_kw'], values: [8, 18] },
  { fields: ['gen', 'gen_kw'], values: [9, 19] },
  { fields: ['gen'], values: [29] },
  { fields: ['gen_kw'], values: [39] },
  { fields: ['type', 'type_kw'], values: [40, 41] },
  { fields: allKeywords, values: allKeywords.map((_, index) => index + 51) },
];
const groupsCode = compileGroups.map(({ fields, values }, group) => {
  const name = structName(fields);
  const construction = fields.map((field, index) => `${fieldIdent(field)}: Some(mk_int(${values[index]}))`).join(', ');
  const checks = fields.map((field, index) => `
    assert_eq!(closed.get_${fieldBase(field)}().unwrap_int(), ${values[index]});
    assert_eq!(closed.__purust_borrow_${fieldBase(field)}().unwrap_int(), ${values[index]});
    assert_eq!(closed.__purust_get_field(${JSON.stringify(field)}).unwrap().unwrap_int(), ${values[index]});
    let mut changed_${group}_${index} = closed.clone();
    changed_${group}_${index}.set_${fieldBase(field)}(mk_int(42));
    assert_eq!(changed_${group}_${index}.get_${fieldBase(field)}().unwrap_int(), 42);
    assert_eq!(closed.get_${fieldBase(field)}().unwrap_int(), ${values[index]});
    let generic_${group}_${index} = Value::Record_a(perceus_ptr::PerceusPtr::new(Record_a { ${fieldIdent(field)}: Some(mk_int(44)), ..Default::default() }));
    assert_eq!(generic_${group}_${index}.get_${fieldBase(field)}().unwrap_int(), 44);
    let updated_${group}_${index} = generic_${group}_${index}.__purust_set_field(${JSON.stringify(field)}, mk_int(45));
    assert_eq!(updated_${group}_${index}.get_${fieldBase(field)}().unwrap_int(), 45);`).join('');
  return `{
    let closed = Value::${name}(perceus_ptr::PerceusPtr::new(${name} { ${construction} }));${checks}
}`;
}).join('\n');
for (const threaded of [false, true]) {
  const file = join(directory, threaded ? 'threaded.rs' : 'normal.rs'), binary = file.slice(0, -3);
  writeFileSync(file, `${threaded ? threadedPrelude(code) : code}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
fn main() {
${groupsCode}
}
`);
  for (const [cmd, args] of [['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary,
    ...(threaded ? ['--cfg', 'feature="threaded"'] : [])]], [binary, []]]) {
    const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
}
console.log(`record keywords: closed/generic/dynamic fields preserve labels in Rc/Arc; ${directory}`);
