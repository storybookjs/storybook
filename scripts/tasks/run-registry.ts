import detectFreePort from 'detect-port';
import waitOn from 'wait-on';

import type { Task } from '../task';
import { CODE_DIRECTORY } from '../utils/constants';
import { exec } from '../utils/exec';

export async function runRegistry({ dryRun, debug }: { dryRun?: boolean; debug?: boolean }) {
  const controller = new AbortController();

  if ((await detectFreePort(REGISTRY_PORT)) === REGISTRY_PORT) {
    exec(
      'yarn local-registry --open',
      { cwd: CODE_DIRECTORY, env: { CI: 'true' } },
      { dryRun, debug, signal: controller.signal }
    ).catch((err) => {
      // If aborted, we want to make sure the rejection is handled.

      // If aborted, we want to make sure the rejection is handled.
      if (!err.killed) {
        throw err;
      }
    });
    await waitOn({
      resources: ['http://localhost:6001', 'http://localhost:6002'],
      interval: 16,
      timeout: 10000,
    });
  }

  await waitOn({
    resources: ['http://localhost:6001', 'http://localhost:6002'],
    interval: 16,
    timeout: 10000,
  });

  return controller;
}

const REGISTRY_PORT = 6001;
export const runRegistryTask: Task = {
  description: 'Run the internal npm server',
  service: true,
  dependsOn: ['publish'],
  async ready() {
    return (await detectFreePort(REGISTRY_PORT)) !== REGISTRY_PORT;
  },
  async run(_, options) {
    return runRegistry(options);
  },
};
