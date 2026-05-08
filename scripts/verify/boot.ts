import { execSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import waitOn from 'wait-on';

export async function preflightPort(port: number): Promise<void> {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' }).trim();
      if (out) {
        const pids = out
          .split('\n')
          .map((line) => line.trim().split(/\s+/).pop())
          .filter(Boolean)
          .join(', ');
        throw new Error(
          `Port ${port} already in use by PID(s) ${pids}. Kill with: taskkill /PID <pid> /F`
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('Port ')) throw err;
      // netstat exit non-zero means port is free on Windows
    }
    return;
  }

  // macOS / Linux: lsof with netstat fallback
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
    if (out) {
      throw new Error(
        `Port ${port} already in use by PID(s) ${out}. Kill with: kill -9 ${out} (or taskkill /PID <pid> /F on Windows)`
      );
    }
    // empty output means port is free
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Port ')) throw err;

    // Check for ENOENT (lsof binary missing)
    const spawnErr = err as NodeJS.ErrnoException;
    if (spawnErr.code === 'ENOENT') {
      // Try netstat fallback once
      try {
        const out = execSync(`netstat -an | grep :${port}`, { encoding: 'utf-8' }).trim();
        if (out) {
          console.warn(
            `[boot] lsof not found; netstat suggests port ${port} may be in use:\n${out}`
          );
        }
      } catch {
        console.warn(`[boot] lsof not found and netstat fallback failed — skipping preflight`);
      }
      return;
    }
    // Non-zero exit from lsof with no stdout means port is free — return normally
  }
}

let installed = false;

export function installSignalHandlers(controller: AbortController): void {
  if (installed) return;
  installed = true;

  process.on('SIGINT', () => {
    controller.abort();
    setImmediate(() => process.exit(130));
  });

  process.on('SIGTERM', () => {
    controller.abort();
    setImmediate(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    console.error('[boot] uncaughtException:', err);
    controller.abort();
    setImmediate(() => process.exit(1));
  });
}

export async function bootStorybook(opts: {
  sandboxDir: string;
  port?: number;
  controller: AbortController;
}): Promise<{ bootMs: number }> {
  const bootStart = performance.now();
  const port = opts.port ?? 6006;

  const child = spawn('yarn', ['storybook', '--port', String(port), '--ci'], {
    cwd: opts.sandboxDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    signal: opts.controller.signal,
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[boot] ${chunk}`);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[boot] ${chunk}`);
  });

  child.on('error', (err: NodeJS.ErrnoException) => {
    if (err.name === 'AbortError') return;
    console.error('[boot] Storybook process error:', err);
  });

  const abortPromise = new Promise<never>((_, reject) => {
    opts.controller.signal.addEventListener('abort', () => {
      reject(new Error('bootStorybook aborted'));
    });
  });

  try {
    await Promise.race([
      Promise.all([
        waitOn({
          resources: [`http://localhost:${port}/iframe.html`],
          interval: 16,
          timeout: 200000,
        }),
        waitOn({
          resources: [`http://localhost:${port}/index.html`],
          interval: 16,
          timeout: 200000,
        }),
      ]),
      abortPromise,
    ]);
  } catch (err: unknown) {
    opts.controller.abort();
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`bootStorybook failed: ${msg}`);
  }

  const bootMs = performance.now() - bootStart;
  return { bootMs };
}
