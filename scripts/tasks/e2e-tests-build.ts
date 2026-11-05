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
    const env = (junitName?: string) => ({
      STORYBOOK_URL: `http://localhost:${port}`,
      STORYBOOK_TYPE: this.type,
      STORYBOOK_TEMPLATE_NAME: key,
      STORYBOOK_SANDBOX_DIR: sandboxDir,
      ...(junitName && { PLAYWRIGHT_JUNIT_OUTPUT_NAME: junitName }),
    });
    const playwright = (args: string, junitName = junitFilename) =>
      exec(
        `yarn playwright test ${args} ${testFiles.join(' ')}`,
        { env: env(junitName), cwd: codeDir },
        { dryRun, debug }
      );

    await waitOn({ resources: [`http://localhost:${port}`], interval: 16, timeout: 200000 });

    if (process.env.DEBUG) {
      await playwright(`${projects} --ui`);
      return;
    }

    // The NX targets `e2e-tests-dev-1` to `-3` (nx.json) each run one part, so CI can run them on
    // different workers. Not `--shard` over both projects: chromium-mutating depends on chromium,
    // and Playwright runs a dependency's tests in every shard, so each shard ran the whole suite.
    // Each part runs its share of chromium; the last one then runs chromium-mutating on its own
    // dev server, after its chromium tests, as the unsplit run does.
    const part = process.env.PLAYWRIGHT_SHARD?.match(/^(\d+)\/(\d+)$/);
    if (!part) {
      await playwright(projects);
      return;
    }
    await playwright(`--project=chromium --shard=${part[1]}/${part[2]}`);
    if (part[1] === part[2]) {
      await playwright(
        '--project=chromium-mutating --no-deps',
        junitFilename?.replace(/(\.xml)?$/, '-mutating.xml')
      );
    }
  },
};
