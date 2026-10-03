import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../src/Purust/Threading.js';

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

// Boundary cases. "fast" must stay native, "validate" must decode natively and
// return the validate error, "fallback" must delegate exactly once.
export function buildBoundaries() {
  const boundaries = [];
  const add = (mode, name, value) => boundaries.push([mode, name, value]);
  const ann = (extra = {}) => ({ meta: null, type: null, ...extra });
  const expr = (type, extra = {}) => ({ type, annotation: ann(), ...extra });
  const varExpr = identifier => ({ type: 'Var', annotation: ann(), value: { moduleName: ['M'], identifier } });
  const nonRec = (identifier, expression, annotation = ann()) => ({ bindType: 'NonRec', annotation, identifier, expression });

  const valid = {
    moduleName: ['Test', 'Valid'],
    modulePath: 'src/Test/Valid.purs',
    sourceSpan: { start: [3, 4], end: [9, 7] },
    typeTable: ['Int', { type: 'Array', element: 0 }, 'String'],
    imports: [{ annotation: ann(), moduleName: ['Data', 'Maybe'] }],
    exports: ['x', 'y'],
    reExports: { 'Data.Maybe': ['Just', 'Nothing'] },
    dataDecls: [{ name: 'T', vars: ['a'], constructors: [{ name: 'C', fields: [0, 2] }] }],
    classDecls: [{ name: 'C', vars: ['a'], superclasses: [{ fqn: ['Data', 'Eq'], args: [0] }], methods: [{ name: 'm', type: 2 }] }],
    decls: [
      nonRec('x', varExpr('x')),
      nonRec('i', expr('Literal', { value: { literalType: 'IntLiteral', value: 3 } })),
      nonRec('n', expr('Literal', { value: { literalType: 'NumberLiteral', value: 1.5 } })),
      nonRec('s', expr('Literal', { value: { literalType: 'StringLiteral', value: 'é😀' } })),
      nonRec('c', expr('Literal', { value: { literalType: 'CharLiteral', value: 'a' } })),
      nonRec('b', expr('Literal', { value: { literalType: 'BooleanLiteral', value: true } })),
      nonRec('a', expr('Literal', { value: { literalType: 'ArrayLiteral', value: [varExpr('x'), expr('Literal', { value: { literalType: 'IntLiteral', value: -1 } })] } })),
      nonRec('o', expr('Literal', { value: { literalType: 'ObjectLiteral', value: [['f', varExpr('x')]] } })),
      nonRec('con', expr('Constructor', { typeName: 'T', name: 'C', fields: ['f', 'g'] })),
      nonRec('acc', expr('Accessor', { expression: varExpr('x'), fieldName: 'f' })),
      nonRec('upd', expr('ObjectUpdate', { expression: varExpr('x'), updates: [['f', varExpr('y')]] })),
      nonRec('abs', expr('Abs', { argument: 'arg', body: varExpr('arg') })),
      nonRec('app', expr('App', { abstraction: varExpr('f'), argument: varExpr('x') })),
      nonRec('ta', expr('TypeApp', { expression: varExpr('x'), typeArgument: 0 })),
      nonRec('case', expr('Case', {
        caseExpressions: [varExpr('x')],
        caseAlternatives: [
          {
            binders: [
              { binderType: 'NullBinder', annotation: ann() },
              { binderType: 'VarBinder', annotation: ann(), identifier: 'v' },
              { binderType: 'LiteralBinder', annotation: ann(), literal: { literalType: 'StringLiteral', value: 's' } },
              { binderType: 'NamedBinder', annotation: ann(), identifier: 'n', binder: { binderType: 'VarBinder', annotation: ann(), identifier: 'i' } },
              {
                binderType: 'ConstructorBinder', annotation: ann(),
                typeName: { moduleName: ['M'], identifier: 'T' },
                name: { moduleName: ['M'], identifier: 'C' },
                binders: [{ binderType: 'NullBinder', annotation: ann() }],
              },
            ],
            isGuarded: false,
            expression: varExpr('v'),
          },
          { binders: [], isGuarded: true, expressions: [{ guard: varExpr('g'), expression: varExpr('e') }] },
        ],
      })),
      nonRec('let', expr('Let', { binds: [nonRec('inner', varExpr('x'))], expression: varExpr('inner') })),
      {
        bindType: 'Rec',
        binds: [
          { annotation: ann(), identifier: 'r1', expression: expr('Abs', { argument: 'q', body: varExpr('r1') }) },
          { annotation: ann(), identifier: 'r2', expression: varExpr('r1') },
        ],
      },
      nonRec('meta', expr('Literal', { value: { literalType: 'IntLiteral', value: 7 } }),
        { meta: { metaType: 'IsConstructor', constructorType: 'ProductType', identifiers: ['a', 'b'] }, type: 0 }),
    ],
    foreign: ['f1', 'f2'],
    foreignAnnotations: { f1: { meta: null, type: 1 } },
    comments: [{ LineComment: 'l' }, { BlockComment: 'b' }],
  };
  add('fast', 'valid-minimal', valid);

  const sharing = structuredClone(valid);
  sharing.moduleName = ['Test', 'Sharing'];
  sharing.modulePath = 'src/Test/Sharing.purs';
  sharing.dataDecls = [];
  sharing.classDecls = [];
  sharing.typeTable = ['Int', { type: 'Array', element: 0 }];
  sharing.decls = [
    nonRec('a', expr('Literal', { value: { literalType: 'IntLiteral', value: 1 } }), { meta: null, type: 0 }),
    nonRec('b', expr('TypeApp', { expression: varExpr('a'), typeArgument: 0 }), { meta: null, type: 0 }),
  ];
  add('fast', 'valid-sharing', sharing);

  add('fast', 'valid-optionals', {
    moduleName: ['Test', 'Optionals'],
    modulePath: 'src/Test/Optionals.purs',
    sourceSpan: { start: [0, 0], end: [0, 0] },
    imports: [],
    exports: [],
    reExports: {},
    decls: [],
    foreign: [],
    comments: [],
  });

  // Optional fields accept null and absent values; vars absent is not vars bad.
  {
    const value = structuredClone(valid);
    value.typeTable = null;
    value.dataDecls = null;
    value.classDecls = null;
    value.foreignAnnotations = null;
    value.decls = [nonRec('x', varExpr('x')), nonRec('i', expr('Literal', { value: { literalType: 'IntLiteral', value: 1 } }))];
    value.foreign = ['f1'];
    add('fast', 'valid-null-optionals', value);
  }
  {
    const value = structuredClone(valid);
    value.dataDecls[0].vars = 3;
    value.dataDecls[0].typeVars = ['a'];
    add('fast', 'dataDecl-vars-malformed-then-typeVars', value);
  }
  {
    const value = structuredClone(valid);
    delete value.dataDecls[0].vars;
    value.dataDecls[0].typeVars = ['ignored'];
    add('fast', 'dataDecl-vars-absent-ignores-typeVars', value);
  }
  {
    const value = structuredClone(valid);
    value.comments = [{ LineComment: 7, BlockComment: 'b' }];
    add('fast', 'comment-line-malformed-then-block', value);
  }
  {
    const value = structuredClone(valid);
    value.decls[8].expression = { type: 'Constructor', annotation: ann(), typeName: 'T', constructorName: 'C', fieldNames: ['f'] };
    add('fast', 'constructor-fallbacks', value);
  }
  {
    const value = structuredClone(valid);
    value.dataDecls[0].constructors[0] = { constructorName: 'C', fieldTypes: [0] };
    add('fast', 'dataConstructor-fallbacks', value);
  }
  add('fast', 'map-order', { ...structuredClone(valid), reExports: { Z: ['z'], 10: ['j'], 2: ['b'], a: ['a'] } });

  // The native path must call validate exactly once, so a valid decode whose
  // usage facts fail validation still stays native and returns the Left.
  {
    const value = structuredClone(valid);
    value.imports[0].annotation = { meta: null, type: null, bindingUsage: { bindingId: 0 } };
    add('validate', 'validate-import-usage', value);
  }
  {
    const usage = () => ({ meta: null, type: null, bindingUsage: { bindingId: 0 } });
    const value = structuredClone(valid);
    value.decls = [{
      bindType: 'NonRec',
      annotation: ann(),
      identifier: 'z',
      expression: {
        type: 'Abs', annotation: usage(), argument: 'a',
        body: { type: 'Abs', annotation: usage(), argument: 'b', body: varExpr('b') },
      },
    }];
    add('validate', 'validate-duplicate-binding', value);
  }

  const bad = (name, mutate) => {
    const value = structuredClone(valid);
    mutate(value);
    add('fallback', name, value);
  };
  bad('missing-moduleName', value => { delete value.moduleName; });
  bad('moduleName-not-array', value => { value.moduleName = 'Test'; });
  bad('moduleName-bad-element', value => { value.moduleName = ['Test', 7]; });
  bad('missing-path', value => { delete value.modulePath; });
  bad('missing-span', value => { delete value.sourceSpan; });
  bad('span-bad-start', value => { value.sourceSpan.start = 'x'; });
  bad('span-short-start', value => { value.sourceSpan.start = [1]; });
  bad('imports-null', value => { value.imports = null; });
  bad('import-missing-annotation', value => { delete value.imports[0].annotation; });
  bad('import-bad-name', value => { value.imports[0].moduleName = 'Data.Maybe'; });
  bad('exports-bad', value => { value.exports = [1]; });
  bad('reexports-array', value => { value.reExports = []; });
  bad('reexports-bad-value', value => { value.reExports = { M: 'x' }; });
  bad('reexports-bad-element', value => { value.reExports = { M: [7] }; });
  bad('typeTable-object', value => { value.typeTable = {}; });
  bad('typeTable-bad-entry', value => { value.typeTable = ['Unknown']; });
  bad('dataDecls-object', value => { value.dataDecls = {}; });
  bad('dataDecl-field-out-of-range', value => { value.dataDecls[0].constructors[0].fields = [99]; });
  bad('dataDecl-missing-constructors', value => { delete value.dataDecls[0].constructors; });
  bad('classDecl-missing-superclasses', value => { delete value.classDecls[0].superclasses; });
  bad('classDecl-vars-malformed', value => { value.classDecls[0].vars = 3; });
  bad('classDecl-method-out-of-range', value => { value.classDecls[0].methods[0].type = 99; });
  bad('decls-bad-bindType', value => { value.decls[0] = { bindType: 'Bogus' }; });
  bad('decl-missing-identifier', value => { delete value.decls[0].identifier; });
  bad('expr-unknown', value => { value.decls[0].expression = { type: 'Bogus', annotation: ann() }; });
  bad('expr-missing-annotation', value => { delete value.decls[0].expression.annotation; });
  bad('expr-typeapp-out-of-range', value => { value.decls[13].expression.typeArgument = 99; });
  bad('expr-typeapp-fraction', value => { value.decls[13].expression.typeArgument = 1.5; });
  bad('expr-typeapp-bottom', value => { value.decls[13].expression.typeArgument = 2147483648; });
  bad('binder-unknown', value => { value.decls[14].expression.caseAlternatives[0].binders[0] = { binderType: 'Bogus', annotation: ann() }; });
  bad('literal-unknown', value => { value.decls[1].expression.value = { literalType: 'Bogus' }; });
  bad('literal-char-length', value => { value.decls[4].expression.value.value = 'ab'; });
  bad('comment-bad', value => { value.comments[0] = {}; });
  bad('foreign-bad', value => { value.foreign = 'x'; });
  bad('foreignAnnotations-bad', value => { value.foreignAnnotations = 3; });
  bad('foreignAnnotation-bad', value => { value.foreignAnnotations.f1 = { meta: { metaType: 'Bogus' } }; });
  bad('annotation-meta-bad', value => { value.decls[17].annotation.meta = { metaType: 'Bogus' }; });
  bad('annotation-type-fraction', value => { value.decls[17].annotation.type = 1.5; });
  bad('isGuarded-bad', value => { value.decls[14].expression.caseAlternatives[1].isGuarded = 'x'; });
  return boundaries;
}

// Frozen corpus: every corefn module is one whole-module differential case.
// Both a directory of <Module>/corefn.json trees and the packed
// [{ name, contents }] diagnostic corpus are accepted.
function corpusEntries(corpus) {
  if (statSync(corpus).isFile()) {
    return JSON.parse(readFileSync(corpus, 'utf8')).map(entry => ({ name: entry.name, value: JSON.parse(entry.contents) }));
  }
  const entries = [];
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(corpus, entry.name, 'corefn.json');
    if (!existsSync(file)) continue;
    entries.push({ name: entry.name, value: JSON.parse(readFileSync(file, 'utf8')) });
  }
  return entries;
}

function main() {
  const [rustArg, corpusArg] = process.argv.slice(2);
  assert(rustArg && corpusArg, 'Usage: node tools/test-native-tast-module.mjs GENERATED_COMPILER_RUST FROZEN_TAST_OUTPUT');
  const rust = resolve(rustArg), corpus = resolve(corpusArg);
  const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-tast-module-'));
  mkdirSync(join(directory, 'src'));

  const corpusModules = corpusEntries(corpus).map(entry => entry.value);
  assert(corpusModules.length > 0, `no corefn modules found in ${corpus}`);
  writeFileSync(join(directory, 'modules.ndjson'), corpusModules.map(module => JSON.stringify(module)).join('\n') + '\n');

  const boundaries = buildBoundaries();
  writeFileSync(join(directory, 'boundaries.ndjson'),
    boundaries.map(([mode, name, value]) => `${mode}\t${name}\t${JSON.stringify(value)}`).join('\n') + '\n');

  const rustModules = [
    'purust_core', 'perceus_ptr', 'Purs_Data_Argonaut_Core', 'Purs_Data_Argonaut_Decode_Error',
    'Purs_Data_Either', 'Purs_Data_Maybe', 'Purs_Data_Tuple', 'Purs_Data_Unfoldable', 'Purs_Foreign_Object',
    'Purs_Data_Map_Internal', 'Purs_Data_Ord', 'Purs_Data_Foldable',
    'Purs_PureScript_Backend_Optimizer_CoreFn', 'Purs_PureScript_Backend_Optimizer_CoreFn_Json',
    'Purs_PureScript_Backend_Optimizer_CoreFn_TypeTable', 'Purs_PureScript_Backend_Optimizer_CoreFn_Usage',
  ];
  writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_tast_module_test"\nversion = "0.0.0"\nedition = "2021"\n' +
    '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
    rustModules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
  const ffi = threadedRust(readFileSync(new URL('../../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/CoreFn/Json.rs', import.meta.url), 'utf8'));
  writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-tast-module.rs', import.meta.url), 'utf8').replace(/^\s*\/\/ NATIVE_FFI$/m, () => ffi));
  console.log(`Retained TAST module test workspace: ${directory}; ${corpusModules.length} frozen modules / ${boundaries.length} boundaries`);
  for (const [stage, executable, args] of [
    ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
    ['run', join(rust, 'target/release/purust_native_tast_module_test'), [join(directory, 'modules.ndjson'), join(directory, 'boundaries.ndjson')]],
  ]) {
    const run = spawnSync(executable, args, { encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
    writeFileSync(join(directory, stage + '.log'), run.stdout + run.stderr);
    assert.equal(run.status, 0, run.error?.message ?? run.stderr);
    console.log(run.stdout.trim());
  }
}

if (isMain) main();
