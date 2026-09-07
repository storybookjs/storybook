import { Channel } from './main.ts';

/** In-process channel with no transport — the default for unit tests and manager story mocks. */
export function mockChannel(): Channel {
  return new Channel({
    transport: { setHandler: () => {}, send: () => {} },
  });
}
