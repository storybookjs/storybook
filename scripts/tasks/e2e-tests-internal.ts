import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';

export const e2eTestsInternal: Task = {
  description: 'Run e2e tests against the internal Storybook UI (code/.storybook)',
  dependsOn: ['compile'],
  junit: true,
  async ready() {
    return false;
  },
  async run({ codeDir, junitFilename }, { dryRun, debug }) {
    await exec(
      'yarn playwright test --project=open-service-internal',
      {
        env: {
          CI: 'true',
          STORYBOOK_URL: 'http://localhost:6006',
          ...(junitFilename && {
            PLAYWRIGHT_JUNIT_OUTPUT_NAME: junitFilename,
          }),
        },
        cwd: codeDir,
      },
      { dryRun, debug }
    );
  },
};
