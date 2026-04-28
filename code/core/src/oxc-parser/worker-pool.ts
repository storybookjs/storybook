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
 *
 * Lifecycle: shared across the process via {@link getOxcParsePool} but ref-counted so
 * concurrent consumers (e.g. ChangeDetectionService) each `acquire`/`release` and only
 * the last release tears the pool down.
 */
interface Pending {
  resolve: (edges: ImportEdge[]) => void;
  reject: (error: unknown) => void;
  /** Slot id of the worker that owns this entry; lets error/exit reject only its tasks. */
  slotId: number;
  /** Optional inactivity timer that rejects the entry if a worker hangs. */
  timer?: NodeJS.Timeout;
}

interface WorkerSlot {
  id: number;
  worker: Worker;
  busy: boolean;
  alive: boolean;
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
  private readonly scriptPath: string;
  private readonly taskTimeoutMs: number;
  private readonly workers: WorkerSlot[] = [];
  private readonly queue: QueueEntry[] = [];
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private nextSlotId = 0;
  private disposed = false;

  constructor(scriptPath: string, size: number, taskTimeoutMs = DEFAULT_TASK_TIMEOUT_MS) {
    this.scriptPath = scriptPath;
    this.taskTimeoutMs = taskTimeoutMs;
    try {
      for (let i = 0; i < size; i++) {
        this.workers.push(this.spawnSlot());
      }
    } catch (err) {
      // Partial-construction failure: terminate workers we already spawned and rethrow.
      for (const slot of this.workers) {
        slot.alive = false;
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

  private spawnSlot(): WorkerSlot {
    const id = this.nextSlotId++;
    const worker = new Worker(this.scriptPath);
    const slot: WorkerSlot = { id, worker, busy: false, alive: true };
    worker.on('message', (msg: WorkerResponse) => this.handleMessage(slot, msg));
    worker.on('error', (error) => this.handleWorkerFailure(slot, error, 'error'));
    worker.on('exit', (code) => {
      if (this.disposed || !slot.alive) {
        return;
      }
      this.handleWorkerFailure(
        slot,
        new Error(`oxc-worker exited unexpectedly with code ${code}`),
        'exit'
      );
    });
    // Release the event loop's grip so a spawned-but-idle pool never blocks shutdown.
    worker.unref();
    return slot;
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const slot = this.workers.find((s) => s.alive && !s.busy);
      if (!slot) {
        return;
      }
      const task = this.queue.shift()!;
      const id = this.nextId++;
      slot.busy = true;
      const pending: Pending = {
        resolve: task.resolve,
        reject: task.reject,
        slotId: slot.id,
      };
      if (this.taskTimeoutMs > 0) {
        pending.timer = setTimeout(() => {
          // Worker hung; treat as a per-slot failure so it gets replaced.
          this.handleWorkerFailure(
            slot,
            new Error(`oxc-worker task ${id} timed out after ${this.taskTimeoutMs}ms`),
            'timeout'
          );
        }, this.taskTimeoutMs);
        // Don't keep the process alive solely for the timer.
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
   * Reject only the pending entries owned by the failed slot, terminate it, and replace
   * it with a fresh worker. Tasks on healthy slots keep running.
   */
  private handleWorkerFailure(
    slot: WorkerSlot,
    error: Error,
    cause: 'error' | 'exit' | 'timeout'
  ): void {
    if (!slot.alive) {
      return;
    }
    slot.alive = false;
    slot.busy = false;
    logger.debug(`oxc-worker ${cause}: ${error.message}`);

    // Reject pendings owned by this slot.
    for (const [id, entry] of this.pending.entries()) {
      if (entry.slotId !== slot.id) {
        continue;
      }
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      this.pending.delete(id);
      entry.reject(new OxcParseError(`oxc-worker ${cause}: ${error.message}`, { cause: error }));
    }

    // Best-effort terminate; ignore errors on a worker that's already dead.
    slot.worker.terminate().catch(() => 0);

    if (this.disposed) {
      return;
    }

    // Replace the slot so the pool stays at full size.
    const idx = this.workers.indexOf(slot);
    if (idx === -1) {
      return;
    }
    try {
      const fresh = this.spawnSlot();
      this.workers[idx] = fresh;
      this.drain();
    } catch (spawnErr) {
      // If respawn fails (rare), drop the slot and continue with a smaller pool.
      this.workers.splice(idx, 1);
      logger.debug(
        `oxc-worker respawn failed: ${spawnErr instanceof Error ? spawnErr.message : String(spawnErr)}`
      );

      // If no alive workers remain, all queued and orphaned pending entries will
      // never settle — reject them now and mark the pool disposed so future
      // parse() calls fail fast.
      if (!this.workers.some((s) => s.alive)) {
        this.disposed = true;
        const noWorkerErr = new OxcParseError(
          'oxc parse pool: no live workers after respawn failure',
          { cause: spawnErr instanceof Error ? spawnErr : new Error(String(spawnErr)) }
        );
        for (const entry of this.pending.values()) {
          if (entry.timer) {
            clearTimeout(entry.timer);
          }
          entry.reject(noWorkerErr);
        }
        for (const queued of this.queue) {
          queued.reject(noWorkerErr);
        }
        this.pending.clear();
        this.queue.length = 0;
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const slot of this.workers) {
      slot.alive = false;
    }

    // Reject callers BEFORE awaiting terminate() so they are never held hostage by a
    // hung worker thread — terminate() may stall if the OS is unresponsive.
    for (const entry of this.pending.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(new OxcParseError('oxc parse pool disposed'));
    }
    for (const queued of this.queue) {
      queued.reject(new OxcParseError('oxc parse pool disposed'));
    }
    this.pending.clear();
    this.queue.length = 0;

    // Best-effort worker shutdown; ignore per-worker errors.
    const terminations = this.workers.map((s) => s.worker.terminate().catch(() => 0));
    this.workers.length = 0;
    await Promise.all(terminations);
  }
}

let sharedPool: OxcParsePool | null = null;
let sharedRefs = 0;
let initialized = false;

function ensurePoolInitialized(): void {
  if (initialized) {
    return;
  }
  initialized = true;
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
 * Acquires a ref on the shared pool, initializing it on first call. Returns null if workers
 * are disabled or the compiled worker script is unavailable. Each successful (non-null)
 * acquire MUST be paired with one {@link disposeOxcParsePool} call so concurrent
 * consumers (e.g. ChangeDetectionService) can co-exist.
 */
export function acquireOxcParsePool(): OxcParsePool | null {
  ensurePoolInitialized();
  if (sharedPool) {
    sharedRefs += 1;
  }
  return sharedPool;
}

/**
 * Returns the shared pool without changing the refcount. Returns null when no one has
 * acquired yet (uninitialized) or the pool was torn down. Callers should fall back to
 * inline {@link oxcParse} on null.
 */
export function getOxcParsePool(): OxcParsePool | null {
  return sharedPool;
}

/**
 * Releases one reference to the shared pool. The pool is only torn down when the last
 * reference is released, so concurrent consumers (e.g. ChangeDetectionService) can each
 * dispose without affecting siblings.
 */
export async function disposeOxcParsePool(): Promise<void> {
  if (!sharedPool) {
    initialized = false;
    sharedRefs = 0;
    return;
  }
  if (sharedRefs > 0) {
    sharedRefs -= 1;
  }
  if (sharedRefs > 0) {
    return;
  }
  const pool = sharedPool;
  sharedPool = null;
  initialized = false;
  await pool.dispose();
}

/** Test-only: force-reset the singleton state between cases. */
export async function _resetOxcParsePoolForTesting(): Promise<void> {
  const pool = sharedPool;
  sharedPool = null;
  sharedRefs = 0;
  initialized = false;
  if (pool) {
    await pool.dispose().catch(() => undefined);
  }
}
