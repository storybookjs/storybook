/* eslint-disable no-underscore-dangle */
import { spawn, type ChildProcess } from 'node:child_process';
import { log } from './utils';

import type { GlobalSetupContext } from 'vitest/node';

let storybookProcess: ChildProcess | null = null;

const checkStorybookRunning = async (storybookUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${storybookUrl}/iframe.html`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
};

const startStorybookIfNotRunning = async () => {
  const storybookScript = process.env.__STORYBOOK_SCRIPT__ as string;
  const storybookUrl = process.env.__STORYBOOK_URL__ as string;

  const isRunning = await checkStorybookRunning(storybookUrl);

  if (isRunning) {
    log('Storybook is already running');
    return;
  }

  log(`Starting Storybook with command: ${storybookScript}`);

  try {
    // We don't await the process because we don't want Vitest to hang while Storybook is starting
    storybookProcess = spawn(storybookScript, [], {
      stdio: process.env.DEBUG === 'storybook' ? 'pipe' : 'ignore',
      cwd: process.cwd(),
      shell: true,
    });

    storybookProcess.on('error', (error) => {
      log('Failed to start Storybook:', error);
      throw error;
    });
  } catch (error: unknown) {
    log('Failed to start Storybook:', error);
    throw error;
  }
};

const killProcess = (process: ChildProcess) => {
  return new Promise((resolve, reject) => {
    process.on('close', resolve);
    process.on('error', reject);
    process.kill();
  });
};

export const setup = async ({ config }: GlobalSetupContext) => {
  if (config.watch) {
    await startStorybookIfNotRunning();
  }
};

export const teardown = async () => {
  if (storybookProcess) {
    log('Stopping Storybook process');
    await killProcess(storybookProcess);
  }
};
