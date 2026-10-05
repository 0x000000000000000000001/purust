import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkProgram } from './check-tast.mjs';

export function prepare({ input, artifacts, run, report }) {
  const parsed = run('cargo', ['run', '--offline', '--quiet', '--manifest-path', join(input, 'extractor/Cargo.toml'),
    '--', join(input, 'native.rs')]);
  const contracts = JSON.parse(parsed.stdout);
  report.contracts = contracts;
  writeFileSync(join(artifacts, 'contracts.json'), JSON.stringify(contracts, null, 2) + '\n');
  const type = ({ kind }) => ({ resource: 'Session', int: 'Int', unit: 'Unit' })[kind];
  const declarations = contracts.functions.map(fn =>
    `foreign import ${fn.name} :: ${[...fn.args.map(type), `Effect ${type(fn.result)}`].join(' -> ')}`);
  const api = 'module LinearLab.Automatic.Native where\n\nimport Effect (Effect)\nimport Data.Unit (Unit)\n\n' +
    'foreign import data Session :: Type\n' + declarations.join('\n') + '\n';
  // Only the scratch copy is generated. Keep the checked-in example reviewable.
  assert.equal(api, readFileSync(join(input, 'Native.purs'), 'utf8'), 'Reference API differs from generated signatures');
  writeFileSync(join(input, 'Native.purs'), api);
  writeFileSync(join(artifacts, 'generated-Native.purs'), api);
  cpSync(join(input, 'extractor/Cargo.lock'), join(artifacts, 'extractor-Cargo.lock'));
  report.unsupportedSignatures = [];
  for (const [name, source] of Object.entries({
    'borrowed-result': 'pub struct Session; pub fn borrowed(s: &Session) -> &Session { s }',
    'nested-shared': 'pub struct Session; pub fn nested(_: &&Session) {}',
    'nested-mutable': 'pub struct Session; pub fn nested(_: &mut &Session) {}',
  })) {
    writeFileSync(join(input, `${name}.rs`), source + '\n');
    const failure = run('cargo', ['run', '--offline', '--quiet', '--manifest-path', join(input, 'extractor/Cargo.toml'),
      '--', join(input, `${name}.rs`)], { reject: true });
    assert.ok(failure.stderr.includes('unsupported signature'));
    report.unsupportedSignatures.push({ name, outcome: 'reject' });
  }
}

export function check({ input, artifacts, run, report, compiled }) {
  report.supplementaryChecks = [];
  const expected = {
    Valid: 'accept', DoubleUse: 'OWNERSHIP', ReplayConsume: 'OWNERSHIP', FreshReplay: 'accept',
    ReadAfterFinish: 'OWNERSHIP', ClosureReplay: 'OWNERSHIP', AffineDrop: 'accept',
    UnknownBranch: 'UNSUPPORTED', Escape: 'UNSUPPORTED',
    OverlappingArgs: 'OWNERSHIP', DisjointArgs: 'accept',
    UnknownCall: 'UNSUPPORTED',
  };
  for (const [name, outcome] of Object.entries(expected)) {
    const moduleName = `LinearLab.Automatic.${name}`;
    const module = JSON.parse(readFileSync(join(compiled.get(moduleName), moduleName, 'corefn.json'), 'utf8'));
    let result;
    try { result = { outcome: 'accept', ...checkProgram(module, report.contracts) }; }
    catch (error) { result = { outcome: error.message.split(':')[0], message: error.message }; }
    assert.equal(result.outcome, outcome, `${name}: ${JSON.stringify(result)}`);
    report.supplementaryChecks.push({ name, ...result });
    console.log(`[automatic] supplementary pass ${outcome}: ${name}`);
  }
  const bodies = {
    valid: 'let mut s = native::open(10); native::add(&mut s, 5); assert_eq!(native::inspect(&s), 15); assert_eq!(native::finish(s), 15); println!("NATIVE_OWNERSHIP_OK");',
    double_move: 'let s = native::open(10); let alias = s; native::finish(s); native::finish(alias);',
    overlapping_borrows: 'let mut s = native::open(10); let a = &mut s; let b = &mut s; native::add(a, 1); native::add(b, 1);',
  };
  report.rustControls = [];
  for (const [name, body] of Object.entries(bodies)) {
    const file = join(input, `${name}.rs`);
    writeFileSync(file, `#[path="native.rs"] mod native;\nfn main() { ${body} }\n`);
    const binary = join(input, `${name}-bin`);
    const result = run('rustc', ['--edition=2021', file, '-o', binary, '--error-format=json'], { reject: name !== 'valid' });
    if (name === 'valid') assert.equal(run(binary, []).stdout.trim(), 'NATIVE_OWNERSHIP_OK');
    else {
      const errors = result.stderr.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
      const code = name === 'double_move' ? 'E0382' : 'E0499';
      assert.ok(errors.some(error => error.code?.code === code));
    }
    report.rustControls.push({ name, outcome: name === 'valid' ? 'accept-and-run' : 'reject' });
  }
  writeFileSync(join(artifacts, 'supplementary-checks.json'), JSON.stringify(report.supplementaryChecks, null, 2) + '\n');
}
