import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import type { TsconfigPathsConfig, transformWithReactDocgen } from './react-docgen-transform.ts';

type TransformResult = ReturnType<typeof transformWithReactDocgen>;

export type ReactDocgenWorkerRequest = {
  taskId: number;
  src: string;
  id: string;
  tsconfigPaths: TsconfigPathsConfig | undefined;
};

export type ReactDocgenWorkerResponse = {
  taskId: number;
  result?: TransformResult;
  error?: { message: string; [key: string]: unknown };
};

type Task = { resolve: (result: TransformResult) => void; reject: (error: unknown) => void };
type Slot = { worker: Worker; tasks: Map<number, Task> };

// Resolved through the export map, not a dist-relative path, so strict layouts like pnpm's work.
const WORKER_SPECIFIER = '@storybook/react-vite/internal/react-docgen-worker';

// Runs react-docgen on worker threads, so a production build parses components in parallel.
export class ReactDocgenPool {
  readonly #slots: Slot[] = [];
  #nextTaskId = 0;
  #failure: unknown;
  #closed = false;

  constructor(size = Math.max(1, Math.min(4, availableParallelism() - 1))) {
    const scriptPath = fileURLToPath(import.meta.resolve(WORKER_SPECIFIER));
    for (let i = 0; i < size; i++) {
      const slot: Slot = { worker: new Worker(scriptPath), tasks: new Map() };
      // Only a worker with tasks in flight holds the event loop open.
      slot.worker.unref();
      slot.worker.on('message', ({ taskId, result, error }: ReactDocgenWorkerResponse) => {
        const task = slot.tasks.get(taskId)!;
        slot.tasks.delete(taskId);
        if (slot.tasks.size === 0) {
          slot.worker.unref();
        }
        if (error) {
          task.reject(Object.assign(new Error(error.message), error));
        } else {
          task.resolve(result);
        }
      });
      slot.worker.on('error', (error) => this.#fail(error));
      slot.worker.on('exit', (code) => {
        if (code !== 0 && !this.#closed) {
          this.#fail(new Error(`react-docgen worker exited with code ${code}`));
        }
      });
      this.#slots.push(slot);
    }
  }

  transform(src: string, id: string, tsconfigPaths: TsconfigPathsConfig | undefined) {
    if (this.#failure) {
      return Promise.reject(this.#failure);
    }
    const slot = this.#slots.reduce((least, candidate) =>
      candidate.tasks.size < least.tasks.size ? candidate : least
    );
    const taskId = this.#nextTaskId++;
    if (slot.tasks.size === 0) {
      slot.worker.ref();
    }
    return new Promise<TransformResult>((resolve, reject) => {
      slot.tasks.set(taskId, { resolve, reject });
      slot.worker.postMessage({
        taskId,
        src,
        id,
        tsconfigPaths,
      } satisfies ReactDocgenWorkerRequest);
    });
  }

  async close() {
    this.#closed = true;
    await Promise.all(this.#slots.map(({ worker }) => worker.terminate()));
  }

  #fail(error: unknown) {
    this.#failure ??= error;
    for (const slot of this.#slots) {
      for (const task of slot.tasks.values()) {
        task.reject(error);
      }
      slot.tasks.clear();
      slot.worker.unref();
    }
  }
}
