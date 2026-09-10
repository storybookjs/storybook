import { Channel } from 'storybook/internal/channels';
import type { Presets } from 'storybook/internal/types';

import { build as viteBuild } from 'vite';
import { expect, it, vi } from 'vitest';

import { build } from './build.ts';

vi.mock(import('vite'), async (importOriginal) => ({
  ...(await importOriginal()),
  build: vi.fn(async () => []),
  loadConfigFromFile: vi.fn(async () => null),
}));

it('keeps Vite from copying the public dir, which Storybook copies through staticDirs', async () => {
  await build({
    configType: 'PRODUCTION',
    configDir: '',
    channel: new Channel({}),
    presets: {
      apply: async (key: string, config: unknown) =>
        ({ core: { builder: {} }, viteFinal: config })[key],
    } as Presets,
  });

  expect(viteBuild).toHaveBeenCalledWith(
    expect.objectContaining({
      build: expect.objectContaining({
        copyPublicDir: false,
      }),
    })
  );
});
