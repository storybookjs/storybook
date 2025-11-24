import waitOn from 'wait-on';

import { getPort } from '../sandbox/utils/getPort';
import type { Task } from '../task';
import { exec } from '../utils/exec';
import { PORT } from './serve';

export const testRunnerBuild: Task & { port: number } = {
  description: 'Run the test runner against a built sandbox',
  junit: true,
  dependsOn: ['serve'],
  port: PORT,
  async ready() {
    return false;
  },
  async run({ sandboxDir, junitFilename, key, selectedTask }, { dryRun, debug }) {
    const port = getPort({ key, selectedTask: selectedTask === 'test-runner' ? 'serve' : 'dev' });

    const execOptions = { cwd: sandboxDir };
    const flags = [
      `--url http://127.0.0.1:${port}`,
      '--junit',
      '--maxWorkers=2',
      '--failOnConsole',
      '--index-json',
    ];

    await waitOn({ resources: [`http://localhost:${port}`], interval: 16, timeout: 10000 });

    await exec(
      `yarn test-storybook ${flags.join(' ')}`,
      {
        ...execOptions,
        env: {
          JEST_JUNIT_OUTPUT_FILE: junitFilename,
          TEST_ROOT: sandboxDir,
        },
      },
      { dryRun, debug }
    );
  },
};
