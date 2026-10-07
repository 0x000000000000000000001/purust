import assert from 'node:assert/strict';
import { join } from 'node:path';

// Standalone controls identify Rust's static guarantee separately from the
// unrestricted PureScript caller's dynamically checked handle.
export function check({ input, workspace, run, report }) {
  report.rustControls = [];
  for (const [name, code] of [['valid', null], ['once_twice', 'E0382'], ['mutable_as_shared', 'E0525']]) {
    const binary = join(workspace, `rust-control-${name}`);
    const args = ['--edition=2021', join(input, 'rust-controls.rs'), '-o', binary, '--error-format=json'];
    if (code) args.push('--cfg', name);
    const result = run('rustc', args, { reject: code !== null });
    const errors = result.stderr.split('\n').flatMap(line => {
      try { const diagnostic = JSON.parse(line); return diagnostic.level === 'error' ? [diagnostic] : []; }
      catch { return []; }
    });
    if (code) assert.ok(errors.some(error => error.code?.code === code), result.stderr);
    else assert.equal(run(binary, []).stdout.trim(), 'RUST_CALLBACK_TRAITS_OK');
    report.rustControls.push({ name, outcome: code ? 'reject' : 'accept-and-run', codes: errors.map(error => error.code?.code).filter(Boolean) });
    console.log(`[native-callbacks] Rust control ${name}: ${code ?? 'RUST_CALLBACK_TRAITS_OK'}`);
  }
}
