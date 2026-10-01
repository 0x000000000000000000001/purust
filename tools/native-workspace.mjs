import { accessSync, constants, existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function nativeWorkspaceConfig(root) {
  const lines = readFileSync(join(root, 'spago.yaml'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex(line => /^package:\s*$/.test(line));
  if (start < 0) throw new Error('spago.yaml has no package section');
  const section = [];
  let skipTest = false;
  for (const line of lines.slice(start)) {
    if (section.length && /^\S/.test(line)) break;
    if (/^  test:/.test(line)) { skipTest = true; continue; }
    if (/^  \S/.test(line)) skipTest = false;
    if (!skipTest) section.push(line);
  }
  const optimizer = resolve(root, '../../purescript-backend-optimizer-purust');
  if (!existsSync(join(optimizer, 'spago.yaml'))) throw new Error(`Missing optimizer: ${optimizer}`);
  const packages = new Map([['backend-optimizer', optimizer]]);
  for (const name of readdirSync(dirname(root)).sort()) {
    if (!name.startsWith('purust-')) continue;
    const directory = join(dirname(root), name);
    if (statSync(join(directory, 'spago.yaml'), { throwIfNoEntry: false })?.isFile()) {
      packages.set(name.slice('purust-'.length), directory);
    }
  }
  return section.join('\n').trimEnd() + '\nworkspace:\n  packageSet:\n    registry: 77.10.1\n  extraPackages:\n' +
    [...packages].map(([name, directory]) => `    ${name}:\n      path: ${JSON.stringify(directory)}\n`).join('');
}

export function findTypedCompiler(root, configured) {
  const candidates = [];
  const dist = resolve(root, '../../purescript/.stack-work/dist');
  if (!configured && existsSync(dist)) {
    for (const platform of readdirSync(dist, { withFileTypes: true })) {
      if (!platform.isDirectory()) continue;
      const directory = join(dist, platform.name);
      for (const build of readdirSync(directory, { withFileTypes: true })) {
        if (!build.isDirectory()) continue;
        const path = join(directory, build.name, 'build/purs/purs');
        const info = statSync(path, { throwIfNoEntry: false });
        if (info?.isFile()) candidates.push({ path, modified: info.mtimeMs });
      }
    }
  }
  const compiler = configured ? resolve(configured)
    : candidates.sort((a, b) => b.modified - a.modified)[0]?.path;
  if (!compiler) throw new Error('Set PURUST_PURS to the TAST-enabled purs executable');
  accessSync(compiler, constants.X_OK);
  return realpathSync(compiler);
}

export function verifyTypedOutput(output) {
  let modules = 0, types = 0;
  for (const entry of readdirSync(output, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(output, entry.name, 'corefn.json');
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (!['typeTable', 'dataDecls', 'classDecls'].every(key => Array.isArray(data[key]))) {
      throw new Error(`${path} lacks TAST metadata; select the typed fork with PURUST_PURS`);
    }
    modules++;
    types += data.typeTable.length;
  }
  if (!modules || !types) throw new Error('No typed CoreFn modules were produced');
  return { modules, types };
}

// Compare the compiler outputs, excluding Cargo build artifacts and lockfiles.
// Build paths in debug information need not produce identical executable bytes.
export function compareGeneratedSources(expected, actual) {
  function sources(directory, prefix = '') {
    return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
      const path = join(prefix, entry.name);
      if (entry.isDirectory()) return entry.name === 'target' ? [] : sources(directory, path);
      return entry.isFile() && (entry.name.endsWith('.rs') || entry.name === 'Cargo.toml') ? [path] : [];
    }).sort();
  }
  const left = sources(expected), right = sources(actual);
  if (!left.length) throw new Error(`No generated sources in ${expected}`);
  const leftSet = new Set(left), rightSet = new Set(right);
  const mismatches = [...new Set([...left, ...right])].filter(path =>
    !leftSet.has(path) || !rightSet.has(path) ||
    !readFileSync(join(expected, path)).equals(readFileSync(join(actual, path))));
  if (mismatches.length) throw new Error(`Node/native output mismatch (${mismatches.length} files):\n${mismatches.sort().join('\n')}`);
  return left.length;
}
