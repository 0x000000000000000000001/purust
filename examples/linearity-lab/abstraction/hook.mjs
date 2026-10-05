import { join } from 'node:path';
import { readFileSync } from 'node:fs';

export function check({ input, artifacts, run, report }) {
  const destination = join(artifacts, 'abstraction.json');
  const result = run(process.execPath, [join(input, 'tests.mjs'), destination]);
  const observations = JSON.parse(readFileSync(destination, 'utf8'));
  report.abstraction = {
    accepted: observations.accepted.length,
    rejected: observations.rejected.length,
    semanticComparisons: observations.semanticComparisons,
    controls: observations.controls,
  };
  console.log(result.stdout.trim());
}
