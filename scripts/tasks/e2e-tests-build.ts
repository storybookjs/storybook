import { dedent } from 'ts-dedent';
import waitOn from 'wait-on';

import { getPort } from '../sandbox/utils/getPort.ts';
import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';
import { isNxTaskExecution } from '../utils/nx.ts';
import { PORT } from './serve.ts';

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
    const port = isNxTaskExecution()
      ? getPort({ key, selectedTask: selectedTask === 'e2e-tests' ? 'serve' : 'dev' })
      : this.port;

    if (process.env.DEBUG) {
      console.log(dedent`
        Running e2e tests in Playwright's ui mode for the chromium and chromium-mutating projects only (for brevity sake).
        You can change the browser by changing the --project flags in the e2e-tests task file.
      `);
    }

    const firstTestFileArgIndex = process.argv.findIndex((arg) => testFileRegex.test(arg));
    const testFiles = firstTestFileArgIndex === -1 ? [] : process.argv.slice(firstTestFileArgIndex);

    // chromium-mutating holds the specs that write to sandbox files; it runs
    // after the parallel chromium pass (see code/playwright.config.ts).
    const projects = '--project=chromium --project=chromium-mutating';
    const playwrightCommand = process.env.DEBUG
      ? `yarn playwright test ${projects} --ui ${testFiles.join(' ')}`
      : `yarn playwright test ${projects} ${testFiles.join(' ')}`;

    await waitOn({ resources: [`http://localhost:${port}`], interval: 16, timeout: 200000 });
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
