import waitOn from 'wait-on';

import type { Task } from '../task';
import { CODE_DIRECTORY } from '../utils/constants';
import { exec } from '../utils/exec';
import { isPortUsed } from '../utils/port';

const REGISTRY_PORT = 6001;
const VERDACCIO_PORT = 6002;

export async function runRegistry({ dryRun, debug }: { dryRun?: boolean; debug?: boolean }) {
  const controller = new AbortController();

  void exec(
    'pnpm local-registry --open',
    { cwd: CODE_DIRECTORY, env: { CI: 'true' } },
    { dryRun, debug, signal: controller.signal }
  ).catch((err) => {
    // If aborted, we want to make sure the rejection is handled.
    if (!err.killed) {
      throw err;
    }
  });
  await waitOn({
    log: true,
    resources: [`http://localhost:${REGISTRY_PORT}`, `http://localhost:${VERDACCIO_PORT}`],
    interval: 16,
    timeout: 20000,
  });
  return controller;
}

export const runRegistryTask: Task = {
  description: 'Run the internal npm server',
  service: true,
  dependsOn: ['publish'],
  async ready() {
    return (await isPortUsed(REGISTRY_PORT)) && (await isPortUsed(VERDACCIO_PORT));
  },
  async run(_, options) {
    return runRegistry(options);
  },
};
