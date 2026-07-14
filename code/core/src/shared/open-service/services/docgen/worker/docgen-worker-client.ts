/**
 * Main-thread client for the long-lived docgen worker.
 *
 * Owns a single worker (docgen extraction serializes on one warm TypeScript program, so a pool
 * would only duplicate multi-second program builds and memory). Spawned once per process when the
 * compiled worker script is present; when it is missing — e.g. running from source without a build —
 * {@link createDocgenWorkerClient} returns `undefined` and the caller skips docgen registration
 * rather than silently extracting on the main thread.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { logger } from 'storybook/internal/node-logger';

import type { IndexEntry } from '../../../../../types/modules/indexer.ts';
import { importMetaResolve } from '../../../../utils/module.ts';
import type { ErrorLike } from '../../module-graph/types.ts';
import type { DocgenPayload, DocgenProviderDescriptor } from '../types.ts';
import type { DocgenWorkerRequest, DocgenWorkerResponse } from './protocol.ts';

/**
 * Package-relative specifier for the compiled worker. Resolved via the package export map (not a
 * hard-coded dist path) so strict package managers like pnpm resolve it correctly.
 */
const WORKER_SPECIFIER = 'storybook/internal/docgen-worker';

const DEFAULT_TASK_TIMEOUT_MS = 120_000;

interface Pending {
  resolve: (payload: DocgenPayload | undefined) => void;
  reject: (error: unknown) => void;
  timer?: NodeJS.Timeout;
}

export interface DocgenWorkerClient {
  /** Extracts docgen for one component entry off the main thread. */
  extract(entry: IndexEntry): Promise<DocgenPayload | undefined>;
}

/** Rebuild an Error from a worker {@link ErrorLike} so the original name/message/stack survive. */
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

class DocgenWorker implements DocgenWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private readonly ready: Promise<void>;
  // Captured from the `ready` promise executor (which runs synchronously) so `fail()` can settle
  // `ready` if the worker dies before sending `init`. No-op default keeps TS definite-assignment happy.
  private rejectReady: (error: unknown) => void = () => undefined;
  private nextId = 0;
  private dead = false;

  constructor(
    scriptPath: string,
    descriptors: DocgenProviderDescriptor[],
    private readonly taskTimeoutMs = DEFAULT_TASK_TIMEOUT_MS
  ) {
    this.worker = new Worker(scriptPath);
    // Never let an idle worker keep the process alive.
    this.worker.unref();
    this.worker.on('message', (msg: DocgenWorkerResponse) => this.handleMessage(msg));
    this.worker.on('error', (error) => this.fail(error));
    this.worker.on('exit', (code) => {
      if (!this.dead) {
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
    // Surface late init rejections instead of leaving an unhandled rejection.
    this.ready.catch(() => undefined);

    this.post({ type: 'init', descriptors });
  }

  async extract(entry: IndexEntry): Promise<DocgenPayload | undefined> {
    if (this.dead) {
      throw new Error('docgen worker is no longer running');
    }
    await this.ready;
    return new Promise<DocgenPayload | undefined>((resolve, reject) => {
      const id = this.nextId++;
      const pending: Pending = { resolve, reject };
      if (this.taskTimeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`docgen worker extract ${id} timed out after ${this.taskTimeoutMs}ms`));
        }, this.taskTimeoutMs);
        pending.timer.unref?.();
      }
      this.pending.set(id, pending);
      this.post({ type: 'extract', id, entry });
    });
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
    if (msg.error) {
      pending.reject(errorLikeToError(msg.error));
    } else {
      pending.resolve(msg.payload);
    }
  }

  /** Reject everything in flight and tear the worker down; used on fatal worker failure. */
  private fail(error: Error): void {
    if (this.dead) {
      return;
    }
    logger.debug(`docgen worker failure: ${error.message}`);
    this.dead = true;
    // If the worker dies before `init`, `ready` would otherwise never settle and an in-flight
    // `extract` awaiting it would hang. Rejecting is a no-op once `ready` has already settled.
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

/**
 * Creates the docgen worker client for `descriptors`. Returns `undefined` when the compiled worker
 * script is unavailable (no fallback — the caller skips docgen registration). The worker lives for the
 * process lifetime and is torn down with it, so there is nothing to dispose explicitly.
 *
 * The worker thread is spawned lazily on the first {@link DocgenWorkerClient.extract}, not here:
 * spawning the thread and importing the provider module graph is CPU work, and extraction is gated
 * until a story renders, so there is nothing to keep warm at dev-server boot — spawning eagerly would
 * only contend with Vite's cold start.
 */
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

  let worker: DocgenWorker | undefined;

  return {
    async extract(entry) {
      worker ??= new DocgenWorker(scriptPath, descriptors);
      return worker.extract(entry);
    },
  };
}
