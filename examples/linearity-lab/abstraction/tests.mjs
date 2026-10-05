import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { realpathSync, writeFileSync } from 'node:fs';
import {
  variable as v, global as g, application as a, lambda as l,
  compile, print, LinearityError,
} from './algorithm.mjs';
import { evaluateSource, evaluateCombinators, applyArguments } from './interpreter.mjs';

const lambdas = (names, body) => names.reduceRight((term, name) => l(name, term), body);
const applications = (head, args) => args.reduce(a, head);
const scalar = value => ({ kind: 'constant', value });
const linear = value => ({ kind: 'linear-function', value });

export function runTests() {
  const accepted = [], rejected = [], controls = [];
  let semanticComparisons = 0;
  const globals = {
    seven: scalar(7), twenty: scalar(20),
    increment: linear(x => x + 1), double: linear(x => x * 2),
    pair: linear(x => y => [x, y]),
    collect5: linear(a => b => c => d => e => [a, b, c, d, e]),
    I: scalar(23),
  };
  function good(name, source, inputs, { basis = 'BCI', expected, target, table = globals } = {}) {
    const result = compile(source, { globals: table, basis });
    const printed = print(result.term);
    if (target !== undefined) assert.equal(printed, target, name);
    for (const args of inputs) {
      const actual = applyArguments(evaluateCombinators(result.term, table), args);
      const reference = applyArguments(evaluateSource(source, table), args);
      assert.deepEqual(actual, reference, `${name}: generated program differs from lambda evaluator`);
      if (expected !== undefined) assert.deepEqual(actual, expected, name);
      semanticComparisons += 1;
    }
    accepted.push({ name, basis, target: printed, steps: result.steps, observations: inputs.length });
    return result;
  }
  function bad(name, source, code, options = {}) {
    assert.throws(() => compile(source, { globals, ...options }), error =>
      error instanceof LinearityError && error.code === code, name);
    rejected.push({ name, code });
  }

  good('identity', l('x', v('x')), [[0], [7], ['text']], { basis: 'BI', target: 'I' });
  good('eta', l('f', l('x', a(v('f'), v('x')))), [[x => x + 3, 4]], { basis: 'BI', target: 'I', expected: 7 });
  good('composition', lambdas(['f', 'g', 'x'], a(v('f'), a(v('g'), v('x')))),
    [[x => x + 3, x => x * 2, 4]], { basis: 'BI', target: 'B', expected: 11 });

  const phil = lambdas(['a', 'b', 'c', 'd', 'e'], a(a(v('a'), a(v('b'), v('c'))), a(v('d'), v('e'))));
  good('Phil article example', phil, [[x => y => [x, y], x => x + 1, 10, x => x * 2, 7]],
    { basis: 'BI', target: 'B (B (B B)) B', expected: [11, 14] });

  good('exchange-left', lambdas(['f', 'x'], a(v('x'), v('f'))), [[7, x => x + 1]],
    { target: 'C I', expected: 8 });
  good('closed argument on right', l('f', a(v('f'), g('seven'))), [[x => x * 2]],
    { target: 'C I @seven', expected: 14 });
  good('closed function eta', l('x', a(g('increment'), v('x'))), [[10]],
    { basis: 'BI', target: '@increment', expected: 11 });
  good('closed scalar term', g('seven'), [[]], { target: '@seven', expected: 7 });
  good('explicit global is not a local or combinator', l('I', a(a(g('pair'), v('I')), g('I'))), [[2]],
    { expected: [2, 23] });

  // Distinct binder identities are required even when display names repeat.
  good('shadowed local still uses outer argument', l('x', a(l('x', v('x')), v('x'))), [[17]],
    { basis: 'BI', expected: 17 });
  good('shadowing in separate branches', l('x', a(l('x', a(g('increment'), v('x'))), v('x'))), [[17]],
    { basis: 'BI', expected: 18 });
  bad('shadowing must not hide unused outer binder', l('x', l('x', v('x'))), 'DroppedBinding');
  bad('shadowing must not hide duplicate inner binder', l('x', a(l('x', a(a(g('pair'), v('x')), v('x'))), v('x'))), 'DuplicatedBinding');
  bad('duplicate local', l('x', a(a(g('pair'), v('x')), v('x'))), 'DuplicatedBinding');
  bad('duplicate under closure', l('x', l('f', a(a(v('f'), v('x')), v('x')))), 'DuplicatedBinding');
  bad('drop local', l('x', g('seven')), 'DroppedBinding');
  bad('unused outer argument', lambdas(['x', 'y'], v('y')), 'DroppedBinding');
  bad('unknown variable is not silently a global', l('x', a(v('missing'), v('x'))), 'UnboundVariable');
  bad('known global still requires explicit global node', v('seven'), 'UnboundVariable');
  bad('unknown primitive', g('missing'), 'UnknownGlobal');
  bad('unsupported source combinator injection', { tag: 'combinator', name: 'K' }, 'UnsupportedNode');
  bad('unknown basis', l('x', v('x')), 'UnknownBasis', { basis: 'SKI' });
  bad('BI cannot exchange local variables', lambdas(['f', 'x'], a(v('x'), v('f'))), 'ExchangeRequired', { basis: 'BI' });
  bad('BI cannot exchange a local with closed argument', l('f', a(v('f'), g('seven'))), 'ExchangeRequired', { basis: 'BI' });
  bad('closed nonlinear function is not automatically trusted', g('const'), 'UntrustedGlobal', {
    globals: { const: { kind: 'nonlinear-function', value: x => _y => x } },
  });
  bad('closed function cannot be labelled a scalar constant', g('const'), 'UntrustedGlobal', {
    globals: { const: scalar(x => _y => x) },
  });
  bad('closed resource object is not an immutable scalar', g('session'), 'UntrustedGlobal', {
    globals: { session: scalar({ consumed: false }) },
  });

  // Every permutation of five arguments: C automates all exchanges.
  function permutations(values) {
    if (!values.length) return [[]];
    return values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest]));
  }
  const names = ['a', 'b', 'c', 'd', 'e'];
  for (const order of permutations(names)) {
    good(`permutation-${order.join('')}`, lambdas(names, applications(g('collect5'), order.map(v))),
      [[1, 2, 3, 4, 5], [0, -7, 20, 100, 6], ['a', 'b', 'c', 'd', 'e']]);
  }

  // Every binary pair shape for four leaves, under every leaf permutation.
  function trees(leaves) {
    if (leaves.length === 1) return [v(leaves[0])];
    const result = [];
    for (let split = 1; split < leaves.length; split += 1) {
      for (const left of trees(leaves.slice(0, split))) {
        for (const right of trees(leaves.slice(split))) result.push(a(a(g('pair'), left), right));
      }
    }
    return result;
  }
  for (const order of permutations(names.slice(0, 4))) {
    trees(order).forEach((body, index) => good(`tree-${order.join('')}-${index}`,
      lambdas(names.slice(0, 4), body), [[1, 2, 3, 4], ['a', 'b', 'c', 'd']]));
  }

  // This test separates use checking from simple type checking. The AST
  // algorithm intentionally does not infer whether an application is typed.
  const illTyped = a(g('seven'), g('twenty'));
  const target = compile(illTyped, { globals }).term;
  assert.throws(() => evaluateSource(illTyped, globals), TypeError);
  assert.throws(() => evaluateCombinators(target, globals), TypeError);
  controls.push({ name: 'ill-typed closed application', outcome: 'abstraction succeeds; both evaluators reject application of a scalar' });

  // Falsely declaring a primitive linear is not made sound by this pass.
  const dishonest = { duplicate: linear(x => [x, x]) };
  const dishonestTarget = compile(l('x', a(g('duplicate'), v('x'))), { globals: dishonest }).term;
  const token = {};
  const aliases = evaluateCombinators(dishonestTarget, dishonest)(token);
  assert.equal(aliases[0], aliases[1]);
  controls.push({ name: 'dishonest primitive contract', outcome: 'accepted declaration can duplicate; trusted primitive bodies are not verified' });

  // Eta preserves the tested extensional results for total pure functions;
  // it need not preserve when an effect hidden in a function expression runs.
  const sourceEvents = [], targetEvents = [];
  const effectful = events => ({
    seven: scalar(7),
    mark: linear(n => { events.push('called'); return x => n + x; }),
  });
  const delayed = l('x', a(a(g('mark'), g('seven')), v('x')));
  const sourceValue = evaluateSource(delayed, effectful(sourceEvents));
  const delayedTarget = compile(delayed, { globals: effectful(targetEvents) }).term;
  const targetValue = evaluateCombinators(delayedTarget, effectful(targetEvents));
  assert.deepEqual(sourceEvents, []);
  assert.deepEqual(targetEvents, ['called']);
  assert.equal(sourceValue(3), targetValue(3));
  controls.push({ name: 'effectful primitive with eta', outcome: 'same final result, but target evaluates the marked function expression earlier' });

  return { complete: true, accepted, rejected, controls, semanticComparisons,
    guarantee: 'Syntactically linear lambda AST to closed BCI/BI terms, with tested extensional semantics for trusted pure total primitives.' };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const report = runTests();
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(`ABSTRACTION_OK accepted=${report.accepted.length} rejected=${report.rejected.length} semantic=${report.semanticComparisons}`);
}
