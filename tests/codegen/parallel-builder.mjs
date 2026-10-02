import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import * as Aff from '../../output/Effect.Aff/index.js';
import { Left } from '../../output/Data.Either/index.js';
import { Nothing, Just } from '../../output/Data.Maybe/index.js';
import * as C from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { fromFoldable } from '../../output/Data.List/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { buildModulesWithJobs, buildModulesInScope, buildConcurrency } from '../../output/Purust.Build/index.js';
import { withEmitter } from '../../output/Purust.Emission/index.js';

const pure = Aff.applicativeAff.pure, bind = Aff.bindAff.bind, lift = Aff.monadEffectAff.liftEffect;
const run = aff => new Promise((resolve, reject) => Aff.runAff(result => () =>
  result instanceof Left ? reject(result.value0) : resolve(result.value0))(aff)());
const ann = { span: C.emptySpan, type: new Just(C.Int.value), meta: Nothing.value, sourceUsage: Nothing.value };
const literal = n => new C.ExprLit(ann, new C.LitInt(n));
const variable = (module, name) => new C.ExprVar(ann, new C.Qualified(new Just(module), name));
const moduleOf = (name, expression, comments = []) => ({ name, path: `${name}.purs`, span: C.emptySpan,
  imports: [], exports: ['value'], reExports: [], dataDecls: [], classDecls: [], foreign: emptyMap, comments,
  decls: [new C.NonRec(new C.Binding(ann, 'value', expression))] });
const modules = fromFoldable(foldableArray)([
  moduleOf('Ahead', variable('Behind', 'value')),
  moduleOf('Base', literal(9), [new C.LineComment('@inline export value never')]),
  moduleOf('Behind', literal(7)),
  moduleOf('User', variable('Base', 'value')),
]);
function options(collected) {
  return { directives: emptyMap, analyzeCustom: () => () => Nothing.value, foreignSemantics: emptyMap,
    traceIdents: emptySet, rewriteLimit: 10000,
    onPrepareModule: () => mod => pure(mod), onSkipModule: () => () => pure(Nothing.value),
    onCodegenModule: () => mod => backend => steps => lift(() => collected.push({ name: mod.name, backend, steps })) };
}
function isolate(t) {
  const cwd = process.cwd(), jobs = process.env.PURUST_PBO_JOBS, codegen = process.env.PURUST_CODEGEN_JOBS;
  delete process.env.PURUST_CODEGEN_JOBS;
  const directory = mkdtempSync(join(tmpdir(), 'purust-pbo-scheduler-'));
  process.chdir(directory);
  t.after(() => {
    process.chdir(cwd); rmSync(directory, { recursive: true, force: true });
    if (jobs === undefined) delete process.env.PURUST_PBO_JOBS; else process.env.PURUST_PBO_JOBS = jobs;
    if (codegen === undefined) delete process.env.PURUST_CODEGEN_JOBS; else process.env.PURUST_CODEGEN_JOBS = codegen;
  });
}
test('Aff scheduler preserves rank visibility, directives and ordered output with delayed workers', async t => {
  isolate(t);
  process.env.PURUST_PBO_JOBS = '1';
  const expected = [];
  await run(buildModulesWithJobs(options(expected))(modules));
  for (const jobs of ['2', '4', '8']) {
    process.env.PURUST_PBO_JOBS = jobs;
    const actual = [], config = options(actual);
    config.onPrepareModule = () => mod => bind(Aff.delay(mod.name === 'Base' ? 15 : 1))(() => pure(mod));
    await run(buildModulesWithJobs(config)(modules));
    assert.deepEqual(actual, expected);
  }
});
test('Aff scheduler propagates preparation/codegen failures and supervises its children', async t => {
  isolate(t);
  process.env.PURUST_PBO_JOBS = '4';
  for (const failure of ['prepare', 'codegen']) {
    let active = 0;
    const config = options([]);
    config.onPrepareModule = () => mod => Aff.bracket(lift(() => { active++; }))(
      () => lift(() => { active--; }))(() => bind(Aff.delay(mod.name === 'Ahead' ? 1 : 50))(() =>
        failure === 'prepare' && mod.name === 'Ahead' ? Aff.monadThrowAff.throwError(new Error('prepare failed')) : pure(mod)));
    config.onCodegenModule = () => () => () => () => Aff.monadThrowAff.throwError(new Error('codegen failed'));
    await assert.rejects(run(buildModulesWithJobs(config)(modules)), new RegExp(`${failure} failed`));
    assert.equal(active, 0, 'all worker finalizers must finish before the error is returned');
  }
});
test('parallel PBO forces untyped private bindings like the sequential builder', async t => {
  isolate(t);
  const untyped = { ...ann, type: Nothing.value };
  const privateMod = moduleOf('Private', variable('Private', 'hidden'));
  privateMod.decls.unshift(new C.NonRec(new C.Binding(untyped, 'hidden',
    new C.ExprApp(untyped, new C.ExprVar(untyped, new C.Qualified(new Just('External'), 'make')), literal(7)))));
  const corpus = fromFoldable(foldableArray)([privateMod, moduleOf('Consumer', variable('Private', 'hidden'))]);
  const expected = [];
  process.env.PURUST_PBO_JOBS = '1';
  await run(buildModulesWithJobs(options(expected))(corpus));
  for (const jobs of ['2', '4', '8']) {
    const actual = [];
    process.env.PURUST_PBO_JOBS = jobs;
    await run(buildModulesWithJobs(options(actual))(corpus));
    assert.deepEqual(actual, expected);
  }
});

test('optimization and delayed generation share a bounded lifetime through ordered publication', async t => {
  isolate(t);
  const expected = [];
  process.env.PURUST_PBO_JOBS = '1';
  await run(buildModulesWithJobs(options(expected))(modules));
  for (const workers of [2, 4]) {
    process.env.PURUST_PBO_JOBS = '8';
    process.env.PURUST_CODEGEN_JOBS = String(workers);
    const config = buildConcurrency();
    const published = [];
    let active = 0, peak = 0;
    const tracked = action => Aff.bracket(lift(() => { active++; peak = Math.max(peak, active); }))(
      () => lift(() => { active--; }))(() => action);
    const generate = item => tracked(bind(Aff.delay(item.name === 'User' ? 20 : 3))(() => pure(item)));
    await run(withEmitter(config.codegen)(generate)(item => lift(() => published.push(item)))(enqueue => {
      const opts = options([]);
      opts.onPrepareModule = () => mod => tracked(bind(Aff.delay(1))(() => pure(mod)));
      opts.onCodegenModule = () => mod => backend => steps => enqueue({ name: mod.name, backend, steps });
      return buildModulesInScope(opts)(modules);
    }));
    assert.deepEqual(published, expected);
    assert.equal(active, 0);
    assert(peak <= 8, `combined worker budget exceeded: ${peak}`);
    assert.equal(config.optimize + config.codegen, 8);
  }
});

test('explicit concurrency stays within the shared budget, including small and invalid configurations', t => {
  isolate(t);
  for (const [budget, requested, optimize, codegen] of [
    ['1', '4', 1, 1], ['2', '4', 2, 1], ['3', '4', 1, 2],
    ['8', '4', 4, 4], ['8', '64', 1, 7], ['8', '1', 8, 1],
    ['0', '4', 1, 1], ['8', 'invalid', 8, 1], ['8', '0', 8, 1],
  ]) {
    process.env.PURUST_PBO_JOBS = budget;
    process.env.PURUST_CODEGEN_JOBS = requested;
    const actual = buildConcurrency();
    assert.equal(actual.optimize, optimize, `${budget}/${requested}`);
    assert.equal(actual.codegen, codegen, `${budget}/${requested}`);
  }
});

test('native defaults split small CPU budgets and respect explicit generation settings', t => {
  const directory = mkdtempSync(join(tmpdir(), 'purust-build-budget-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'main.rs'), `
#![allow(non_snake_case, private_interfaces)]
enum Func1 { Shared(std::rc::Rc<dyn Fn(Value) -> Value>) }
enum Value { Int(i64), Func1(Func1) }
${readFileSync(new URL('../../src/Purust/Build.rs', import.meta.url), 'utf8')}
fn run(effect: Value) -> i64 {
    let Value::Func1(Func1::Shared(call)) = effect else { panic!("expected Effect") };
    let Value::Int(value) = call(Value::Int(0)) else { panic!("expected Int") };
    value
}
fn main() {
    std::env::remove_var("PURUST_PBO_JOBS");
    std::env::remove_var("PURUST_CODEGEN_JOBS");
    let budget = run(Purust_Build_optimizerConcurrency());
    assert!((1..=8).contains(&budget));
    assert!(budget <= std::thread::available_parallelism().unwrap().get() as i64);
    for (budget, expected) in [(1, 1), (2, 1), (3, 1), (4, 2), (8, 4), (64, 4)] {
        std::env::set_var("PURUST_PBO_JOBS", budget.to_string());
        assert_eq!(run(Purust_Build_optimizerConcurrency()), budget);
        assert_eq!(run(Purust_Build_codegenConcurrency()), expected);
    }
    for (setting, expected) in [("1", 1), ("2", 2), ("4", 4), ("64", 64),
        ("0", 1), ("65", 1), ("-1", 1), ("", 1), ("invalid", 1), ("99999999999999999999", 1)] {
        std::env::set_var("PURUST_CODEGEN_JOBS", setting);
        assert_eq!(run(Purust_Build_codegenConcurrency()), expected);
    }
}
`);
  const binary = join(directory, 'checks');
  const build = spawnSync('rustc', ['--edition=2021', join(directory, 'main.rs'), '-o', binary], { encoding: 'utf8', timeout: 120000 });
  assert.equal(build.status, 0, build.error?.message ?? build.stderr);
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
});
