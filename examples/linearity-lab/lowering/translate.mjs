// A first-order, strictly linear fragment. Resolves binders before counting,
// then generates symmetric monoidal routing, preserving the TAST let order.
// No ordinary PureScript FFI is executed by this transformation.
const sourceModule = 'LinearLab.Lowering.Source';
const unwrap = node => node.type === 'TypeApp' ? unwrap(node.expression) : node;
const unsupported = message => { throw Error(`UNSUPPORTED: ${message}`); };
const linearity = message => { throw Error(`LINEARITY: ${message}`); };

export function translate(module) {
  const declaration = module.decls.find(bind => bind.identifier === 'program');
  if (!declaration || declaration.bindType !== 'NonRec') unsupported('nonrecursive program required');
  const root = unwrap(declaration.expression);
  if (root.type !== 'Abs') unsupported('one explicit input parameter required');
  let fresh = 0;
  const bindings = new Map();
  function bind(name) {
    const id = ++fresh;
    bindings.set(id, { name, uses: 0 });
    return id;
  }
  function resolve(node, scope) {
    node = unwrap(node);
    if (node.type === 'Var') {
      if (node.value.moduleName) unsupported('bare global');
      const id = scope.get(node.value.identifier);
      if (!id) unsupported(`unresolved local ${node.value.identifier}`);
      bindings.get(id).uses++;
      return { tag: 'var', id };
    }
    if (node.type === 'Literal') return { tag: 'constant' };
    if (node.type === 'Let') {
      const nested = new Map(scope);
      const values = [];
      for (const value of node.binds) {
        if (value.bindType !== 'NonRec') unsupported('recursive let');
        const expression = resolve(value.expression, nested);
        const id = bind(value.identifier);
        nested.set(value.identifier, id);
        values.push({ id, expression });
      }
      return { tag: 'let', values, body: resolve(node.expression, nested) };
    }
    if (node.type === 'App') {
      const args = [];
      let fn = node;
      while ((fn = unwrap(fn)).type === 'App') { args.unshift(fn.argument); fn = fn.abstraction; }
      fn = unwrap(fn);
      if (fn.type !== 'Var' || fn.value.moduleName?.join('.') !== sourceModule) unsupported('application');
      const name = fn.value.identifier;
      if (name === 'Pair' && args.length === 2) return { tag: 'pair', left: resolve(args[0], scope), right: resolve(args[1], scope) };
      if (name === 'add' && args.length === 2) {
        const amount = unwrap(args[0]);
        if (amount.type !== 'Literal' || amount.value.literalType !== 'IntLiteral'
          || !Number.isSafeInteger(amount.value.value)) unsupported('add requires a literal amount');
        return { tag: 'call', operation: `(L.add ${amount.value.value < 0 ? `(${amount.value.value})` : amount.value.value})`,
          argument: resolve(args[1], scope) };
      }
      const primitive = { open: 'open', inspect: 'inspect', observe: 'observe', finish: 'finish', duplicate: 'duplicateInt', sum: 'sumInts' }[name];
      if (primitive && args.length === 1) return { tag: 'call', operation: `L.${primitive}`, argument: resolve(args[0], scope) };
      return unsupported(`primitive ${name}`);
    }
    if (node.type === 'Case') {
      const alt = node.caseAlternatives[0];
      const pattern = alt?.binders?.[0];
      if (node.caseExpressions.length !== 1 || node.caseAlternatives.length !== 1 || alt.isGuarded
        || alt.binders.length !== 1 || pattern?.binderType !== 'ConstructorBinder'
        || pattern.constructorName.moduleName?.join('.') !== sourceModule || pattern.constructorName.identifier !== 'Pair'
        || pattern.binders.length !== 2 || pattern.binders.some(b => b.binderType !== 'VarBinder')) {
        unsupported('only complete two-variable Pair destructuring is supported');
      }
      const value = resolve(node.caseExpressions[0], scope);
      const left = bind(pattern.binders[0].identifier), right = bind(pattern.binders[1].identifier);
      const nested = new Map(scope);
      nested.set(pattern.binders[0].identifier, left);
      nested.set(pattern.binders[1].identifier, right);
      return { tag: 'split', value, left, right, body: resolve(alt.expression, nested) };
    }
    return unsupported(`expression ${node.type}`);
  }
  const input = bind(root.argument);
  const term = resolve(root.body, new Map([[root.argument, input]]));
  for (const { name, uses } of bindings.values()) {
    if (uses !== 1) linearity(`${name} occurs ${uses} times; this fragment requires exactly one use`);
  }

  // A context with a,b,c is represented as Pair a (Pair b c). Structural
  // arrows preserve each leaf once; native primitive arrows handle real data.
  const identity = 'L.identity';
  const then = (a, b) => a === identity ? b : b === identity ? a : `(L.then_ ${a} ${b})`;
  const tensor = (a, b) => a === identity && b === identity ? identity : `(L.tensor ${a} ${b})`;
  function adjacent(index, size) {
    if (index > 0) return tensor(identity, adjacent(index - 1, size - 1));
    return size === 2 ? 'L.swap' : then('L.unassoc', then(tensor('L.swap', identity), 'L.assoc'));
  }
  let context = [input];
  let code = identity;
  function emit(next) { code = then(code, next); }
  function moveFront(ids) {
    if (new Set(ids).size !== ids.length || ids.some(id => !context.includes(id))) linearity('wire reused or unavailable');
    const desired = [...ids, ...context.filter(id => !ids.includes(id))];
    for (let at = 0; at < desired.length; at++) {
      let current = context.indexOf(desired[at]);
      while (current > at) {
        emit(adjacent(current - 1, context.length));
        [context[current - 1], context[current]] = [context[current], context[current - 1]];
        current--;
      }
    }
  }
  const environment = new Map([[input, input]]);
  function generate(term) {
    switch (term.tag) {
      case 'var': {
        const id = environment.get(term.id);
        if (!context.includes(id)) linearity('use after consumption');
        return id;
      }
      case 'call': {
        const argument = generate(term.argument);
        moveFront([argument]);
        emit(context.length === 1 ? term.operation : tensor(term.operation, identity));
        const result = ++fresh;
        context[0] = result;
        return result;
      }
      case 'pair': {
        const left = generate(term.left), right = generate(term.right);
        moveFront([left, right]);
        if (context.length > 2) emit('L.unassoc');
        const result = ++fresh;
        context = [result, ...context.slice(2)];
        return result;
      }
      case 'let':
        for (const value of term.values) environment.set(value.id, generate(value.expression));
        return generate(term.body);
      case 'split': {
        const value = generate(term.value);
        moveFront([value]);
        if (context.length > 1) emit('L.assoc');
        const left = ++fresh, right = ++fresh;
        context = [left, right, ...context.slice(1)];
        environment.set(term.left, left);
        environment.set(term.right, right);
        return generate(term.body);
      }
      default: return unsupported('closed values need additional unit/shared rules');
    }
  }
  const result = generate(term);
  if (context.length !== 1 || context[0] !== result) linearity('unconsumed wires');
  return { code, bindings: [...bindings.values()], arrows: (code.match(/L\./g) ?? []).length };
}
