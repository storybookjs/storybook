// Print, as GitHub Actions outputs, which parts of .github/workflows/nx.yml a CircleCI workflow
// needs. Runs under plain Node before `yarn install`, like scripts/ci/main.ts.
//
// Usage: node --experimental-transform-types scripts/ci/nx/plan-cli.ts --workflow=<workflows>
// Focused runs read the changed files since `CI_CHANGED_FILES_BASE` (scripts/ci/utils/changed-files.ts).
import { parseArgs } from 'node:util';

import { changedFilesFromEnvironment } from '../utils/changed-files.ts';
import { parseWorkflows, planFor, sideJobs } from './plan.ts';

const { values } = parseArgs({ options: { workflow: { type: 'string', default: '' } } });
const changedFiles = changedFilesFromEnvironment();
const selected = parseWorkflows(values.workflow);
const plan = planFor(selected, changedFiles);

if (plan.missing.length > 0) {
  throw new Error(`No NX equivalent for the CircleCI jobs: ${plan.missing.join(', ')}`);
}

const outputs = {
  // In CircleCI's order, whatever order the labels were added in.
  workflow: selected.join(','),
  'changed-files-count': changedFiles.length,
  // Whether the NX Cloud job has any task to run.
  nx: plan.tasks.length > 0 || plan.affectedCheck,
  ...Object.fromEntries(sideJobs.map((job) => [job, plan.sideJobs.includes(job)])),
};

for (const [name, value] of Object.entries(outputs)) {
  console.log(`${name}=${value}`);
}
