import { readFileSync } from 'node:fs';

// V1 deliberately supports pinned registry dependencies only, not arbitrary TOML.
export const loadFfiCargo = ffiPath => () => {
  const path = `${ffiPath}.cargo.json`;
  let source;
  try { source = readFileSync(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
  const fail = message => { throw new Error(`Invalid FFI Cargo declaration ${path}: ${message}`); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, allowed) => {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`expected only ${allowed.join(', ')}`);
  };
  let declaration;
  try { declaration = JSON.parse(source); } catch { fail('invalid JSON'); }
  keys(declaration, ['schema', 'dependencies']);
  if (declaration.schema !== 1 || !object(declaration.dependencies)) fail('expected schema 1 and a dependencies object');
  const reserved = new Set(['purust-core', 'perceus-ptr', 'fancy-regex', 'mimalloc', 'tokio']);
  const names = new Set();
  return Object.entries(declaration.dependencies).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, dependency]) => {
    if (!/^[a-z][a-z0-9_-]*$/.test(name)) fail(`unsupported crate name: ${name}`);
    const normalized = name.replaceAll('_', '-');
    if (reserved.has(normalized) || normalized.startsWith('purs-')) fail(`reserved dependency: ${name}`);
    if (names.has(normalized)) fail(`colliding dependency: ${name}`);
    names.add(normalized);
    keys(dependency, ['version', 'features', 'default-features']);
    if (typeof dependency.version !== 'string' || !/^=(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(dependency.version))
      fail(`${name}: version must be an exact stable =major.minor.patch`);
    const fields = [`version = ${JSON.stringify(dependency.version)}`];
    if (Object.hasOwn(dependency, 'default-features')) {
      if (typeof dependency['default-features'] !== 'boolean') fail(`${name}: default-features must be boolean`);
      fields.push(`default-features = ${dependency['default-features']}`);
    }
    if (Object.hasOwn(dependency, 'features')) {
      const features = dependency.features;
      if (!Array.isArray(features) || features.some(f => typeof f !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9_+.-]*$/.test(f))
        || new Set(features).size !== features.length) fail(`${name}: expected distinct feature names`);
      fields.push(`features = [${features.map(f => JSON.stringify(f)).join(', ')}]`);
    }
    return `${name} = { ${fields.join(', ')} }\n`;
  }).join('');
};
