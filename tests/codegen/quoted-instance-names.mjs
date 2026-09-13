import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { codegenModule, sanitizeIdent } from '../../output/Purust.CodeGen/index.js';
import { empty, insert } from '../../output/Data.Map/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Int, LitInt, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Lit, Typed, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

// Observed TAST dictionary names plus a distinct underscore Symbol instance.
const names = ['splitDotStep"."', 'splitDotStep"_"', 'splitDotLoop""""', 'hasNestedKeyLoopRecord""'];
const symbols = names.map(sanitizeIdent);
assert.equal(new Set(symbols).size, names.length);
for (const symbol of symbols) {
  assert.match(symbol, /^[A-Za-z_][A-Za-z0-9_]*$/);
  assert.equal(sanitizeIdent(symbol), symbol);
}
let arities = empty;
for (const symbol of symbols) arities = insert(ordString)(`Library_${symbol}`)(Int.value)(arities);
const generate = (name, bindings) => codegenModule(arities)(empty)
  ({ name, dataDecls: [], classDecls: [] })
  ({ name, bindings: [{ recursive: false, bindings }] });
const library = generate('Library', names.map((name, index) => new Tuple(name, new Typed(Int.value, new Lit(new LitInt(index + 1))))));
const caller = generate('Caller', names.map((name, index) => new Tuple(`read${index}`, new Typed(Int.value,
  new Var(new Qualified(new Just('Library'), name))))));
const directory = mkdtempSync(join(tmpdir(), 'purust-quoted-instances-'));
const file = join(directory, 'checks.rs'), binary = join(directory, 'checks');
writeFileSync(file, `${library}\n${caller}\nfn main() {
${names.map((_, index) => `    assert_eq!(Caller_read${index}(), ${index + 1});`).join('\n')}
}`);
for (const [cmd, args] of [['rustc', ['--edition=2021', '-Awarnings', file, '-o', binary]], [binary, []]]) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
}
console.log(`Quoted instance names: declarations and imported references agree; ${directory}`);
