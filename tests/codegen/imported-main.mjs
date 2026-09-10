// A library value called main keeps its module-qualified symbol, while each
// generated module also exposes the alias used by executable entry points.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { codegenModule } from '../../output/Purust.CodeGen/index.js';
import { empty, insert } from '../../output/Data.Map/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Int, LitInt, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Lit, Op2, OpAdd, OpIntNum, PrimOp, Typed, Var }
  from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const int = value => new Typed(Int.value, new Lit(new LitInt(value)));
const reference = moduleName => new Typed(Int.value,
  new Var(new Qualified(new Just(moduleName), 'main')));
let arities = empty;
for (const name of ['Library.Left', 'Library.Right']) {
  arities = insert(ordString)(`${name.replaceAll('.', '_')}_main`)(Int.value)(arities);
}
const generate = (name, binding, expression) => codegenModule(arities)(empty)
  ({ name, dataDecls: [], classDecls: [] })
  ({ name, bindings: [{ recursive: false, bindings: [new Tuple(binding, expression)] }] });
const left = generate('Library.Left', 'main', int(11));
const right = generate('Library.Right', 'main', int(31));
const consumer = generate('Consumer', 'sum', new Typed(Int.value,
  new PrimOp(new Op2(new OpIntNum(OpAdd.value),
    reference('Library.Left'), reference('Library.Right')))));
const rust = `#![allow(non_snake_case)]
mod left {
${left}
}
mod right {
${right}
}
use left::Library_Left_main;
use right::Library_Right_main;
${consumer}
fn main() {
    assert_eq!(Library_Left_main(), 11);
    assert_eq!(Library_Right_main(), 31);
    assert_eq!(left::main(), 11);
    assert_eq!(right::main(), 31);
    assert_eq!(Consumer_sum(), 42);
    println!("Imported main values keep distinct qualified symbols and entry aliases.");
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-imported-main-'));
try {
  const source = join(directory, 'main.rs');
  const binary = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [
    ['rustc', ['--edition=2021', source, '-o', binary]],
    [binary, []],
  ]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    if (command === binary) process.stdout.write(result.stdout);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
