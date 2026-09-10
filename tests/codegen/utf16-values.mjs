import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Char, LitChar, LitString, String as StringType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Lit, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
import { showStringImpl, showCharImpl } from '../../../purust-prelude/src/Data/Show.js';

const samples = ['a\udc00\ud800\ud800\u{16805}\u{16a06}z\ue000\uffff', '\0' + '9',
  '\x01\x07\b\t\n\v\f\r\x7f"\\', '😀\ue000\ud800'];
const characters = ['\ud800', '\udc00', '\ue000', '\uffff', '\0', '\n', "'", '\\'];
const units = value => Array.from({ length: value.length }, (_, i) => value.charCodeAt(i));
const binding = (name, ty, value) => new Tuple(name, new Typed(ty, new Lit(value)));
const bindings = samples.flatMap((value, i) => [
  binding(`sample${i}`, StringType.value, new LitString(value)),
  binding(`shown${i}`, StringType.value, new LitString(showStringImpl(value))),
]);
characters.forEach((value, i) => bindings.push(
  binding(`char${i}`, Char.value, new LitChar(value)),
  binding(`shownChar${i}`, StringType.value, new LitString(showCharImpl(value))),
));
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'Utf16Values', dataDecls: [], classDecls: [] },
)({ name: 'Utf16Values', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const ffi = [
  '../../../purust-prelude/src/Data/Show.rs', '../../../purust-prelude/src/Data/Bounded.rs',
  '../../../purust-enums/src/Data/Enum.rs', '../../../purust-console/src/Effect/Console.rs',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const source = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
mod foreign { use super::*; ${ffi} }
${generated}
fn main() {
    use foreign::*;
    ${samples.map((value, i) => `assert_eq!(purust_string_to_utf16(&Utf16Values_sample${i}()), vec![${units(value)}]);
    assert_eq!(Data_Show_showStringImpl(Utf16Values_sample${i}()), Utf16Values_shown${i}());`).join('\n')}
    ${characters.map((value, i) => `assert_eq!(Data_Enum_toCharCode(Utf16Values_char${i}()), ${value.charCodeAt(0)});
    assert_eq!(Data_Show_showCharImpl(Utf16Values_char${i}()), Utf16Values_shownChar${i}());`).join('\n')}
    for unit in 0u16..=u16::MAX {
        let character = Data_Enum_fromCharCode(unit as i64);
        assert_eq!(Data_Enum_toCharCode(character), unit as i64);
        if unit < u16::MAX { assert!(character < Data_Enum_fromCharCode(unit as i64 + 1)); }
    }
    assert_eq!(Data_Enum_toCharCode(Data_Bounded_bottomChar()), 0);
    assert_eq!(Data_Enum_toCharCode(Data_Bounded_topChar()), 65535);
    assert_eq!(Data_Enum_toCharCode(Data_Enum_fromCharCode(-1)), 65535);
    assert_eq!(Data_Enum_toCharCode(Data_Enum_fromCharCode(65536)), 0);
    assert_ne!(Utf16Values_char0(), Utf16Values_char2(), "surrogates never collide with PUA");
    let joined = purust_string_from_utf16(&[0xd83d]) + &purust_string_from_utf16(&[0xde00]);
    assert_eq!(purust_string_to_utf8_lossy(&joined), "😀");
    let native = "😀é\\u{e000}";
    assert_eq!(purust_string_to_utf8_lossy(&purust_string_from_utf8(native)), native);
    let action = Effect_Console_log(Utf16Values_sample3());
    action.unwrap_func1()(Value::Unit);
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-utf16-values-'));
try {
  const path = join(directory, 'utf16-values.rs');
  const binary = join(directory, 'utf16-values');
  writeFileSync(path, source);
  const compile = spawnSync('rustc', ['--edition=2021', path, '-o', binary], { encoding: 'utf8' });
  assert.equal(compile.status, 0, `${compile.error ?? ''}\n${compile.stdout}\n${compile.stderr}`);
  const run = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  assert.equal(run.stdout, Buffer.from(samples[3], 'utf8').toString('utf8') + '\n');
  assert.equal(run.stderr, '');
  console.log('UTF-16 literals, all Char units and order, Show, PUA separation and UTF-8 console boundaries passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
