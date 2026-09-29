import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReactDocgenPool } from './react-docgen-pool.ts';
import { transformWithReactDocgen } from './react-docgen-transform.ts';
import { reactDocgen } from './react-docgen.ts';

type FakeWorker = import('node:events').EventEmitter & {
  posted: { taskId: number }[];
  postMessage(message: { taskId: number }): void;
};

type DocgenPlugin = {
  configResolved(config: { command: string }): void;
  transform(src: string, id: string): Promise<unknown>;
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
const component = `
import React from 'react';

/** A button */
export const Button = ({ label }: { label: string }) => <button>{label}</button>;
`;

async function createBuildPlugin() {
  const plugin = (await reactDocgen()) as unknown as DocgenPlugin;
  plugin.configResolved({ command: 'build' });
  return plugin;
}

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

  it('rejects transforms that are still in flight when it closes', async () => {
    const pool = new ReactDocgenPool(1);
    const pending = pool.transform('export {}', id, undefined);

    await pool.close();

    await expect(pending).rejects.toThrow('react-docgen pool closed before the transform finished');
    await expect(pool.transform('export {}', id, undefined)).rejects.toThrow(
      'react-docgen pool is closed'
    );
  });

  it('reports a failed pool once a worker crashes', async () => {
    const pool = new ReactDocgenPool(1);
    expect(pool.failed).toBe(false);

    fake.workers[0].emit('error', new Error('worker crashed'));

    expect(pool.failed).toBe(true);
    await expect(pool.transform('export {}', id, undefined)).rejects.toThrow('worker crashed');
  });
});

describe('reactDocgen plugin in a build', () => {
  it('parses on the main thread when the workers fail after starting', async () => {
    fake.onCreate = (worker) => {
      queueMicrotask(() => worker.emit('error', new Error("Cannot find module 'react-docgen'")));
    };
    const plugin = await createBuildPlugin();

    await expect(plugin.transform(component, id)).resolves.toEqual(
      transformWithReactDocgen(component, id, undefined)
    );
  });

  it('keeps failing the transform for a react-docgen error from a working worker', async () => {
    fake.onCreate = (worker) => {
      worker.postMessage = ({ taskId }) => {
        queueMicrotask(() =>
          worker.emit('message', {
            taskId,
            error: { name: 'SyntaxError', message: 'Unexpected token (3:1)' },
          })
        );
      };
    };
    const plugin = await createBuildPlugin();

    await expect(plugin.transform(component, id)).rejects.toThrow('Unexpected token (3:1)');
  });
});
