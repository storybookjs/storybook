import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearToolsetRegistry, getToolset } from 'storybook/open-service';
import type { Channel } from 'storybook/internal/channels';

import { TRIGGER_TEST_RUN_REQUEST } from '../constants.ts';
import type { TestRunnerHost } from './host.ts';
import { registerTestServices } from './services.ts';

function makeStorybook({ core }: { core?: unknown } = {}): TestRunnerHost & { channel: Channel } {
  return {
    configDir: '.storybook',
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown as Channel,
    getStoryIndexGenerator: async () => ({ getIndex: async () => ({ v: 5, entries: {} }) }),
    callHook: async (name: string, value?: unknown) =>
      name === 'core:config:extend' ? (core ?? value) : value,
  } as unknown as TestRunnerHost & { channel: Channel };
}

describe('registerTestServices', () => {
  beforeEach(() => {
    clearToolsetRegistry();
  });

  it.each([
    { a11yEnabled: true, expected: expect.stringContaining('accessibility') },
    { a11yEnabled: false, expected: expect.not.stringContaining('accessibility') },
  ])('describes a11y checks when a11y is $a11yEnabled', async ({ a11yEnabled, expected }) => {
    await registerTestServices(makeStorybook(), a11yEnabled);

    expect(getToolset('test').methods.run.description).toEqual(expected);
  });

  // `storybook tools` and non-Vite dev servers never reach the server channel hook.
  it('registers the test toolset without a server channel', async () => {
    await registerTestServices(makeStorybook(), false);

    expect(getToolset('test').methods.run.description).toBeDefined();
  });

  // The hook that offers the toolset also answers its requests, so it works without a dev server.
  it('wires the test-run responder next to the registration for Vite projects', async () => {
    const storybook = makeStorybook({ core: { builder: '@storybook/builder-vite' } });

    await registerTestServices(storybook, false);

    expect(storybook.channel.on).toHaveBeenCalledWith(
      TRIGGER_TEST_RUN_REQUEST,
      expect.any(Function)
    );
  });
});
