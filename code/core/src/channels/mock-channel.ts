import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { clearChannel, setChannel } from './channel-slot.ts';
import { Channel } from './main.ts';
import type { ChannelEvent } from './types.ts';

/** In-process channel with no transport — the default for unit tests and manager story mocks. */
export function mockChannel(): Channel {
  return new Channel({
    transport: { setHandler: () => {}, send: () => {} },
  });
}

export type TestChannel = Channel & {
  /**
   * Deliver an event to current listeners as if from an external peer, without going through the
   * spied `emit` (so `emit.mock.calls` only reflects this runtime's own broadcasts).
   */
  emitExternal(eventName: string, ...args: unknown[]): void;
};

export type SpiedTestChannel = TestChannel & {
  on: Mock<Channel['on']>;
  off: Mock<Channel['off']>;
  emit: Mock<Channel['emit']>;
};

/**
 * {@link mockChannel} plus spied `on` / `off` / `emit` and {@link TestChannel.emitExternal} for tests
 * that assert on channel wiring while simulating peer traffic.
 */
export function createTestChannel(): SpiedTestChannel {
  const channel = mockChannel();
  const on = vi.spyOn(channel, 'on');
  const off = vi.spyOn(channel, 'off');
  const emit = vi.spyOn(channel, 'emit');

  const emitExternal = (eventName: string, ...args: unknown[]) => {
    const event: ChannelEvent = { type: eventName, from: '__test_external__', args };
    const listeners = channel.listeners(eventName);

    if (listeners) {
      listeners.forEach((listener) => listener.apply(event, args));
    }
  };

  return Object.assign(channel, { on, off, emit, emitExternal }) as SpiedTestChannel;
}

export function installTestChannel(channel: SpiedTestChannel | null): void {
  if (channel === null) {
    clearChannel();
  } else {
    setChannel(channel);
  }
}
