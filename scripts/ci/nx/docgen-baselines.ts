// Verify a sandbox's docgen baselines, as CircleCI's create job does after the build (see
// `getDocgenBaselineSteps` in scripts/ci/sandboxes.ts).
//
// On NX the `build` this depends on may have run on another worker, so its output was restored into
// the repository (`sandbox/<dir>`), not into the sandbox the harness reads. The baselines hold paths
// relative to the sandbox, so the cached copy goes where the sandbox was built.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { restoreSandbox } from '../../prepare-sandbox.ts';
import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from '../../utils/constants.ts';

const template = process.argv[2];
if (!template) {
  throw new Error('Usage: docgen-baselines.ts <template>');
}

const dir = template.replace('/', '-');
const sandboxDir = join(SANDBOX_DIRECTORY, dir);
const cachedDir = join(ROOT_DIRECTORY, 'sandbox', dir);

// Always from the cache when there is one: a storybook-static already in the sandbox can be older,
// and an earlier task on the same NX agent can have changed the sandbox.
if (existsSync(cachedDir) && cachedDir !== sandboxDir) {
  await restoreSandbox(cachedDir, sandboxDir);
}

const { status } = spawnSync('yarn', ['baselines:sandbox', '--template', template], {
  cwd: join(ROOT_DIRECTORY, 'code/lib/docgen-harness'),
  stdio: 'inherit',
});
process.exit(status ?? 1);
