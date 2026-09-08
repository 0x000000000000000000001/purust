// Run after npm run build. PURS must select the TAST fork (or put it on PATH):
// PURS=/path/to/tast/purs npm run test:tast
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isNullaryEnum } from '../../output/Purust.DataLayout/index.js';
import { decodeModule } from '../../output/PureScript.Backend.Optimizer.CoreFn.Json/index.js';
import { ADT, Int } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Right } from '../../output/Data.Either/index.js';

const fixture = fileURLToPath(new URL('fixtures/nullary-enums.purs', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-nullary-enums-'));
try {
  // The fork writes its enriched tcorefn format to corefn.json with this target.
  const run = spawnSync(process.env.PURS ?? 'purs',
    ['compile', fixture, '--codegen', 'corefn', '--output', directory], { encoding: 'utf8' });
  assert.equal(run.status, 0, `TAST compiler: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  const json = JSON.parse(readFileSync(join(directory, 'NullaryEnums/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(json.dataDecls), 'Set PURS to the TAST fork: dataDecls are required.');
  const decoded = decodeModule(json);
  assert.ok(decoded instanceof Right, `PBO must decode the TAST fixture: ${JSON.stringify(decoded)}`);
  const declarations = decoded.value0.dataDecls;
  assert.deepEqual(Object.fromEntries(declarations.map(decl => [decl.name, isNullaryEnum(decl)])), {
    Color: true,
    Signal: true,
    Token: true,
    Marker: true,
    Mixed: false,
    Tree: false,
    Uninhabited: false,
  });
  // A phantom parameter does not introduce constructor payload.
  assert.deepEqual(declarations.find(decl => decl.name === 'Marker').vars, ['a']);
  // An eligible enum used in a field does not make its containing ADT eligible.
  // Assert the decoded field types too, so missing metadata cannot pass as [].
  const tree = declarations.find(decl => decl.name === 'Tree');
  assert.deepEqual(tree.constructors.find(ctor => ctor.name === 'T').fields, [
    new ADT('NullaryEnums.Color', ['NullaryEnums', 'Color'], []),
    new ADT('NullaryEnums.Tree', ['NullaryEnums', 'Tree'], []),
    Int.value,
    new ADT('NullaryEnums.Tree', ['NullaryEnums', 'Tree'], []),
  ]);
  assert.deepEqual(declarations.find(decl => decl.name === 'Mixed').constructors
    .find(ctor => ctor.name === 'Payload').fields, [Int.value]);
  console.log('TAST enum eligibility: nullary constructors, phantom parameters, payloads and nested Color checked.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
