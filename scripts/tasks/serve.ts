import detectFreePort from 'detect-port';
import waitOn from 'wait-on';

import type { Task } from '../task';
import { exec } from '../utils/exec';

export const PORT = process.env.STORYBOOK_SERVE_PORT
  ? parseInt(process.env.STORYBOOK_SERVE_PORT, 10)
  : 8001;

export const serve: Task = {
  description: 'Serve the build storybook for a sandbox',
  service: true,
  dependsOn: ['build'],
  async ready() {
    return (await detectFreePort(PORT)) !== PORT;
  },
  async run({ builtSandboxDir, codeDir }, { debug, dryRun }) {
    const controller = new AbortController();
    exec(
      `yarn http-server ${builtSandboxDir} --port ${PORT} -s`,
      { cwd: codeDir },
      { dryRun, debug, signal: controller.signal as AbortSignal }
    ).catch((err) => {
      // If aborted, we want to make sure the rejection is handled.
      if (!err.killed) {
        throw err;
      }
    });
    await waitOn({ resources: [`tcp:127.0.0.1:${PORT}`], interval: 16 });

    return controller;
  },
};
