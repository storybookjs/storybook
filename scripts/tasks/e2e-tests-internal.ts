import waitOn from 'wait-on';

import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';

const STORYBOOK_PORT = 6006;
const READY_TIMEOUT_MS = 25_000;

export const e2eTestsInternal: Task = {
  description: 'Run e2e tests against the internal Storybook UI (code/.storybook)',
  dependsOn: ['compile'],
  junit: true,
  async ready() {
    return false;
  },
  async run({ codeDir, junitFilename }, { dryRun, debug }) {
    const storybookUrl = `http://localhost:${STORYBOOK_PORT}`;
    const env = {
      CI: 'true',
      STORYBOOK_URL: storybookUrl,
      ...(junitFilename && {
        PLAYWRIGHT_JUNIT_OUTPUT_NAME: junitFilename,
      }),
    };

    if (!dryRun) {
      await waitOn({
        resources: [`${storybookUrl}/index.json`],
        interval: 16,
        timeout: READY_TIMEOUT_MS,
      });
    }

    await exec(
      'yarn playwright test -c playwright.internal.config.ts --project=internal-storybook',
      {
        env,
        cwd: codeDir,
      },
      { dryRun, debug }
    );
  },
};
