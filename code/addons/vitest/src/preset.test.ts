import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearToolsetRegistry, getToolset } from 'storybook/open-service';
import type { Options } from 'storybook/internal/types';

import { TRIGGER_TEST_RUN_REQUEST } from './constants.ts';
import { services } from './preset.ts';

function makeOptions({ core }: { core?: unknown } = {}): Options {
  return {
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    presets: {
      apply: async (key: string, fallback?: unknown) => {
        switch (key) {
          case 'storyIndexGenerator':
            return { getIndex: async () => ({ v: 5, entries: {} }) };
          case 'core':
            return core ?? fallback;
          default:
            return fallback;
        }
      },
    },
  } as unknown as Options;
}

describe('services preset hook', () => {
  beforeEach(() => {
    clearToolsetRegistry();
  });

  // Consumers resolve the `test` toolset for its descriptions and schemas alone, without a dev
  // server: `storybook ai` metadata generation applies `services` but never starts one, and a
  // non-Vite dev server returns from `experimental_serverChannel` before it could register. Both
  // used to hit an unregistered toolset and fail hard.
  it('registers the test toolset without a server channel', async () => {
    await services(undefined, makeOptions());

    expect(getToolset('test').methods.run.description).toBeDefined();
  });

  // The offering and answering surfaces must not drift apart: the same hook that registers the
  // toolset wires the responder that answers its requests, which is what lets `storybook tools
  // test run` work without a dev server.
  it('wires the test-run responder next to the registration for Vite projects', async () => {
    const options = makeOptions({ core: { builder: '@storybook/builder-vite' } });

    await services(undefined, options);

    expect(options.channel.on).toHaveBeenCalledWith(TRIGGER_TEST_RUN_REQUEST, expect.any(Function));
  });
});
