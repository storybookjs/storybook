import type { ChildProcess } from 'node:child_process';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { Plugin } from 'vite';
import {
  buildCompodocCommandArgs,
  runCompodoc,
  type RunCompodocOptions,
} from '../builders/utils/run-compodoc.ts';
import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import {
  COMPODOC_COVERAGE_OPTIONS,
  COMPODOC_EXPORT_OPTION,
  COMPODOC_SERVE_OPTION,
  COMPODOC_WATCH_OPTION,
  insertCompodocOptions,
  removeCompodocOptions,
} from '../compodoc-args.ts';

/**
 * IPC contract between this plugin and the Compodoc watch process.
 *
 * No released `@compodoc/compodoc` emits these messages yet. An installed Compodoc that stays
 * silent is detected by the handshake probe below, so such a project gives up on the watcher within
 * seconds and falls back to the one-shot generation instead of stalling the dev server.
 */
export const COMPODOC_WATCH_PROTOCOL = 'compodoc-watch';
export const COMPODOC_WATCH_PROTOCOL_VERSION = 1;

export type CompodocWatchChange = {
  kind: 'change' | 'add' | 'unlink';
  path: string;
};

type CompodocWatchTrigger =
  | { kind: 'initial' }
  | { kind: 'changes'; changes: CompodocWatchChange[] };

type CompodocWatchCycleEvent = {
  protocol: typeof COMPODOC_WATCH_PROTOCOL;
  version: typeof COMPODOC_WATCH_PROTOCOL_VERSION;
  type: 'watch-cycle';
  cycle: number;
  trigger: CompodocWatchTrigger;
} & (
  | { state: 'start' }
  | {
      state: 'complete';
      invalidation: 'files' | 'global';
      output: { format: string; path: string };
      durationMs: number;
    }
  | { state: 'error'; error: { name: string; message: string; stack?: string } }
);

type CompodocWatchClosedEvent = {
  protocol: typeof COMPODOC_WATCH_PROTOCOL;
  version: typeof COMPODOC_WATCH_PROTOCOL_VERSION;
  type: 'watch-closed';
};

type CompodocWatchCapabilityEvent = {
  protocol: typeof COMPODOC_WATCH_PROTOCOL;
  version: typeof COMPODOC_WATCH_PROTOCOL_VERSION;
  type: 'watch-capability';
  capabilities: { cycles: true; gracefulClose: true };
};

type CompodocWatchFatalEvent = {
  protocol: typeof COMPODOC_WATCH_PROTOCOL;
  version: typeof COMPODOC_WATCH_PROTOCOL_VERSION;
  type: 'watch-fatal';
  error: { name: string; message: string; stack?: string };
};

export type CompodocWatchEvent =
  | CompodocWatchCapabilityEvent
  | CompodocWatchCycleEvent
  | CompodocWatchFatalEvent
  | CompodocWatchClosedEvent;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isChange = (value: unknown): value is CompodocWatchChange =>
  isRecord(value) &&
  (value.kind === 'change' || value.kind === 'add' || value.kind === 'unlink') &&
  typeof value.path === 'string';

const isTrigger = (value: unknown): value is CompodocWatchTrigger =>
  isRecord(value) &&
  (value.kind === 'initial' ||
    (value.kind === 'changes' && Array.isArray(value.changes) && value.changes.every(isChange)));

/** Runtime validation is deliberately independent from Compodoc's source/types. */
export const isCompodocWatchEvent = (value: unknown): value is CompodocWatchEvent => {
  if (
    !isRecord(value) ||
    value.protocol !== COMPODOC_WATCH_PROTOCOL ||
    value.version !== COMPODOC_WATCH_PROTOCOL_VERSION
  ) {
    return false;
  }
  if (value.type === 'watch-closed') {
    return true;
  }
  if (value.type === 'watch-capability') {
    return (
      isRecord(value.capabilities) &&
      value.capabilities.cycles === true &&
      value.capabilities.gracefulClose === true
    );
  }
  if (value.type === 'watch-fatal') {
    return (
      isRecord(value.error) &&
      typeof value.error.name === 'string' &&
      typeof value.error.message === 'string' &&
      (value.error.stack === undefined || typeof value.error.stack === 'string')
    );
  }
  if (
    value.type !== 'watch-cycle' ||
    !Number.isSafeInteger(value.cycle) ||
    (value.cycle as number) < 1 ||
    !isTrigger(value.trigger)
  ) {
    return false;
  }
  if (value.state === 'start') {
    return true;
  }
  if (value.state === 'complete') {
    return (
      isRecord(value.output) &&
      (value.invalidation === 'files' || value.invalidation === 'global') &&
      typeof value.output.format === 'string' &&
      typeof value.output.path === 'string' &&
      typeof value.durationMs === 'number' &&
      Number.isFinite(value.durationMs)
    );
  }
  return (
    value.state === 'error' &&
    isRecord(value.error) &&
    typeof value.error.name === 'string' &&
    typeof value.error.message === 'string' &&
    (value.error.stack === undefined || typeof value.error.stack === 'string')
  );
};

export type ResolvedCompodocCli = {
  cliPath: string;
  packagePath: string;
  version: string;
};

/** Resolves the user's installed package; no node_modules path is assumed. */
export const resolveCompodocCli = (workspaceRoot: string): ResolvedCompodocCli => {
  const requireFromProject = createRequire(resolve(workspaceRoot, 'package.json'));
  const packagePath = requireFromProject.resolve('@compodoc/compodoc/package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    version?: unknown;
    bin?: { compodoc?: unknown };
  };
  if (typeof packageJson.version !== 'string' || typeof packageJson.bin?.compodoc !== 'string') {
    throw new Error(`Invalid @compodoc/compodoc package metadata at ${packagePath}`);
  }
  return {
    cliPath: resolve(dirname(packagePath), packageJson.bin.compodoc),
    packagePath,
    version: packageJson.version,
  };
};

export const withoutLongRunningFlags = (args: string[]) =>
  removeCompodocOptions(args, [
    COMPODOC_SERVE_OPTION,
    COMPODOC_WATCH_OPTION,
    ...COMPODOC_COVERAGE_OPTIONS,
  ]);

const forceJsonExport = (args: string[]) =>
  insertCompodocOptions(removeCompodocOptions(args, [COMPODOC_EXPORT_OPTION]), ['-e', 'json']);

export const buildCompodocWatchArgs = (options: RunCompodocOptions): string[] => {
  const [, ...cliArgs] = buildCompodocCommandArgs(options);
  return insertCompodocOptions(forceJsonExport(withoutLongRunningFlags(cliArgs)), ['--watch']);
};

const oneShotOptions = (options: RunCompodocOptions): RunCompodocOptions => ({
  ...options,
  // Preserve the user's config and every finite generation option. Released Compodoc versions do
  // not understand Storybook's finite-fallback marker, so process ownership below terminates a
  // config-owned watch/serve process as soon as its fresh JSON snapshot is complete.
  compodocArgs: forceJsonExport(
    removeCompodocOptions(options.compodocArgs, [
      COMPODOC_SERVE_OPTION,
      COMPODOC_WATCH_OPTION,
      ...COMPODOC_COVERAGE_OPTIONS,
    ])
  ),
});

type SpawnCompodoc = (
  modulePath: string,
  args: readonly string[],
  options: Parameters<typeof fork>[2]
) => ChildProcess;

export type CompodocWatchController = {
  ready: Promise<void>;
  close: () => Promise<void>;
  child: ChildProcess;
  resolved: ResolvedCompodocCli;
};

export type CreateCompodocWatchOptions = RunCompodocOptions & {
  /** Directory containing the canonical JSON snapshot this child must report. */
  outputDir: string;
  handshakeTimeoutMs?: number;
  initialTimeoutMs?: number;
  closeTimeoutMs?: number;
  spawn?: SpawnCompodoc;
  resolveCli?: (workspaceRoot: string) => ResolvedCompodocCli;
  refresh?: (input: {
    files: string[];
    generation: number;
    invalidation: 'files' | 'global';
  }) => Promise<void>;
  /** Allocates a provider-wide generation watermark. Primarily injectable for deterministic tests. */
  nextGeneration?: () => number;
};

const liveWatchChildren = new Set<ChildProcess>();
let processTeardownRegistered = false;
let providerGenerationSequence = 0;
let processTeardownSequence = 0;

/**
 * Vite's `closeBundle` only runs when the dev server is closed in-process, so a `storybook dev`
 * stopped by a signal would otherwise leave the Compodoc child alive holding filesystem watchers.
 */
export const terminateWatchChildren = () => {
  processTeardownSequence += 1;
  for (const child of liveWatchChildren) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }
  }
  liveWatchChildren.clear();
};

const trackWatchChild = (child: ChildProcess) => {
  liveWatchChildren.add(child);
  if (processTeardownRegistered) {
    return;
  }
  processTeardownRegistered = true;
  process.once('exit', terminateWatchChildren);
  process.prependOnceListener('SIGINT', terminateWatchChildren);
  process.prependOnceListener('SIGTERM', terminateWatchChildren);
};

const waitFor = (timeoutMs: number, onTimeout: () => void) => {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<void>((resolvePromise) => {
    timer = setTimeout(() => {
      onTimeout();
      resolvePromise();
    }, timeoutMs);
    timer.unref?.();
  });
  return { promise, cancel: () => timer && clearTimeout(timer) };
};

const refreshCoreDocgen = async (input: {
  files: string[];
  generation: number;
  invalidation: 'files' | 'global';
}) => {
  const { getService } = await import('storybook/internal/core-server');
  const docgen = getService('core/docgen', { internal: true });
  await docgen.commands._refreshDocgenForFiles(input);
};

export const createCompodocWatch = (
  options: CreateCompodocWatchOptions
): CompodocWatchController => {
  const {
    handshakeTimeoutMs = 10_000,
    initialTimeoutMs = 120_000,
    closeTimeoutMs = 2_000,
    spawn = fork,
    resolveCli = resolveCompodocCli,
    refresh = refreshCoreDocgen,
    nextGeneration = () => ++providerGenerationSequence,
  } = options;
  const resolved = resolveCli(options.workspaceRoot);
  const child = spawn(resolved.cliPath, buildCompodocWatchArgs(options), {
    cwd: options.workspaceRoot,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  trackWatchChild(child);

  logger.debug(
    `[storybook-angular-vite] watching Compodoc ${resolved.version} from ${resolved.packagePath}`
  );
  child.stdout?.on('data', (chunk) => logger.debug(`[compodoc] ${String(chunk).trimEnd()}`));
  child.stderr?.on('data', (chunk) => logger.warn(`[compodoc] ${String(chunk).trimEnd()}`));

  let initialSettled = false;
  let capabilitySeen = false;
  let closing = false;
  let watcherLostReported = false;
  let resolveReady: () => void = () => undefined;
  let rejectReady: (error: unknown) => void = () => undefined;
  const ready = new Promise<void>((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise;
    rejectReady = rejectPromise;
  });
  // A caller may close after a startup failure without awaiting `ready` again.
  ready.catch((): void => undefined);

  let initialTimer: NodeJS.Timeout | undefined;
  const settleStartup = (settle: () => void) => {
    if (initialSettled) {
      return;
    }
    initialSettled = true;
    clearTimeout(handshakeTimer);
    if (initialTimer) {
      clearTimeout(initialTimer);
    }
    settle();
  };
  const failStartup = (error: Error) => settleStartup(() => rejectReady(error));

  // Capability negotiation is independent from project scanning and initial generation. Released
  // versions that do not implement the protocol fail quickly, while a large compatible project gets
  // the full initial-generation timeout after acknowledging support.
  const handshakeTimer = setTimeout(
    () =>
      failStartup(
        new Error(
          `Compodoc ${resolved.version} reported no watch capability within ${handshakeTimeoutMs}ms; the installed release does not support Storybook's watch protocol`
        )
      ),
    handshakeTimeoutMs
  );
  handshakeTimer.unref?.();

  let lastCompletion = 0;
  let resolveClosedAck: () => void = () => undefined;
  let resolveExit: () => void = () => undefined;
  let closePromise: Promise<void> | undefined;
  let closeWatch: () => Promise<void> = async () => undefined;
  const closedAck = new Promise<void>((resolvePromise) => (resolveClosedAck = resolvePromise));
  const exited = new Promise<void>((resolvePromise) => (resolveExit = resolvePromise));

  child.on('message', (message: unknown) => {
    if (!isCompodocWatchEvent(message)) {
      logger.warn('[storybook-angular-vite] ignored malformed Compodoc watch IPC message');
      return;
    }
    if (message.type === 'watch-capability') {
      capabilitySeen = true;
      clearTimeout(handshakeTimer);
      if (!initialTimer && !initialSettled) {
        initialTimer = setTimeout(
          () =>
            failStartup(
              new Error(`Compodoc initial watch cycle timed out after ${initialTimeoutMs}ms`)
            ),
          initialTimeoutMs
        );
        initialTimer.unref?.();
      }
      return;
    }
    if (!capabilitySeen && message.type !== 'watch-closed' && message.type !== 'watch-fatal') {
      logger.warn(
        '[storybook-angular-vite] ignored Compodoc watch cycle before capability negotiation'
      );
      return;
    }
    if (message.type === 'watch-closed') {
      resolveClosedAck();
      if (!initialSettled) {
        failStartup(new Error('Compodoc watch closed before initial completion'));
      }
      return;
    }
    if (message.type === 'watch-fatal') {
      const error = new Error(message.error.message);
      error.name = message.error.name;
      error.stack = message.error.stack ?? error.stack;
      reportWatcherLost(`reported a fatal watcher error: ${error.message}`, error);
      void closeWatch();
      return;
    }
    if (message.state === 'error') {
      const error = new Error(message.error.message);
      error.name = message.error.name;
      if (message.error.stack) {
        error.stack = message.error.stack;
      }
      if (message.trigger.kind === 'initial') {
        failStartup(error);
      } else {
        logger.warn(
          `[storybook-angular-vite] Compodoc watch cycle ${message.cycle} failed: ${error}`
        );
      }
      return;
    }
    if (message.state !== 'complete' || message.cycle <= lastCompletion) {
      return;
    }
    const expectedOutput = resolve(options.outputDir, DOCUMENTATION_JSON);
    const actualOutput = resolve(message.output.path);
    const normalizeOutput = (file: string) =>
      process.platform === 'win32' ? file.toLowerCase() : file;
    if (
      message.output.format !== 'json' ||
      normalizeOutput(actualOutput) !== normalizeOutput(expectedOutput) ||
      !existsSync(expectedOutput)
    ) {
      const error = new Error(
        `Compodoc cycle ${message.cycle} completed with unexpected output ${message.output.format}:${message.output.path}; expected json:${expectedOutput}`
      );
      if (message.trigger.kind === 'initial') {
        failStartup(error);
      } else {
        logger.warn(`[storybook-angular-vite] ${error.message}`);
      }
      return;
    }
    lastCompletion = message.cycle;
    const generation = nextGeneration();
    logger.debug(
      `[storybook-angular-vite] Compodoc watch cycle ${message.cycle} completed in ${message.durationMs}ms (${message.trigger.kind === 'initial' ? 'initial' : `${message.trigger.changes.length} change(s)`})`
    );
    if (message.trigger.kind === 'initial') {
      settleStartup(resolveReady);
      return;
    }
    void refresh({
      files: message.trigger.changes.map((change) => change.path),
      generation,
      invalidation: message.invalidation,
    })
      .then(() =>
        logger.debug(
          `[storybook-angular-vite] refreshed core/docgen for Compodoc cycle ${message.cycle}`
        )
      )
      .catch((error) =>
        logger.warn(
          `[storybook-angular-vite] Compodoc cycle ${message.cycle} completed, but core/docgen could not be refreshed: ${String(error)}`
        )
      );
  });

  function reportWatcherLost(reason: string, error?: Error) {
    if (!initialSettled) {
      failStartup(error ?? new Error(`Compodoc watch child ${reason} before initial completion`));
      return;
    }
    if (closing || watcherLostReported) {
      return;
    }
    watcherLostReported = true;
    logger.warn(
      `[storybook-angular-vite] Compodoc watch child ${reason}; component docs will no longer refresh until the dev server is restarted.`
    );
  }

  // A lost IPC channel means no further cycles, but the child may well still be running, so only a
  // real exit may satisfy the bounded SIGTERM window in `close()`.
  const onChildGone = (reason: string) => {
    reportWatcherLost(reason);
    resolveClosedAck();
  };
  child.once('error', (error) => {
    reportWatcherLost(`failed: ${error.message}`, error);
    if (child.pid === undefined) {
      liveWatchChildren.delete(child);
      resolveClosedAck();
      resolveExit();
    }
  });
  child.once('disconnect', () => onChildGone('disconnected'));
  child.once('exit', (code, signal) => {
    liveWatchChildren.delete(child);
    onChildGone(`exited (${signal ?? code ?? 'unknown'})`);
    resolveExit();
  });

  const teardown = async () => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    if (child.connected) {
      try {
        child.send({
          protocol: COMPODOC_WATCH_PROTOCOL,
          version: COMPODOC_WATCH_PROTOCOL_VERSION,
          type: 'watch-close',
        });
      } catch (error) {
        // The IPC channel may close between the `connected` check and `send`; bounded signals
        // below remain the authoritative teardown fallback.
        logger.debug(
          `[storybook-angular-vite] Compodoc watch-close IPC send failed: ${String(error)}`
        );
      }
    }

    let acknowledged = false;
    const ackTimeout = waitFor(closeTimeoutMs, () => undefined);
    await Promise.race([
      closedAck.then(() => {
        acknowledged = true;
      }),
      ackTimeout.promise,
    ]);
    ackTimeout.cancel();

    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    const gracefulExit = waitFor(acknowledged ? 250 : 0, () => undefined);
    await Promise.race([exited, gracefulExit.promise]);
    gracefulExit.cancel();
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    child.kill('SIGTERM');
    const terminateTimeout = waitFor(closeTimeoutMs, () => undefined);
    await Promise.race([exited, terminateTimeout.promise]);
    terminateTimeout.cancel();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      const killTimeout = waitFor(closeTimeoutMs, () => undefined);
      await Promise.race([exited, killTimeout.promise]);
      killTimeout.cancel();
    }
    if (child.exitCode === null && child.signalCode === null) {
      throw new Error(
        `Compodoc watch child did not exit after SIGTERM and SIGKILL within ${closeTimeoutMs}ms each`
      );
    }
  };

  closeWatch = () => {
    if (closePromise) {
      return closePromise;
    }
    closing = true;
    closePromise = teardown();
    return closePromise;
  };

  return { ready, close: closeWatch, child, resolved };
};

export type CompodocWatchPluginOptions = CreateCompodocWatchOptions;

/**
 * The watcher owns generation for the whole dev session, so whenever it cannot run, the one-shot
 * generation every other entry point uses has to produce the file it would otherwise have written.
 */
const ensureDocumentationJson = async (
  options: CompodocWatchPluginOptions,
  signal: AbortSignal
) => {
  const output = resolve(options.outputDir, DOCUMENTATION_JSON);
  const backup = `${output}.storybook-backup-${process.pid}-${Date.now()}-${randomUUID()}`;
  let previousOutputMoved = false;
  let run: Promise<void> | undefined;
  let readinessTimeout: ReturnType<typeof waitFor> | undefined;
  const fallbackAbort = new AbortController();
  const abortFallback = () => fallbackAbort.abort(signal.reason);
  signal.addEventListener('abort', abortFallback, { once: true });
  const waitForRunSettlement = async () => {
    if (!run) {
      return;
    }
    // `runCompodoc` owns the fallback subprocess. Returning while that promise is unsettled would
    // allow the aborted process to overwrite the restored/canonical JSON after this function exits.
    await run.catch((): void => undefined);
  };

  const waitForFreshJson = () =>
    new Promise<void>((resolveFresh, rejectFresh) => {
      let timer: NodeJS.Timeout | undefined;
      const finish = (settle: () => void) => {
        if (timer) {
          clearTimeout(timer);
        }
        fallbackAbort.signal.removeEventListener('abort', onAbort);
        settle();
      };
      const onAbort = () =>
        finish(() => rejectFresh(fallbackAbort.signal.reason ?? new Error('Fallback aborted')));
      const check = () => {
        if (fallbackAbort.signal.aborted) {
          onAbort();
          return;
        }
        if (existsSync(output)) {
          try {
            JSON.parse(readFileSync(output, 'utf8'));
            finish(resolveFresh);
            return;
          } catch {
            // Released versions can write in place. Keep the stale snapshot outside the reader
            // path and wait until the newly owned bytes form one complete JSON document.
          }
        }
        timer = setTimeout(check, 25);
      };
      fallbackAbort.signal.addEventListener('abort', onAbort, { once: true });
      check();
    });

  try {
    if (existsSync(output)) {
      renameSync(output, backup);
      previousOutputMoved = true;
    }
    run = runCompodoc({ ...oneShotOptions(options), signal: fallbackAbort.signal });
    readinessTimeout = waitFor(options.initialTimeoutMs ?? 120_000, () => undefined);
    const outcome = await Promise.race([
      run.then(
        () => ({ type: 'exit' as const }),
        (error: unknown) => ({ type: 'error' as const, error })
      ),
      waitForFreshJson().then(
        () => ({ type: 'output' as const }),
        (error: unknown) => ({ type: 'error' as const, error })
      ),
      readinessTimeout.promise.then(() => ({ type: 'timeout' as const })),
    ]);
    readinessTimeout.cancel();
    if (outcome.type === 'error') {
      throw outcome.error;
    }
    if (outcome.type === 'timeout') {
      throw new Error(
        `Compodoc fallback produced no readable ${DOCUMENTATION_JSON} within ${options.initialTimeoutMs ?? 120_000}ms`
      );
    }
    if (outcome.type === 'output') {
      fallbackAbort.abort(new Error('Fresh Compodoc fallback output is ready'));
      await waitForRunSettlement();
    }
    signal.throwIfAborted();
    if (!existsSync(output)) {
      throw new Error(`Compodoc completed without writing ${output}`);
    }
    JSON.parse(readFileSync(output, 'utf8'));
    fallbackAbort.abort(new Error('Compodoc fallback finished'));
    if (previousOutputMoved) {
      rmSync(backup, { force: true });
      previousOutputMoved = false;
    }
  } catch (error) {
    fallbackAbort.abort(error);
    await waitForRunSettlement();
    rmSync(output, { force: true });
    if (!signal.aborted) {
      logger.warn(`[storybook-angular-vite] compodoc generation failed: ${String(error)}`);
    }
    throw error;
  } finally {
    readinessTimeout?.cancel();
    signal.removeEventListener('abort', abortFallback);
  }
};

export const compodocWatchPlugin = (options: CompodocWatchPluginOptions): Plugin => {
  const creationTeardownSequence = processTeardownSequence;
  let controller: CompodocWatchController | undefined;
  let fallbackAbort: AbortController | undefined;
  let fallbackPromise: Promise<void> | undefined;
  let shuttingDown = false;
  const startFallback = () => {
    if (shuttingDown) {
      return Promise.resolve();
    }
    if (fallbackPromise) {
      return fallbackPromise;
    }
    fallbackAbort = new AbortController();
    fallbackPromise = ensureDocumentationJson(options, fallbackAbort.signal).catch(
      (): void => undefined
    );
    return fallbackPromise;
  };
  const close = async () => {
    shuttingDown = true;
    fallbackAbort?.abort();
    await Promise.allSettled([controller?.close(), fallbackPromise]);
  };
  return {
    name: 'storybook:angular-vite-compodoc-watch',
    async buildStart() {
      if (controller || shuttingDown || processTeardownSequence !== creationTeardownSequence) {
        shuttingDown = true;
        return;
      }
      // A failing watcher degrades docgen to a one-shot generation; it must never take the dev
      // server down with it.
      try {
        controller = createCompodocWatch(options);
      } catch (error) {
        logger.warn(
          `[storybook-angular-vite] Compodoc watch could not be started, component docs fall back to a one-shot generation: ${String(error)}`
        );
        await startFallback();
        return;
      }
      const started = controller;
      const launchTeardownSequence = processTeardownSequence;
      const settled = started.ready.catch(async (error) => {
        if (processTeardownSequence !== launchTeardownSequence) {
          shuttingDown = true;
          await Promise.allSettled([started.close()]);
          return;
        }
        logger.warn(
          `[storybook-angular-vite] Compodoc initial watch cycle failed, component docs fall back to a one-shot generation: ${String(error)}`
        );
        await started.close();
        await startFallback();
      });
      // The initial completion is the readiness barrier: starting from an older complete snapshot
      // is safe for readers, but would let the first extraction publish stale component metadata.
      await settled;
    },
    configureServer(server) {
      server.httpServer?.once('close', close);
    },
    closeBundle: close,
  };
};
