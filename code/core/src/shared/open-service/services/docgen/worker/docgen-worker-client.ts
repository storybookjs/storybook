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

interface Job {
  entry: IndexEntry;
  resolve: (payload: DocgenPayload | undefined) => void;
  reject: (error: unknown) => void;
}

interface InFlight {
  id: number;
  job: Job;
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
//
// Extracts are posted one at a time and each timeout starts at dispatch. Callers such as the static
// build fan out every component at once, and a timer started at enqueue would charge each extract
// for the whole queue ahead of it.
//
// A timed-out extract keeps running in the worker, so the next one can still wait out its tail. A
// second timeout with no answer in between means the worker is stuck rather than slow, so it is
// stopped: the queue then fails within two timeouts instead of one timeout per queued extract.
class DocgenWorker implements DocgenWorkerClient {
  private readonly worker: Worker;
  private inFlight: InFlight | undefined;
  private readonly queue: Job[] = [];
  /** Id of the last extract that timed out, cleared by the worker's next answer. */
  private unansweredTimeoutId: number | undefined;
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
    this.throwIfDead();
    await this.ready;
    // The worker can die while `ready` settles, after which nothing would dispatch this extract.
    this.throwIfDead();
    return new Promise<DocgenPayload | undefined>((resolve, reject) => {
      this.queue.push({ entry, resolve, reject });
      this.dispatchNext();
      this.keepProcessAliveWhileBusy();
    });
  }

  private throwIfDead(): void {
    if (this.death) {
      // Carries the death forward: the crash itself is one event, but every later extract fails on
      // it, so a bare "no longer running" is the only thing anyone downstream ever sees.
      throw new Error(`docgen worker is no longer running: ${this.death.message}`, {
        cause: this.death,
      });
    }
  }

  private dispatchNext(): void {
    if (this.death || this.inFlight) {
      return;
    }
    const job = this.queue.shift();
    if (!job) {
      return;
    }
    const inFlight: InFlight = { id: this.nextId++, job };
    if (this.taskTimeoutMs > 0) {
      inFlight.timer = setTimeout(() => this.timeOut(inFlight), this.taskTimeoutMs);
      inFlight.timer.unref?.();
    }
    this.inFlight = inFlight;
    this.post({ type: 'extract', id: inFlight.id, entry: job.entry });
  }

  private timeOut({ id, job }: InFlight): void {
    const timedOut = `timed out after ${this.taskTimeoutMs}ms`;
    if (this.unansweredTimeoutId !== undefined) {
      const ids = `extracts ${this.unansweredTimeoutId} and ${id}`;
      this.fail(new Error(`docgen worker stopped responding: ${ids} both ${timedOut}`));
      return;
    }
    this.unansweredTimeoutId = id;
    job.reject(new Error(`docgen worker extract ${id} ${timedOut}`));
    this.finishInFlight();
  }

  /** Frees the worker for the next queued extract once the current one has settled. */
  private finishInFlight(): void {
    clearTimeout(this.inFlight?.timer);
    this.inFlight = undefined;
    this.dispatchNext();
    this.keepProcessAliveWhileBusy();
  }

  private keepProcessAliveWhileBusy(): void {
    if (this.inFlight || this.queue.length > 0) {
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
    // Any answer, even a late one for a timed-out extract, shows the worker isn't stuck.
    this.unansweredTimeoutId = undefined;
    const inFlight = this.inFlight;
    if (inFlight?.id !== msg.id) {
      return;
    }
    this.served = true;
    if (msg.error) {
      inFlight.job.reject(errorLikeToError(msg.error));
    } else {
      inFlight.job.resolve(msg.payload);
    }
    this.finishInFlight();
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
    if (this.inFlight) {
      clearTimeout(this.inFlight.timer);
      this.inFlight.job.reject(error);
      this.inFlight = undefined;
    }
    for (const job of this.queue.splice(0)) {
      job.reject(error);
    }
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
    async extract(entry) {
      if (worker?.replaceable) {
        logger.debug('docgen worker died after serving requests; spawning a replacement');
        worker = undefined;
      }
      worker ??= new DocgenWorker(scriptPath, descriptors);
      return worker.extract(entry);
    },
  };
}
