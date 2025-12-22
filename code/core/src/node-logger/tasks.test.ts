import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import { executeTaskWithSpinner } from './tasks';

// Create a minimal fake ExecaChildProcess
const makeChild = (onStart?: (cp: Partial<ExecaChildProcess>) => void): ExecaChildProcess => {
  const listeners: Record<string, Function[]> = {};
  const stdout = {
    on: vi.fn((event: string, cb: (data: Buffer) => void) => {
      listeners[event] ||= [];
      listeners[event].push(cb);
    }),
  } as any;

  const cp: Partial<ExecaChildProcess> = {
    stdout: stdout as any,
    then: undefined as any,
    catch: undefined as any,
    finally: undefined as any,
  };

  const promise = Promise.resolve() as any;
  Object.setPrototypeOf(cp, promise);
  (cp as any).then = promise.then.bind(promise);
  (cp as any).catch = promise.catch.bind(promise);
  (cp as any).finally = promise.finally.bind(promise);

  onStart?.(cp);
  return cp as ExecaChildProcess;
};

describe('executeTaskWithSpinner', () => {
  it('returns "aborted" when the child process rejects with an abort error', async () => {
    const outcome = await executeTaskWithSpinner(() => makeChild(), {
      id: 'test',
      intro: 'Intro',
      error: 'Error',
      success: 'Success',
      abortable: true,
    });

    // Non-abort path returns undefined
    expect(outcome).toBeUndefined();

    // Simulate an aborted child process by rejecting with an abort-like error message
    const outcome2 = await executeTaskWithSpinner(
      () => {
        const err = new Error('The operation was aborted');
        const p = Promise.reject(err);
        // Avoid unhandled rejection warnings
        p.catch(() => {});
        const cp: any = makeChild();
        // Make the thenable reject
        const rejected = p as any;
        Object.setPrototypeOf(cp, rejected);
        cp.then = rejected.then.bind(rejected);
        cp.catch = rejected.catch.bind(rejected);
        cp.finally = rejected.finally.bind(rejected);
        return cp;
      },
      {
        id: 'test2',
        intro: 'Intro',
        error: 'Error',
        success: 'Success',
        abortable: true,
      }
    );

    expect(outcome2).toBe('aborted');
  });
});
