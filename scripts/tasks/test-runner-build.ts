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
  async run({ sandboxDir, junitFilename }, { dryRun, debug }) {
    const execOptions = { cwd: sandboxDir };
    const flags = [
      `--url http://127.0.0.1:${this.port}`,
      '--junit',
      '--maxWorkers=2',
      '--failOnConsole',
      '--skipTags="test-skip"',
      '--index-json',
    ];

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
