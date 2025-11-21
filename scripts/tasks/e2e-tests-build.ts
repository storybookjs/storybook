import { dedent } from 'ts-dedent';
import waitOn from 'wait-on';

import { getPort } from '../sandbox/utils/getPort';
import type { Task } from '../task';
import { exec } from '../utils/exec';
import { PORT } from './serve';

const testFileRegex = /(test|spec)\.(js|ts|mjs)$/;

export const e2eTestsBuild: Task & { port: number; type: 'build' | 'dev' } = {
  description: 'Run e2e tests against a sandbox in prod mode',
  dependsOn: ['serve'],
  junit: true,
  port: PORT,
  type: 'build',
  async ready() {
    return false;
  },
  async run({ codeDir, junitFilename, key, sandboxDir, selectedTask }, { dryRun, debug }) {
    const port = getPort({ key, selectedTask: selectedTask === 'e2e-tests' ? 'serve' : 'dev' });
    if (process.env.DEBUG) {
      console.log(dedent`
        Running e2e tests in Playwright's ui mode for chromium only (for brevity sake).
        You can change the browser by changing the --project flag in the e2e-tests task file.
      `);
    }

    const firstTestFileArgIndex = process.argv.findIndex((arg) => testFileRegex.test(arg));
    const testFiles = firstTestFileArgIndex === -1 ? [] : process.argv.slice(firstTestFileArgIndex);

    const playwrightCommand = process.env.DEBUG
      ? `yarn playwright test --project=chromium --ui ${testFiles.join(' ')}`
      : `yarn playwright test ${testFiles.join(' ')}`;

    await waitOn({ resources: [`http://localhost:${port}`], interval: 16 });
    await exec(
      playwrightCommand,
      {
        env: {
          STORYBOOK_URL: `http://localhost:${port}`,
          STORYBOOK_TYPE: this.type,
          STORYBOOK_TEMPLATE_NAME: key,
          STORYBOOK_SANDBOX_DIR: sandboxDir,
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
