/**
 * Verify a sandbox's docgen baselines, as CircleCI's create job does after the build (see
 * `getDocgenBaselineSteps` in scripts/ci/sandboxes.ts).
 *
 * On NX the `build` this depends on may have run on another worker, so its output was restored into
 * the repository (`sandbox/<dir>`), not into the sandbox the harness reads. The baselines hold paths
 * relative to the sandbox, so the cached copy goes where the sandbox was built.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from '../../utils/constants.ts';

const template = process.argv[2];
if (!template) {
  throw new Error('Usage: docgen-baselines.ts <template>');
}

const dir = template.replace('/', '-');
const sandboxDir = join(SANDBOX_DIRECTORY, dir);
const cachedDir = join(ROOT_DIRECTORY, 'sandbox', dir);

if (!existsSync(join(sandboxDir, 'storybook-static')) && existsSync(cachedDir)) {
  console.log(`Copying the cached sandbox ${cachedDir} to ${sandboxDir}`);
  cpSync(cachedDir, sandboxDir, { recursive: true, force: true });
}

const { status } = spawnSync('yarn', ['baselines:sandbox', '--template', template], {
  cwd: join(ROOT_DIRECTORY, 'code/lib/docgen-harness'),
  stdio: 'inherit',
});
process.exit(status ?? 1);
