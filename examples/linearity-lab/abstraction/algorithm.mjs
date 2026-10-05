// Original implementation of linear bracket abstraction from the B/C/I laws.
// This operates on a small, explicitly constructed AST, not PureScript text.
export const variable = name => ({ tag: 'variable', name });
export const global = name => ({ tag: 'global', name });
export const application = (left, right) => ({ tag: 'application', left, right });
export const lambda = (name, body) => ({ tag: 'lambda', name, body });
const combinator = name => ({ tag: 'combinator', name });

export class LinearityError extends Error {
  constructor(code, message) { super(message); this.name = 'LinearityError'; this.code = code; }
}
const fail = (code, message) => { throw new LinearityError(code, message); };

// A closed value is not automatically a linear primitive. Function entries
// must explicitly state the trusted linear contract; scalar constants are
// separate. This manifest is a trust boundary, not a proof about JS functions.
export function checkGlobals(globals) {
  for (const [name, entry] of Object.entries(globals)) {
    if (entry?.kind === 'linear-function' && typeof entry.value === 'function') continue;
    if (entry?.kind === 'constant' &&
        (entry.value === null || ['number', 'string', 'boolean'].includes(typeof entry.value))) continue;
    fail('UntrustedGlobal', `Global ${name} is not an approved linear function or immutable scalar.`);
  }
}

export function resolve(source, globals = {}) {
  checkGlobals(globals);
  let nextId = 0;
  const bindings = [];
  function walk(node, scope) {
    if (!node || typeof node !== 'object') fail('UnsupportedNode', 'Expected an AST node.');
    switch (node.tag) {
      case 'variable': {
        const binding = scope.get(node.name);
        if (!binding) fail('UnboundVariable', `No local binder for ${node.name}; globals must be explicit.`);
        binding.uses += 1;
        return { tag: 'variable', name: node.name, id: binding.id };
      }
      case 'global':
        if (!Object.hasOwn(globals, node.name)) fail('UnknownGlobal', `Unknown global ${node.name}.`);
        return { ...node };
      case 'application':
        return application(walk(node.left, scope), walk(node.right, scope));
      case 'lambda': {
        if (typeof node.name !== 'string') fail('InvalidBinder', 'Binders must have string names.');
        const binding = { id: nextId++, name: node.name, uses: 0 };
        bindings.push(binding);
        const inner = new Map(scope);
        inner.set(node.name, binding);
        return { tag: 'lambda', id: binding.id, name: node.name, body: walk(node.body, inner) };
      }
      default: fail('UnsupportedNode', `Source node ${node.tag} is not supported.`);
    }
  }
  const result = walk(source, new Map());
  for (const binding of bindings) {
    if (binding.uses === 0) fail('DroppedBinding', `${binding.name}#${binding.id} is never used.`);
    if (binding.uses > 1) fail('DuplicatedBinding', `${binding.name}#${binding.id} is used ${binding.uses} times.`);
  }
  return result;
}

function occurrences(node, id) {
  if (node.tag === 'variable') return node.id === id ? 1 : 0;
  if (node.tag === 'application') return occurrences(node.left, id) + occurrences(node.right, id);
  return 0;
}

export function compile(source, { globals = {}, basis = 'BCI' } = {}) {
  if (!['BI', 'BCI'].includes(basis)) fail('UnknownBasis', `Unsupported basis ${basis}.`);
  const resolved = resolve(source, globals);
  const steps = { identity: 0, eta: 0, compose: 0, exchange: 0 };
  function abstract(id, body) {
    const count = occurrences(body, id);
    if (count !== 1) fail('InternalInvariant', `Abstraction expects one occurrence, found ${count}.`);
    if (body.tag === 'variable') { steps.identity += 1; return combinator('I'); }
    if (body.tag !== 'application') fail('InternalInvariant', 'No abstraction rule applies.');
    const leftUses = occurrences(body.left, id);
    if (leftUses === 0) {
      // [x](f x) = f, provided x is not free in f.
      if (body.right.tag === 'variable' && body.right.id === id) {
        steps.eta += 1;
        return body.left;
      }
      // [x](f (g x)) = B f g; recursively abstract the right subtree.
      steps.compose += 1;
      return application(application(combinator('B'), body.left), abstract(id, body.right));
    }
    // [x]((f x) y) = C f y; x occurs on the left only.
    if (basis === 'BI') fail('ExchangeRequired', 'This abstraction needs exchange (C), unavailable in BI mode.');
    steps.exchange += 1;
    return application(application(combinator('C'), abstract(id, body.left)), body.right);
  }
  function eliminate(node) {
    if (node.tag === 'lambda') return abstract(node.id, eliminate(node.body));
    if (node.tag === 'application') return application(eliminate(node.left), eliminate(node.right));
    return node;
  }
  return { term: eliminate(resolved), steps };
}

export function print(node, nested = false) {
  switch (node.tag) {
    case 'variable': return node.name;
    case 'global': return `@${node.name}`;
    case 'combinator': return node.name;
    case 'lambda': return `λ${node.name}.${print(node.body)}`;
    case 'application': {
      const text = `${print(node.left)} ${print(node.right, true)}`;
      return nested ? `(${text})` : text;
    }
    default: fail('UnsupportedNode', `Cannot print ${node.tag}.`);
  }
}
