// Run after npm run build. Exercise code generation directly so PBO cannot
// constant-fold the primitive before Rust sees it.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { codegenModule } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Map/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Func, Int, Number as NumberType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Local, Op2, OpIntNum, OpNumberNum, OpDivide, OpMod, PrimOp, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
import { intDiv } from '../../../purust-prelude/src/Data/EuclideanRing.js';

function binding(name, type, operator) {
  const params = [new Tuple(new Just('x'), 0), new Tuple(new Just('y'), 1)];
  const body = new PrimOp(new Op2(operator,
    new Local(new Just('x'), 0), new Local(new Just('y'), 1)));
  return new Tuple(name, new Typed(new Func([type, type], type), new Abs(params, body)));
}

const generated = codegenModule(empty)(empty)(
  { name: 'Modulo', dataDecls: [], classDecls: [] },
)({
  name: 'Modulo',
  bindings: [{ recursive: false, bindings: [
    binding('intDiv', Int.value, new OpIntNum(OpDivide.value)),
    binding('intMod', Int.value, new OpIntNum(OpMod.value)),
    binding('numberMod', NumberType.value, new OpNumberNum(OpMod.value)),
  ] }],
});

// Compare generated, non-constant-folded divisions with Prelude's JS oracle.
// Zero divisors exercise the PBO multiplication overflow check; negative
// dividends distinguish Euclidean division from Rust's truncating `/`.
const edges = [-2147483648, -2147483647, -17, -5, -1, 0, 1, 5, 17, 2147483647];
const divisions = edges.flatMap(x => edges.map(y => [x, y, intDiv(x)(y)]));
let seed = 0x5eed;
const randomInt = () => (seed = (Math.imul(seed, 1664525) + 1013904223) | 0);
for (let i = 0; i < 512; i++) {
  const x = randomInt(), y = randomInt();
  divisions.push([x, y, intDiv(x)(y)]);
}

const rust = `#![allow(non_snake_case, unused_mut)]
${generated}
fn main() {
    for (x, y, expected) in [
        ${divisions.map(row => `(${row.join(', ')})`).join(',\n        ')}
    ] {
        assert_eq!(Modulo_intDiv(x, y), expected, "div({}, {})", x, y);
    }
    for (x, y, expected) in [
        (17, 5, 2), (-17, 5, 3), (17, -5, 2), (-17, -5, 3),
        (17, 0, 0), (0, 0, 0), (0, 5, 0),
        (-2147483648, -1, 0), (2147483647, -2147483648, 2147483647),
    ] {
        assert_eq!(Modulo_intMod(x, y), expected, "mod({}, {})", x, y);
    }
    assert_eq!(Modulo_numberMod(5.5, 2.0), 0.0);
    assert_eq!(Modulo_numberMod(-5.5, 2.0), 0.0);
    assert_eq!(Modulo_numberMod(5.5, 0.0), 0.0);
}
`;

const dir = mkdtempSync(join(tmpdir(), 'purust-modulo-'));
try {
  const source = join(dir, 'modulo.rs');
  const binary = join(dir, 'modulo');
  writeFileSync(source, rust);
  for (const [command, args] of [
    ['rustc', [source, '-o', binary]], [binary, []],
    ['rustc', ['-O', source, '-o', binary]], [binary, []],
  ]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log(`Primitive division/modulo: ${divisions.length + 12} checks passed in debug and optimized Rust.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
