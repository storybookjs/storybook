import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { logger } from 'storybook/internal/node-logger';

import type { IndexEntry } from '../../../../../types/modules/indexer.ts';
import { importMetaResolve } from '../../../../utils/module.ts';
import type { ErrorLike } from '../../module-graph/types.ts';
import type { DocgenProviderDescriptor, DocgenResult } from '../types.ts';
import type { DocgenWorkerRequest, DocgenWorkerResponse } from './protocol.ts';

// Resolved via the export map, not a hard-coded dist path, so strict layouts like pnpm's work.
const WORKER_SPECIFIER = 'storybook/internal/docgen-worker';

interface Pending {
  resolve: (results: DocgenResult[]) => void;
  reject: (error: unknown) => void;
  /** The number of entries in the request. */
  size: number;
}

export interface DocgenWorkerClient {
  /** Extract the entries in one worker request; settles one result per entry, in the same order. */
  extract(entries: IndexEntry[]): Promise<DocgenResult[]>;
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
  private diedInBatch = false;

  constructor(scriptPath: string, descriptors: DocgenProviderDescriptor[]) {
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
   *
   * A worker that died during a request for several components is replaceable too. Such a request
   * can die of its size, which says nothing about a later request for one component.
   */
  get replaceable(): boolean {
    return this.death !== undefined && (this.served || this.diedInBatch);
  }

  async extract(entries: IndexEntry[]): Promise<DocgenResult[]> {
    if (this.death) {
      // Carries the death forward: the crash itself is one event, but every later extract fails on
      // it, so a bare "no longer running" is the only thing anyone downstream ever sees.
      throw new Error(`docgen worker is no longer running: ${this.death.message}`, {
        cause: this.death,
      });
    }
    await this.ready;
    return new Promise<DocgenResult[]>((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, size: entries.length });
      this.keepProcessAliveWhileBusy();
      this.post({ type: 'extract', id, entries });
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
    this.pending.delete(msg.id);
    this.served = true;
    this.keepProcessAliveWhileBusy();
    if (msg.error) {
      pending.reject(errorLikeToError(msg.error));
      return;
    }
    pending.resolve(
      msg.results.map((result) =>
        result.error
          ? { status: 'rejected', reason: errorLikeToError(result.error) }
          : { status: 'fulfilled', value: result.payload }
      )
    );
  }

  private fail(error: Error): void {
    if (this.death) {
      return;
    }
    logger.warn(`docgen worker died, so component docs are unavailable: ${error.message}`);
    this.death = error;
    this.diedInBatch = [...this.pending.values()].some(({ size }) => size > 1);
    // Without this, an `extract` awaiting `ready` hangs when the worker dies before `init`.
    this.rejectReady(error);
    this.rejectAllPending(error);
    this.worker.terminate().catch(() => 0);
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
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

  let worker: DocgenWorker | undefined;

  return {
    async extract(entries) {
      if (worker?.replaceable) {
        logger.debug('docgen worker died after serving requests; spawning a replacement');
        worker = undefined;
      }
      worker ??= new DocgenWorker(scriptPath, descriptors);
      return worker.extract(entries);
    },
  };
}
