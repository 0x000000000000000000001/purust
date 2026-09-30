// Inspect the actual post-PBO input to the Rust generator, without generating Rust.
// node bench/dump-ir.mjs OUTPUT MODULE DESTINATION
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspect } from 'node:util';
import * as Aff from '../output/Effect.Aff/index.js';
import { Left } from '../output/Data.Either/index.js';
import { Nothing } from '../output/Data.Maybe/index.js';
import { empty } from '../output/Data.Set/index.js';
import { coreFnModulesFromOutput, loadDirectives } from '../output/PureScript.Backend.Optimizer.App/index.js';
import { buildModules } from '../output/PureScript.Backend.Optimizer.Builder/index.js';
import { coreForeignSemantics } from '../output/PureScript.Backend.Optimizer.Semantics.Foreign/index.js';

const [source, moduleName, destination] = process.argv.slice(2);
if (!destination) throw new Error('usage: dump-ir.mjs OUTPUT MODULE DESTINATION');
const run = action => new Promise((resolve, reject) => Aff.runAff(result => () => {
  if (result instanceof Left) reject(result.value0); else resolve(result.value0);
})(action)());
const pure = Aff.applicativeAff.pure;
function syntaxOnly(value) {
  if (!value || typeof value !== 'object') return value;
  if (value.constructor.name === 'Typed') return syntaxOnly(value.value1);
  if (value.constructor.name === 'TypeApp') return syntaxOnly(value.value0);
  if (Array.isArray(value)) return value.map(syntaxOnly);
  return Object.assign(Object.create(Object.getPrototypeOf(value)),
    Object.fromEntries(Object.entries(value).map(([key, child]) => [key, syntaxOnly(child)])));
}
let found = false;
const modules = await run(coreFnModulesFromOutput(resolve(source)));
const directives = await run(loadDirectives);
const target = resolve(destination);
const cwd = process.cwd();
const base = join(tmpdir(), 'opencode');
mkdirSync(base, { recursive: true });
const cache = mkdtempSync(join(base, 'purust-ir-'));
// PBO writes .purmeta during inspection too. Keep it out of the source tree.
process.chdir(cache);
try {
await run(buildModules(Aff.monadEffectAff)({
  directives, rewriteLimit: 10000,
  analyzeCustom: _ => _ => Nothing.value, foreignSemantics: coreForeignSemantics,
  traceIdents: empty, onPrepareModule: _ => mod => pure(mod),
  onSkipModule: _ => _ => pure(Nothing.value),
  onCodegenModule: _ => _ => mod => _ => Aff.monadEffectAff.liftEffect(() => {
    if (mod.name === moduleName) {
      writeFileSync(target, inspect(process.argv.includes('--syntax') ? syntaxOnly(mod) : mod,
        { depth: null, maxArrayLength: null, breakLength: 120 }));
      found = true;
    }
  }),
})(modules));
} finally {
  process.chdir(cwd);
  rmSync(cache, { recursive: true });
}
if (!found) throw new Error(`module not found: ${moduleName}`);
