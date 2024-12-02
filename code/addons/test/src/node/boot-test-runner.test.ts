import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel, type ChannelTransport } from '@storybook/core/channels';

import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_PROGRESS_REPORT,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
} from '@storybook/core/core-events';

// eslint-disable-next-line depend/ban-dependencies
import { execaNode } from 'execa';

import { log } from '../logger';
import { killTestRunner, runTestRunner } from './boot-test-runner';

let stdout: (chunk: any) => void;
let stderr: (chunk: any) => void;
let message: (event: any) => void;

const child = vi.hoisted(() => ({
  stdout: {
    on: vi.fn((event, callback) => {
      stdout = callback;
    }),
  },
  stderr: {
    on: vi.fn((event, callback) => {
      stderr = callback;
    }),
  },
  on: vi.fn((event, callback) => {
    message = callback;
  }),
  send: vi.fn(),
  kill: vi.fn(),
}));

vi.mock('execa', () => ({
  execaNode: vi.fn().mockReturnValue(child),
}));

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  killTestRunner();
});

afterEach(() => {
  vi.useRealTimers();
});

const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
const mockChannel = new Channel({ transport });

describe('bootTestRunner', () => {
  it('should execute vitest.js', async () => {
    runTestRunner(mockChannel);
    expect(execaNode).toHaveBeenCalledWith(expect.stringMatching(/vitest\.mjs$/));
  });

  it('should log stdout and stderr', async () => {
    runTestRunner(mockChannel);
    stdout('foo');
    stderr('bar');
    expect(log).toHaveBeenCalledWith('foo');
    expect(log).toHaveBeenCalledWith('bar');
  });

  it('should wait for vitest to be ready', async () => {
    let ready;
    const promise = runTestRunner(mockChannel).then(() => {
      ready = true;
    });
    expect(ready).toBeUndefined();
    message({ type: 'ready' });
    await expect(promise).resolves.toBeUndefined();
    expect(ready).toBe(true);
  });

  it('should abort if vitest doesn’t become ready in time', async () => {
    const promise = runTestRunner(mockChannel);
    vi.advanceTimersByTime(30001);
    await expect(promise).rejects.toThrow();
  });

  it('should forward channel events', async () => {
    runTestRunner(mockChannel);
    message({ type: 'ready' });

    message({ type: TESTING_MODULE_PROGRESS_REPORT, args: ['foo'] });
    expect(mockChannel.last(TESTING_MODULE_PROGRESS_REPORT)).toEqual(['foo']);

    mockChannel.emit(TESTING_MODULE_RUN_REQUEST, 'foo');
    expect(child.send).toHaveBeenCalledWith({
      args: ['foo'],
      from: 'server',
      type: TESTING_MODULE_RUN_REQUEST,
    });

    mockChannel.emit(TESTING_MODULE_WATCH_MODE_REQUEST, 'baz');
    expect(child.send).toHaveBeenCalledWith({
      args: ['baz'],
      from: 'server',
      type: TESTING_MODULE_WATCH_MODE_REQUEST,
    });

    mockChannel.emit(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, 'qux');
    expect(child.send).toHaveBeenCalledWith({
      args: ['qux'],
      from: 'server',
      type: TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
    });
  });

  it('should resend init event', async () => {
    runTestRunner(mockChannel, 'init', ['foo']);
    message({ type: 'ready' });
    expect(child.send).toHaveBeenCalledWith({
      args: ['foo'],
      from: 'server',
      type: 'init',
    });
  });
});
