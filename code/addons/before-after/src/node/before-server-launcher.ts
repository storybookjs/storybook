/**
 * Parent-side process manager for the before-server subprocess.
 *
 * Forks a child process that runs a separate Vite dev server for serving
 * git HEAD content. Communicates via IPC for lifecycle management, cache
 * invalidation, and story prewarming.
 */
import { fork, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Compiled subprocess entry point at dist/node/before-server-subprocess.js */
const SUBPROCESS_PATH = join(__dirname, 'node', 'before-server-subprocess.js');

const STARTUP_TIMEOUT_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

export interface BeforeServerProcess {
  /** The port the before-server is listening on */
  port: number;
  /** Invalidate git file cache and Vite module graph (call after HEAD changes) */
  invalidate(): void;
  /** Eagerly compile story files in the before-server's Vite instance */
  prewarm(storyFiles: string[]): void;
  /** Gracefully shut down the subprocess */
  shutdown(): Promise<void>;
}

export async function launchBeforeServerProcess(config: {
  configDir: string;
  mainPort: number;
  repoRoot: string;
  cacheKey?: string;
}): Promise<BeforeServerProcess> {
  return new Promise<BeforeServerProcess>((resolve, reject) => {
    let child: ChildProcess;

    try {
      child = fork(SUBPROCESS_PATH, [], {
        // Inherit stdio so child's logger output appears in the same terminal
        silent: false,
      });
    } catch (err) {
      reject(new Error(`[before-after] Failed to fork subprocess: ${err}`));
      return;
    }

    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGKILL');
        reject(new Error('[before-after] Subprocess timed out during startup'));
      }
    }, STARTUP_TIMEOUT_MS);

    child.on('message', (msg: any) => {
      if (settled) {
        return;
      }

      if (msg.type === 'ready') {
        settled = true;
        clearTimeout(timeout);
        logger.info(`[before-after] Subprocess ready on port ${msg.port}`);

        resolve({
          port: msg.port,

          invalidate() {
            if (child.connected) {
              child.send({ type: 'invalidate' });
            }
          },

          prewarm(storyFiles: string[]) {
            if (child.connected && storyFiles.length > 0) {
              child.send({ type: 'prewarm', storyFiles });
            }
          },

          async shutdown() {
            if (!child.connected) {
              return;
            }

            child.send({ type: 'shutdown' });

            await new Promise<void>((res) => {
              const killTimer = setTimeout(() => {
                child.kill('SIGKILL');
                res();
              }, SHUTDOWN_TIMEOUT_MS);

              child.on('exit', () => {
                clearTimeout(killTimer);
                res();
              });
            });

            logger.info('[before-after] Subprocess shut down');
          },
        });
      } else if (msg.type === 'error') {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`[before-after] Subprocess startup failed: ${msg.message}`));
      }
    });

    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`[before-after] Subprocess error: ${err.message}`));
      }
    });

    child.on('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(
          new Error(
            `[before-after] Subprocess exited unexpectedly (code=${code}, signal=${signal})`
          )
        );
      }
    });

    // Send the start message to kick off bootstrap in the child
    child.send({
      type: 'start',
      configDir: config.configDir,
      mainPort: config.mainPort,
      repoRoot: config.repoRoot,
      cacheKey: config.cacheKey,
    });
  });
}
