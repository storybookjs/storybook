import { PORT } from './dev.ts';
import { testRunnerBuild as testRunnerProd } from './test-runner-build.ts';

export const testRunnerDev: typeof testRunnerProd = {
  ...testRunnerProd,
  port: PORT,
  description: 'Run the test runner against a sandbox in dev mode',
  dependsOn: ['dev'],
};
