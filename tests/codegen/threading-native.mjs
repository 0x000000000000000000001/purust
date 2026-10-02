import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { threadedRust, threadedPrelude, rustModules } from '../../src/Purust/Threading.js';

// Exercise the actual native FFI against the independent JS scanner, including
// repeated/concurrent calls and every truncation of representative Rust tokens.
const fragments = [
  'use std::rc::Rc;', "dyn Fn() + 'static", "dyn Fn() + Send + Sync + 'static",
  "dyn Fn() + Async + 'static", "dyn Fn() + éSync + 'static",
  "dyn Fn() + 🦀Sync + 'static", "fn f<'a>(x: &'a Purs_Data_Array::Array) {}",
  "fn f<'static>() {}", 'Purs_A::a(); Purs_B::b(); Purs_A::a();',
  '"std::rc::Rc Purs_Fake::x() + \'static"', '"escape \\\" std::rc::Rc"',
  'r###"std::rc::Rc "# Purs_Fake::x()"###', 'br#"std::rc::Rc"#',
  'cr##"Purs_Fake::x()"##', 'r"std::rc::Rc"', 'ar#"std::rc::Rc"#',
  '// std::rc::Rc Purs_Fake::x()\nPurs_Real::x();',
  "/* outer /* std::rc::Rc */ Purs_Fake::x() + 'static */",
  "'🦀'", "'é'", "'\\''", "'\\\\'", "'\\u{1f980}'", "'\\x41'",
  'dyn std::any::Any>', ') -> R>),', '🦀r#"std::rc::Rc"#',
];
const cases = ['', ...fragments, fragments.join('\n')];
for (const fragment of fragments) {
  const chars = Array.from(fragment);
  for (let i = 1; i < chars.length; i++) cases.push(chars.slice(0, i).join(''));
}
for (let i = 0; i < fragments.length; i++) {
  cases.push(fragments[i] + fragments[(i * 7 + 3) % fragments.length] + '\nPurs_After::x();');
}
const directory = mkdtempSync(join(tmpdir(), 'purust-native-scanner-'));
try {
  mkdirSync(join(directory, 'src'));
  const fields = cases.flatMap(source => [source, threadedRust(source), threadedPrelude(source), rustModules(source).join('\0')]);
  const bytes = fields.flatMap(field => {
    const content = Buffer.from(field), length = Buffer.alloc(4);
    length.writeUInt32LE(content.length);
    return [length, content];
  });
  writeFileSync(join(directory, 'cases.bin'), Buffer.concat(bytes));
  writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_scanner_test"\nversion = "0.0.0"\nedition = "2021"\n[dependencies]\nfancy-regex = "0.13"\n');
  writeFileSync(join(directory, 'src/main.rs'), `
#![allow(non_snake_case)]
#[derive(Debug)]
enum Value { String(String), Array(Vec<Value>) }
fn mk_array(values: Vec<Value>) -> Value { Value::Array(values) }
${readFileSync(new URL('../../src/Purust/Threading.rs', import.meta.url), 'utf8')}
fn take<'a>(bytes: &mut &'a [u8]) -> &'a str {
    let size = u32::from_le_bytes(bytes[..4].try_into().unwrap()) as usize;
    let text = std::str::from_utf8(&bytes[4..4 + size]).unwrap();
    *bytes = &bytes[4 + size..];
    text
}
fn verify(input: &str, rust: &str, prelude: &str, modules: &str) {
    assert_eq!(Purust_Threading_threadedRust(input.to_owned()), rust, "threadedRust: {input:?}");
    assert_eq!(Purust_Threading_threadedPrelude(input.to_owned()), prelude, "threadedPrelude: {input:?}");
    let Value::Array(values) = Purust_Threading_rustModules(input.to_owned()) else { panic!("array expected") };
    let names: Vec<_> = values.into_iter().map(|v| match v { Value::String(s) => s, _ => panic!("string expected") }).collect();
    assert_eq!(names.join("\\0"), modules, "rustModules: {input:?}");
}
fn main() {
    let mut bytes: &[u8] = include_bytes!("../cases.bin");
    let mut count = 0;
    while !bytes.is_empty() {
        let (input, rust, prelude, modules) = (take(&mut bytes), take(&mut bytes), take(&mut bytes), take(&mut bytes));
        verify(input, rust, prelude, modules);
        count += 1;
    }
    std::thread::scope(|scope| {
        for _ in 0..8 { scope.spawn(|| {
            for _ in 0..20 { verify("Purs_A::f(); use std::rc::Rc;", "Purs_A::f(); use std::sync::Arc as Rc;", "Purs_A::f(); use std::sync::Arc as Rc;", "A"); }
        }); }
    });
    println!("native scanner: {count} JS differential cases and concurrent calls passed");
}
`);
  const build = spawnSync('cargo', ['build', '--offline', '--quiet', '--manifest-path', join(directory, 'Cargo.toml')], { encoding: 'utf8', timeout: 120000 });
  assert.equal(build.status, 0, build.error?.message ?? build.stderr);
  const run = spawnSync(join(directory, 'target/debug/purust_native_scanner_test'), [], { encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  console.log(run.stdout.trim());
} finally {
  rmSync(directory, { recursive: true, force: true });
}
