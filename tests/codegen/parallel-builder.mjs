import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
import { buildModulesWithJobs } from '../../output/Purust.Build/index.js';

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
  const cwd = process.cwd(), jobs = process.env.PURUST_PBO_JOBS;
  const directory = mkdtempSync(join(tmpdir(), 'purust-pbo-scheduler-'));
  process.chdir(directory);
  t.after(() => {
    process.chdir(cwd); rmSync(directory, { recursive: true, force: true });
    if (jobs === undefined) delete process.env.PURUST_PBO_JOBS; else process.env.PURUST_PBO_JOBS = jobs;
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
