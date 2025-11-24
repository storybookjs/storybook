import detectFreePort from 'detect-port';
import waitOn from 'wait-on';

import { getPort } from '../sandbox/utils/getPort';
import { type Task } from '../task';
import { ROOT_DIRECTORY } from '../utils/constants';
import { exec } from '../utils/exec';

export const PORT = process.env.STORYBOOK_SERVE_PORT
  ? parseInt(process.env.STORYBOOK_SERVE_PORT, 10)
  : 8001;

export const serve: Task = {
  description: 'Serve the build storybook for a sandbox',
  service: true,
  dependsOn: ['build'],
  async ready({ key }) {
    const port = getPort({ key, selectedTask: 'serve' });
    return (await detectFreePort(port)) !== port;
  },
  async run({ builtSandboxDir, key }, { debug, dryRun }) {
    const port = getPort({ key, selectedTask: 'serve' });
    const controller = new AbortController();
    if ((await detectFreePort(port)) === port) {
      exec(
        `yarn http-server ${builtSandboxDir} --port ${port}`,
        { cwd: ROOT_DIRECTORY },
        { dryRun, debug, signal: controller.signal as AbortSignal }
      ).catch((err) => {
        // If aborted, we want to make sure the rejection is handled.
        if (!err.killed) {
          throw err;
        }
      });
      await waitOn({ resources: [`tcp:127.0.0.1:${port}`], interval: 16, timeout: 10000 });
    }

    return controller;
  },
};
