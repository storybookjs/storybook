import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDevStandalone, withTelemetry } from 'storybook/internal/server';

import { isTelemetryModuleEnabled, telemetry } from '@storybook/core/internal/telemetry';
import { dev } from './dev.ts';

vi.mock('@storybook/core/internal/common', () => ({ cache: {} }));
vi.mock('@storybook/core/internal/node-logger', () => ({ logger: {}, instance: {} }));
vi.mock('storybook/internal/server', async () => ({
  buildDevStandalone: vi.fn(),
  exitOnDevServerSignal: (await import('../server/exit-on-signal.ts')).exitOnDevServerSignal,
  withTelemetry: vi.fn((_event, _options, run) => run()),
}));
vi.mock('@storybook/core/internal/telemetry', () => ({
  isTelemetryModuleEnabled: vi.fn(),
  telemetry: vi.fn(),
}));
vi.mock('@storybook/core/internal/deep/story-index/summarizeIndex', () => ({
  summarizeIndex: () => ({ storyCount: 1 }),
}));

const SIGNALS = new EventEmitter();
const EXIT = vi.fn();
const CLOSE = vi.fn();
const GET_INDEX = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('process', {
    ...process,
    env: { ...process.env },
    on: SIGNALS.on.bind(SIGNALS),
    once: SIGNALS.once.bind(SIGNALS),
    removeListener: SIGNALS.removeListener.bind(SIGNALS),
    exit: EXIT,
  });
  CLOSE.mockResolvedValue(undefined);
  GET_INDEX.mockResolvedValue({ storyIndex: { v: 5, entries: {} }, stats: { total: 1 } });
  vi.mocked(telemetry).mockResolvedValue(undefined);
  vi.mocked(buildDevStandalone).mockResolvedValue({
    port: 6007,
    address: 'http://localhost:6007/',
    networkAddress: 'http://localhost:6007/',
    close: CLOSE,
    storybook: { getStoryIndexGenerator: async () => ({ getIndexAndStats: GET_INDEX }) } as never,
  });
});

afterEach(() => {
  SIGNALS.removeAllListeners();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dev signal handling', () => {
  it.each([
    { signal: 'SIGINT', enabled: false },
    { signal: 'SIGINT', enabled: true },
    { signal: 'SIGTERM', enabled: false },
    { signal: 'SIGTERM', enabled: true },
  ])('closes once and exits 0 on $signal (telemetry: $enabled)', async ({ signal, enabled }) => {
    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(enabled);
    await dev({});

    // signal-exit re-sends the signal if only its own listener remains during dispatch.
    SIGNALS.on(signal, () => {
      if (SIGNALS.listenerCount(signal) === 1) {
        EXIT(signal === 'SIGINT' ? 130 : 143);
      }
    });
    SIGNALS.emit(signal);
    await vi.advanceTimersByTimeAsync(0);

    expect(buildDevStandalone).toHaveBeenCalledOnce();
    expect(CLOSE).toHaveBeenCalledOnce();
    expect(EXIT.mock.calls).toEqual([[0]]);
    if (enabled) {
      expect(telemetry).toHaveBeenCalledExactlyOnceWith(
        'canceled',
        { eventType: 'dev', storyIndex: { storyCount: 1 }, storyStats: { total: 1 } },
        { immediate: true }
      );
    } else {
      expect(telemetry).not.toHaveBeenCalled();
    }
  });

  it('still sends cancellation telemetry when the story index fails', async () => {
    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(true);
    GET_INDEX.mockRejectedValue(new Error('index unavailable'));
    await dev({});

    SIGNALS.emit('SIGINT');
    await vi.advanceTimersByTimeAsync(0);

    expect(telemetry).toHaveBeenCalledExactlyOnceWith(
      'canceled',
      { eventType: 'dev' },
      { immediate: true }
    );
    expect(CLOSE).toHaveBeenCalledOnce();
    expect(EXIT.mock.calls).toEqual([[0]]);
  });

  it.each(['telemetry', 'close'])('exits 0 when %s rejects', async (failure) => {
    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(true);
    (failure === 'telemetry' ? vi.mocked(telemetry) : CLOSE).mockRejectedValue(new Error(failure));
    await dev({});

    SIGNALS.emit('SIGINT');
    await vi.advanceTimersByTimeAsync(0);

    expect(telemetry).toHaveBeenCalledOnce();
    expect(CLOSE).toHaveBeenCalledOnce();
    expect(EXIT.mock.calls).toEqual([[0]]);
  });

  it('starts cleanup while telemetry is pending and exits within three seconds', async () => {
    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(true);
    vi.mocked(telemetry).mockReturnValue(new Promise(() => {}));
    await dev({});

    SIGNALS.emit('SIGINT');
    await vi.advanceTimersByTimeAsync(0);
    expect(CLOSE).toHaveBeenCalledOnce();
    expect(EXIT).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);
    expect(EXIT.mock.calls).toEqual([[0]]);
  });

  it.each(['SIGINT', 'SIGTERM'])(
    'exits immediately on a second %s without closing twice',
    async (signal) => {
      vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);
      CLOSE.mockReturnValue(new Promise(() => {}));
      await dev({});

      SIGNALS.emit('SIGINT');
      expect(EXIT).not.toHaveBeenCalled();
      SIGNALS.emit(signal);

      expect(EXIT.mock.calls).toEqual([[0]]);
      expect(CLOSE).toHaveBeenCalledOnce();
    }
  );

  it('returns without signal handlers when startup was canceled', async () => {
    vi.mocked(withTelemetry).mockResolvedValueOnce(undefined);
    await dev({});
    SIGNALS.emit('SIGINT');
    expect(CLOSE).not.toHaveBeenCalled();
    expect(EXIT).not.toHaveBeenCalled();
  });
});
