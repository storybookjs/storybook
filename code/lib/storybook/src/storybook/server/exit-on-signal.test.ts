import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exitOnDevServerSignal } from './exit-on-signal.ts';

vi.mock('@storybook/core/internal/telemetry', () => ({
  isTelemetryModuleEnabled: () => false,
  telemetry: vi.fn(),
}));

const SIGNALS = new EventEmitter();
const EXIT = vi.fn();

beforeEach(() => {
  vi.stubGlobal('process', {
    ...process,
    on: SIGNALS.on.bind(SIGNALS),
    removeListener: SIGNALS.removeListener.bind(SIGNALS),
    exit: EXIT,
  });
});

afterEach(() => {
  SIGNALS.removeAllListeners();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('exitOnDevServerSignal', () => {
  it.each([
    {
      name: 'removes its listeners when disposed before a signal',
      input: { signalBeforeDispose: false },
      expected: { listeners: { SIGINT: 0, SIGTERM: 0 }, closeCalls: 0, exitCalls: [] },
    },
    {
      name: 'keeps its listeners when disposed during shutdown',
      input: { signalBeforeDispose: true },
      expected: { listeners: { SIGINT: 1, SIGTERM: 1 }, closeCalls: 1, exitCalls: [] },
    },
  ])('$name', ({ input, expected }) => {
    const close = vi.fn(() => new Promise<void>(() => {}));
    const dispose = exitOnDevServerSignal({ storybook: {} as never, close });

    if (input.signalBeforeDispose) {
      SIGNALS.emit('SIGINT');
    }
    dispose();

    expect({
      listeners: {
        SIGINT: SIGNALS.listenerCount('SIGINT'),
        SIGTERM: SIGNALS.listenerCount('SIGTERM'),
      },
      closeCalls: close.mock.calls.length,
      exitCalls: EXIT.mock.calls,
    }).toEqual(expected);
  });
});
