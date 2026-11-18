import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { logger } from 'storybook/internal/node-logger';

import { OxcParseError } from './errors.ts';
import type { ImportEdge } from './types.ts';

/**
 * Pool of worker threads that each run {@link ./parse.ts} against the files the main
 * thread hands them. Pool size is `min(4, max(1, cpus()-1))`. When the compiled worker
 * script isn't on disk (e.g. running from source without a build), `getOxcParsePool`
 * returns `null` and callers transparently fall back to inline parsing.
 */
interface Pending {
  resolve: (edges: ImportEdge[]) => void;
  reject: (error: unknown) => void;
  /** Optional inactivity timer that rejects the entry if a worker hangs. */
  timer?: NodeJS.Timeout;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
}

interface QueueEntry {
  filePath: string;
  source: string;
  resolve: (edges: ImportEdge[]) => void;
  reject: (error: unknown) => void;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  edges?: ImportEdge[];
  message?: string;
  name?: string;
}

export interface OxcParsePool {
  parse(filePath: string, source: string): Promise<ImportEdge[]>;
  dispose(): Promise<void>;
}

// OxcWorkerPool ships bundled into `dist/core-server/index.js`; the worker is emitted as
// a sibling sub-package at `dist/oxc-parser/worker.js`, one level up from core-server/.
const WORKER_RELATIVE_PATH = '../oxc-parser/worker.js';

const DEFAULT_TASK_TIMEOUT_MS = 30_000;

function resolveWorkerScriptPath(): string | undefined {
  // import.meta.url may be synthetic under exotic bundling; guard explicitly.
  if (typeof import.meta.url !== 'string') {
    return undefined;
  }
  const path = fileURLToPath(new URL(WORKER_RELATIVE_PATH, import.meta.url));
  return existsSync(path) ? path : undefined;
}

function computePoolSize(): number {
  const cpuCount = cpus().length;
  return Math.max(1, Math.min(4, cpuCount - 1));
}

export class OxcWorkerPool implements OxcParsePool {
  private readonly taskTimeoutMs: number;
  private readonly workers: WorkerSlot[] = [];
  private readonly queue: QueueEntry[] = [];
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private disposed = false;

  constructor(scriptPath: string, size: number, taskTimeoutMs = DEFAULT_TASK_TIMEOUT_MS) {
    this.taskTimeoutMs = taskTimeoutMs;
    try {
      for (let i = 0; i < size; i++) {
        const worker = new Worker(scriptPath);
        const slot: WorkerSlot = { worker, busy: false };
        worker.on('message', (msg: WorkerResponse) => this.handleMessage(slot, msg));
        worker.on('error', (error) => this.handleWorkerFailure(error));
        worker.on('exit', (code) => {
          if (!this.disposed) {
            this.handleWorkerFailure(new Error(`oxc-worker exited unexpectedly with code ${code}`));
          }
        });
        // Release the event loop's grip so a spawned-but-idle pool never blocks shutdown.
        worker.unref();
        this.workers.push(slot);
      }
    } catch (err) {
      // Partial-construction failure: terminate workers already spawned and rethrow.
      for (const slot of this.workers) {
        slot.worker.terminate().catch(() => 0);
      }
      this.workers.length = 0;
      throw err;
    }
  }

  parse(filePath: string, source: string): Promise<ImportEdge[]> {
    if (this.disposed) {
      return Promise.reject(new OxcParseError('oxc parse pool disposed'));
    }
    return new Promise<ImportEdge[]>((resolve, reject) => {
      this.queue.push({ filePath, source, resolve, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const slot = this.workers.find((s) => !s.busy);
      if (!slot) {
        return;
      }
      const task = this.queue.shift()!;
      const id = this.nextId++;
      slot.busy = true;
      const pending: Pending = {
        resolve: task.resolve,
        reject: task.reject,
      };
      if (this.taskTimeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.handleWorkerFailure(
            new Error(`oxc-worker task ${id} timed out after ${this.taskTimeoutMs}ms`)
          );
        }, this.taskTimeoutMs);
        pending.timer.unref?.();
      }
      this.pending.set(id, pending);
      slot.worker.postMessage({ id, filePath: task.filePath, source: task.source });
    }
  }

  private handleMessage(slot: WorkerSlot, msg: WorkerResponse): void {
    const entry = this.pending.get(msg.id);
    if (!entry) {
      return;
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    this.pending.delete(msg.id);
    slot.busy = false;
    if (msg.ok && msg.edges) {
      entry.resolve(msg.edges);
    } else {
      const err = new OxcParseError(msg.message ?? 'oxc-worker error');
      if (msg.name) {
        err.name = msg.name;
      }
      entry.reject(err);
    }
    this.drain();
  }

  /**
   * On any worker failure: reject all in-flight and queued tasks, dispose the pool so
   * subsequent parse() calls fail fast and the caller in index.ts falls back to inline
   * oxcParse. Nulls out the module-level pool reference so getOxcParsePool() returns null.
   */
  private handleWorkerFailure(error: Error): void {
    if (this.disposed) {
      return;
    }
    logger.debug(`oxc-worker failure: ${error.message}`);
    this.disposed = true;

    for (const [, entry] of this.pending) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(new OxcParseError(`oxc-worker failure: ${error.message}`, { cause: error }));
    }
    this.pending.clear();

    for (const queued of this.queue) {
      queued.reject(new OxcParseError('oxc parse pool disposed'));
    }
    this.queue.length = 0;

    for (const slot of this.workers) {
      slot.worker.terminate().catch(() => 0);
    }
    this.workers.length = 0;

    // Null out the module-level pool so getOxcParsePool() returns null and callers
    // fall through to inline oxcParse.
    sharedPool = null;
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const [, entry] of this.pending) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(new OxcParseError('oxc parse pool disposed'));
    }
    this.pending.clear();

    for (const queued of this.queue) {
      queued.reject(new OxcParseError('oxc parse pool disposed'));
    }
    this.queue.length = 0;

    // Reject callers BEFORE awaiting terminate() so they are never held hostage by a
    // hung worker thread — terminate() may stall if the OS is unresponsive.
    const terminations = this.workers.map((s) => s.worker.terminate().catch(() => 0));
    this.workers.length = 0;
    await Promise.all(terminations);
  }
}

let sharedPool: OxcParsePool | null = null;

function ensurePool(): void {
  if (sharedPool) {
    return;
  }
  const scriptPath = resolveWorkerScriptPath();
  if (!scriptPath) {
    logger.debug(
      'oxc worker pool disabled: compiled worker script not found (running from source?)'
    );
    return;
  }
  try {
    sharedPool = new OxcWorkerPool(scriptPath, computePoolSize());
  } catch (error) {
    logger.debug(
      `oxc worker pool disabled: failed to spawn (${error instanceof Error ? error.message : String(error)})`
    );
    sharedPool = null;
  }
}

/**
 * Returns the shared pool, initializing it on first call. Returns null if workers are
 * disabled or the compiled worker script is unavailable. Callers should fall back to
 * inline {@link oxcParse} on null.
 */
export function getOxcParsePool(): OxcParsePool | null {
  ensurePool();
  return sharedPool;
}

/**
 * Disposes the shared pool if one is running.
 */
export async function disposeOxcParsePool(): Promise<void> {
  const pool = sharedPool;
  sharedPool = null;
  if (pool) {
    await pool.dispose().catch(() => undefined);
  }
}

/** Test-only: force-reset the singleton state between cases. */
export async function _resetOxcParsePoolForTesting(): Promise<void> {
  const pool = sharedPool;
  sharedPool = null;
  if (pool) {
    await pool.dispose().catch(() => undefined);
  }
}
