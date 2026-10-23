import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

export type DevServer = {
  stop(): Promise<void>;
};

export const VITE_BIN = path.join(
  path.dirname(createRequire(import.meta.url).resolve('vite/package.json')),
  'bin/vite.js'
);

const FIXTURE = path.resolve(import.meta.dirname, '../..');

export async function startDevServer(
  args: string[],
  readyUrl: string,
  env?: Record<string, string>
): Promise<DevServer> {
  const child = spawn(process.execPath, args, {
    cwd: FIXTURE,
    env: { ...process.env, ...env, STORYBOOK_DISABLE_TELEMETRY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  let output = '';
  let exited = false;
  let spawnError: Error | undefined;
  const exitPromise = new Promise<void>((resolve) => {
    child.on('exit', () => {
      exited = true;
      resolve();
    });
    child.on('error', (error) => {
      exited = true;
      spawnError = error;
      output += `\n${error.message}`;
      resolve();
    });
  });

  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (spawnError) {
      throw new Error(`Dev server failed before ${readyUrl} was ready.\n\n${output}`);
    }

    if (exited) {
      throw new Error(`Dev server exited before ${readyUrl} was ready.\n\n${output}`);
    }

    try {
      const response = await fetch(readyUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        return {
          async stop(): Promise<void> {
            if (exited) {
              return;
            }

            stopProcessGroup(child.pid);
            await exitPromise;
          },
        };
      }
    } catch {
      await wait(500);
      continue;
    }

    await wait(500);
  }

  stopProcessGroup(child.pid);

  throw new Error(`Timed out waiting for ${readyUrl}.\n\n${output}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProcessGroup(pid: number | undefined): void {
  if (!pid) {
    return;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error;
    }
  }
}
