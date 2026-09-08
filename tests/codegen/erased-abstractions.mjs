// Run after npm run build. An erased annotation around an abstraction must
// preserve its native function representation until an actual boxing boundary.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Func, Int } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, Local, Typed, UncurriedAbs } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const value = Any.value;
const param = (name, level) => new Tuple(new Just(name), level);
const local = (name, level) => new Local(new Just(name), level);
const erased = expression => new Typed(value, new Typed(value, expression));
const fn1 = new Func([Int.value], Int.value);
const binding = (name, argType, body) => new Tuple(name,
  new Typed(new Func([argType], value), new Abs([param('captured', 0)], body)));

const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'ErasedAbs', dataDecls: [], classDecls: [] },
)({ name: 'ErasedAbs', bindings: [{ recursive: false, bindings: [
  binding('captured', value, erased(new Abs([param('x', 1)], local('captured', 0)))),
  binding('binary', value, erased(new Abs([param('x', 1), param('y', 2)], local('y', 2)))),
  binding('uncurried', value, erased(new UncurriedAbs([param('x', 1), param('y', 2)], local('y', 2)))),
  binding('unannotated', value, new Abs([param('x', 1), param('y', 2)], local('y', 2))),
  // The annotation flattens two arguments, but the AST has only one explicit
  // binder and returns the captured function for the remaining argument.
  binding('partialBinders', fn1, new Typed(new Func([Int.value, Int.value], Int.value),
    new Abs([param('x', 1)], local('captured', 0)))),
  // Top-level eta expansion must keep the parameter annotation even when
  // PBO deduplicates the root Typed wrapper.
  ...[false, true].map(repeated => {
    const type = new Func([fn1, Int.value], Int.value);
    const body = new Typed(type, new Abs([param('captured', 0)], local('captured', 0)));
    return new Tuple(repeated ? 'topPartialRepeated' : 'topPartial',
      repeated ? new Typed(type, body) : body);
  }),
] }] });

const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${generated}
fn main() {
    let captured = ErasedAbs_captured(mk_int(42)).unwrap_func1();
    assert_eq!(captured(mk_int(1)).unwrap_int(), 42);
    assert_eq!(captured(mk_int(2)).unwrap_int(), 42);
    for make in [ErasedAbs_binary, ErasedAbs_uncurried, ErasedAbs_unannotated] {
        let f = make(mk_int(0)).unwrap_func2();
        assert_eq!(f(mk_int(1), mk_int(42)).unwrap_int(), 42);
    }
    let f = ErasedAbs_partialBinders(Func1::Static(|x| x + 1)).unwrap_func2();
    assert_eq!(f(mk_int(999), mk_int(41)).unwrap_int(), 42);
    for apply in [ErasedAbs_topPartial, ErasedAbs_topPartialRepeated] {
        assert_eq!(apply(Func1::Static(|x| x + 1), 41), 42);
    }
}
`;

const dir = mkdtempSync(join(tmpdir(), 'purust-erased-abs-'));
try {
  const source = join(dir, 'erased-abs.rs');
  const binary = join(dir, 'erased-abs');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', [source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Erased abstractions: captured, binary, uncurried and partial binder Rust checks passed.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
