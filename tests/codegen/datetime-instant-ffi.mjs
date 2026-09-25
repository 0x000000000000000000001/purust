// UTC constructors: toDateTimeImpl (Func7) and canonicalDateImpl (Func4), Rc/Arc.
// fromDateTimeImpl is deliberately outside this differential qualification.
// The constructor returns a marker; this FFI must neither inspect nor rebuild it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';
import { threadedPrelude, threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mount = resolve(root, '../../b8x/run/bak');
const directory = mkdtempSync(join(mount, 'rust/output/purust-datetime-instant-'));
const remote = path => '/var/www/b8x/run/bak/' + relative(mount, path);
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const paths = ['output/Purust.CodeGen/index.js', 'src/Purust/RecordFields.js', 'src/Purust/Utf16.js', 'src/Purust/Threading.js',
  'tests/codegen/datetime-instant-ffi.mjs', 'tests/runtime/perceus_ptr/src/lib.rs', 'tests/runtime/perceus_ptr/src/local.rs',
  'tests/runtime/perceus_ptr/src/threaded.rs', '../purust-datetime/src/Data/DateTime/Instant.rs',
  '../purust-datetime/src/Data/DateTime/Instant.js', '../purust-datetime/src/Data/DateTime/Instant.purs',
  '../purust-datetime/src/Data/Date.rs', '../purust-datetime/src/Data/Date.js'];
const report = { complete: false, commands: [], modes: [], inputs: paths.map(p => {
  const path = resolve(root, p); return { path, sha256: hash(path) };
}) };
const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
console.log(directory);
function run(label, args) {
  const result = spawnSync('docker', args, { cwd: directory, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(directory, `${label}.json`), JSON.stringify({ args, status: result.status, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr }, null, 2));
  report.commands.push({ label, status: result.status }); save();
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
const lower = -8639977881600000, upper = 8639977881599999;
const ps = read('../purust-datetime/src/Data/DateTime/Instant.purs');
assert.ok(ps.includes(`bottom = Instant (Milliseconds (${lower}.0))`));
assert.ok(ps.includes(`top = Instant (Milliseconds ${upper}.0)`));
const bits = value => { const bytes = Buffer.alloc(8); bytes.writeDoubleBE(value); return bytes.toString('hex'); };
const inputs = new Map();
function add(value, group) {
  if (!Number.isFinite(value) || value < lower || value > upper) return;
  const key = bits(value);
  const existing = inputs.get(key);
  if (existing) existing.groups.add(group); else inputs.set(key, { bits: key, value, groups: new Set([group]) });
}
for (const n of [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, 0.1, -0.1, 0.999999999999, -0.999999999999,
  1, -1, 1.1, -1.1, 1.999, -1.999, 999.999, -999.999, 1000.1, -1000.1, 59999.9, -59999.9,
  60000.1, -60000.1, 86399999.9, -86399999.9, 86400000.1, -86400000.1]) add(n, 'fractional-timeclip');
for (const offset of [0, 1, 2, 999, 1000, 59999, 60000, 86399999, 86400000, 86400001, 366 * 86400000]) {
  add(lower + offset, 'PS-bounds'); add(upper - offset, 'PS-bounds');
}
function utc(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  // Date.UTC applies a 1900 offset to years 0..99. Construct test inputs with
  // setUTCFullYear instead; do not exercise the unrequested fromDateTimeImpl.
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond); return date.getTime();
}
function around(value, group) { for (const offset of [-1, 0, 1]) add(value + offset, group); }
for (let year = 0; year < 100; year++) for (let month = 1; month <= 12; month++) {
  around(utc(year, month, 1), 'years-0-99'); around(utc(year, month, 28, 23, 59, 59, 999), 'years-0-99');
}
for (let year = -271800; year <= 275700; year += 100) {
  around(utc(year, 2, 28, 23, 59, 59, 999), 'century-leap-boundaries');
  around(utc(year, 3, 1), 'century-leap-boundaries');
}
for (const year of [-271820, -100000, -10000, -401, -400, -399, -101, -100, -99, -4, -1, 0, 1, 4,
  99, 100, 400, 1582, 1600, 1700, 1800, 1900, 1969, 1970, 2000, 2024, 2100, 2400, 10000, 100000, 275759]) {
  for (let month = 1; month <= 12; month++) {
    around(utc(year, month, 1), 'large-calendars');
    around(utc(year, month + 1, 0, 23, 59, 59, 999), 'large-calendars');
  }
}
let seed = 0x823aa12f;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
for (let i = 0; i < 8192; i++) add(lower * (1 - random()) + upper * random(), 'full-range-random');
// Recent-range fractions remain representable in f64, unlike sub-ms at the bounds.
for (let i = 0; i < 1024; i++) add((random() - 0.5) * 2e12 + (random() - 0.5), 'fractional-random');
const vectors = [...inputs.values()];
const canonicalInputs = new Map();
function canonical(year, month, day) {
  assert.ok(year >= -271820 && year <= 275759 && month >= 1 && month <= 12 && day >= 1 && day <= 31);
  const values = [year, month, day]; canonicalInputs.set(values.join(','), values);
}
for (let year = 0; year < 100; year++) for (let month = 1; month <= 12; month++) for (let day = 1; day <= 31; day++) canonical(year, month, day);
for (const year of [-271820, -271819, -100000, -10000, -401, -400, -399, -101, -100, -99, -4, -1,
  100, 400, 1582, 1600, 1700, 1800, 1900, 1969, 1970, 2000, 2024, 2100, 2400, 10000, 100000, 275758, 275759]) {
  for (let month = 1; month <= 12; month++) for (let day = 1; day <= 31; day++) canonical(year, month, day);
}
for (let year = -1; year >= -400; year--) for (let month = 1; month <= 12; month++) for (const day of [1, 28, 29, 30, 31]) canonical(year, month, day);
for (let year = -271800; year <= 275700; year += 100) for (const day of [28, 29, 30, 31]) canonical(year, 2, day);
for (let i = 0; i < 8192; i++) canonical(-271820 + Math.floor(random() * 547580), 1 + Math.floor(random() * 12), 1 + Math.floor(random() * 31));
const canonicalVectors = [...canonicalInputs.values()];
report.domain = { lower, upper, onlyValidPSInstants: true, fromDateTimeImplTested: false };
report.vectors = { total: vectors.length, groups: Object.fromEntries([...new Set(vectors.flatMap(v => [...v.groups]))]
  .map(group => [group, vectors.filter(v => v.groups.has(group)).length])) };
report.canonical = { total: canonicalVectors.length, yearBounds: [-271820, 275759], monthBounds: [1,12], dayBounds: [1,31],
  exhaustiveYears0To99: 37200, includesBCE400YearCycle: true };
const referenceScript = `
import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
const request=JSON.parse(readFileSync(process.argv[1],'utf8'));
const {toDateTimeImpl}=await import('data:text/javascript;base64,'+Buffer.from(request.source).toString('base64'));
const {canonicalDateImpl}=await import('data:text/javascript;base64,'+Buffer.from(request.dateSource).toString('base64'));
const results=request.inputs.map(bits=>{
  const value=Buffer.from(bits,'hex').readDoubleBE(); let fields,calls=0; const marker={};
  const ctor=y=>mo=>d=>h=>mi=>s=>ms=>{calls++; fields=[y,mo,d,h,mi,s,ms]; return marker;};
  assert.strictEqual(toDateTimeImpl(ctor)(value),marker); assert.equal(calls,1);
  assert.ok(fields.every(Number.isInteger)); return fields;
});
const canonical=request.canonical.map(([year,month,day])=>{
  let fields,calls=0; const marker={};
  assert.strictEqual(canonicalDateImpl(y=>m=>d=>{calls++;fields=[y,m,d];return marker;},year,month,day),marker);
  assert.equal(calls,1); assert.ok(fields.every(Number.isInteger)); return fields;
});
console.log(JSON.stringify({node:process.version,results,canonical}));
`;
const checks = `
// This marker belongs to the supplied constructor, not to an emulated PS ADT.
// Verifying pointer identity proves the FFI returns its exact constructor result.
pub struct DateTime;
fn check(value: f64, expected: [i64;7]) {
    use std::rc::Rc;
    let result=Rc::new(DateTime); let returned=result.clone();
    let calls=Rc::new(std::sync::atomic::AtomicUsize::new(0)); let seen=calls.clone();
    let ctor=Func7::Shared(Rc::new(move |y,mo,d,h,mi,s,ms| {
        seen.fetch_add(1,std::sync::atomic::Ordering::SeqCst);
        assert_eq!([y,mo,d,h,mi,s,ms],expected,"instant {:?}",value);
        returned.clone()
    }));
    let actual=ffi::Data_DateTime_Instant_toDateTimeImpl(ctor,value);
    assert!(Rc::ptr_eq(&result,&actual),"constructor result identity");
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst),1);
}
fn check_canonical(input: [i64;3], expected: [i64;3], curried: bool) {
    use std::rc::Rc;
    let marker=Rc::new(42_i64); let returned=marker.clone();
    let calls=Rc::new(std::sync::atomic::AtomicUsize::new(0)); let seen=calls.clone();
    let ctor=Value::Func3(Func3::Shared(Rc::new(move |y,m,d| {
        seen.fetch_add(1,std::sync::atomic::Ordering::SeqCst);
        assert_eq!([y.unwrap_int(),m.unwrap_int(),d.unwrap_int()],expected,"canonical {:?}",input);
        Value::Class(returned.clone())
    })));
    let function=date::Data_Date_canonicalDateImpl();
    let actual=if curried {
        function.unwrap_func1()(ctor).unwrap_func1()(mk_int(input[0])).unwrap_func1()(mk_int(input[1])).unwrap_func1()(mk_int(input[2]))
    } else { function.unwrap_func4()(ctor,mk_int(input[0]),mk_int(input[1]),mk_int(input[2])) };
    match actual {Value::Class(value)=>assert!(Rc::ptr_eq(&marker,&value.downcast::<i64>().unwrap())),_=>panic!("lost constructor result")};
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst),1);
}
fn main() {
    let mut vectors=Vec::new();
    for line in include_str!("cases.tsv").lines() {
        let fields=line.split('\\t').collect::<Vec<_>>();
        let value=f64::from_bits(u64::from_str_radix(fields[0],16).unwrap());
        let expected=std::array::from_fn(|i|fields[i+1].parse::<i64>().unwrap());
        check(value,expected); vectors.push((value,expected));
    }
    let mut canonical=Vec::new();
    for line in include_str!("canonical.tsv").lines() {
        let fields=line.split('\\t').map(|v|v.parse::<i64>().unwrap()).collect::<Vec<_>>();
        let input=std::array::from_fn(|i|fields[i]); let expected=std::array::from_fn(|i|fields[i+3]);
        check_canonical(input,expected,false); check_canonical(input,expected,true); canonical.push((input,expected));
    }
    #[cfg(feature="threaded")]
    {
        let inputs=std::sync::Arc::new(vectors.clone());
        let workers=(0..8).map(|offset| {let inputs=inputs.clone(); std::thread::spawn(move || {
            for i in (offset..inputs.len()).step_by(8) {let (value,expected)=inputs[i]; check(value,expected);}
        })}).collect::<Vec<_>>();
        for worker in workers {worker.join().unwrap();}
    }
    println!("toDateTimeImpl: {} JS constructor vectors passed",vectors.len());
    println!("canonicalDateImpl: {} JS constructor vectors passed, native Func4 and curried ABI",canonical.len());
}
`;
try {
  const request = join(directory, 'reference-request.json');
  writeFileSync(request, JSON.stringify({ source: read('../purust-datetime/src/Data/DateTime/Instant.js'),
    dateSource: read('../purust-datetime/src/Data/Date.js'), canonical: canonicalVectors, inputs: vectors.map(v => v.bits) }));
  const reference = JSON.parse(run('reference', ['exec', 'core-api-cli-1', 'node', '--input-type=module', '-e', referenceScript, remote(request)]).stdout);
  assert.equal(reference.results.length, vectors.length);
  assert.equal(reference.canonical.length, canonicalVectors.length);
  const yearZeroFebruary29 = reference.canonical[canonicalVectors.findIndex(([y,m,d]) => y === 0 && m === 2 && d === 29)];
  assert.deepEqual(yearZeroFebruary29, [0,3,1], 'Original Date.UTC first normalizes year 1900, then restores year 0');
  report.reference = { passed: true, node: reference.node,
    lower: reference.results[vectors.findIndex(v => v.value === lower)], upper: reference.results[vectors.findIndex(v => v.value === upper)], yearZeroFebruary29 };
  const prelude = codegenPrelude(empty);
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal', dir = join(directory, mode); mkdirSync(dir);
    const adapt = source => threaded ? threadedRust(source) : source;
    const code = `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
extern crate self as Purs_Data_DateTime;
extern crate self as Purs_Data_Date;
mod perceus_ptr { ${read('tests/runtime/perceus_ptr/src/lib.rs').replace('mod local;', `mod local { ${read('tests/runtime/perceus_ptr/src/local.rs')} }`).replace('mod threaded;', `mod threaded { ${read('tests/runtime/perceus_ptr/src/threaded.rs')} }`)} }
mod date { ${adapt(read('../purust-datetime/src/Data/Date.rs'))} }
pub use date::{purust_date_from_days, purust_utc_milliseconds};
mod ffi { ${adapt(read('../purust-datetime/src/Data/DateTime/Instant.rs'))} }
${adapt(checks)}`;
    writeFileSync(join(dir, 'main.rs'), code);
    writeFileSync(join(dir, 'cases.tsv'), vectors.map((v,i) => [v.bits,...reference.results[i]].join('\t')).join('\n'));
    writeFileSync(join(dir, 'canonical.tsv'), canonicalVectors.map((v,i) => [...v,...reference.canonical[i]].join('\t')).join('\n'));
    writeFileSync(join(dir, 'Cargo.toml'), '[package]\nname="datetime_instant_ffi"\nversion="0.0.0"\nedition="2021"\n[[bin]]\nname="datetime_instant_ffi"\npath="main.rs"\n[features]\nthreaded=[]\n');
    const result = run(`native-${mode}`, ['exec', '-w', remote(dir), '-e', 'CARGO_BUILD_JOBS=1', '-e', 'CARGO_PROFILE_DEV_DEBUG=0',
      '-e', 'CARGO_INCREMENTAL=0', 'core-api-cli-1', 'cargo', 'run', '--offline', '--quiet', ...(threaded ? ['--features', 'threaded'] : [])]);
    assert.equal(result.stderr, ''); assert.match(result.stdout, new RegExp(`${vectors.length} JS constructor vectors passed`));
    assert.match(result.stdout, new RegExp(`${canonicalVectors.length} JS constructor vectors passed`));
    report.modes.push({ mode, vectors: vectors.length, concurrentVectors: threaded ? vectors.length : 0,
      canonicalVectors: canonicalVectors.length, canonicalInvocations: 2 * canonicalVectors.length, constructorIdentity: true }); save();
    console.log(`${mode}: ${result.stdout.trim()}`);
  }
  report.inputs.forEach(input => assert.equal(hash(input.path), input.sha256, `input changed: ${input.path}`));
  report.complete = true;
} finally { save(); }
