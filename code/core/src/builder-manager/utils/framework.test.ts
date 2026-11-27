import type { CoreConfig, Options } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import { buildFrameworkGlobalsFromOptions } from './framework.ts';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  getFrameworkName: vi.fn(() => '@storybook/react-vite'),
}));

describe('buildFrameworkGlobalsFromOptions', () => {
  it.each([
    {
      name: 'includes a configured channel path',
      input: { wsToken: 't', wsPath: '/_nuxt/storybook-server-channel' },
      expected: '/_nuxt/storybook-server-channel',
    },
    {
      name: 'omits the channel path when unset',
      input: { wsToken: 't' },
      expected: undefined,
    },
  ])('$name', async ({ input, expected }) => {
    const options = {
      configType: 'DEVELOPMENT',
      presets: {
        apply: vi.fn(async (name: string): Promise<CoreConfig | undefined> =>
          name === 'core'
            ? { builder: '@storybook/builder-vite', channelOptions: input }
            : undefined
        ),
      },
    } as unknown as Options;

    const globals = await buildFrameworkGlobalsFromOptions(options);

    if (expected) {
      expect(globals.CHANNEL_OPTIONS).toMatchInlineSnapshot(`
        {
          "wsPath": "/_nuxt/storybook-server-channel",
          "wsToken": "t",
        }
      `);
    } else {
      expect(globals.CHANNEL_OPTIONS).toMatchInlineSnapshot(`
        {
          "wsToken": "t",
        }
      `);
    }
    expect('wsPath' in globals.CHANNEL_OPTIONS).toBe(expected !== undefined);
  });
});
