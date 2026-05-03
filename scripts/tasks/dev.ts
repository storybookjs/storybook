import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
 * Scoped to the change-detection E2E test suite so we don't leave stray commits behind in
 * sandboxes consumed by Chromatic / publishing flows that expect a clean working tree.
 */
function initGitForChangeDetectionE2E(sandboxDir: string): void {
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
      return false;
    }
  },
  async run({ sandboxDir, key, selectedTask }, { dryRun, debug, link }) {
    await prepareSandbox({ key, link });

    if (selectedTask === 'e2e-tests-dev' && !dryRun) {
      initGitForChangeDetectionE2E(sandboxDir);
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
