// Run after npm run build. Optimizer locals are identified by their lexical
// levels, so reusing a human-readable name must not capture a different local.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Func, Int, LitBoolean, LitInt, Qualified } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Branch, Let, Lit, Local, Op2, OpAdd, OpIntNum, Pair, PrimOp, Typed, Var } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const local = level => new Local(new Just('x'), level);
const param = level => new Tuple(new Just('x'), level);
const binding = (name, type, body) => new Tuple(name, new Typed(type, new Abs([param(0)], body)));
const fnType = new Func([Int.value], Int.value);
const global = (name, qualifier = Nothing.value) => new Var(new Qualified(qualifier, name));
const bindings = [
  binding('sameType', fnType, new Let(new Just('x'), 1, new Lit(new LitInt(99)), local(0))),
  binding('differentType', fnType, new Let(new Just('x'), 1, new Lit(new LitBoolean(true)),
    new Branch([new Pair(local(1), local(0))], local(0)))),
  binding('captured', new Func([Int.value], fnType),
    new Let(new Just('x'), 1, new Lit(new LitInt(99)),
      new Typed(fnType, new Abs([param(2)],
        new PrimOp(new Op2(new OpIntNum(OpAdd.value), local(0), local(2))))))),
  new Tuple('purs_local_0', new Typed(Int.value, new Lit(new LitInt(42)))),
  binding('purs_local_1', fnType, new PrimOp(new Op2(new OpIntNum(OpAdd.value), local(0), new Lit(new LitInt(1))))),
  binding('globalValue', fnType, global('purs_local_0')),
  binding('qualifiedGlobal', fnType, global('purs_local_0', new Just('Shadow'))),
  binding('globalCall', fnType, new Let(new Just('x'), 1, new Lit(new LitInt(999)),
    new App(global('purs_local_1'), [local(0)]))),
  binding('globalClosure', new Func([Int.value], fnType),
    new Typed(fnType, new Abs([param(1)], global('purs_local_0')))),
];
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'Shadow', dataDecls: [], classDecls: [] },
)({ name: 'Shadow', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    assert_eq!(Shadow_sameType(42), 42);
    assert_eq!(Shadow_differentType(42), 42);
    let captured = Shadow_captured(19);
    assert_eq!(captured(23), 42);
    assert_eq!(captured(24), 43);
    assert_eq!(Shadow_globalValue(999), 42);
    assert_eq!(Shadow_qualifiedGlobal(999), 42);
    assert_eq!(Shadow_globalCall(41), 42);
    assert_eq!(Shadow_globalClosure(999)(123), 42);
}
`;
const dir = mkdtempSync(join(tmpdir(), 'purust-shadowing-'));
try {
  const source = join(dir, 'shadowing.rs');
  const binary = join(dir, 'shadowing');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', [source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Lexical locals preserve values across name collisions and nested abstractions.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
