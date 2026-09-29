import { describe, expect, it } from 'vitest';

import { SERVICE_ENTRY } from '../service-channel.ts';
import { VirtualNetwork } from './network.ts';

describe('VirtualNetwork time', () => {
  it('does not move now backward when delivering a released earlier frame', () => {
    const network = new VirtualNetwork(
      ['a', 'b', 'c'],
      [
        ['a', 'b'],
        ['b', 'c'],
      ]
    );
    network.hold('a', 'b');
    network.channel('a').emit(SERVICE_ENTRY, { n: 1 });
    network.setDelay('b', 'c', 50);
    network.channel('b').emit(SERVICE_ENTRY, { n: 2 });
    network.drain();

    network.release('a', 'b');
    network.setDelay('b', 'c', 0);
    network.channel('b').emit(SERVICE_ENTRY, { n: 3 });
    network.drainDue();

    expect(
      network.frames.some(
        (frame) =>
          frame.from === 'b' && frame.to === 'c' && (frame.payload as { n: number }).n === 3
      )
    ).toBe(true);
  });
});
