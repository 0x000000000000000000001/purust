import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { foreignTypeForwards, foreignUnboundTypes } from '../../src/Purust/ForeignTypes.js';

const source = 'module Sample where\nforeign import data Handle :: Type\nforeign import data Box :: Type -> Type\n';
const forwarded = foreignTypeForwards(source)('');
assert.match(forwarded, /pub enum Handle \{\}/);
assert.match(forwarded, /pub enum Box \{\}/);
// Unbound types carry coerced values, so code generation maps them to the
// boxed runtime Value; only the declarations with a native Rust binding keep
// their concrete layout.
assert.deepEqual(foreignUnboundTypes(source)(''), ['Handle', 'Box']);
assert.deepEqual(foreignUnboundTypes(source)('pub struct Handle { value: i32 }'), ['Box']);
assert.deepEqual(foreignUnboundTypes(source)('pub use native::Handle;\npub type Box = i32;'), []);
for (const native of ['pub struct Handle { value: i32 }', 'pub enum Handle { A }', 'pub type Handle = i32;',
  'pub use native::Handle;', 'pub use native::Other as Handle;', 'pub use native::{Other as Handle, X};']) {
  assert.ok(!foreignTypeForwards(source)(native).includes('enum Handle'), native);
}
const hidden = '-- foreign import data Hidden :: Type\n{- nested {- foreign import data Hidden :: Type -} -}\ntext = """\nforeign import data Hidden :: Type\n"""\n';
assert.equal(foreignTypeForwards(hidden)(''), '');
assert.deepEqual(foreignUnboundTypes(hidden)(''), []);
assert.equal(foreignTypeForwards('data Real = Real\n')(''), '');
const directory = mkdtempSync(join(tmpdir(), 'purust-foreign-types-'));
for (const ptr of ['Rc', 'Arc']) {
  const file = join(directory, ptr + '.rs'), binary = join(directory, ptr);
  writeFileSync(file, `use std::${ptr === 'Rc' ? 'rc' : 'sync'}::${ptr};\nmod a { ${forwarded} }\nmod b { ${forwarded} }\nfn keep(x: ${ptr}<a::Handle>) -> ${ptr}<a::Handle> { x.clone() }\nfn main() {}\n`);
  const result = spawnSync('rustc', ['--edition=2021', '-Awarnings', file, '-o', binary], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  writeFileSync(file, `mod a { ${forwarded} }\nfn main() { let _ = a::Handle {}; }\n`);
  const rejected = spawnSync('rustc', ['--edition=2021', '-Awarnings', file, '-o', binary], { encoding: 'utf8' });
  assert.notEqual(rejected.status, 0, 'An absent FFI must not have a constructible native value');
}
console.log('Foreign declarations keep identity, declared layouts win, and unbound types are reported for boxed use in Rc/Arc.');
