import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sanitizeIdent } from '../../output/Purust.CodeGen/index.js';
import { runtimeHelpers } from '../../src/Purust/Utf16.js';

// Use the compiled PureScript implementation through its JS fallback as the
// oracle. Feed Rust the real encoded-UTF16 ABI, not ordinary UTF-8 strings.
const directory = mkdtempSync(join(tmpdir(), 'purust-ident-native-'));
try {
  const cases = ['', '_', 'normal_123', '123', 'type', 'fn', 'break', 'mod', 'as', 'gen',
    'use', 'pub', 'ref', 'mut', 'move', 'let', 'if', 'loop', 'async', 'Self',
    'type_kw', "'$.\"-", '\ud800', '\udfff', '😀', 'é', '\u0000', 'a'.repeat(4096)];
  // Every code unit, mixed replacement sequences, and deterministic strings
  // exercise supplementary characters and unpaired surrogates independently.
  for (let unit = 0; unit <= 0xffff; unit++) {
    cases.push(String.fromCharCode(unit), `prefix_${String.fromCharCode(unit)}.$'"-suffix`);
  }
  let seed = 42;
  for (let i = 0; i < 2048; i++) {
    let text = '';
    for (let j = 0; j < i % 41; j++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      text += String.fromCharCode(seed >>> 16);
    }
    cases.push(text);
  }
  const buffers = [];
  for (const text of cases) {
    const input = Buffer.from(text, 'utf16le'), expected = Buffer.from(sanitizeIdent(text));
    assert(expected.every(byte => byte < 128));
    for (const field of [input, expected]) {
      const length = Buffer.alloc(4); length.writeUInt32LE(field.length);
      buffers.push(length, field);
    }
  }
  writeFileSync(join(directory, 'cases.bin'), Buffer.concat(buffers));
  writeFileSync(join(directory, 'main.rs'), `
#![allow(non_snake_case, dead_code)]
type Func1<A, B> = fn(A) -> B;
${runtimeHelpers}
${readFileSync(new URL('../../src/Purust/CodeGen.rs', import.meta.url), 'utf8')}
fn field<'a>(bytes: &mut &'a [u8]) -> &'a [u8] {
    let length = u32::from_le_bytes(bytes[..4].try_into().unwrap()) as usize;
    let value = &bytes[4..4 + length]; *bytes = &bytes[4 + length..]; value
}
fn main() {
    let mut bytes: &[u8] = include_bytes!("cases.bin");
    let mut count = 0;
    while !bytes.is_empty() {
        let units = field(&mut bytes).chunks_exact(2).map(|u| u16::from_le_bytes([u[0], u[1]])).collect::<Vec<_>>();
        let expected = std::str::from_utf8(field(&mut bytes)).unwrap();
        let input = purust_string_from_utf16(&units);
        let actual = Purust_CodeGen_sanitizeIdentImpl(|_| panic!("native fallback must not run"), input);
        assert_eq!(actual, expected, "UTF-16 units: {units:?}");
        count += 1;
    }
    let input = String::from("an_ordinary_identifier_42");
    let pointer = input.as_ptr();
    let output = Purust_CodeGen_sanitizeIdentImpl(|_| unreachable!(), input);
    assert_eq!(pointer, output.as_ptr(), "ordinary identifiers reuse their buffer");
    println!("native sanitizeIdent: {count} PureScript differential cases passed");
}
`);
  const binary = join(directory, 'checks');
  const build = spawnSync('rustc', ['--edition=2021', '-O', join(directory, 'main.rs'), '-o', binary], { encoding: 'utf8', timeout: 120000 });
  assert.equal(build.status, 0, build.error?.message ?? build.stderr);
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  console.log(run.stdout.trim());
} finally { rmSync(directory, { recursive: true, force: true }); }
