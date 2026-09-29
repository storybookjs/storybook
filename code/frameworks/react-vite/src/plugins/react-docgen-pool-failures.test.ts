import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReactDocgenPool } from './react-docgen-pool.ts';

type FakeWorker = import('node:events').EventEmitter & {
  posted: { taskId: number }[];
};

const fake = vi.hoisted(() => ({
  workers: [] as FakeWorker[],
  onCreate: (_worker: FakeWorker) => {},
}));

vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  class Worker extends EventEmitter {
    posted: { taskId: number }[] = [];
    constructor() {
      super();
      fake.workers.push(this);
      fake.onCreate(this);
    }
    postMessage(message: { taskId: number }) {
      this.posted.push(message);
    }
    ref() {}
    unref() {}
    terminate() {
      this.emit('exit', 1);
      return Promise.resolve(1);
    }
  }
  return { Worker };
});

const id = '/project/src/Button.tsx';

beforeEach(() => {
  fake.workers.length = 0;
  fake.onCreate = () => {};
});

describe('ReactDocgenPool failures', () => {
  it('ignores a reply for a task that a failed worker already rejected', async () => {
    const pool = new ReactDocgenPool(2);
    const first = pool.transform('export {}', id, undefined);
    const second = pool.transform('export {}', id, undefined);
    const [failing, surviving] = fake.workers;

    const crash = new Error('worker crashed');
    failing.emit('error', crash);

    await expect(first).rejects.toBe(crash);
    await expect(second).rejects.toBe(crash);
    expect(() =>
      surviving.emit('message', { taskId: surviving.posted[0].taskId, result: undefined })
    ).not.toThrow();
  });
});
