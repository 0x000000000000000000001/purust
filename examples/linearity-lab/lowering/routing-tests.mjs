import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from './translate.mjs';

// Structural unit tests over synthetic ASTs, not compiler-generated TAST.
// Arbitrarily shaped inputs exercise generic routing, independently of the
// Int -> Int boundary checked by the real compilation/execution fixtures.
const sourceModule = ['LinearLab', 'Lowering', 'Source'];
const variable = identifier => ({ type: 'Var', value: { identifier } });
const application = (abstraction, argument) => ({ type: 'App', abstraction, argument });
const pair = (left, right) => application(application({
  type: 'Var', value: { moduleName: sourceModule, identifier: 'Pair' },
}, left), right);

function split(value, left, right, body) {
  return {
    type: 'Case', caseExpressions: [value], caseAlternatives: [{
      isGuarded: false,
      binders: [{
        binderType: 'ConstructorBinder',
        constructorName: { moduleName: sourceModule, identifier: 'Pair' },
        binders: [left, right].map(identifier => ({ binderType: 'VarBinder', identifier })),
      }],
      expression: body,
    }],
  };
}

const moduleFor = body => ({
  moduleName: ['RoutingProbe'],
  decls: [{ identifier: 'program', bindType: 'NonRec',
    expression: { type: 'Abs', argument: 'input', body } }],
});

// An independent executable interpretation of the structural arrows.
const arrows = {
  identity: value => value,
  swap: ([left, right]) => [right, left],
  assoc: ([[a, b], c]) => [a, [b, c]],
  unassoc: ([a, [b, c]]) => [[a, b], c],
  then_: first => second => value => second(first(value)),
  tensor: left => right => ([a, b]) => [left(a), right(b)],
};

function interpret(code) {
  const tokens = code.match(/L\.\w+|[()]/g) ?? [];
  assert.equal(tokens.join(''), code.replace(/\s/g, ''), 'Unexpected routing syntax');
  let index = 0;
  function value() {
    const token = tokens[index++];
    if (token !== '(') {
      const arrow = arrows[token?.slice(2)];
      assert.equal(typeof arrow, 'function', `Unknown structural arrow: ${token}`);
      return arrow;
    }
    let result = value();
    while (tokens[index] !== ')') {
      assert.ok(index < tokens.length, 'Unclosed routing expression');
      result = result(value());
    }
    index++;
    return result;
  }
  const result = value();
  assert.equal(index, tokens.length, 'Unconsumed routing syntax');
  return result;
}

function* permutations(values) {
  if (!values.length) { yield []; return; }
  for (let index = 0; index < values.length; index++) {
    for (const tail of permutations(values.filter((_, other) => other !== index))) {
      yield [values[index], ...tail];
    }
  }
}

function shapes(values) {
  if (values.length === 1) return [values[0]];
  return values.slice(1).flatMap((_, index) =>
    shapes(values.slice(0, index + 1)).flatMap(left =>
      shapes(values.slice(index + 1)).map(right => [left, right])));
}

const expressionFor = tree => Array.isArray(tree)
  ? pair(expressionFor(tree[0]), expressionFor(tree[1])) : variable(tree);
const inputFor = names => names.length === 1 ? names[0] : [names[0], inputFor(names.slice(1))];

function unpack(names, body, index = 0) {
  if (names.length === 1) return body;
  return split(variable(index === 0 ? 'input' : `tail${index}`), names[0],
    names.length === 2 ? names[1] : `tail${index + 1}`,
    names.length === 2 ? body : unpack(names.slice(1), body, index + 1));
}

const letBinding = (identifier, expression, body) => ({
  type: 'Let', binds: [{ bindType: 'NonRec', identifier, expression }], expression: body,
});

export function runRoutingTests({ reportPath } = {}) {
  let routingCases = 0;
  for (let size = 2; size <= 5; size++) {
    const names = Array.from({ length: size }, (_, index) => `v${index}`);
    for (const order of permutations(names)) {
      for (const output of shapes(order)) {
        const lowered = translate(moduleFor(unpack(names, expressionFor(output))));
        assert.deepEqual(interpret(lowered.code)(inputFor(names)), output);
        routingCases++;
      }
    }
  }
  assert.equal(routingCases, 1814);

  const shadow = moduleFor(letBinding('x', variable('input'),
    letBinding('y', variable('x'), letBinding('x', variable('y'), variable('x')))));
  assert.equal(interpret(translate(shadow).code)('owner'), 'owner');

  const duplicate = moduleFor(letBinding('x', variable('input'),
    letBinding('alias', variable('x'), pair(variable('x'), variable('alias')))));
  assert.throws(() => translate(duplicate), /^Error: LINEARITY:/);

  const report = {
    inputKind: 'synthetic ASTs of the supported shape; not compiler-generated TAST',
    routingCases,
    coverage: 'all permutations and binary output groupings of 2 through 5 distinct leaves',
    controls: { shadowing: 'identity preserved', aliasDuplication: 'LINEARITY rejection' },
    complete: true,
  };
  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--report'),
    'Usage: node routing-tests.mjs [--report report.json]');
  console.log(JSON.stringify(runRoutingTests({ reportPath: args[1] }), null, 2));
}
