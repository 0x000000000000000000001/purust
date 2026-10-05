// A deliberately restricted, separate abstract interpreter. This is NOT a
// production ownership pass. Unknown constructs are rejected, not trusted.
export function checkProgram(module, contracts) {
  const native = 'LinearLab.Automatic.Native';
  const signatures = new Map(contracts.functions.map(fn => [fn.name, fn]));
  const declarations = new Map(module.decls.map(decl => {
    if (decl.bindType !== 'NonRec') throw Error('UNSUPPORTED: recursive declaration');
    return [decl.identifier, decl.expression];
  }));
  let steps = 0;
  let nextId = 0;
  const live = new Map();
  const events = [];
  function unsupported(detail) { throw Error(`UNSUPPORTED: ${detail}`); }
  function tick() { if (++steps > 1000) unsupported('analysis limit / recursion'); }
  function ref(name, args = []) { return { tag: 'global', name, args }; }
  function evaluate(node, env = new Map()) {
    tick();
    switch (node.type) {
      case 'TypeApp': return evaluate(node.expression, env);
      case 'Literal':
        if (!['IntLiteral', 'BooleanLiteral'].includes(node.value.literalType)) unsupported('literal');
        return { tag: 'scalar' };
      case 'Var': {
        const qualifier = node.value.moduleName?.join('.');
        const name = node.value.identifier;
        if (!qualifier && env.has(name)) return env.get(name);
        if ((!qualifier || qualifier === module.moduleName.join('.')) && declarations.has(name)) {
          return evaluate(declarations.get(name), new Map());
        }
        const qualified = `${qualifier}.${name}`;
        if (qualified === 'Data.Unit.unit') return { tag: 'scalar' };
        if (!['Control.Bind.bind', 'Control.Applicative.pure', 'Effect.bindEffect', 'Effect.applicativeEffect'].includes(qualified)
          && !(qualifier === native && signatures.has(name))) unsupported(`global ${qualified}`);
        return ref(qualified);
      }
      case 'Abs': return { tag: 'closure', node, env: new Map(env) };
      case 'Let': {
        const scope = new Map(env);
        for (const bind of node.binds) {
          if (bind.bindType !== 'NonRec') unsupported('recursive local binding');
          scope.set(bind.identifier, evaluate(bind.expression, scope));
        }
        return evaluate(node.expression, scope);
      }
      case 'App': return apply(evaluate(node.abstraction, env), evaluate(node.argument, env));
      default: return unsupported(`expression ${node.type}`);
    }
  }
  function apply(fn, argument) {
    tick();
    if (fn.tag === 'closure') {
      const scope = new Map(fn.env);
      scope.set(fn.node.argument, argument);
      return evaluate(fn.node.body, scope);
    }
    if (fn.tag !== 'global') unsupported('application of non-function');
    if (!['Control.Bind.bind', 'Control.Applicative.pure'].includes(fn.name) && !fn.name.startsWith(`${native}.`)) {
      unsupported(`application ${fn.name}`);
    }
    const args = [...fn.args, argument];
    if (fn.name === 'Control.Bind.bind' && args.length === 3) {
      if (args[0].name !== 'Effect.bindEffect') unsupported('non-Effect bind');
      return { tag: 'bind', first: args[1], then: args[2] };
    }
    if (fn.name === 'Control.Applicative.pure' && args.length === 2) {
      if (args[0].name !== 'Effect.applicativeEffect') unsupported('non-Effect pure');
      return { tag: 'pure', result: args[1] };
    }
    if (fn.name.startsWith(`${native}.`)) {
      const signature = signatures.get(fn.name.slice(native.length + 1));
      if (!signature) unsupported(`native function ${fn.name}`);
      if (args.length === signature.args.length) return { tag: 'native', signature, args };
      if (args.length > signature.args.length) unsupported('overapplication');
    }
    return ref(fn.name, args);
  }
  function execute(action) {
    tick();
    if (action.tag === 'pure') return action.result;
    if (action.tag === 'bind') return execute(apply(action.then, execute(action.first)));
    if (action.tag !== 'native') unsupported(`effect ${action.tag}`);
    const { signature, args } = action;
    const borrowed = new Map();
    signature.args.forEach((contract, index) => {
      const value = args[index];
      if (contract.kind !== 'resource') {
        if (value.tag !== 'scalar') unsupported('non-scalar argument');
        return;
      }
      if (value.tag !== 'resource') unsupported('unknown resource');
      if (!live.get(value.id)) throw Error(`OWNERSHIP: ${signature.name} reuses consumed resource ${value.id}`);
      const previous = borrowed.get(value.id);
      if (previous && (previous !== 'borrow' || contract.mode !== 'borrow')) {
        throw Error(`OWNERSHIP: overlapping ownership/borrow arguments for ${value.id}`);
      }
      borrowed.set(value.id, contract.mode);
      if (contract.mode === 'consume') live.set(value.id, false);
      events.push({ operation: signature.name, resource: value.id, mode: contract.mode });
    });
    // This allow-list is a required trusted semantic contract: the Rust return
    // type alone does not prove freshness or that a function retains no aliases.
    if (signature.result.kind === 'resource') {
      if (signature.name !== 'open') unsupported('owned result without a freshness contract');
      const id = ++nextId;
      live.set(id, true);
      events.push({ operation: signature.name, resource: id, mode: 'fresh' });
      return { tag: 'resource', id };
    }
    return { tag: 'scalar' };
  }
  const result = execute(evaluate(declarations.get('program')));
  if (result.tag !== 'scalar') unsupported('resource, closure or action escapes the checked entrypoint');
  return { events, resources: nextId, liveAtExit: [...live].filter(([, active]) => active).length };
}
