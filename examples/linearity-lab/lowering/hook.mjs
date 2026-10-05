import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTypedOutput } from '../../../tools/native-workspace.mjs';
import { translate } from './translate.mjs';
import { runRoutingTests } from './routing-tests.mjs';

export function prepare({ input }) {
  for (const name of ['Linear.purs', 'Linear.rs']) {
    cpSync(fileURLToPath(new URL(`../combinators/${name}`, import.meta.url)), join(input, name));
  }
}

export function check({ input, workspace, artifacts, run, report, compiled, sourcesFor, compiler, backend }) {
  report.routing = runRoutingTests({ reportPath: join(artifacts, 'routing.json') });
  const expected = {
    Sequential: 'accept', TwoResources: 'accept', Observed: 'accept', Alias: 'accept', Shadow: 'accept', ScalarCopy: 'accept',
    ImplicitScalarCopy: 'LINEARITY', DoubleConsume: 'LINEARITY', Discard: 'LINEARITY',
    OrdinaryBorrow: 'UNSUPPORTED', LocalFunction: 'UNSUPPORTED',
  };
  const generated = [];
  report.lowering = [];
  for (const [name, outcome] of Object.entries(expected)) {
    const moduleName = `LinearLab.Lowering.${name}`;
    const module = JSON.parse(readFileSync(join(compiled.get(moduleName), moduleName, 'corefn.json'), 'utf8'));
    let result;
    try { result = { outcome: 'accept', ...translate(module) }; }
    catch (error) { result = { outcome: error.message.split(':')[0], message: error.message }; }
    assert.equal(result.outcome, outcome, `${name}: ${JSON.stringify(result)}`);
    report.lowering.push({ name, ...result });
    if (outcome === 'accept') generated.push(`${name[0].toLowerCase() + name.slice(1)} :: L.Linear Int Int\n${name[0].toLowerCase() + name.slice(1)} = ${result.code}\n`);
    console.log(`[lowering] ${outcome}: ${name}`);
  }
  const source = 'module LinearLab.Lowering.Generated where\n\nimport LinearLab.Combinators.Linear as L\n\n' + generated.join('\n');
  writeFileSync(join(input, 'Generated.purs'), source);
  writeFileSync(join(artifacts, 'Generated.purs'), source);
  writeFileSync(join(input, 'Demo.purs'), `module LinearLab.Lowering.Demo where

import Prelude
import Effect (Effect)
import LinearLab.Combinators.Linear as L
import LinearLab.Lowering.Generated as G

foreign import checkUnopened :: Effect Int -> Effect Unit
foreign import assertEqual :: Int -> Int -> Effect Unit
foreign import verify :: Effect Unit

main :: Effect Unit
main = do
  let action = L.runInt G.sequential 10
  checkUnopened action
  first <- action
  assertEqual 17 first
  replay <- action
  assertEqual 17 replay
  paired <- L.runInt G.twoResources 10
  assertEqual 23 paired
  observed <- L.runInt G.observed 10
  assertEqual 36 observed
  alias <- L.runInt G.alias 10
  assertEqual 11 alias
  shadow <- L.runInt G.shadow 10
  assertEqual 12 shadow
  scalar <- L.runInt G.scalarCopy 10
  assertEqual 20 scalar
  verify
`);
  writeFileSync(join(input, 'Demo.rs'), `
pub fn LinearLab_Lowering_Demo_checkUnopened(_action: Value) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        Purs_LinearLab_Combinators_Linear::verify_counts(0);
        println!("LOWERING_UNOPENED");
        Value::Unit
    })))
}
pub fn LinearLab_Lowering_Demo_assertEqual(expected: i64, actual: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!(actual, expected);
        Value::Unit
    })))
}
pub fn LinearLab_Lowering_Demo_verify() -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        Purs_LinearLab_Combinators_Linear::verify_counts(7);
        println!("AUTOMATIC_ROUTING_OK resources=7 results=17,17,23,36,11,12,20");
        Value::Unit
    })))
}
`);
  const tast = join(workspace, 'generated-tast');
  run(compiler, ['compile', ...sourcesFor('LinearLab.Combinators.Linear'), join(input, 'Generated.purs'), join(input, 'Demo.purs'),
    '--codegen', 'corefn', '--output', tast]);
  report.generatedTast = verifyTypedOutput(tast);
  const expectedTrace = [
    'LOWERING_UNOPENED',
    'COMBINATOR_OPEN 1', 'COMBINATOR_ADD 1 7 17', 'COMBINATOR_READ 1 17', 'COMBINATOR_FINISH 1 17',
    'COMBINATOR_OPEN 2', 'COMBINATOR_ADD 2 7 17', 'COMBINATOR_READ 2 17', 'COMBINATOR_FINISH 2 17',
    'COMBINATOR_OPEN 3', 'COMBINATOR_ADD 3 2 12', 'COMBINATOR_FINISH 3 12',
    'COMBINATOR_OPEN 4', 'COMBINATOR_ADD 4 1 11', 'COMBINATOR_FINISH 4 11',
    'COMBINATOR_OPEN 5', 'COMBINATOR_READ 5 10', 'COMBINATOR_ADD 5 3 13', 'COMBINATOR_READ 5 13', 'COMBINATOR_FINISH 5 13',
    'COMBINATOR_OPEN 6', 'COMBINATOR_ADD 6 1 11', 'COMBINATOR_FINISH 6 11',
    'COMBINATOR_OPEN 7', 'COMBINATOR_ADD 7 2 12', 'COMBINATOR_FINISH 7 12',
    'AUTOMATIC_ROUTING_OK resources=7 results=17,17,23,36,11,12,20', '',
  ].join('\n');
  for (const mode of ['normal', 'threaded']) {
    const output = join(workspace, `generated-${mode}`);
    run(process.execPath, ['--stack-size=65536', backend, '--source', tast, '--out', output,
      '--main', 'LinearLab.Lowering.Demo', ...(mode === 'threaded' ? ['--threaded'] : [])]);
    const result = run('cargo', ['run', '--offline', '--quiet'], { cwd: output });
    assert.equal(result.stdout, expectedTrace, 'Native order/allocation trace differs from the source TAST sequence');
    const saved = join(artifacts, mode);
    mkdirSync(saved, { recursive: true });
    for (const module of ['Generated', 'Demo']) {
      cpSync(join(output, `Purs_LinearLab_Lowering_${module}/src/lib.rs`), join(saved, `${module}.rs`));
    }
    report.executions.push({ module: 'LinearLab.Lowering.Demo', mode, stdout: result.stdout });
    console.log(`[lowering] Rust ${mode}: AUTOMATIC_ROUTING_OK`);
  }
}
