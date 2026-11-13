import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { logger } from 'storybook/internal/node-logger';

import type { IndexEntry } from '../../../../../types/modules/indexer.ts';
import { importMetaResolve } from '../../../../utils/module.ts';
import type { ErrorLike } from '../../module-graph/types.ts';
import type { DocgenPayload, DocgenProviderDescriptor } from '../types.ts';
import type { DocgenWorkerRequest, DocgenWorkerResponse } from './protocol.ts';

// Resolved via the export map, not a hard-coded dist path, so strict layouts like pnpm's work.
const WORKER_SPECIFIER = 'storybook/internal/docgen-worker';

const DEFAULT_TASK_TIMEOUT_MS = 120_000;

// A build extracts every component with nobody waiting on a panel, so its slowest component gets
// longer before the worker counts as hung.
export const BUILD_TASK_TIMEOUT_MS = 300_000;

interface Pending {
  entry: IndexEntry;
  resolve: (payload: DocgenPayload | undefined) => void;
  reject: (error: unknown) => void;
  timer?: NodeJS.Timeout;
}

export interface DocgenWorkerClient {
  extract(entry: IndexEntry): Promise<DocgenPayload | undefined>;
  /**
   * Announce the entries about to be extracted, so providers can do the setup those extractions
   * share once instead of per component. Optional: extraction works without it.
   */
  prepare(entries: IndexEntry[]): void;
}

export interface DocgenWorkerClientOptions {
  /** How long one extraction may run before the worker counts as hung. `0` disables the limit. */
  taskTimeoutMs?: number;
}

function errorLikeToError(errorLike: ErrorLike): Error {
  const error = new Error(errorLike.message);
  if (errorLike.name) {
    error.name = errorLike.name;
  }
  if (errorLike.stack) {
    error.stack = errorLike.stack;
  }
  return error;
}

// One worker, never a pool: extraction serializes on a single warm TypeScript program, so extra
// threads would only duplicate multi-second program builds and their memory.
class DocgenWorker implements DocgenWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private readonly ready: Promise<void>;
  private rejectReady: (error: unknown) => void = () => undefined;
  private nextId = 0;
  private death: Error | undefined;
  private served = false;

  constructor(
    scriptPath: string,
    descriptors: DocgenProviderDescriptor[],
    private readonly taskTimeoutMs: number,
    batch: IndexEntry[] | undefined
  ) {
    this.worker = new Worker(scriptPath);
    this.worker.on('message', (msg: DocgenWorkerResponse) => this.handleMessage(msg));
    this.worker.on('error', (error) => this.fail(error));
    this.worker.on('exit', (code) => {
      if (!this.death) {
        this.fail(new Error(`docgen worker exited unexpectedly with code ${code}`));
      }
    });

    this.ready = new Promise<void>((resolve, reject) => {
      this.rejectReady = reject;
      const onMessage = (msg: DocgenWorkerResponse) => {
        if (msg.type !== 'init') {
          return;
        }
        this.worker.off('message', onMessage);
        if (msg.error) {
          reject(errorLikeToError(msg.error));
        } else {
          resolve();
        }
      };
      this.worker.on('message', onMessage);
    });
    // Prevents an unhandled rejection; `extract` still awaits `ready` and surfaces the error.
    this.ready.catch(() => undefined);

    // Spawn is lazy, so an extract is always imminent: stay referenced until `ready` settles.
    this.ready.finally(() => this.keepProcessAliveWhileBusy()).catch(() => undefined);

    this.post({ type: 'init', descriptors, logLevel: logger.getLogLevel() });
    if (batch) {
      this.prepare(batch);
    }
  }

  prepare(entries: IndexEntry[]): void {
    if (!this.death) {
      this.post({ type: 'prepare', entries });
    }
  }

  /**
   * Whether a fresh worker would be worth spawning in this one's place.
   *
   * Only once it has served an extract: a worker that died without ever answering died of something
   * a replacement would hit again, and respawning would rebuild a multi-second TypeScript program
   * per request to fail the same way.
   */
  get replaceable(): boolean {
    return this.death !== undefined && this.served;
  }

  async extract(entry: IndexEntry): Promise<DocgenPayload | undefined> {
    if (this.death) {
      // Carries the death forward: the crash itself is one event, but every later extract fails on
      // it, so a bare "no longer running" is the only thing anyone downstream ever sees.
      throw new Error(`docgen worker is no longer running: ${this.death.message}`, {
        cause: this.death,
      });
    }
    await this.ready;
    return new Promise<DocgenPayload | undefined>((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { entry, resolve, reject });
      this.keepProcessAliveWhileBusy();
      // Every request goes to the worker right away: it queues them itself, so it keeps working
      // while this thread is busy with the rest of a build.
      this.post({ type: 'extract', id, entry });
    });
  }

  // The limit runs from the moment the worker starts a request, so it covers that request's own
  // work and not the wait behind the requests queued before it.
  private startTimeLimit(pending: Pending): void {
    if (this.taskTimeoutMs <= 0) {
      return;
    }
    // The worker cannot be interrupted mid-extraction, so a request past its limit takes the worker
    // down with it; the next extract spawns a replacement.
    pending.timer = setTimeout(
      () =>
        this.fail(
          new Error(
            `docgen extraction of "${pending.entry.title}" timed out after ${this.taskTimeoutMs}ms`
          )
        ),
      this.taskTimeoutMs
    );
    pending.timer.unref?.();
  }

  private keepProcessAliveWhileBusy(): void {
    if (this.pending.size > 0) {
      this.worker.ref();
    } else {
      this.worker.unref();
    }
  }

  private post(msg: DocgenWorkerRequest): void {
    this.worker.postMessage(msg);
  }

  private handleMessage(msg: DocgenWorkerResponse): void {
    if (msg.type === 'init') {
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) {
      return;
    }
    if (msg.type === 'started') {
      this.startTimeLimit(pending);
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(msg.id);
    this.served = true;
    this.keepProcessAliveWhileBusy();
    if (msg.error) {
      pending.reject(errorLikeToError(msg.error));
    } else {
      pending.resolve(msg.payload);
    }
  }

  private fail(error: Error): void {
    if (this.death) {
      return;
    }
    logger.warn(`docgen worker died, so component docs are unavailable: ${error.message}`);
    this.death = error;
    // Without this, an `extract` awaiting `ready` hangs when the worker dies before `init`.
    this.rejectReady(error);
    this.rejectAllPending(error);
    this.worker.terminate().catch(() => 0);
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.worker.unref();
  }
}

function resolveWorkerScriptPath(): string | undefined {
  try {
    const scriptPath = fileURLToPath(importMetaResolve(WORKER_SPECIFIER));
    return existsSync(scriptPath) ? scriptPath : undefined;
  } catch {
    return undefined;
  }
}

// The thread is spawned on the first extract, not here: nothing extracts until a story renders, so
// an eager spawn would only contend with the dev server's cold start.
export function createDocgenWorkerClient(
  descriptors: DocgenProviderDescriptor[],
  { taskTimeoutMs = DEFAULT_TASK_TIMEOUT_MS }: DocgenWorkerClientOptions = {}
): DocgenWorkerClient | undefined {
  const scriptPath = resolveWorkerScriptPath();
  if (!scriptPath) {
    logger.debug(
      'docgen worker disabled: compiled worker script not found (running from source without a build?)'
    );
    return undefined;
  }

  let worker: DocgenWorker | undefined;
  // Kept so a worker spawned or respawned after the announcement still receives it.
  let batch: IndexEntry[] | undefined;

  return {
    prepare(entries) {
      batch = entries;
      worker?.prepare(entries);
    },
    async extract(entry) {
      if (worker?.replaceable) {
        logger.debug('docgen worker died after serving requests; spawning a replacement');
        worker = undefined;
      }
      worker ??= new DocgenWorker(scriptPath, descriptors, taskTimeoutMs, batch);
      return worker.extract(entry);
    },
  };
}
