// Reference source evaluator is independent of the abstraction algorithm.
// Both evaluators assume total pure primitives: eta is extensional here.
const apply = (fn, arg) => {
  if (typeof fn !== 'function') throw new TypeError('Application expects a function.');
  return fn(arg);
};

export function evaluateSource(node, globals, locals = new Map()) {
  switch (node.tag) {
    case 'variable': {
      if (!locals.has(node.name)) throw new Error(`Unbound variable ${node.name}.`);
      return locals.get(node.name);
    }
    case 'global': return globals[node.name].value;
    case 'application':
      return apply(evaluateSource(node.left, globals, locals), evaluateSource(node.right, globals, locals));
    case 'lambda':
      return value => evaluateSource(node.body, globals, new Map(locals).set(node.name, value));
    default: throw new Error(`Unknown source node ${node.tag}.`);
  }
}

const B = f => g => x => f(g(x));
const C = f => y => x => f(x)(y);
const I = x => x;

export function evaluateCombinators(node, globals) {
  switch (node.tag) {
    case 'global': return globals[node.name].value;
    case 'combinator': {
      const fn = { B, C, I }[node.name];
      if (!fn) throw new Error(`Unsupported combinator ${node.name}.`);
      return fn;
    }
    case 'application':
      return apply(evaluateCombinators(node.left, globals), evaluateCombinators(node.right, globals));
    default: throw new Error(`Non-closed target node ${node.tag}.`);
  }
}

export const applyArguments = (value, args) => args.reduce(apply, value);
