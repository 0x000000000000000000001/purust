import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadFfiCargo } from '../../src/Purust/FfiCargo.js';

test('FFI Cargo: absent declaration preserves output; pinned dependencies retain their options', () => {
  const dir = mkdtempSync(join(tmpdir(), 'purust-ffi-cargo-'));
  try {
    const ffi = join(dir, 'Example.rs');
    assert.equal(loadFfiCargo(ffi)(), '');
    writeFileSync(`${ffi}.cargo.json`, JSON.stringify({ schema: 1, dependencies: {
      'num-bigint-dig': { version: '=0.8.6', features: ['i128'], 'default-features': false },
      'num-traits': { version: '=0.2.19', 'default-features': true },
    } }));
    assert.equal(loadFfiCargo(ffi)(), 'num-bigint-dig = { version = "=0.8.6", default-features = false, features = ["i128"] }\nnum-traits = { version = "=0.2.19", default-features = true }\n');
    writeFileSync(`${ffi}.cargo.json`, '{"schema":1,"dependencies":{"example":{"version":"=1.2.3"}}}');
    assert.equal(loadFfiCargo(ffi)(), 'example = { version = "=1.2.3" }\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('FFI Cargo: reject malformed declarations, injection, unsupported sources and reserved/colliding names', () => {
  const dir = mkdtempSync(join(tmpdir(), 'purust-ffi-cargo-'));
  const valid = { version: '=0.8.6' };
  const envelope = dependencies => ({ schema: 1, dependencies });
  const cases = [null, [], {}, { schema: 2, dependencies: {} }, { schema: 1, dependencies: [] },
    { ...envelope({}), unexpected: {} }, ...[null, [], '0.8.6', {}, { version: '*' }, { version: '=01.2.3' },
      { version: 'bad"\n[workspace]' }, { ...valid, path: '/tmp/x' }, { ...valid, git: 'x' },
      { ...valid, package: 'renamed' }, { ...valid, optional: true }, { ...valid, registry: 'other' },
      { ...valid, 'default-features': 'false' }, { ...valid, features: 'i128' },
      { ...valid, features: ['i128', 'i128'] }, { ...valid, features: [null] },
      { ...valid, features: ['x"\n'] }].map(value => envelope({ example: value })),
    ...['purust_core', 'perceus-ptr', 'fancy_regex', 'tokio', 'mimalloc', 'purs_example', 'Purs_Example',
      'bad"name'].map(name => envelope({ [name]: valid })),
    envelope({ 'some-crate': valid, some_crate: valid })];
  try {
    const ffi = join(dir, 'Example.rs');
    for (const value of cases) {
      writeFileSync(`${ffi}.cargo.json`, JSON.stringify(value));
      assert.throws(() => loadFfiCargo(ffi)(), /Invalid FFI Cargo declaration .*Example\.rs\.cargo\.json:/, JSON.stringify(value));
    }
    writeFileSync(`${ffi}.cargo.json`, '{bad');
    assert.throws(() => loadFfiCargo(ffi)(), /invalid JSON/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
