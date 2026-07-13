import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

import waitOn from 'wait-on';

import type { AllTemplatesKey } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { now, saveBench } from '../bench/utils.ts';
import { getPort } from '../sandbox/utils/getPort.ts';
import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';
import { isNxTaskExecution } from '../utils/nx.ts';
import { prepareSandbox } from '../prepare-sandbox.ts';

/**
 * Initialise a git repo with an initial commit in the sandbox so the Storybook dev server can
 * use change detection from the moment it starts (git diff requires at least one commit).
 *
 * Idempotent — skips `git init` if `.git` already exists, skips the initial commit if HEAD
 * already points to one. Chromatic and publishing flows run in dedicated jobs with their own
 * checkout, so initialising git inside the dev sandbox does not affect them.
 */
function initGitForChangeDetection(sandboxDir: string): void {
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Storybook Sandbox',
    GIT_AUTHOR_EMAIL: 'sandbox@storybook.js',
    GIT_COMMITTER_NAME: 'Storybook Sandbox',
    GIT_COMMITTER_EMAIL: 'sandbox@storybook.js',
  };
  const gitOpts = { cwd: sandboxDir, stdio: 'pipe' as const, env: gitEnv };
  if (!existsSync(join(sandboxDir, '.git'))) {
    execSync('git init', gitOpts);
  }
  try {
    execSync('git rev-parse HEAD', { cwd: sandboxDir, stdio: 'pipe' });
  } catch {
    execSync('git add -A', gitOpts);
    execSync('git commit --allow-empty -m "Initial sandbox commit" --no-verify', gitOpts);
  }
}

export const PORT = process.env.STORYBOOK_SERVE_PORT
  ? parseInt(process.env.STORYBOOK_SERVE_PORT, 10)
  : 6006;

function getDevPort(key: AllTemplatesKey) {
  return isNxTaskExecution() ? getPort({ selectedTask: 'dev', key }) : PORT;
}

export const dev: Task = {
  description: 'Run the sandbox in development mode',
  service: true,
  dependsOn: ['sandbox'],
  async ready({ key }) {
    const port = getDevPort(key);
    try {
      await fetch(`http://localhost:${port}/iframe.html`, { signal: AbortSignal.timeout(1000) });
      return true;
    } catch {
      // The fetch can fail while a dev server owns the port: a cold compile
      // outlasting the timeout, or the server resetting connections before
      // its middleware is up. Spawning a second server then can only crash
      // with EADDRINUSE once it finishes compiling, so a held port must
      // count as ready - every consumer of this task performs its own HTTP
      // wait before using the server.
      return await new Promise<boolean>((resolve) => {
        const socket = connect({ port, host: '127.0.0.1' });
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => resolve(false));
      });
    }
  },
  async run({ sandboxDir, key, selectedTask }, { dryRun, debug, link }) {
    await prepareSandbox({ key, link });

    if (!dryRun) {
      try {
        initGitForChangeDetection(sandboxDir);
      } catch (e) {
        console.warn(
          `Failed to initialise git in sandbox for change detection: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    const controller = new AbortController();
    const port = getDevPort(key);
    const devCommand = `yarn storybook --port ${port}${selectedTask === 'dev' ? '' : ' --ci'}`;

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
