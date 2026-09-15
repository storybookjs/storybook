import { expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { buildFrameworkGlobalsFromOptions } from './framework.ts';

const createOptions = (configType: Options['configType'], core: Record<string, any> = {}) =>
  ({
    configType,
    presets: {
      apply: async (key: string) => {
        if (key === 'core') {
          return core;
        }

        return key === 'framework' ? '@storybook/react-vite' : undefined;
      },
    },
  }) as unknown as Options;

it('forwards configured channel options and the dev server token to the manager', async () => {
  const globals = await buildFrameworkGlobalsFromOptions(
    createOptions('DEVELOPMENT', {
      builder: '@storybook/builder-vite',
      channelOptions: { maxDepth: 999, allowFunction: false, wsToken: 'ws-token' },
    })
  );

  expect(globals.CHANNEL_OPTIONS).toEqual({
    maxDepth: 999,
    allowFunction: false,
    wsToken: 'ws-token',
  });
});

it('forwards configured channel options to static builds, without the token', async () => {
  const globals = await buildFrameworkGlobalsFromOptions(
    createOptions('PRODUCTION', {
      builder: '@storybook/builder-vite',
      channelOptions: { maxDepth: 999, wsToken: 'ws-token' },
    })
  );

  expect(globals.CHANNEL_OPTIONS).toEqual({ maxDepth: 999 });
});

it('defaults to empty channel options when none are configured', async () => {
  const globals = await buildFrameworkGlobalsFromOptions(createOptions('PRODUCTION'));

  expect(globals.CHANNEL_OPTIONS).toEqual({});
});
