import { type ChildProcess, spawn } from 'node:child_process';

import type { TestProject } from 'vitest/node';

import { logger } from 'storybook/internal/node-logger';

import treeKill from 'tree-kill';

let storybookProcess: ChildProcess | null = null;

const getIsVitestStandaloneRun = () => {
  try {
    // @ts-expect-error Suppress TypeScript warning about wrong setting. Doesn't matter, because we don't use tsc for bundling.
    return (import.meta.env || process?.env).STORYBOOK !== 'true';
  } catch (e) {
    return false;
  }
};

const isVitestStandaloneRun = getIsVitestStandaloneRun();

// TODO: Not run when executed via Storybook
const checkStorybookRunning = async (storybookUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${storybookUrl}/iframe.html`, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
  } catch (error) {
    logger.verbose(`Failed to get response from ${storybookUrl}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
    return false;
  }
};

const startStorybookIfNotRunning = async () => {
  const storybookScript = process.env.__STORYBOOK_SCRIPT__ as string;
  const storybookUrl = process.env.__STORYBOOK_URL__ as string;

  const isRunning = await checkStorybookRunning(storybookUrl);

  if (isRunning) {
    logger.verbose('Storybook is already running');
    return;
  }

  logger.verbose(`Starting Storybook with command: ${storybookScript}`);

  try {
    // We don't await the process because we don't want Vitest to hang while Storybook is starting
    // Use shell so commands like `yarn storybook --no-open` or `npm run storybook -- --no-open`
    // are interpreted correctly across platforms.
    storybookProcess = spawn(storybookScript, {
      shell: true,
      stdio: process.env.DEBUG === 'storybook' ? 'pipe' : 'ignore',
      cwd: process.cwd(),
    });

    storybookProcess.on('error', (error) => {
      logger.verbose('Failed to start Storybook:' + error.message);
      throw error;
    });
  } catch (error: unknown) {
    logger.verbose('Failed to start Storybook:' + (error as any).message);
    throw error;
  }
};

export const setup = async ({ config }: TestProject) => {
  if (config.watch && isVitestStandaloneRun) {
    await startStorybookIfNotRunning();
  }
};

export const teardown = async () => {
  if (!storybookProcess) {
    return;
  }
  logger.verbose('Stopping Storybook process');
  await new Promise<void>((resolve, reject) => {
    // Storybook starts multiple child processes, so we need to kill the whole tree
    if (storybookProcess?.pid) {
      treeKill(storybookProcess.pid, 'SIGTERM', (error) => {
        if (error) {
          logger.error('Failed to stop Storybook process:');
          reject(error);
          return;
        }
        resolve();
      });
    }
  });
};
