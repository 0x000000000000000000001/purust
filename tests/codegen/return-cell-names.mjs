// Foreign declarations can reserve the same names as internal cell helpers.
// Compile those names together so accidentally emitting a duplicate is caught.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap, insert } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Func, Int, Qualified, SumType } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, CtorSaturated, Local, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';
const ty = new ADT('Tree', ['ReturnCellNames', 'Tree'], []);
const sig = new Func([Int.value], ty);
const qualify = name => new Qualified(new Just('ReturnCellNames'), name);
const ctor = new CtorSaturated(qualify('Node'), SumType.value, 'Tree', 'Node',
  [new Tuple('value0', new Local(new Just('key'), 0))]);
const expr = new Typed(sig, new Abs([new Tuple(new Just('key'), 0)], ctor));
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
for (const reserved of ['rebuild__purust_reuse', '__purust_rebuild_Node']) {
  let arities = insert(ordString)('ReturnCellNames_Node')(sig)(emptyMap);
  arities = insert(ordString)(`ReturnCellNames_${reserved}`)(new Func([Int.value], Int.value))(arities);
  const generated = codegenModule(arities)(emptyMap)({ name: 'ReturnCellNames', classDecls: [],
    dataDecls: [{name: 'Tree', constructors: [{name: 'Empty', fields: []}, {name: 'Node', fields: [Int.value]}]}],
  })({name: 'ReturnCellNames', bindings: [{recursive: false, bindings: [new Tuple('rebuild', expr)]}]});
  const directory = mkdtempSync(join(tmpdir(), 'purust-return-cell-names-'));
  try {
    const source = join(directory, 'checks.rs');
    const binary = join(directory, 'checks');
    writeFileSync(source, `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
pub fn ReturnCellNames_${reserved}(x: i64) -> i64 { x + 99 }
fn main() {
    assert_eq!(ReturnCellNames_${reserved}(1),100);
    assert!(matches!(ReturnCellNames_rebuild(7).as_ref(), Tree::Node(7)));
}`);
    for (const [command,args] of [['rustc',['--edition=2021',source,'-o',binary]], [binary,[]]]) {
      const result = spawnSync(command,args,{encoding:'utf8'});
      assert.equal(result.status,0,`${reserved}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    }
  } finally { rmSync(directory,{recursive:true,force:true}); }
}
console.log('Foreign names retain their declarations and meaning at worker/helper boundaries.');
