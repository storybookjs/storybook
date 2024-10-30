import { PORT } from './dev';
import { testRunnerBuild as testRunnerProd } from './test-runner-build';

export const testRunnerDev: typeof testRunnerProd = {
  ...testRunnerProd,
  port: PORT,
  description: 'Run the test runner against a sandbox in dev mode',
  dependsOn: ['dev'],
};
