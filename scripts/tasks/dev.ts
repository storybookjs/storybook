import detectFreePort from 'detect-port';
import waitOn from 'wait-on';

import { now, saveBench } from '../bench/utils';
import { getPort } from '../sandbox/utils/getPort';
import type { Task } from '../task';
import { exec } from '../utils/exec';

export const PORT = process.env.STORYBOOK_SERVE_PORT
  ? parseInt(process.env.STORYBOOK_SERVE_PORT, 10)
  : undefined;

export const dev: Task = {
  description: 'Run the sandbox in development mode',
  service: true,
  dependsOn: ['sandbox'],
  async ready({ key }) {
    const port = getPort({ selectedTask: 'dev', key });
    return (await detectFreePort(port)) !== port;
  },
  async run({ sandboxDir, key }, { dryRun, debug }) {
    const controller = new AbortController();
    const port = getPort({ selectedTask: 'dev', key });
    const devCommand = `yarn storybook --port ${port}`;

    const start = now();
    exec(
      devCommand,
      { cwd: sandboxDir },
      { dryRun, debug, signal: controller.signal as AbortSignal }
    ).catch((err) => {
      // If aborted, we want to make sure the rejection is handled.
      if (!err.killed) {
        throw err;
      }
    });
    const [devPreviewResponsive, devManagerResponsive] = await Promise.all([
      waitOn({
        resources: [`http://localhost:${port}/iframe.html`],
        interval: 16,
        timeout: 200000,
      }).then(() => {
        return now() - start;
      }),
      waitOn({
        resources: [`http://localhost:${port}/index.html`],
        interval: 16,
        timeout: 200000,
      }).then(() => {
        return now() - start;
      }),
    ]);

    await saveBench(
      'dev',
      {
        devPreviewResponsive,
        devManagerResponsive,
      },
      { rootDir: sandboxDir }
    );

    return controller;
  },
};
