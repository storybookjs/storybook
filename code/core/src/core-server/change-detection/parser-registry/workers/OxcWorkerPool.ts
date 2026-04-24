import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { logger } from 'storybook/internal/node-logger';

import { ChangeDetectionFailureError } from '../../errors.ts';
import type { ImportEdge } from '../types.ts';

/**
 * Pool of worker threads that each run {@link ../oxc-parse.ts} against the files the main
 * thread hands them. Pool size defaults to `min(4, max(1, cpus()-1))` and is capped by
 * `STORYBOOK_CHANGE_DETECTION_WORKERS`. Pool usage is opt-out via
 * `STORYBOOK_CHANGE_DETECTION_NO_WORKER=1`.
 */
interface Pending {
  resolve: (edges: ImportEdge[]) => void;
  reject: (error: unknown) => void;
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

/**
 * At dev time the module lives at
 * `dist/core-server/change-detection/parser-registry/workers/OxcWorkerPool.js`, so the
 * worker is a sibling (`./oxc-worker.js`). After bundling, the pool is inlined into
 * `dist/core-server/index.js` and `import.meta.url` points there instead, so we probe
 * the descendant path where the worker entry actually ships.
 */
const WORKER_PATH_CANDIDATES = [
  './oxc-worker.js',
  './change-detection/parser-registry/workers/oxc-worker.js',
] as const;

function resolveWorkerScriptPath(): string | undefined {
  const override = process.env.STORYBOOK_CHANGE_DETECTION_WORKER_PATH;
  if (override) {
    return existsSync(override) ? override : undefined;
  }
  for (const relative of WORKER_PATH_CANDIDATES) {
    try {
      const url = new URL(relative, import.meta.url);
      const path = fileURLToPath(url);
      if (existsSync(path)) {
        return path;
      }
    } catch {
      // ignore — try next candidate
    }
  }
  return undefined;
}

function computePoolSize(): number {
  const envSize = Number(process.env.STORYBOOK_CHANGE_DETECTION_WORKERS);
  if (Number.isFinite(envSize) && envSize > 0) {
    return Math.floor(envSize);
  }
  const cpuCount = cpus().length;
  return Math.max(1, Math.min(4, cpuCount - 1));
}

export class OxcWorkerPool implements OxcParsePool {
  private readonly workers: WorkerSlot[] = [];
  private readonly queue: QueueEntry[] = [];
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private disposed = false;

  constructor(scriptPath: string, size: number) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(scriptPath);
      const slot: WorkerSlot = { worker, busy: false };
      worker.on('message', (msg: WorkerResponse) => this.handleMessage(slot, msg));
      worker.on('error', (error) => this.handleWorkerError(slot, error));
      worker.on('exit', (code) => {
        if (!this.disposed && code !== 0) {
          logger.debug(`oxc-worker exited unexpectedly with code ${code}`);
        }
      });
      // Release the event loop's grip so a spawned-but-idle pool never blocks shutdown.
      worker.unref();
      this.workers.push(slot);
    }
  }

  parse(filePath: string, source: string): Promise<ImportEdge[]> {
    if (this.disposed) {
      return Promise.reject(new ChangeDetectionFailureError('oxc parse pool disposed'));
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
      this.pending.set(id, { resolve: task.resolve, reject: task.reject });
      slot.worker.postMessage({ id, filePath: task.filePath, source: task.source });
    }
  }

  private handleMessage(slot: WorkerSlot, msg: WorkerResponse): void {
    const entry = this.pending.get(msg.id);
    if (!entry) {
      return;
    }
    this.pending.delete(msg.id);
    slot.busy = false;
    if (msg.ok && msg.edges) {
      entry.resolve(msg.edges);
    } else {
      const err = new ChangeDetectionFailureError(msg.message ?? 'oxc-worker error');
      if (msg.name) {
        err.name = msg.name;
      }
      entry.reject(err);
    }
    this.drain();
  }

  private handleWorkerError(slot: WorkerSlot, error: Error): void {
    // A worker crash is unrecoverable for the in-flight task; reject it and keep the slot
    // busy=false so subsequent tasks either retry via the pool or fall back to inline.
    logger.debug(`oxc-worker error: ${error.message}`);
    slot.busy = false;
    // Reject every pending entry belonging to this worker. We cannot map pending->worker
    // precisely, so we reject ALL pending as a conservative fallback; callers should
    // retry inline. This only fires on catastrophic worker crashes.
    for (const [id, pending] of this.pending.entries()) {
      pending.reject(new ChangeDetectionFailureError(`oxc-worker crashed: ${error.message}`));
      this.pending.delete(id);
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const terminations = this.workers.map((s) => s.worker.terminate().catch(() => 0));
    await Promise.all(terminations);
    for (const pending of this.pending.values()) {
      pending.reject(new ChangeDetectionFailureError('oxc parse pool disposed'));
    }
    this.pending.clear();
    this.queue.length = 0;
  }
}

let sharedPool: OxcParsePool | null = null;
let initialized = false;

/**
 * Returns the shared pool if workers are enabled AND the compiled worker script exists on
 * disk. Otherwise returns null; callers should fall back to inline {@link oxcParse}.
 * Lazy init means the first file to be parsed pays the spin-up cost; subsequent parses
 * reuse the same workers.
 */
export function getOxcParsePool(): OxcParsePool | null {
  if (initialized) {
    return sharedPool;
  }
  initialized = true;

  if (process.env.STORYBOOK_CHANGE_DETECTION_NO_WORKER) {
    return null;
  }
  const scriptPath = resolveWorkerScriptPath();
  if (!scriptPath) {
    logger.debug(
      'oxc worker pool disabled: compiled worker script not found (running from source?)'
    );
    return null;
  }
  try {
    sharedPool = new OxcWorkerPool(scriptPath, computePoolSize());
  } catch (error) {
    logger.debug(
      `oxc worker pool disabled: failed to spawn (${error instanceof Error ? error.message : String(error)})`
    );
    sharedPool = null;
  }
  return sharedPool;
}

export async function disposeOxcParsePool(): Promise<void> {
  const pool = sharedPool;
  sharedPool = null;
  initialized = false;
  if (pool) {
    await pool.dispose();
  }
}
