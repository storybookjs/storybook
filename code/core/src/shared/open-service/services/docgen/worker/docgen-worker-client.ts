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

interface Pending {
  resolve: (payload: DocgenPayload | undefined) => void;
  reject: (error: unknown) => void;
  timer?: NodeJS.Timeout;
}

export interface DocgenWorkerClient {
  extract(entry: IndexEntry): Promise<DocgenPayload | undefined>;
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
  // Serialized dispatch means the pending map holds at most one request: the drain loop posts the
  // next extract only after the previous one settles.
  private readonly pending = new Map<number, Pending>();
  private readonly ready: Promise<void>;
  private rejectReady: (error: unknown) => void = () => undefined;
  private nextId = 0;
  private death: Error | undefined;
  private served = false;

  constructor(
    scriptPath: string,
    descriptors: DocgenProviderDescriptor[],
    private readonly taskTimeoutMs = DEFAULT_TASK_TIMEOUT_MS
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
      const pending: Pending = { resolve, reject };
      this.pending.set(id, pending);
      if (this.taskTimeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.pending.delete(id);
          const timeoutError = new Error(
            `docgen worker extract ${id} timed out after ${this.taskTimeoutMs}ms`
          );
          // The client posts one request at a time, so a request is always the one the worker is
          // actively extracting: expiry means this extraction itself made no progress for the
          // whole window, and everything queued behind it would hang too. Reject the wedged
          // extraction, kill the worker, and let the queue drain onto a replacement
          // (`replaceable`).
          this.fail(timeoutError);
          pending.reject(timeoutError);
        }, this.taskTimeoutMs);
        pending.timer.unref?.();
      }
      this.keepProcessAliveWhileBusy();
      this.post({ type: 'extract', id, entry });
    });
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
    if (msg.type !== 'extract') {
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) {
      return;
    }
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
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
    for (const [, pending] of this.pending) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
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
  descriptors: DocgenProviderDescriptor[]
): DocgenWorkerClient | undefined {
  const scriptPath = resolveWorkerScriptPath();
  if (!scriptPath) {
    logger.debug(
      'docgen worker disabled: compiled worker script not found (running from source without a build?)'
    );
    return undefined;
  }

  // Requests are queued client-side and dispatched one at a time. The worker thread serializes the
  // CPU-bound TypeScript work anyway, so this costs no throughput — but it makes the per-request
  // timeout measure the active extraction instead of queue wait. A static build fans out one
  // extract per component onto this single worker; with timers armed at fan-out, any repo whose
  // total extraction exceeds the window would reject queued-but-healthy requests and fail builds
  // that had already produced a complete index.
  let worker: DocgenWorker | undefined;
  let draining = false;
  const queue: Array<{
    entry: IndexEntry;
    resolve: (payload: DocgenPayload | undefined) => void;
    reject: (error: unknown) => void;
  }> = [];

  const drain = async (): Promise<void> => {
    if (draining) {
      return;
    }
    draining = true;
    try {
      while (queue.length > 0) {
        if (worker?.replaceable) {
          logger.debug('docgen worker died after serving requests; spawning a replacement');
          worker = undefined;
        }
        worker ??= new DocgenWorker(scriptPath, descriptors);
        const task = queue.shift();
        if (!task) {
          break;
        }
        try {
          task.resolve(await worker.extract(task.entry));
        } catch (error) {
          task.reject(error);
        }
      }
    } catch (error) {
      // Worker construction itself failed; every queued extract fails on the same cause.
      for (const task of queue.splice(0)) {
        task.reject(error);
      }
    } finally {
      draining = false;
    }
  };

  return {
    extract(entry) {
      return new Promise<DocgenPayload | undefined>((resolve, reject) => {
        queue.push({ entry, resolve, reject });
        void drain();
      });
    },
  };
}
