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
        Running e2e tests in Playwright's ui mode for chromium only (for brevity sake).
        You can change the browser by changing the --project flag in the e2e-tests task file.
      `);
    }

    const firstTestFileArgIndex = process.argv.findIndex((arg) => testFileRegex.test(arg));
    const testFiles = firstTestFileArgIndex === -1 ? [] : process.argv.slice(firstTestFileArgIndex);

    const baseEnv = {
      STORYBOOK_URL: `http://localhost:${port}`,
      STORYBOOK_TYPE: this.type,
      STORYBOOK_TEMPLATE_NAME: key,
      STORYBOOK_SANDBOX_DIR: sandboxDir,
    };

    await waitOn({ resources: [`http://localhost:${port}`], interval: 16, timeout: 200000 });

    if (process.env.DEBUG) {
      await exec(
        `yarn playwright test --project=chromium --project=chromium-mutating --ui ${testFiles.join(' ')}`,
        { env: baseEnv, cwd: codeDir },
        { dryRun, debug }
      );
      return;
    }

    // The sandbox-mutating specs run in a second, serial invocation so their
    // dev-server invalidations cannot reload the parallel pass's pages. Two
    // invocations instead of a Playwright project dependency: dependency
    // projects run unfiltered, which would re-run the whole chromium suite on
    // any CI shard whose file subset contains a mutating spec.
    // --pass-with-no-tests covers shards whose subset has no match for one of
    // the projects.
    for (const [project, junitSuffix] of [
      ['chromium', ''],
      ['chromium-mutating', '-mutating'],
    ]) {
      await exec(
        `yarn playwright test --project=${project} --pass-with-no-tests ${testFiles.join(' ')}`,
        {
          env: {
            ...baseEnv,
            ...(junitFilename && {
              PLAYWRIGHT_JUNIT_OUTPUT_NAME: junitFilename.replace(/\.xml$/, `${junitSuffix}.xml`),
            }),
          },
          cwd: codeDir,
        },
        { dryRun, debug }
      );
    }
  },
};
