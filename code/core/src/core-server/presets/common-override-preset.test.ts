import { expect, it, vi } from 'vitest';

import type { CoreConfig, Options } from 'storybook/internal/types';

import { core as coreOverridePreset } from './common-override-preset.ts';
import { core as coreCommonPreset } from './common-preset.ts';
import { getWsToken } from './wsToken.ts';

// common-preset.ts resolves these at import time; neither is used by its `core` preset.
vi.mock('../utils/constants', () => ({
  defaultStaticDirs: [],
  defaultFavicon: '',
}));

vi.mock('../../shared/utils/module', () => ({
  resolvePackageDir: vi.fn().mockReturnValue('mocked-path'),
}));

const createOptions = (configType: Options['configType']) => ({ configType }) as unknown as Options;

/**
 * `applyPresets` shallow merges a plain object exported by a preset over the accumulated value
 * (see `code/core/src/common/presets.ts`), so a `core` object in the user's main.ts replaces
 * `core.channelOptions` wholesale. This applies both `core` presets in the order the preset
 * loader uses them, with the user config in between.
 */
const resolveCore = async (userCore: CoreConfig, options: Options) => {
  const fromCommonPreset = await coreCommonPreset({} as CoreConfig, options);

  return coreOverridePreset({ ...fromCommonPreset, ...userCore }, options);
};

it('keeps the user channel options and the dev server token together in development', async () => {
  const core = await resolveCore(
    { channelOptions: { maxDepth: 100 } },
    createOptions('DEVELOPMENT')
  );

  expect(core.channelOptions).toStrictEqual({ maxDepth: 100, wsToken: getWsToken() });
});

it('keeps the user channel options without a dev server token in a static build', async () => {
  const core = await resolveCore(
    { channelOptions: { maxDepth: 100 } },
    createOptions('PRODUCTION')
  );

  expect(core.channelOptions).toStrictEqual({ maxDepth: 100 });
});

it('drops a dev server token that came in through the user config in a static build', async () => {
  const core = await resolveCore(
    { channelOptions: { maxDepth: 100, wsToken: 'stale' } },
    createOptions('PRODUCTION')
  );

  expect(core.channelOptions).toStrictEqual({ maxDepth: 100 });
});
