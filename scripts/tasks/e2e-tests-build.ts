import { dedent } from 'ts-dedent';
import type { Task } from '../task';
import { exec } from '../utils/exec';
import { PORT } from './serve';

export const e2eTestsBuild: Task & { port: number; type: 'build' | 'dev' } = {
  description: 'Run e2e tests against a sandbox in prod mode',
  dependsOn: ['serve'],
  junit: true,
  port: PORT,
  type: 'build',
  async ready() {
    return false;
  },
  async run({ codeDir, junitFilename, key, sandboxDir }, { dryRun, debug }) {
    if (process.env.DEBUG) {
      console.log(dedent`
        Running e2e tests in Playwright's ui mode for chromium only (for brevity sake).
        You can change the browser by changing the --project flag in the e2e-tests task file.
      `);
    }

    const playwrightCommand = process.env.DEBUG
      ? 'yarn playwright test --project=chromium --ui'
      : 'yarn playwright test';

    await exec(
      playwrightCommand,
      {
        env: {
          STORYBOOK_URL: `http://localhost:${this.port}`,
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
