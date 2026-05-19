import { execSync, spawn } from 'node:child_process';
import * as net from 'node:net';
import { performance } from 'node:perf_hooks';

import waitOn from 'wait-on';

// Best-effort: ask the OS which PID(s) currently hold the port so the
// thrown error can name the offender. NEVER interpreted as "free": any
// failure here (sandbox denial, missing binary, PATH, AppArmor) returns
// an empty string and the bind probe remains authoritative.
function describePortHolders(port: number): string {
  const isWindows = process.platform === 'win32';
  try {
    if (isWindows) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' }).trim();
      const pids = out
        .split('\n')
        .map((line) => line.trim().split(/\s+/).pop())
        .filter(Boolean)
        .join(', ');
      return pids;
    }
    return execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
  } catch {
    // lsof/netstat itself failed — cannot enrich, but this does NOT mean
    // the port is free. The bind probe is the source of truth.
    return '';
  }
}

export async function preflightPort(port: number): Promise<void> {
  // Authoritative check: attempt to bind the port. EADDRINUSE is the
  // definitive collision signal; a successful listen (then immediate
  // close) proves the port is free. lsof/netstat are used ONLY to enrich
  // the error message with the offending PID and their failure is never
  // treated as "free".
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();

    probe.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        const holders = describePortHolders(port);
        const isWindows = process.platform === 'win32';
        const killHint = isWindows
          ? 'taskkill /PID <pid> /F'
          : `kill -9 ${holders || '<pid>'} (or taskkill /PID <pid> /F on Windows)`;
        reject(
          new Error(
            holders
              ? `Port ${port} already in use by PID(s) ${holders}. Kill with: ${killHint}`
              : `Port ${port} already in use (PID undetermined). Kill with: ${killHint}`
          )
        );
        return;
      }
      // Any other bind error (EACCES, etc.) is a real problem too — do
      // NOT swallow it as "free".
      reject(new Error(`Port ${port} preflight bind failed: ${err.message}`));
    });

    probe.once('listening', () => {
      probe.close(() => resolve());
    });

    probe.listen(port, '127.0.0.1');
  });
}

// Graceful child teardown shared by every long-lived dev-server spawn.
//
// Children MUST be spawned with `detached: true` so they get their own
// process group; we then signal the whole group (negative PID) so Vite /
// Storybook subprocesses die too instead of orphaning and holding the
// port for the next run. Sequence: SIGTERM the group, start a bounded 5s
// timer that escalates to SIGKILL, and resolve only once the child has
// actually exited. Callers MUST await this before process.exit().
const SIGKILL_GRACE_MS = 5_000;

function killProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    // Negative PID targets the process group (requires detached spawn).
    process.kill(-pid, signal);
  } catch {
    // Group may already be gone, or kill not permitted — fall back to
    // signalling the child directly; ignore if it too is already dead.
    try {
      process.kill(pid, signal);
    } catch {
      /* already exited */
    }
  }
}

export function gracefulKill(child: {
  pid?: number;
  killed?: boolean;
  once: (event: 'exit', cb: () => void) => unknown;
  exitCode?: number | null;
  signalCode?: NodeJS.Signals | null;
}): Promise<void> {
  return new Promise<void>((resolve) => {
    const pid = child.pid;
    // Nothing to do if the child never started or already exited.
    if (!pid || child.exitCode != null || child.signalCode != null) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve();
    };

    child.once('exit', finish);

    killProcessGroup(pid, 'SIGTERM');

    const killTimer = setTimeout(() => {
      // Child trapped/ignored SIGTERM — escalate to SIGKILL on the group.
      killProcessGroup(pid, 'SIGKILL');
    }, SIGKILL_GRACE_MS);
    // Don't let the escalation timer keep the event loop alive.
    if (typeof killTimer.unref === 'function') killTimer.unref();
  });
}

let installed = false;

export function installSignalHandlers(controller: AbortController): void {
  if (installed) return;
  installed = true;

  process.on('SIGINT', () => {
    controller.abort();
    // controller.abort() triggers gracefulKill on any spawned dev-server
    // child (which awaits real child exit). Give that a bounded window,
    // then force-exit so a wedged child can never hang the orchestrator.
    setTimeout(() => process.exit(130), SIGKILL_GRACE_MS + 1_000).unref?.();
  });

  process.on('SIGTERM', () => {
    controller.abort();
    setTimeout(() => process.exit(1), SIGKILL_GRACE_MS + 1_000).unref?.();
  });

  process.on('uncaughtException', (err) => {
    console.error('[boot] uncaughtException:', err);
    controller.abort();
    setTimeout(() => process.exit(1), SIGKILL_GRACE_MS + 1_000).unref?.();
  });
}

export async function bootStorybook(opts: {
  sandboxDir: string;
  port?: number;
  controller: AbortController;
}): Promise<{ bootMs: number }> {
  const bootStart = performance.now();
  const port = opts.port ?? 6006;

  // detached so the child gets its own process group; gracefulKill then
  // signals the whole group so Vite/Storybook subprocesses die with it.
  const child = spawn('yarn', ['storybook', '--port', String(port), '--ci'], {
    cwd: opts.sandboxDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
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

  // On abort, tear the child (and its group) down with SIGTERM ->
  // bounded SIGKILL escalation. Fire-and-forget here; verify-pr.ts's
  // top-level teardown ordering plus the signal-handler grace window
  // ensure the parent doesn't exit before this resolves.
  const onAbort = () => {
    void gracefulKill(child);
  };
  opts.controller.signal.addEventListener('abort', onAbort, { once: true });

  // Reject-only race promise: must auto-remove its listener on success
  // and never become an unhandledRejection on normal teardown (when
  // verify-pr.ts calls controller.abort() at end-of-run). The
  // AbortSignal-scoped listener auto-detaches in `finally`, and the
  // attached .catch() neutralises the spurious rejection.
  const abortRaceController = new AbortController();
  const abortPromise = new Promise<never>((_, reject) => {
    opts.controller.signal.addEventListener(
      'abort',
      () => reject(new Error('bootStorybook aborted')),
      { signal: abortRaceController.signal }
    );
  });
  abortPromise.catch(() => {});

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
  } finally {
    // Remove the abort-race listener on every exit path (success or
    // failure) so end-of-run controller.abort() can't resurrect it.
    abortRaceController.abort();
  }

  const bootMs = performance.now() - bootStart;
  return { bootMs };
}
